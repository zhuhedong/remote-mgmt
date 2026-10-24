import { test } from "node:test";
import assert from "node:assert/strict";
import { BridgeRouter, ChatBridge, applyEvent, unwrap } from "../.build/bridge/index.js";

function fakeController() {
  const calls = [];
  let push = null;
  const queue = [];
  const ctl = {
    calls,
    async list() { calls.push(["list"]); return { items: [
      { sessionId: "s1", cwd: "/Users/code/inpass-engine", updatedAt: 2, running: true, blank: false },
      { sessionId: "s2", cwd: "/Users/code/inpass-engine", updatedAt: 1, running: false, blank: true },
      { sessionId: "c1", parentSessionId: "s1", cwd: "/x" },
    ] }; },
    async create(req) { calls.push(["create", req]); return { sessionId: "new1" }; },
    async page(req) { calls.push(["page", req]); return { records: [
      { type: "event", event: { type: "user/message", seq: 1, data: { role: "user", content: [{ type: "text", text: "你好" }] } } },
      { type: "event", event: { type: "assistant/message", seq: 2, data: { message: { content: [{ type: "text", text: "嗨" }] } } } },
    ], hasMore: false }; },
    async prompt(req, signal) { calls.push(["prompt", req]); assert.ok(signal); return { accepted: true }; },
    async cancel(req) { calls.push(["cancel", req]); return { ok: true, value: {} }; },
    async modelCatalog() { return { default: { provider: "p", model: "m1" }, groups: [{ id: "p", name: "P", models: [{ id: "m1" }, { id: "m2" }] }] }; },
    async projections() { return { kind: "sequenced", values: { modelSelection: { lastUsed: null, next: { provider: "p", model: "m2" } } } }; },
    async selectModel(req) { calls.push(["selectModel", req]); return { provider: req.provider, model: req.model }; },
    follow(req, signal) {
      calls.push(["follow", req]);
      return (async function* () {
        yield { type: "snapshot", cursor: 2, records: [
          { type: "event", event: { type: "user/message", seq: 1, data: { content: [{ type: "text", text: "hi" }] } } },
        ] };
        while (!signal.aborted) {
          if (queue.length) { yield queue.shift(); continue; }
          await new Promise((r) => { push = r; signal.addEventListener("abort", r, { once: true }); });
        }
      })();
    },
    emit(f) { queue.push(f); if (push) { const p = push; push = null; p(); } },
  };
  return ctl;
}

const deps = (chat) => ({ status: () => ({}), enrollment: () => ({}), chat });

test("L1 not declared without sessionController", () => {
  const r = new BridgeRouter(deps(new ChatBridge(() => null)));
  assert.ok(!r.list().capabilities.some((c) => c.id.startsWith("chat.")));
});

test("L1 list + sessions + spaces + models", async () => {
  const ctl = fakeController();
  const chat = new ChatBridge(() => ctl);
  const r = new BridgeRouter(deps(chat));
  const ids = r.list().capabilities.map((c) => c.id);
  for (const id of ["chat.sessions.list", "chat.prompt", "chat.follow", "models.list", "models.select"]) assert.ok(ids.includes(id), id);
  const s = await r.invoke("chat.sessions.list", {}, "r1");
  assert.equal(s.ok, true);
  assert.equal(s.data.sessions.length, 2);
  assert.equal(s.data.spaces[0].name, "inpass-engine");
  assert.equal(s.data.spaces[0].count, 2);
  const m = await r.invoke("models.list", { sessionId: "s1" }, "r2");
  assert.equal(m.data.current.model, "m2");
  assert.equal(m.data.groups[0].models.length, 2);
  const sel = await r.invoke("models.select", { sessionId: "s1", provider: "p", model: "m1" }, "r3");
  assert.equal(sel.ok, true);
  assert.deepEqual(ctl.calls.at(-1), ["selectModel", { sessionId: "s1", provider: "p", model: "m1" }]);
  const bad = await r.invoke("models.select", { sessionId: "s1" }, "r4");
  assert.equal(bad.code, "VALIDATION");
  const h = await r.invoke("chat.history", { sessionId: "s1" }, "r5");
  assert.deepEqual(h.data.messages.map((x) => x.role), ["user", "assistant"]);
  const c = await r.invoke("chat.session.create", { cwd: "/tmp" }, "r6");
  assert.equal(c.data.sessionId, "new1");
  chat.dispose();
});

test("prompt + follow streams live text then settles", async () => {
  const ctl = fakeController();
  const chat = new ChatBridge(() => ctl);
  const r = new BridgeRouter(deps(chat));
  const p = await r.invoke("chat.prompt", { sessionId: "s1", text: "写首诗" }, "p1");
  assert.equal(p.ok, true);
  const pr = ctl.calls.find((x) => x[0] === "prompt")[1];
  assert.deepEqual(pr.content, [{ type: "text", text: "写首诗" }]);
  assert.equal(pr.mode, "followup");
  let f = (await r.invoke("chat.follow", { sessionId: "s1", version: -1, waitMs: 200 }, "f1")).data;
  ctl.emit({ type: "assistant-stream", frame: { type: "start", revision: 1 } });
  ctl.emit({ type: "assistant-stream", frame: { type: "chunk", chunk: { type: "text-delta", index: 0, text: "床前" } } });
  ctl.emit({ type: "assistant-stream", frame: { type: "chunk", chunk: { type: "text-delta", index: 0, text: "明月光" } } });
  await new Promise((r) => setTimeout(r, 20));
  f = (await r.invoke("chat.follow", { sessionId: "s1", version: f.version, waitMs: 500 }, "f2")).data;
  assert.equal(f.live, "床前明月光");
  assert.equal(f.running, true);
  ctl.emit({ type: "event", event: { type: "assistant/message", seq: 3, data: { message: { content: [{ type: "text", text: "床前明月光" }] } } } });
  ctl.emit({ type: "event", event: { type: "turn/end", seq: 4, data: {} } });
  await new Promise((r) => setTimeout(r, 20));
  f = (await r.invoke("chat.follow", { sessionId: "s1", version: f.version, waitMs: 500 }, "f3")).data;
  assert.equal(f.live, "");
  assert.equal(f.running, false);
  assert.equal(f.messages.at(-1).text, "床前明月光");
  const same = (await r.invoke("chat.follow", { sessionId: "s1", version: f.version, waitMs: 50 }, "f4")).data;
  assert.equal(same.unchanged, true);
  const empty = await r.invoke("chat.prompt", { sessionId: "s1", text: "  " }, "p2");
  assert.equal(empty.code, "VALIDATION");
  chat.dispose();
});

test("applyEvent tool steps and unwrap errors", () => {
  const msgs = [];
  applyEvent(msgs, { type: "tool/call", seq: 1, data: { callId: "c1", name: "bash", arguments: "{}" } });
  assert.equal(msgs[0].status, "running");
  applyEvent(msgs, { type: "tool/result", seq: 2, data: { message: { callId: "c1" } } });
  assert.equal(msgs[0].status, "done");
  assert.throws(() => unwrap({ ok: false, error: { code: "session/not-found", message: "x" } }), /x/);
});
