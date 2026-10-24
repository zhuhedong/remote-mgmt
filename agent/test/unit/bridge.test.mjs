import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { listCapabilities, findCapability, AGENT_CAP_VERSION } from "../.build/bridge/catalog.js";
import { BridgeRouter, handleControlMessage } from "../.build/bridge/router.js";
import { LogRing, clampLogLines } from "../.build/bridge/logs.js";
import { checkServicesHealth, isLoopbackHost, probeTcp } from "../.build/bridge/health.js";
import { gateDshRestart, normalizeOpsPolicy } from "../.build/bridge/ops.js";
import { addSecret } from "../.build/redact.js";

test("bridge catalog: L0 ids include instance.status and sensitive ops", () => {
  const { agentCapVersion, capabilities } = listCapabilities();
  assert.equal(agentCapVersion, AGENT_CAP_VERSION);
  const ids = capabilities.map((c) => c.id);
  for (const id of [
    "instance.status",
    "instance.metrics",
    "instance.enrollment",
    "instance.logs.tail",
    "services.health",
    "dsh.restart",
    "plugin.reload",
    "plugin.update",
  ]) {
    assert.ok(ids.includes(id), "missing " + id);
  }
  const restart = findCapability("dsh.restart");
  assert.equal(restart.sensitive, true);
  assert.equal(restart.permission, "restart");
  assert.equal(findCapability("instance.status").stream, false);
});

test("bridge router: list + invoke instance.status", async () => {
  const router = new BridgeRouter({
    status: () => ({
      dshReady: true,
      restartNeeded: false,
      plugin: "0.1.0",
      platform: "linux",
      arch: "x64",
      cpu: 12,
      memUsed: 40,
      load: 0.5,
      uptime: 100,
      rss: 80,
    }),
    enrollment: () => ({ hub: "https://remote.example", fingerprintPrefix: "abcdef123456" }),
  });
  const list = router.list();
  assert.ok(list.capabilities.length >= 8);

  const ok = await router.invoke("instance.status", {}, "req-1");
  assert.equal(ok.ok, true);
  assert.equal(ok.requestId, "req-1");
  assert.equal(ok.data.dshReady, true);
  assert.equal(ok.data.plugin, "0.1.0");
  assert.equal(ok.data.platform, "linux");

  const metrics = await router.invoke("instance.metrics", {}, "req-m");
  assert.equal(metrics.ok, true);
  assert.equal(metrics.data.cpu, 12);

  const en = await router.invoke("instance.enrollment", {}, "req-e");
  assert.equal(en.ok, true);
  assert.equal(en.data.hub, "https://remote.example");

  const missing = await router.invoke("no.such", {}, "req-x");
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "NOT_FOUND");
});

test("bridge handleControlMessage: capability.list / invoke wire shape", async () => {
  const router = new BridgeRouter({
    status: () => ({ dshReady: false, plugin: "0.1.0" }),
    enrollment: () => ({}),
  });
  const listed = await handleControlMessage(router, { type: "capability.list", id: "1" });
  assert.ok(listed.agentCapVersion);
  assert.ok(Array.isArray(listed.capabilities));

  const invoked = await handleControlMessage(router, {
    type: "capability.invoke",
    id: "2",
    capability: "instance.status",
    params: {},
    requestId: "r-wire",
  });
  assert.equal(invoked.ok, true);
  assert.equal(invoked.requestId, "r-wire");
  assert.equal(invoked.data.plugin, "0.1.0");

  assert.equal(await handleControlMessage(router, { type: "sso.request", id: "3" }), null);
});

test("logs.tail: ring + redact secrets; clamp lines", async () => {
  assert.equal(clampLogLines({}), 100);
  assert.equal(clampLogLines({ lines: 0 }), 1);
  assert.equal(clampLogLines({ lines: 9999 }), 500);

  const ring = new LogRing(50);
  addSecret("SUPERSECRETTOKEN99");
  ring.push("hello cookie: session=abc123xyz", "info");
  ring.push("Authorization: Bearer SUPERSECRETTOKEN99", "warn");
  ring.push("enroll ABCD-EFGH-IJKL ok", "agent");

  const router = new BridgeRouter({
    status: () => ({}),
    enrollment: () => ({}),
    logs: { tail: (n) => ring.tail(n) },
  });
  const r = await router.invoke("instance.logs.tail", { lines: 10 }, "log-1");
  assert.equal(r.ok, true);
  assert.equal(r.data.source, "ring");
  assert.ok(r.data.entries.length >= 3);
  const blob = r.data.entries.map((e) => e.text).join("\n");
  assert.doesNotMatch(blob, /SUPERSECRETTOKEN99/);
  assert.doesNotMatch(blob, /session=abc123xyz/i);
  assert.match(blob, /\*\*\*/);
});

