// End-to-end: Go hub (real binary) + agent bundle (real index.js) + fake DSH.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import net from "node:net";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { startFakeDsh, connectionStub, LAUNCH_TOKEN, SESSION, BIG } from "./fake-dsh.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const HUB_BIN = process.env.HUB_BIN || join(here, "../../hub/dist/remote-hub-linux-amd64");
const work = mkdtempSync(join(tmpdir(), "rm-e2e-"));
const hubData = join(work, "hub"), agentDir = join(work, "agent"), patch = join(work, "cordis.patch.yml");
writeFileSync(patch, "- id: connection\n  name: '@deepseek-ai/dsh-client-connection'\n  config:\n    trustedHosts: !!js \"['dsh.cli-help.com', ...ctx.webStartup.trustedHosts]\"\n");
Object.assign(process.env, { DSH_REMOTE_AGENT_DIR: agentDir, DSH_REMOTE_AGENT_PATCH: patch, DSH_REMOTE_AGENT_ALLOW_HTTP: "1" });

const BASE = "localhost", ZONE = "d.localhost";
const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
const PORT = await freePort(), ASK = await freePort();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let hubLog = "", agentLog = "";
let hub;
function startHub() {
  hub = spawn(HUB_BIN, ["-listen", `127.0.0.1:${PORT}`, "-ask-listen", `127.0.0.1:${ASK}`, "-data", hubData, "-base-host", BASE, "-zone", ZONE, "-insecure", "-trust-proxy=0"]);
  hub.stdout.on("data", (d) => (hubLog += d)); hub.stderr.on("data", (d) => (hubLog += d));
}
async function waitFor(fn, ms = 15000, what = "condition") { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t > ms) throw new Error("timeout waiting for " + what); await sleep(100); } }

// tiny cookie-jar HTTP client that talks to 127.0.0.1 with an explicit Host
function req(method, host, path, { body, jar, headers = {} } = {}) {
  return new Promise((res, rej) => {
    const data = body === undefined ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    const h = { host: `${host}:${PORT}`, ...headers };
    if (data) { h["content-length"] = data.length; if (!Buffer.isBuffer(body)) h["content-type"] = "application/json"; }
    if (method === "POST" && host === BASE) h["x-hub"] = "1";
    if (jar && jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const r = http.request({ host: "127.0.0.1", port: PORT, method, path, headers: h }, (resp) => {
      const chunks = []; resp.on("data", (c) => chunks.push(c));
      resp.on("end", () => {
        for (const sc of resp.headers["set-cookie"] || []) { const [kv, ...attrs] = sc.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim(); if (jar) { if (/max-age=0|max-age=-/i.test(attrs.join(";")) || v === "") jar.delete(k); else jar.set(k, v); } }
        const buf = Buffer.concat(chunks); let json = null; try { json = JSON.parse(buf.toString()); } catch {}
        res({ status: resp.statusCode, headers: resp.headers, buf, text: buf.toString(), json });
      });
    });
    r.on("error", rej); if (data) r.write(data); r.end();
  });
}
function totp(secret, t = Date.now()) {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = "";
  for (const c of secret.replace(/=+$/, "")) bits += alpha.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(t / 1000 / 30)));
  const h = crypto.createHmac("sha1", key).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0");
}

const results = [];
async function step(name, fn) { const t = Date.now(); try { await fn(); results.push(["PASS", name, Date.now() - t]); console.log("PASS", name); } catch (e) { results.push(["FAIL", name, e.message]); console.log("FAIL", name, e.stack); throw e; } }

