import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { MuxSession, encodeHeader, T_WINDOW, T_DATA, T_PING, F_SYN, F_ACK, F_FIN, INITIAL_WINDOW } from "../.build/mux.js";
import { applyHosts, syncHostsFile } from "../.build/hosts.js";
import { FileStore, newDeviceKey, loadKey, signMsg } from "../.build/keystore.js";
import { redact, addSecret } from "../.build/redact.js";
import { verify, createPublicKey } from "node:crypto";

function pair() {
  // two client-role sessions can't talk (both odd ids), so emulate the hub by hand
  const sent = [];
  const s = new MuxSession({ send: (b) => sent.push(b), close() {} });
  return { s, sent };
}

test("mux: accepts server stream, ACKs, delivers data, honours FIN", async () => {
  const { s, sent } = pair();
  let got = null;
  s.on("stream", (st) => { got = st; });
  s.feed(encodeHeader(T_WINDOW, F_SYN, 2, 0));
  assert.ok(got, "stream emitted");
  const ack = sent.shift();
  assert.equal(ack[1], T_WINDOW); assert.equal(ack.readUInt16BE(2), F_ACK); assert.equal(ack.readUInt32BE(4), 2);
  const chunks = [];
  got.on("data", (d) => chunks.push(d));
  const ended = new Promise((r) => got.on("end", r));
  const payload = Buffer.from("hello");
  // split frame across feeds
  const f = Buffer.concat([encodeHeader(T_DATA, 0, 2, payload.length), payload]);
  s.feed(f.subarray(0, 7)); s.feed(f.subarray(7));
  s.feed(encodeHeader(T_DATA, F_FIN, 2, 0));
  await ended;
  assert.equal(Buffer.concat(chunks).toString(), "hello");
});

test("mux: send window blocks writes until window update", async () => {
  const { s, sent } = pair();
  const st = s.open();
  sent.length = 0;
  const big = Buffer.alloc(INITIAL_WINDOW + 1000, 1);
  let done = false;
  st.write(big, () => { done = true; });
  await new Promise((r) => setImmediate(r));
  const dataBytes = () => sent.filter((b) => b[1] === T_DATA).reduce((n, b) => n + b.readUInt32BE(8), 0);
  assert.equal(dataBytes(), INITIAL_WINDOW);
  assert.equal(done, false);
  s.feed(encodeHeader(T_WINDOW, 0, st.id, 4096));
  await new Promise((r) => setImmediate(r));
  assert.equal(dataBytes(), INITIAL_WINDOW + 1000);
  assert.equal(done, true);
});

test("mux: answers ping and rejects window overflow", () => {
  const { s, sent } = pair();
  s.feed(encodeHeader(T_PING, F_SYN, 0, 77));
  const p = sent.pop();
  assert.equal(p[1], T_PING); assert.equal(p.readUInt16BE(2), F_ACK); assert.equal(p.readUInt32BE(8), 77);
  let closed = false; s.on("close", () => { closed = true; });
  s.feed(encodeHeader(T_WINDOW, F_SYN, 4, 0));
  const big = Buffer.alloc(INITIAL_WINDOW + 1);
  s.feed(Buffer.concat([encodeHeader(T_DATA, 0, 4, big.length), big]));
  assert.equal(closed, true);
});

const CONN = "- id: connection\n  name: '@deepseek-ai/dsh-client-connection'\n  config:\n    trustedHosts: !!js \"['dsh.cli-help.com', ...ctx.webStartup.trustedHosts]\"\n";

