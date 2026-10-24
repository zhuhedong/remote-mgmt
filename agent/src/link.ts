// Outbound link to the hub: WSS + yamux, signed challenge auth, reconnect with
// backoff, sleep/wake detection, control-channel RPC, stream -> local service.
import { EventEmitter } from "node:events";
import net from "node:net";
import http from "node:http";
import os from "node:os";
import WebSocket from "ws";
import { MuxSession, MuxStream } from "./mux.js";
import { signMsg } from "./keystore.js";
import { redact } from "./redact.js";
import { resolveProxy, agentFor } from "./net.js";
import type { KeyObject } from "node:crypto";
import type { BridgeRouter } from "./bridge/index.js";
import { handleControlMessage } from "./bridge/index.js";

export const PROTO_TAG = "dra-v1";

export interface LinkOptions {
  hub: string; deviceId: string; key: KeyObject; versions: Record<string, string>;
  proxy?: string;
  local: () => { host: string; port: number } | null; // dsh web origin
  sso: (base: string) => Promise<string[]>;            // returns Set-Cookie headers
  status: () => Record<string, unknown>;
  /** Capability Bridge router (list / invoke / cancel on control stream). */
  bridge?: BridgeRouter;
  log: { info: (m: string) => void; warn: (m: string) => void };
  minBackoffMs?: number; maxBackoffMs?: number; statusEveryMs?: number;
}

export type LinkState = "idle" | "connecting" | "online" | "waiting" | "pending" | "revoked" | "stopped";

export class HubLink extends EventEmitter {
  state: LinkState = "idle";
  lastError: string | null = null;
  since: number | null = null;
  rtt: number | null = null;
  hosts: string[] = [];
  private ws: WebSocket | null = null;
  private mux: MuxSession | null = null;
  private ctrl: MuxStream | null = null;
  private wanted = false;
  private attempt = 0;
  private timer: NodeJS.Timeout | null = null;
  private ticks: NodeJS.Timeout[] = [];
  constructor(public o: LinkOptions) { super(); }

  private set(s: LinkState, err?: string | null) { this.state = s; if (err !== undefined) this.lastError = err; this.emit("change", s); }

  start() {
    if (this.wanted) return;
    this.wanted = true;
    let last = Date.now();
    const wake = setInterval(() => { const now = Date.now(); if (now - last > 30000 && this.wanted) { this.o.log.info("检测到休眠唤醒，立即重连"); this.reconnectNow(); } last = now; }, 5000);
    wake.unref?.(); this.ticks.push(wake);
    this.connect();
  }
  stop() {
    this.wanted = false;
    if (this.timer) clearTimeout(this.timer);
    for (const t of this.ticks) clearInterval(t); this.ticks = [];
    this.teardown();
    this.set("stopped");
  }
  /** Reconnect only if not already online or mid-dial (used by the manual "connect" button). */
  ensureConnected() { if (this.state !== "online" && this.state !== "connecting") this.reconnectNow(); }
  reconnectNow() { this.attempt = 0; if (this.timer) clearTimeout(this.timer); this.teardown(); this.connect(); }

  private teardown() {
    try { this.mux?.close(); } catch {}
    try { this.ws?.terminate(); } catch {}
    this.ws = null; this.mux = null; this.ctrl = null;
  }