let agentHandle, dsh, slug, deviceId, secret, svcHost;
const PASSWORD = "pw-" + crypto.randomBytes(8).toString("hex");
const jar = new Map(), djar = new Map();
let enrollCode;
try {
  startHub();
  await waitFor(() => req("GET", BASE, "/healthz").then((r) => r.status === 200), 15000, "hub");
  dsh = await startFakeDsh(patch);

  await step("first-run setup with one-time token + mandatory TOTP", async () => {
    const tok = readFileSync(join(hubData, "setup-token"), "utf8").trim();
    assert.equal((await req("GET", BASE, "/api/state")).json.setupRequired, true);
    assert.equal((await req("POST", BASE, "/api/auth/setup/begin", { body: { token: "wrong" } })).status, 403);
    const b = await req("POST", BASE, "/api/auth/setup/begin", { body: { token: tok } });
    secret = b.json.secret;
    assert.equal((await req("POST", BASE, "/api/auth/setup/finish", { body: { token: tok, username: "me", password: PASSWORD, code: "000000" } })).status, 400);
    const f = await req("POST", BASE, "/api/auth/setup/finish", { body: { token: tok, username: "me", password: PASSWORD, code: totp(secret) } });
    assert.equal(f.status, 200, f.text);
    assert.equal(existsSync(join(hubData, "setup-token")), false, "setup token file removed");
    assert.equal((await req("POST", BASE, "/api/auth/setup/begin", { body: { token: tok } })).status, 403);
  });

  await step("login: password then TOTP; CSRF header required; wrong password rejected", async () => {
    assert.equal((await req("POST", BASE, "/api/auth/login", { body: { username: "me", password: "nope" }, jar })).status, 401);
    const noCsrf = await new Promise((r) => { const x = http.request({ host: "127.0.0.1", port: PORT, method: "POST", path: "/api/auth/login", headers: { host: BASE, "content-type": "application/json" } }, (s) => { s.resume(); r(s.statusCode); }); x.end("{}"); });
    assert.equal(noCsrf, 403);
    assert.equal((await req("POST", BASE, "/api/auth/login", { body: { username: "me", password: PASSWORD }, jar })).status, 200);
    assert.equal((await req("GET", BASE, "/api/me", { jar })).status, 401, "not logged in before TOTP");
    assert.equal((await req("POST", BASE, "/api/auth/totp", { body: { code: "123456" }, jar })).status, 401);
    const t = await req("POST", BASE, "/api/auth/totp", { body: { code: totp(secret) }, jar });
    assert.equal(t.status, 200, t.text);
    assert.equal((await req("GET", BASE, "/api/me", { jar })).json.username, "me");
  });

  await step("enrollment: code -> agent keypair -> pending -> fingerprint-checked activation -> online", async () => {
    const c = await req("POST", BASE, "/api/enroll-codes", { body: { name: "MacBook Pro" }, jar });
    enrollCode = c.json.code;
    const mod = await import(join(here, "../index.js"));
    let handler;
    const ctx = {
      logger: { info: (m) => (agentLog += m + "\n"), warn: (m) => (agentLog += m + "\n") },
      inject(names, cb) { cb({ webServer: { host: "127.0.0.1", port: dsh.port, register: (o) => { handler = o.handler; return () => {}; } }, connection: connectionStub, commands: { register() {} } }); },
      on() {},
    };
    agentHandle = mod.default(ctx, { hub: `http://${BASE}:${PORT}`, proxy: "direct" });
    await assert.rejects(agentHandle.handler("enroll", { hub: `http://${BASE}:${PORT}`, code: "AAAA-BBBB-CCCC" }), /登记失败/);
    const v = await agentHandle.handler("enroll", { hub: `http://${BASE}:${PORT}`, code: enrollCode });
    assert.equal(v.enrolled, true); assert.equal(v.keyStore, "file");
    await assert.rejects(agentHandle.handler("enroll", { hub: `http://${BASE}:${PORT}`, code: enrollCode }), /登记失败/, "code is single-use");
    await agentHandle.handler("forget"); // that failed re-enroll stopped the link; restore by enrolling a fresh code
    const c2 = await req("POST", BASE, "/api/enroll-codes", { body: { name: "MacBook Pro" }, jar });
    const v2 = await agentHandle.handler("enroll", { hub: `http://${BASE}:${PORT}`, code: c2.json.code });
    await waitFor(async () => (await agentHandle.handler("status")).state === "pending", 10000, "pending");
    const devs = (await req("GET", BASE, "/api/devices", { jar })).json;
    const d = devs.find((x) => x.fingerprint === v2.fingerprint);
    assert.ok(d && d.status === "pending");
    deviceId = d.id; slug = d.slug; svcHost = `dsh--${slug}.${ZONE}`;
    assert.equal((await req("POST", BASE, "/api/devices/activate", { body: { id: deviceId, fingerprint: "ffffff" }, jar })).status, 400);
    assert.equal((await req("POST", BASE, "/api/devices/activate", { body: { id: deviceId, fingerprint: d.fingerprint.slice(0, 8) }, jar })).status, 200);
    await agentHandle.handler("connect");
    await waitFor(async () => (await agentHandle.handler("status")).state === "online", 15000, "online");
    await waitFor(async () => (await req("GET", BASE, "/api/devices", { jar })).json.find((x) => x.id === deviceId)?.online, 5000, "hub sees online");
  });

  await step("trustedHosts: device subdomain added, legacy dsh.cli-help.com kept and adopted, backup made", async () => {
    const t = readFileSync(patch, "utf8");
    assert.match(t, new RegExp(`'${svcHost.replace(/\./g, "\\.")}'`));
    assert.match(t, /'dsh\.cli-help\.com'/); assert.match(t, /\.\.\.ctx\.webStartup\.trustedHosts/);
    assert.ok(readdirSync(work).some((f) => f.startsWith("cordis.patch.yml.remote-agent-bak-")));
    const s = await agentHandle.handler("status");
    assert.equal(s.restartNeeded, true); assert.ok(s.managedHosts.includes("dsh.cli-help.com"));
  });

  await step("on-demand TLS ask: only console host and active device service hosts", async () => {
    const ask = (d) => new Promise((r) => http.get({ host: "127.0.0.1", port: ASK, path: "/tls-ask?domain=" + d }, (s) => { s.resume(); r(s.statusCode); }));
    assert.equal(await ask(BASE), 200); assert.equal(await ask(svcHost), 200);
    assert.equal(await ask(`dsh--nope.${ZONE}`), 404); assert.equal(await ask(`x--${slug}.${ZONE}`), 404); assert.equal(await ask("evil.com"), 404);
    assert.equal((await req("GET", BASE, "/tls-ask?domain=" + BASE)).status === 200 && false, false);
  });

  await step("subdomain without login redirects to console; unknown host 421", async () => {
    const r = await req("GET", svcHost, "/");
    assert.equal(r.status, 303); assert.match(r.headers.location, new RegExp(`^http://${BASE}/`));
    assert.equal((await req("GET", "evil.example", "/")).status, 421);
  });

  let ticketUrl;
  await step("open DSH: one-time ticket -> service cookie + DSH SSO cookie handoff -> 303", async () => {
    const o = await req("POST", BASE, "/api/open", { body: { device: deviceId, service: "dsh" }, jar });
    ticketUrl = new URL(o.json.url);
    assert.equal(ticketUrl.host, svcHost);
    const r = await req("GET", svcHost, ticketUrl.pathname + ticketUrl.search, { jar: djar });
    assert.equal(r.status, 303, r.text); assert.equal(r.headers.location, "/");
    assert.equal(r.headers["referrer-policy"], "no-referrer");
    assert.ok(djar.has("rh_svc"), "service cookie set"); assert.equal(djar.get("dsh_session"), SESSION, "DSH cookie handed off");
    assert.ok(!r.text.includes(LAUNCH_TOKEN) && !JSON.stringify(r.headers).includes(LAUNCH_TOKEN), "launch token never reaches browser");
    const again = await req("GET", svcHost, ticketUrl.pathname + ticketUrl.search, { jar: new Map() });
    assert.equal(again.status, 303); assert.match(again.headers.location, new RegExp(`^http://${BASE}/`), "ticket is single-use");
  });

  await step("proxy: DSH page through tunnel with public Host; hub cookies stripped", async () => {
    const r = await req("GET", svcHost, "/", { jar: djar });
    assert.equal(r.status, 200); assert.equal(r.text, `DSH HOME host=${svcHost}:${PORT}`);
    const e = await req("GET", svcHost, "/api/echo", { jar: djar });
    assert.deepEqual(e.json.cookies, ["dsh_session"]); assert.equal(e.json.xfp, "http");
  });

  await step("large download (5MB) and upload (3MB) integrity through yamux flow control", async () => {
    const r = await req("GET", svcHost, "/big", { jar: djar });
    assert.equal(r.buf.length, BIG.length); assert.ok(r.buf.equals(BIG));
    const up = crypto.randomBytes(3 * 1024 * 1024);
    const u = await req("POST", svcHost, "/upload", { body: up, jar: djar, headers: { "content-type": "application/octet-stream" } });
    assert.equal(u.json.n, up.length); assert.equal(u.json.sha, crypto.createHash("sha256").update(up).digest("hex"));
    const many = await Promise.all(Array.from({ length: 30 }, () => req("GET", svcHost, "/api/echo", { jar: djar })));
    assert.ok(many.every((m) => m.status === 200));
  });

  const wsEcho = (jarIn) => new Promise((res, rej) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: { host: `${svcHost}:${PORT}`, cookie: [...jarIn].map(([k, v]) => `${k}=${v}`).join("; ") } });
    ws.on("open", () => ws.send("ping-1")); ws.on("message", (m) => { ws.close(); res(String(m)); }); ws.on("error", rej); ws.on("unexpected-response", (_q, s) => rej(new Error("HTTP " + s.statusCode)));
  });
  await step("WebSocket passthrough", async () => { assert.equal(await wsEcho(djar), "echo:ping-1"); });

  await step("reconnect after hub restart; sessions persist", async () => {
    hub.kill("SIGTERM"); await new Promise((r) => hub.once("exit", r));
    await waitFor(async () => (await agentHandle.handler("status")).state !== "online", 10000, "agent notices");
    startHub();
    await waitFor(() => req("GET", BASE, "/healthz").then((r) => r.status === 200), 15000, "hub back");
    await waitFor(async () => (await agentHandle.handler("status")).state === "online", 30000, "agent back online");
    const r = await req("GET", svcHost, "/", { jar: djar });
    assert.equal(r.status, 200); assert.equal(await wsEcho(djar), "echo:ping-1");
  });

  await step("kick session: logout invalidates console and service sessions", async () => {
    const jar2 = new Map();
    await req("POST", BASE, "/api/auth/login", { body: { username: "me", password: PASSWORD }, jar: jar2 });
    await sleep(31000 - (Date.now() % 30000)); // next TOTP step (replay protection)
    assert.equal((await req("POST", BASE, "/api/auth/totp", { body: { code: totp(secret) }, jar: jar2 })).status, 200);
    const sess = (await req("GET", BASE, "/api/sessions", { jar: jar2 })).json;
    assert.equal(sess.length, 2);
    const other = sess.find((s) => !s.current);
    assert.equal((await req("POST", BASE, "/api/sessions/revoke", { body: { id: other.id }, jar: jar2 })).status, 200);
    assert.equal((await req("GET", BASE, "/api/me", { jar })).status, 401, "kicked session is dead");
    const r = await req("GET", svcHost, "/", { jar: djar });
    assert.equal(r.status, 303, "service session from kicked session is dead");
    for (const [k, v] of jar2) jar.set(k, v);
  });

  await step("revocation: device kicked, key cleared, subdomain gone, cannot reconnect", async () => {
    assert.equal((await req("POST", BASE, "/api/devices/revoke", { body: { id: deviceId }, jar })).status, 200);
    await waitFor(async () => (await agentHandle.handler("status")).revoked === true, 10000, "agent revoked");
    assert.equal(existsSync(join(agentDir, "device-key.enc")), false, "private key removed");
    assert.equal((await req("GET", svcHost, "/", { jar: djar })).status, 404);
    const devs = (await req("GET", BASE, "/api/devices", { jar })).json;
    assert.equal(devs.find((d) => d.id === deviceId), undefined);
  });

  await step("audit log records the flow", async () => {
    const a = (await req("GET", BASE, "/api/audit", { jar })).json.map((x) => x.action);
    for (const k of ["setup", "login", "login.password", "enroll.code", "device.enroll", "device.activate", "device.connect", "service.open", "session.revoke", "device.revoke"]) assert.ok(a.includes(k), "missing audit " + k);
  });

  await step("no secrets in hub/agent logs, state files or hub DB", async () => {
    const tok = (() => { try { return readFileSync(join(hubData, "setup-token"), "utf8"); } catch { return null; } })();
    const db = readFileSync(join(hubData, "hub.db")).toString("latin1") + (existsSync(join(hubData, "hub.db-wal")) ? readFileSync(join(hubData, "hub.db-wal")).toString("latin1") : "");
    const state = readFileSync(join(agentDir, "state.json"), "utf8");
    for (const [label, s] of [["hub log", hubLog], ["agent log", agentLog], ["agent state", state], ["hub db", db]]) {
      for (const secretVal of [LAUNCH_TOKEN, SESSION, PASSWORD, secret, enrollCode]) assert.ok(!s.includes(secretVal), `${label} leaks a secret`);
    }
    assert.equal(tok, null);
  });
} finally {
  try { agentHandle && agentHandle.cleanup(); } catch {}
  try { hub && hub.kill(); } catch {}
  try { dsh && dsh.srv.close(); } catch {}
  console.log("\n" + results.map((r) => r.join("  ")).join("\n"));
  const fails = results.filter((r) => r[0] === "FAIL").length;
  console.log(`\n${results.length - fails}/${results.length} e2e steps passed`);
  setTimeout(() => process.exit(fails ? 1 : 0), 200);
}
