// dsh-remote-agent: connects this DSH to a self-hosted DSH Remote hub.
// Host integration mirrors dsh-cloudflare-tunnel 0.8.0: default-export
// apply(ctx, config), services reached lazily via ctx.inject(), webServer
// host/port read inside an effect, control route on dsh web behind
// connection.requestRejection, sidebar UI in client.js.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { HubLink, localSso, metrics } from "./link.js";
import { pickStore, newDeviceKey, loadKey, KeyStore } from "./keystore.js";
import { syncHostsFile } from "./hosts.js";
import { redact, addSecret } from "./redact.js";
import { postJSON, resolveProxy, agentFor } from "./net.js";
import { registerControlRoute } from "./route.js";
import { Config as ConfigSchema } from "./schema.js";

export const name = "dsh-remote-agent";
export { Config } from "./schema.js";
export const PREFIX = "/dsh-remote-agent";
export const VERSION = "0.1.0";
const LEGACY_HOSTS = ["dsh.cli-help.com"]; // adopted from dsh-cloudflare-tunnel (decision D8)

const here = () => { try { return dirname(fileURLToPath(import.meta.url)); } catch { return process.cwd(); } };
/** profiles/web/node_modules/dsh-remote-agent -> profiles/web */
export function profileDir() { return process.env.DSH_REMOTE_AGENT_PROFILE || join(here(), "..", ".."); }
export function dataDir() { return process.env.DSH_REMOTE_AGENT_DIR || join(profileDir(), ".dsh-remote-agent"); }
export function patchFile() { return process.env.DSH_REMOTE_AGENT_PATCH || join(profileDir(), "cordis.patch.yml"); }

interface State { hub?: string; deviceId?: string; name?: string; slug?: string; fingerprint?: string; keyStore?: string; hosts?: string[]; managedHosts?: string[]; restartNeeded?: boolean; revoked?: boolean }

function loadState(): State { try { return JSON.parse(readFileSync(join(dataDir(), "state.json"), "utf8")); } catch { return {}; } }
function saveState(s: State) { mkdirSync(dataDir(), { recursive: true, mode: 0o700 }); writeFileSync(join(dataDir(), "state.json"), JSON.stringify(s, null, 2), { mode: 0o600 }); }

function logger(ctx: any) {
  const l = ctx && ctx.logger;
  const pick = (lvl: "info" | "warn") => (msg: string) => {
    const text = `[remote-agent] ${redact(msg)}`;
    try { if (l && typeof l[lvl] === "function") return l[lvl](text); } catch {}
    (lvl === "warn" ? console.warn : console.log)(text);
  };
  return { info: pick("info"), warn: pick("warn") };
}

export function normalizeConfig(raw: any) {
  const c = raw || {};
  return {
    hub: String(c.hub || "https://remote.zhuhedong.cn").replace(/\/+$/, ""),
    instanceName: String(c.instanceName || os.hostname().replace(/\.local$/, "")),
    autoConnect: c.autoConnect !== false,
    proxy: String(c.proxy || "system"),
    manageTrustedHosts: c.manageTrustedHosts !== false,
    keyStore: c.keyStore === "file" ? "file" : "auto",
  };
}