  private schedule(ms?: number) {
    if (!this.wanted) return;
    const min = this.o.minBackoffMs ?? 1000, max = this.o.maxBackoffMs ?? 60000;
    const base = ms ?? Math.min(max, min * 2 ** Math.min(this.attempt, 10));
    const d = Math.round(base * (0.8 + Math.random() * 0.4));
    this.attempt++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(), d);
    this.timer.unref?.();
  }

  private gen = 0;
  private async connect() {
    if (!this.wanted) return;
    const gen = ++this.gen; // a newer connect() supersedes any dial still resolving its proxy
    this.teardown();
    this.set("connecting");
    const u = new URL("/agent/connect", this.o.hub);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    let proxy: string | null = null;
    try { proxy = await resolveProxy(this.o.proxy, this.o.hub); } catch {}
    if (gen !== this.gen || !this.wanted) return;
    const ws = new WebSocket(u, { agent: agentFor(proxy) as any, handshakeTimeout: 15000, perMessageDeflate: false, maxPayload: 8 * 1024 * 1024 });
    this.ws = ws;
    const mux = new MuxSession({ send: (b) => { if (ws.readyState === WebSocket.OPEN) ws.send(b); }, close: () => { try { ws.close(); } catch {} } });
    this.mux = mux;
    let settled = false;
    const fail = (why: string) => {
      if (this.ws !== ws) { try { mux.close(); } catch {} try { ws.terminate(); } catch {} return; }
      this.teardown();
      if (this.state === "revoked") return;
      if (!settled) this.lastError = redact(why);
      settled = true;
      this.since = null;
      this.set(this.state === "pending" ? "pending" : "waiting", this.lastError);
      this.schedule(this.state === "pending" ? 10000 : undefined);
    };
    ws.on("message", (d: Buffer, isBinary: boolean) => { if (isBinary) mux.feed(Buffer.isBuffer(d) ? d : Buffer.from(d as any)); });
    ws.on("error", (e) => fail("连接错误: " + e.message));
    ws.on("close", () => fail("连接已断开"));
    ws.on("unexpected-response", (_req, res) => fail(`Hub 返回 HTTP ${res.statusCode}`));
    mux.on("close", (e) => fail(e ? e.message : "会话关闭"));
    mux.on("stream", (s: MuxStream) => this.onStream(s));
    ws.on("open", () => this.handshake(mux).catch((e) => fail(String(e.message || e))));
  }

  private async handshake(mux: MuxSession) {
    const ctrl = mux.open();
    this.ctrl = ctrl;
    const lines = lineReader(ctrl);
    send(ctrl, { type: "hello", deviceId: this.o.deviceId, versions: this.o.versions });
    const ch = await lines.next(15000);
    if (this.mux !== mux) throw new Error("superseded");
    if (ch.type !== "challenge") throw new Error("unexpected handshake");
    const msg = `${ch.nonce}|${ch.ts}|${this.o.deviceId}|${PROTO_TAG}`;
    send(ctrl, { type: "auth", sig: signMsg(this.o.key, msg) });
    const w = await lines.next(15000);
    if (this.mux !== mux) throw new Error("superseded");
    if (w.type === "denied") {
      if (w.reason === "pending") { this.set("pending", "等待在控制台核对指纹并激活"); throw new Error("等待激活"); }
      if (w.reason === "revoked" || /unknown device/.test(String(w.reason))) { this.set("revoked", "设备已在 Hub 移除"); this.emit("revoked"); this.wanted = false; throw new Error("revoked"); }
      throw new Error("Hub 拒绝连接: " + w.reason);
    }
    if (w.type !== "welcome") throw new Error("unexpected handshake");
    this.attempt = 0;
    this.hosts = Array.isArray(w.hosts) ? w.hosts : [];
    this.since = Date.now();
    this.set("online", null);
    this.emit("welcome", w);
    this.o.log.info("已连接 Hub");
    const pushStatus = () => send(ctrl, { type: "status", ...this.o.status(), streams: mux.streamCount, rtt: this.rtt });
    pushStatus();
    const st = setInterval(pushStatus, this.o.statusEveryMs ?? 30000); st.unref?.();
    const pg = setInterval(() => { mux.ping(45000).then((r) => { this.rtt = r; }).catch(() => { this.o.log.warn("心跳超时，重连"); mux.close(new Error("ping timeout")); }); }, 20000); pg.unref?.();
    mux.once("close", () => { clearInterval(st); clearInterval(pg); });
    (async () => {
      for (;;) {
        let m: any;
        try { m = await lines.next(0); } catch { return; }
        if (m.type === "revoked") { this.set("revoked", "设备已在 Hub 移除"); this.wanted = false; this.emit("revoked"); mux.close(); return; }
        if (m.type === "sso.request") {
          this.o.sso(String(m.base)).then((setCookie) => send(ctrl, { type: "reply", id: m.id, setCookie }), (e) => send(ctrl, { type: "reply", id: m.id, error: "sso failed" + (e && e.code ? ": " + e.code : "") }));
          continue;
        }
        if (this.o.bridge && m.type && String(m.type).startsWith("capability.")) {
          const id = m.id;
          handleControlMessage(this.o.bridge, m).then((body) => {
            if (!id) return;
            if (!body) { send(ctrl, { type: "reply", id, error: "unsupported" }); return; }
            send(ctrl, { type: "reply", id, ...body });
          }, (e) => {
            if (id) send(ctrl, { type: "reply", id, error: String(e && e.message || e), code: "INTERNAL" });
          });
          continue;
        }
        if (m.id) send(ctrl, { type: "reply", id: m.id, error: "unsupported" });
      }
    })();
  }

  private onStream(s: MuxStream) {
    const lines = lineReader(s, true);
    lines.next(10000).then((pre: any) => {
      const target = pre && pre.svc === "dsh" ? this.o.local() : null;
      if (!target) { s.destroy(); return; }
      const rest = lines.rest();
      const sock = net.connect({ host: target.host, port: target.port, allowHalfOpen: true });
      sock.setNoDelay(true);
      if (rest.length) sock.write(rest);
      s.pipe(sock); sock.pipe(s);
      const kill = () => { s.destroy(); sock.destroy(); };
      sock.on("error", kill); s.on("error", kill);
      sock.on("close", () => { if (!s.destroyed) s.end(); });
    }, () => s.destroy());
  }
}