test("hosts: adds managed host, keeps user + spread, idempotent, removes stale managed", () => {
  const r = applyHosts("- id: x\n  name: other\n" + CONN, ["dsh--mac.d.r.cn", "dsh.cli-help.com"], ["dsh--mac.d.r.cn", "dsh.cli-help.com"]);
  assert.ok(!("error" in r));
  assert.match(r.text, /trustedHosts: !!js "\['dsh\.cli-help\.com', 'dsh--mac\.d\.r\.cn', \.\.\.ctx\.webStartup\.trustedHosts\]"/);
  assert.match(r.text, /name: other/);
  const again = applyHosts(r.text, ["dsh--mac.d.r.cn", "dsh.cli-help.com"], ["dsh--mac.d.r.cn", "dsh.cli-help.com"]);
  assert.equal(again.text, r.text);
  const drop = applyHosts(r.text, ["dsh--mac.d.r.cn"], ["dsh--mac.d.r.cn", "dsh.cli-help.com"]);
  assert.doesNotMatch(drop.text, /cli-help/);
  const user = applyHosts(CONN.replace("dsh.cli-help.com", "mine.example.com"), ["a.b.cn"], ["a.b.cn"]);
  assert.match(user.text, /'mine\.example\.com', 'a\.b\.cn'/);
});

test("hosts: creates entry when missing, refuses odd formats", () => {
  const r = applyHosts("- id: x\n  name: other\n", ["h.cn"], ["h.cn"]);
  assert.match(r.text, /- id: connection\n  name: '@deepseek-ai\/dsh-client-connection'\n  config:\n    trustedHosts: !!js "\['h\.cn', \.\.\.ctx\.webStartup\.trustedHosts\]"/);
  const odd = applyHosts(CONN.replace(/!!js .*/, "[a, b]"), ["h.cn"], ["h.cn"]);
  assert.ok("error" in odd);
  assert.ok("error" in applyHosts(CONN, ["bad host'"], []));
});

test("hosts file: backup + write", () => {
  const d = mkdtempSync(join(tmpdir(), "hosts-"));
  const f = join(d, "cordis.patch.yml");
  writeFileSync(f, CONN);
  const r = syncHostsFile(f, ["dsh--m.d.r.cn"], ["dsh--m.d.r.cn"]);
  assert.equal(r.changed, true);
  assert.ok(r.backup && readFileSync(r.backup, "utf8") === CONN);
  assert.match(readFileSync(f, "utf8"), /dsh--m\.d\.r\.cn/);
  assert.equal(syncHostsFile(f, ["dsh--m.d.r.cn"], ["dsh--m.d.r.cn"]).changed, false);
});

test("keystore: file fallback round-trip, 0600, wrong machine id fails; ed25519 sign", async () => {
  const d = mkdtempSync(join(tmpdir(), "ks-"));
  const fs1 = new FileStore(join(d, "k.enc"), async () => "machine-A");
  const k = newDeviceKey();
  await fs1.save(k.pkcs8);
  assert.equal(statSync(join(d, "k.enc")).mode & 0o777, 0o600);
  assert.equal(await fs1.load(), k.pkcs8);
  assert.doesNotMatch(readFileSync(join(d, "k.enc"), "utf8"), new RegExp(k.pkcs8.slice(10, 30).replace(/[+/]/g, ".")));
  assert.equal(await new FileStore(join(d, "k.enc"), async () => "machine-B").load(), null);
  const { priv, pub } = loadKey(k.pkcs8);
  assert.equal(pub, k.pub);
  const sig = signMsg(priv, "n|1|id|dra-v1");
  const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(pub, "base64")]);
  assert.ok(verify(null, Buffer.from("n|1|id|dra-v1"), createPublicKey({ key: spki, format: "der", type: "spki" }), Buffer.from(sig, "base64")));
  await fs1.clear();
  assert.equal(await fs1.load(), null);
});

test("redact: tokens, cookies, enrollment codes, known secrets", () => {
  addSecret("supersecretvalue");
  const s = redact("GET /auth?token=abc123&x=1 Cookie: dsh=zzz code ABCD-EFGH-JKLM supersecretvalue eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.c2lnbmF0dXJlMTIz");
  assert.doesNotMatch(s, /abc123|zzz|ABCD-EFGH|supersecretvalue|eyJhbGciOiJIUzI1/);
});