export function apply(ctx: any, rawConfig: any) {
  const log = logger(ctx);
  const cfg = normalizeConfig(rawConfig);
  let state = loadState();
  let local: { host: string; port: number } | null = null;
  let connSvc: any = null;
  let link: HubLink | null = null;
  let store: KeyStore | null = null;
  let snap: any = null;
  const recent: { ts: number; text: string }[] = [];
  const note = (text: string) => { recent.unshift({ ts: Date.now(), text }); recent.length = Math.min(recent.length, 20); };

  const getStore = async () => (store ||= await pickStore(dataDir(), cfg.keyStore === "file" ? "file" : undefined));

  const syncHosts = (hosts: string[]) => {
    if (!cfg.manageTrustedHosts || !hosts.length) return;
    try {
      const managed = [...new Set([...(state.managedHosts || []), ...hosts])];
      const desired = [...new Set([...hosts, ...(state.managedHosts || []).filter((h) => LEGACY_HOSTS.includes(h))])];
      // adopt legacy hosts already present in the file
      try { const t = readFileSync(patchFile(), "utf8"); for (const h of LEGACY_HOSTS) if (t.includes(`'${h}'`) && !managed.includes(h)) { managed.push(h); desired.push(h); } } catch {}
      const r = syncHostsFile(patchFile(), desired, managed);
      state = { ...state, hosts, managedHosts: managed, restartNeeded: state.restartNeeded || r.changed };
      saveState(state);
      if (r.changed) { log.info(`已更新 trustedHosts（备份 ${r.backup || "无"}），需重启 DSH 生效`); note("trustedHosts 已更新，需重启 DSH"); }
      if (r.manual) log.warn(r.manual);
    } catch (e: any) { log.warn(`trustedHosts 更新失败: ${e.message}`); }
  };

  let starting: Promise<void> | null = null;
  const startLink = (): Promise<void> => (starting ??= startLinkOnce().finally(() => { starting = null; }));
  const startLinkOnce = async () => {
    if (link || !state.deviceId || !state.hub || state.revoked) return;
    const pkcs8 = await (await getStore()).load();
    if (link || state.revoked) return;
    if (!pkcs8) { log.warn("未找到设备密钥，请重新登记"); return; }
    const { priv } = loadKey(pkcs8);
    link = new HubLink({
      hub: state.hub, deviceId: state.deviceId, key: priv, proxy: cfg.proxy,
      versions: { plugin: VERSION, node: process.versions.node, os: `${process.platform}-${process.arch}` },
      local: () => local,
      sso: async (base) => {
        if (!connSvc || typeof connSvc.authenticatedUrl !== "function" || !local) throw Object.assign(new Error("sso unavailable"), { code: "unavailable" });
        const ok = state.hosts && state.hosts.some((h) => new URL(base).host === h);
        if (!ok) throw Object.assign(new Error("unexpected host"), { code: "host" });
        const r = await localSso((u) => connSvc.authenticatedUrl(u), local, base);
        note("远程登录 DSH（免二次登录）");
        return r;
      },
      status: () => { const r = metrics(snap); snap = r.snap; return { ...r.m, dshReady: Boolean(local), restartNeeded: Boolean(state.restartNeeded), plugin: VERSION }; },
      log,
    });
    link.on("welcome", (w: any) => { if (w.slug) { state = { ...state, slug: w.slug }; saveState(state); } syncHosts(link!.hosts); });
    link.on("revoked", async () => {
      log.warn("设备已在 Hub 被移除，清除本机密钥");
      note("设备已被 Hub 移除");
      try { await (await getStore()).clear(); } catch {}
      state = { ...state, revoked: true, deviceId: undefined }; saveState(state);
    });
    link.start();
  };
  const stopLink = () => { if (link) { link.stop(); link = null; } };

  const view = async () => ({
    version: VERSION, hub: state.hub || cfg.hub, name: state.name || cfg.instanceName,
    enrolled: Boolean(state.deviceId), revoked: Boolean(state.revoked), fingerprint: state.fingerprint || null,
    state: link ? link.state : (state.deviceId ? "stopped" : "not-enrolled"), lastError: link ? link.lastError : null,
    since: link ? link.since : null, rtt: link ? link.rtt : null, url: state.hosts && state.hosts[0] ? `https://${state.hosts[0]}` : null,
    keyStore: store ? store.kind : state.keyStore || null, dshReady: Boolean(local), restartNeeded: Boolean(state.restartNeeded),
    managedHosts: state.managedHosts || [], recent: recent.slice(0, 10),
  });

  const handler = async (ep: string, p: any = {}) => {
    switch (ep) {
      case "status": return view();
      case "enroll": {
        const hub = String(p.hub || cfg.hub).trim().replace(/\/+$/, "");
        if (!/^https:\/\//.test(hub) && !(process.env.DSH_REMOTE_AGENT_ALLOW_HTTP === "1" && /^http:\/\//.test(hub))) throw new Error("Hub 地址必须是 https://");
        const code = String(p.code || "").trim();
        if (!code) throw new Error("请填写登记码");
        addSecret(code);
        stopLink();
        const k = newDeviceKey();
        const proxy = await resolveProxy(cfg.proxy, hub);
        const r = await postJSON(hub + "/agent/enroll", { code, pubkey: k.pub, hostname: os.hostname(), versions: { plugin: VERSION, node: process.versions.node } }, agentFor(proxy));
        if (r.status !== 200) throw new Error("登记失败：" + (r.json && r.json.error ? r.json.error : "HTTP " + r.status));
        const st = await getStore();
        await st.save(k.pkcs8);
        state = { hub, deviceId: r.json.deviceId, name: r.json.name, slug: r.json.slug, fingerprint: r.json.fingerprint, keyStore: st.kind, managedHosts: state.managedHosts || [], restartNeeded: state.restartNeeded };
        saveState(state);
        syncHosts(r.json.hosts || []);
        note("已登记到 " + hub);
        await startLink();
        return view();
      }
      case "connect": state.revoked = false; await startLink(); link?.ensureConnected(); return view();
      case "disconnect": stopLink(); return view();
      case "forget": stopLink(); try { await (await getStore()).clear(); } catch {} state = { managedHosts: state.managedHosts, restartNeeded: state.restartNeeded }; saveState(state); return view();
      case "restart.done": state.restartNeeded = false; saveState(state); return view();
      default: throw new Error("unknown endpoint " + ep);
    }
  };

  if (typeof ctx.inject === "function") {
    try {
      ctx.inject(["webServer"], (w: any) => {
        const run = () => {
          const ws = w.webServer; const port = Number(ws && ws.port);
          if (!port) { log.warn("webServer 未提供端口"); return; }
          const h = String(ws.host || "");
          local = { host: !h || h === "0.0.0.0" || h === "::" ? "127.0.0.1" : h, port };
          return () => { local = null; };
        };
        if (typeof w.effect === "function") w.effect(run); else run();
      });
    } catch (e: any) { log.warn(`无法注入 webServer: ${e.message}`); }
    try {
      ctx.inject(["connection", "webServer"], (c: any) => {
        const run = () => { connSvc = c.connection; const d = registerControlRoute(PREFIX, c.connection, c.webServer, handler); if (!d) log.warn("无法注册控制路由"); return () => { connSvc = null; if (typeof d === "function") d(); }; };
        if (typeof c.effect === "function") c.effect(run); else run();
      });
    } catch (e: any) { log.warn(`注册控制通道失败: ${e.message}`); }
    try {
      ctx.inject(["commands"], (c: any) => {
        try {
          return c.commands.register({ name: "remote", description: "DSH Remote: status | connect | disconnect", input: { hint: "status | connect | disconnect" },
            async handler(inv: any) {
              const sub = String((inv && inv.rawInput) || "status").trim().split(/\s+/)[0] || "status";
              if (!["status", "connect", "disconnect"].includes(sub)) return { kind: "error", text: "用法: /remote status|connect|disconnect" };
              const v: any = await handler(sub, {});
              return { kind: "success", text: `Hub: ${v.hub}\n状态: ${v.state}${v.lastError ? "（" + v.lastError + "）" : ""}\n访问地址: ${v.url || "-"}${v.restartNeeded ? "\n提示: trustedHosts 已更新，需重启 DSH" : ""}` };
            } });
        } catch (e: any) { log.warn(`注册 /remote 命令失败: ${e.message}`); }
      });
    } catch {}
  }

  if (cfg.autoConnect && state.deviceId && !state.revoked) startLink().catch((e) => log.warn(`启动连接失败: ${e.message}`));
  const cleanup = () => { stopLink(); };
  process.once("exit", cleanup);
  if (typeof ctx.on === "function") { try { ctx.on("dispose", () => { process.removeListener("exit", cleanup); cleanup(); }); } catch {} }
  void ConfigSchema;
  return { handler, cleanup, _state: () => state, _link: () => link };
}

apply.inject = [] as string[];
export default apply;
