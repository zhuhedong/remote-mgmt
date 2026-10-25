import { test } from "node:test";
import assert from "node:assert/strict";
import { BridgeRouter, ChatBridge, applyEvent, parseAskArguments, isPendingAskResult, extractAskCallId, extractAskSessionId, unwrap, resolveSessionCwd, textOf, chunkText } from "../.build/bridge/index.js";

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
      { sessionId: "new1", cwd: "/Users/code/proj" },
    ] }; },
    async create(req) { calls.push(["create", req]); return { sessionId: "new1" }; },
    async page(req) { calls.push(["page", req]); return { records: [
      { type: "event", event: { type: "user/message", seq: 1, data: { source: { kind: "user" }, role: "user", content: [{ type: "text", text: "你好" }] } } },
      { type: "event", event: { type: "assistant/message", seq: 2, data: { message: { content: [{ type: "text", text: "嗨" }, { type: "thinking", text: "secret" }] } } } },
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
          { type: "event", event: { type: "user/message", seq: 1, data: { source: { kind: "user" }, content: [{ type: "text", text: "hi" }] } } },
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
  assert.equal(s.data.sessions.length, 3);
  assert.equal(s.data.spaces[0].name, "inpass-engine");
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
  assert.equal(h.data.messages[1].text, "嗨"); // thinking part dropped
  const c = await r.invoke("chat.session.create", { cwd: "/tmp/proj" }, "r6");
  assert.equal(c.data.sessionId, "new1");
  assert.equal(c.data.cwd, "/Users/code/proj"); // from list header after create
  assert.deepEqual(ctl.calls.find((x) => x[0] === "create")[1], { cwd: "/tmp/proj" });
  chat.dispose();
});

test("sessionCreate expands ~ and returns cwd", async () => {
  const ctl = fakeController();
  const chat = new ChatBridge(() => ctl);
  const r = new BridgeRouter(deps(chat));
  const c = await r.invoke("chat.session.create", { cwd: "~/code/app" }, "c1");
  assert.equal(c.ok, true);
  const created = ctl.calls.find((x) => x[0] === "create")[1];
  assert.ok(created.cwd.endsWith("/code/app"), created.cwd);
  assert.ok(!created.cwd.includes("~"), created.cwd);
  assert.equal(c.data.cwd, "/Users/code/proj");
  const empty = await r.invoke("chat.session.create", { cwd: "   " }, "c2");
  assert.equal(empty.code, "VALIDATION");
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
  ctl.emit({ type: "assistant-stream", frame: { type: "chunk", chunk: { type: "reasoning-delta", text: "think" } } });
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

test("applyEvent drops non-user sources, ignorable, system/developer; keeps real user/assistant", () => {
  const msgs = [];
  assert.equal(applyEvent(msgs, { type: "user/message", seq: 1, data: { source: { kind: "skill" }, content: [{ type: "text", text: "注入的技能提示词" }] } }), false);
  assert.equal(msgs.length, 0);
  assert.equal(applyEvent(msgs, { type: "user/message", seq: 2, ignorable: true, data: { source: { kind: "user" }, content: [{ type: "text", text: "ignorable" }] } }), false);
  assert.equal(msgs.length, 0);
  assert.equal(applyEvent(msgs, { type: "system/message", seq: 3, data: { content: [{ type: "text", text: "sys" }] } }), false);
  assert.equal(applyEvent(msgs, { type: "developer/message", seq: 4, data: { content: [{ type: "text", text: "dev" }] } }), false);
  assert.equal(msgs.length, 0);
  assert.equal(applyEvent(msgs, { type: "user/message", seq: 5, data: { source: { kind: "user" }, content: [{ type: "text", text: "你好" }] } }), true);
  assert.equal(applyEvent(msgs, { type: "assistant/message", seq: 6, data: { message: { content: [
    { type: "thinking", text: "内部思考" },
    { type: "text", text: "回复" },
    { type: "tool_use", text: "{}" },
  ] } } }), true);
  assert.deepEqual(msgs.map((m) => [m.role, m.text]), [["user", "你好"], ["assistant", "回复"]]);

  applyEvent(msgs, { type: "tool/call", seq: 7, data: { callId: "c1", name: "bash", arguments: "{}" } });
  assert.equal(msgs.at(-1).status, "running");
  applyEvent(msgs, { type: "tool/result", seq: 8, data: { message: { callId: "c1" } } });
  assert.equal(msgs.at(-1).status, "done");
  assert.throws(() => unwrap({ ok: false, error: { code: "session/not-found", message: "x" } }), /x/);
});

test("resolveSessionCwd expands ~ and resolves relative", () => {
  assert.equal(resolveSessionCwd("~", "/Users/me", "/tmp"), "/Users/me");
  assert.equal(resolveSessionCwd("~/code/app", "/Users/me", "/tmp"), "/Users/me/code/app");
  assert.equal(resolveSessionCwd("/abs/path", "/Users/me", "/tmp"), "/abs/path");
  assert.equal(resolveSessionCwd("rel/path", "/Users/me", "/tmp/base"), "/tmp/base/rel/path");
  assert.throws(() => resolveSessionCwd("  ", "/Users/me", "/tmp"), /cwd/);
  assert.equal(textOf([{ type: "thinking", text: "x" }, { type: "text", text: "y" }]), "y");
  assert.equal(chunkText({ chunk: { type: "reasoning-delta", text: "z" } }), "");
  assert.equal(chunkText({ chunk: { type: "text-delta", text: "ok" } }), "ok");
});

test("parseAskArguments and applyEvent ask step", () => {
  const ask = parseAskArguments("c1", {
    questions: [
      { id: "q1", question: "选哪个？", header: "确认", options: [{ label: "A", description: "甲" }, { label: "B" }], multi_select: false },
    ],
  });
  assert.equal(ask.callId, "c1");
  assert.equal(ask.questions[0].options.length, 2);
  assert.equal(ask.questions[0].header, "确认");
  const msgs = [];
  applyEvent(msgs, { type: "tool/call", seq: 1, data: { callId: "c1", name: "ask_user_question", arguments: { questions: [{ id: "q1", question: "选哪个？", options: [{ label: "A" }] }] } } });
  assert.equal(msgs[0].name, "ask_user_question");
  assert.ok(msgs[0].ask);
  assert.equal(msgs[0].ask.questions[0].id, "q1");
  applyEvent(msgs, { type: "tool/result", seq: 2, data: { callId: "c1" } });
  assert.equal(msgs[0].status, "done");
});


test("extractAskCallId / sessionId and pending result", () => {
  assert.equal(extractAskCallId({ wait: { callId: "c1", timed: true } }), "c1");
  assert.equal(extractAskCallId({ questions: [{ id: "q" }] }), "");
  assert.equal(extractAskSessionId({ agent: { id: "sess-1" } }), "sess-1");
  assert.equal(isPendingAskResult({ result: { pending: true, callId: "c1" } }), true);
  assert.equal(isPendingAskResult({ message: { callId: "c1" } }), false);
  const msgs = [];
  applyEvent(msgs, { type: "tool/call", seq: 1, data: { callId: "c1", name: "ask_user_question", arguments: { questions: [{ id: "q1", question: "选？", options: [{ label: "A" }] }] } } });
  applyEvent(msgs, { type: "tool/result", seq: 2, data: { callId: "c1", result: { pending: true, callId: "c1" } } });
  assert.equal(msgs[0].status, "running"); // stay interactive
});

test("provisional park rebinds to tool callId and answerAsk resolves", async () => {
  const ctl = fakeController();
  const chat = new ChatBridge(() => ctl);
  // Start follower so surfaceAsk has somewhere to land
  const followP = chat.follow({ sessionId: "s1", version: -1, waitMs: 0 });
  await new Promise((r) => setTimeout(r, 30));
  const race = chat.raceUserQuestion(
    { questions: [{ id: "q1", question: "选哪个？", options: [{ label: "A" }, { label: "B" }] }], agent: { id: "s1" } },
    () => new Promise(() => {}), // desktop never answers
  );
  await new Promise((r) => setTimeout(r, 20));
  // Simulate tool/call with real callId
  ctl.emit({ type: "event", event: { type: "tool/call", seq: 9, data: { callId: "tool-real", name: "ask_user_question", arguments: { questions: [{ id: "q1", question: "选哪个？", options: [{ label: "A" }, { label: "B" }] }] } } } });
  await new Promise((r) => setTimeout(r, 40));
  const snap = await chat.follow({ sessionId: "s1", version: -1, waitMs: 0 });
  assert.ok(snap.pendingAsk, "pendingAsk should stay while park live");
  assert.equal(snap.pendingAsk.callId, "tool-real");
  const ans = chat.answerAsk({ sessionId: "s1", callId: "tool-real", answers: [{ id: "q1", selected: ["A"] }] });
  const result = await ans;
  assert.equal(result.ok, true);
  const answered = await race;
  assert.deepEqual(answered.answers[0].selected, ["A"]);
  chat.dispose();
  await followP.catch(() => {});
});


test("answerAsk continued uses exact live agent not sessionId string", async () => {
  const live = { id: "s1", session: "s1", steer() {} };
  const agents = {
    store: new Map([["s1", live]]),
    get(id) { return this.store.get(id); },
    roots() { return [live]; },
  };
  const answered = [];
  const uq = {
    answer(agent, callId, payload) {
      answered.push({ agent, callId, payload });
      // Mirror DSH assertLiveRoot
      if (agents.get(agent.id) !== agent) {
        const e = new Error("human interaction requires the exact live calling agent when an agent is supplied");
        e.code = "CALLER_NOT_LIVE";
        throw e;
      }
      return true;
    },
  };
  const ctl = fakeController();
  const chat = new ChatBridge(() => ctl);
  chat.setUserQuestions(() => uq);
  chat.setAgents(() => agents);
  // Remember live agent as raceUserQuestion would
  chat.raceUserQuestion(
    { questions: [{ id: "q1", question: "选？", options: [{ label: "A" }] }], agent: live, signal: AbortSignal.abort() },
    () => Promise.reject(Object.assign(new Error("no provider"), { code: "NO_PROVIDER" })),
  ).catch(() => {});
  await new Promise((r) => setTimeout(r, 20));
  // No park left (aborted) — continued path
  const result = await chat.answerAsk({
    sessionId: "s1",
    callId: "c-continued",
    answers: [{ id: "q1", selected: ["A"] }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.via, "continued");
  assert.equal(answered.length, 1);
  assert.equal(answered[0].agent, live); // exact same object
  assert.notEqual(typeof answered[0].agent, "string");
  chat.dispose();
});

test("answerAsk continued resolves agent via agents.get when not remembered", async () => {
  const live = { id: "s2", session: "s2" };
  const agents = { get(id) { return id === "s2" ? live : undefined; }, roots() { return [live]; } };
  let got = null;
  const uq = {
    answer(agent, callId, payload) {
      got = agent;
      if (agents.get(agent.id) !== agent) {
        const e = new Error("human interaction requires the exact live calling agent when an agent is supplied");
        e.code = "CALLER_NOT_LIVE";
        throw e;
      }
      return true;
    },
  };
  const chat = new ChatBridge(() => fakeController());
  chat.setUserQuestions(() => uq);
  chat.setAgents(() => agents);
  const result = await chat.answerAsk({
    sessionId: "s2",
    callId: "c2",
    answers: [{ id: "q1", selected: ["B"] }],
  });
  assert.equal(result.ok, true);
  assert.equal(got, live);
  chat.dispose();
});
