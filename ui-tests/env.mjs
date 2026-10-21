// Spin up a hub + fake DSH + real agent bundle with demo data for UI tests/screenshots.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import net from "node:net";
import crypto from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
export function totp(secret, t = Date.now()) {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = "";
  for (const c of secret.replace(/=+$/, "")) bits += alpha.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(t / 1000 / 30)));
  const h = crypto.createHmac("sha1", key).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0");
}

export async function startEnv(hubBin) {
  const work = mkdtempSync(join(tmpdir(), "rm-ui-"));
  const hubData = join(work, "hub"), patch = join(work, "cordis.patch.yml");
  writeFileSync(patch, "- id: connection\n  name: '@deepseek-ai/dsh-client-connection'\n  config:\n    trustedHosts: !!js \"[...ctx.webStartup.trustedHosts]\"\n");
  Object.assign(process.env, { DSH_REMOTE_AGENT_DIR: join(work, "agent"), DSH_REMOTE_AGENT_PATCH: patch, DSH_REMOTE_AGENT_ALLOW_HTTP: "1" });
  const PORT = await freePort(), ASK = await freePort();
  const hub = spawn(hubBin, ["-listen", `127.0.0.1:${PORT}`, "-ask-listen", `127.0.0.1:${ASK}`, "-data", hubData, "-base-host", "localhost", "-zone", "d.localhost", "-insecure", "-trust-proxy=0"], { stdio: process.env.DBG ? ["ignore", "inherit", "inherit"] : "ignore" });
  const jar = new Map();
  const req = (method, path, body, host = "localhost") => new Promise((res, rej) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const h = { host: `${host}:${PORT}`, "x-hub": "1" };
    if (data) { h["content-type"] = "application/json"; h["content-length"] = data.length; }
    if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const r = http.request({ host: "127.0.0.1", port: PORT, method, path, headers: h }, (resp) => {
      const ch = []; resp.on("data", (c) => ch.push(c));
      resp.on("end", () => { for (const sc of resp.headers["set-cookie"] || []) { const kv = sc.split(";")[0]; const i = kv.indexOf("="); const v = kv.slice(i + 1); if (v) jar.set(kv.slice(0, i), v); else jar.delete(kv.slice(0, i)); }
        let j = null; try { j = JSON.parse(Buffer.concat(ch).toString()); } catch {} res({ status: resp.statusCode, json: j, text: Buffer.concat(ch).toString(), headers: resp.headers }); });
    });
    r.on("error", rej); if (data) r.write(data); r.end();
  });
  for (let i = 0; i < 100; i++) { try { if ((await req("GET", "/healthz")).status === 200) break; } catch {} await sleep(100); }
  const env = { base: `http://localhost:${PORT}`, port: PORT, ask: ASK, hubData, req, jar, hub, work, password: "Demo-password-2026!", username: "me" };
  env.setupToken = () => readFileSync(join(hubData, "setup-token"), "utf8").trim();
  env.doSetup = async () => {
    const tok = env.setupToken();
    const b = await req("POST", "/api/auth/setup/begin", { token: tok });
    env.secret = b.json.secret;
    const f = await req("POST", "/api/auth/setup/finish", { token: tok, username: env.username, password: env.password, code: totp(env.secret) });
    if (f.status !== 200) throw new Error("setup " + f.text);
  };
  env.login = async () => {
    await req("POST", "/api/auth/login", { username: env.username, password: env.password });
    const t = await req("POST", "/api/auth/totp", { code: totp(env.secret) });
    if (t.status !== 200) throw new Error("login " + t.text);
  };
  env.devices = async () => {
    const { startFakeDsh, connectionStub } = await import(join(here, "../agent/test/fake-dsh.mjs"));
    const dsh = await startFakeDsh(patch);
    const mod = await import(join(here, "../agent/index.js"));
    const ctx = { logger: { info(...a) { if (process.env.DBG) console.log("I", ...a); }, warn(...a) { if (process.env.DBG) console.log("W", ...a); } }, inject(n, cb) { cb({ webServer: { host: "127.0.0.1", port: dsh.port, register: () => () => {} }, connection: connectionStub, commands: { register() {} } }); }, on() {} };
    const agent = mod.default(ctx, { hub: env.base, proxy: "direct" });
    const c = await req("POST", "/api/enroll-codes", { name: "MacBook-Pro" });
    const v = await agent.handler("enroll", { hub: env.base, code: c.json.code });
    let d = (await req("GET", "/api/devices")).json.find((x) => x.fingerprint === v.fingerprint);
    await req("POST", "/api/devices/activate", { id: d.id, fingerprint: d.fingerprint });
    if (!process.env.NOCONN) await agent.handler("connect");
    for (let i = 0; i < 100; i++) { if ((await agent.handler("status")).state === "online") break; await sleep(100); }
    await sleep(1200); // first status report incl. cpu needs two samples; second report not needed for mem
    // an offline (activated, never connected) device and a pending one
    const mk = async (name, activate) => {
      const cc = await req("POST", "/api/enroll-codes", { name });
      const pub = crypto.generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "der" }).subarray(12).toString("base64");
      const e = await req("POST", "/agent/enroll", { code: cc.json.code, pubkey: pub, hostname: name.toLowerCase(), versions: { plugin: "0.1.0", node: "22.11.0", os: "darwin-arm64" } });
      if (activate) await req("POST", "/api/devices/activate", { id: e.json.deviceId, fingerprint: e.json.fingerprint });
      return e.json;
    };
    await mk("office-mac", true);
    env.pending = await mk("home-mini", false);
    env.agent = agent; env.dsh = dsh;
  };
  env.stop = () => { try { env.agent?.cleanup(); } catch {} try { hub.kill(); } catch {} try { env.dsh?.srv.close(); } catch {} };
  return env;
}