test("services.health: loopback whitelist only; no crash on miss", async () => {
  assert.equal(isLoopbackHost("127.0.0.1"), true);
  assert.equal(isLoopbackHost("8.8.8.8"), false);

  const refused = await probeTcp("8.8.8.8", 80, 200);
  assert.equal(refused.ok, false);
  assert.match(refused.error, /loopback/);

  const server = http.createServer((_req, res) => { res.end("ok"); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;

  const report = await checkServicesHealth({
    local: { host: "127.0.0.1", port },
    linkState: "online",
  });
  assert.equal(report.services.find((s) => s.id === "webServer").ok, true);
  assert.equal(report.services.find((s) => s.id === "hubLink").ok, true);

  const badHost = await checkServicesHealth({
    local: { host: "203.0.113.9", port: 9999 },
    linkState: "waiting",
  });
  assert.equal(badHost.services.find((s) => s.id === "webServer").ok, false);

  const router = new BridgeRouter({
    status: () => ({}),
    enrollment: () => ({}),
    local: () => ({ host: "127.0.0.1", port }),
    linkState: () => "online",
  });
  const hr = await router.invoke("services.health", {}, "h1");
  assert.equal(hr.ok, true);
  assert.ok(Array.isArray(hr.data.services));

  // missing local should not throw
  const router2 = new BridgeRouter({
    status: () => ({}),
    enrollment: () => ({}),
    local: () => null,
    linkState: () => "stopped",
  });
  const hr2 = await router2.invoke("services.health", {}, "h2");
  assert.equal(hr2.ok, true);
  assert.equal(hr2.data.services.find((s) => s.id === "webServer").ok, false);

  await new Promise((r) => server.close(r));
});

test("ops gates: restart disabled / dry-run / stub execute", async () => {
  const denied = gateDshRestart(normalizeOpsPolicy({}), {});
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "REMOTE_RESTART_DISABLED");

  const dry = gateDshRestart(normalizeOpsPolicy({ remoteRestart: true }), {});
  assert.equal(dry.ok, true);
  assert.equal(dry.data.dryRun, true);
  assert.equal(dry.data.executed, false);

  const stub = gateDshRestart(normalizeOpsPolicy({ remoteRestart: true }), { execute: true });
  assert.equal(stub.ok, false);
  assert.equal(stub.code, "STUB");

  const router = new BridgeRouter({
    status: () => ({}),
    enrollment: () => ({}),
    opsPolicy: () => ({ remoteRestart: false, allowPluginReload: false, allowPluginUpdate: false }),
  });
  const r = await router.invoke("dsh.restart", {}, "op1");
  assert.equal(r.ok, false);
  assert.equal(r.code, "REMOTE_RESTART_DISABLED");

  const routerOn = new BridgeRouter({
    status: () => ({}),
    enrollment: () => ({}),
    opsPolicy: () => ({ remoteRestart: true, allowPluginReload: true, allowPluginUpdate: true }),
  });
  const dryR = await routerOn.invoke("dsh.restart", { dryRun: true }, "op2");
  assert.equal(dryR.ok, true);
  assert.equal(dryR.data.executed, false);

  const execR = await routerOn.invoke("dsh.restart", { execute: true }, "op3");
  assert.equal(execR.ok, false);
  assert.equal(execR.code, "STUB");

  const reload = await router.invoke("plugin.reload", {}, "op4");
  assert.equal(reload.code, "RELOAD_DISABLED");
  const update = await router.invoke("plugin.update", {}, "op5");
  assert.equal(update.code, "UPDATE_DISABLED");
});