function send(s: MuxStream, m: unknown) { s.write(JSON.stringify(m) + "\n"); }

/** Reads newline-delimited JSON. With `once`, stops after the first line and keeps the remainder for raw piping. */
function lineReader(s: MuxStream, once = false) {
  let buf = Buffer.alloc(0);
  const queue: any[] = []; const waiters: { res: (v: any) => void; rej: (e: Error) => void }[] = [];
  let ended = false;
  const onData = (d: Buffer) => {
    buf = Buffer.concat([buf, d]);
    let i: number;
    while ((i = buf.indexOf(10)) >= 0) {
      const line = buf.subarray(0, i).toString("utf8"); buf = buf.subarray(i + 1);
      let m: any = null; try { m = JSON.parse(line); } catch {}
      if (waiters.length) waiters.shift()!.res(m); else queue.push(m);
      if (once) { s.off("data", onData); s.pause(); return; }
    }
    if (buf.length > 1 << 20) s.destroy();
  };
  s.on("data", onData);
  const end = () => { ended = true; while (waiters.length) waiters.shift()!.rej(new Error("closed")); };
  s.on("end", end); s.on("close", end);
  return {
    next(timeout: number): Promise<any> {
      if (queue.length) return Promise.resolve(queue.shift());
      if (ended) return Promise.reject(new Error("closed"));
      return new Promise((res, rej) => {
        const w = { res, rej }; waiters.push(w);
        if (timeout > 0) { const t = setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) waiters.splice(i, 1); rej(new Error("timeout")); }, timeout); t.unref?.(); }
      });
    },
    rest() { s.off("end", end); s.off("close", end); const r = buf; buf = Buffer.alloc(0); return r; },
  };
}

/** Run DSH's connection.authenticatedUrl locally and collect the cookies dsh web sets. The URL/token never leaves this function. */
export function localSso(authenticatedUrl: (u: URL) => unknown, local: { host: string; port: number }, base: string): Promise<string[]> {
  const pub = new URL(base);
  const u = new URL(String(authenticatedUrl(new URL("/", pub))));
  return new Promise((res, rej) => {
    const req = http.request({ host: local.host, port: local.port, path: u.pathname + u.search, method: "GET", headers: { host: pub.host, "x-forwarded-proto": pub.protocol.replace(":", ""), "x-forwarded-host": pub.host, accept: "text/html" }, timeout: 8000 }, (r) => {
      r.resume();
      const sc = r.headers["set-cookie"] || [];
      if ((r.statusCode || 0) >= 400 || !sc.length) { const e: any = new Error("no session cookie"); e.code = "status-" + r.statusCode; return rej(e); }
      res(sc);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => rej(Object.assign(new Error("local request failed"), { code: (e as any).code })));
    req.end();
  });
}

export function metrics(prev: { t: number; idle: number; total: number } | null) {
  const cpus = os.cpus();
  let idle = 0, total = 0;
  for (const c of cpus) { for (const k of Object.keys(c.times) as (keyof typeof c.times)[]) total += c.times[k]; idle += c.times.idle; }
  const cpu = prev && total > prev.total ? Math.round((1 - (idle - prev.idle) / (total - prev.total)) * 100) : null;
  return { snap: { t: Date.now(), idle, total }, m: { cpu, memUsed: Math.round((1 - os.freemem() / os.totalmem()) * 100), load: os.loadavg()[0], uptime: Math.round(os.uptime()), rss: Math.round(process.memoryUsage().rss / 1048576), platform: process.platform, arch: process.arch } };
}
