import { findCapability, listCapabilities } from "./catalog.js";
import { clampLogLines } from "./logs.js";
import { checkServicesHealth } from "./health.js";
import { DEFAULT_OPS_POLICY, gateDshRestart, gatePluginReload, gatePluginUpdate, normalizeOpsPolicy } from "./ops.js";
import type { BridgeDeps, CapListResult, InvokeResult } from "./types.js";

const active = new Map<string, { cancelled: boolean }>();

function fail(code: string, message: string): never {
  const e: any = new Error(message);
  e.code = code;
  throw e;
}

export class BridgeRouter {
  constructor(private deps: BridgeDeps) {}

  list(): CapListResult {
    return listCapabilities(this.l1());
  }

  private l1(): boolean {
    try { return Boolean(this.deps.chat && this.deps.chat.available()); } catch { return false; }
  }

  cancel(requestId: string): boolean {
    const a = active.get(requestId);
    if (!a) return false;
    a.cancelled = true;
    return true;
  }

  async invoke(capability: string, params: Record<string, unknown> | undefined, requestId: string): Promise<InvokeResult> {
    if (!requestId || typeof requestId !== "string") {
      return { ok: false, requestId: String(requestId || ""), code: "VALIDATION", message: "requestId required" };
    }
    const desc = findCapability(capability, this.l1());
    if (!desc) {
      return { ok: false, requestId, code: "NOT_FOUND", message: `unknown capability: ${capability}` };
    }
    const slot = { cancelled: false };
    active.set(requestId, slot);
    try {
      const data = await this.dispatch(desc.id, params || {}, requestId, slot);
      if (slot.cancelled) {
        return { ok: false, requestId, code: "CANCELLED", message: "cancelled" };
      }
      return { ok: true, requestId, data };
    } catch (e: any) {
      const code = e && e.code ? String(e.code) : "INTERNAL";
      const message = e && e.message ? String(e.message) : "invoke failed";
      return { ok: false, requestId, code, message };
    } finally {
      active.delete(requestId);
    }
  }

  private async dispatch(
    id: string,
    params: Record<string, unknown>,
    _requestId: string,
    _slot: { cancelled: boolean },
  ): Promise<unknown> {
    switch (id) {
      case "instance.status":
        return this.facadeStatus();
      case "instance.metrics":
        return this.facadeMetrics();
      case "instance.enrollment":
        return this.facadeEnrollment();
      case "instance.logs.tail":
        return this.facadeLogsTail(params);
      case "services.health":
        return this.facadeHealth();
      case "dsh.restart":
        return this.facadeOps("dsh.restart", params);
      case "plugin.reload":
        return this.facadeOps("plugin.reload", params);
      case "plugin.update":
        return this.facadeOps("plugin.update", params);
      case "chat.sessions.list": return this.deps.chat!.sessionsList();
      case "chat.session.create": return this.deps.chat!.sessionCreate(params);
      case "chat.session.rename": return this.deps.chat!.sessionRename(params);
      case "chat.session.delete": return this.deps.chat!.sessionDelete(params);
      case "chat.history": return this.deps.chat!.history(params);
      case "chat.prompt": return this.deps.chat!.prompt(params);
      case "chat.follow": return this.deps.chat!.follow(params);
      case "chat.cancel": return this.deps.chat!.cancel(params);
      case "models.list": return this.deps.chat!.modelsList(params);
      case "models.select": return this.deps.chat!.modelsSelect(params);
      default:
        fail("NOT_FOUND", `unknown capability: ${id}`);
    }
  }

  private facadeStatus(): Record<string, unknown> {
    const s = this.deps.status() || {};
    return {
      dshReady: Boolean(s.dshReady),
      restartNeeded: Boolean(s.restartNeeded),
      plugin: s.plugin ?? null,
      platform: s.platform ?? null,
      arch: s.arch ?? null,
      uptime: s.uptime ?? null,
      rss: s.rss ?? null,
      cpu: s.cpu ?? null,
      memUsed: s.memUsed ?? null,
      load: s.load ?? null,
      rtt: s.rtt ?? null,
      streams: s.streams ?? null,
    };
  }

  private facadeMetrics(): Record<string, unknown> {
    const s = (this.deps.metrics ? this.deps.metrics() : this.deps.status()) || {};
    return {
      cpu: s.cpu ?? null,
      memUsed: s.memUsed ?? null,
      load: s.load ?? null,
      uptime: s.uptime ?? null,
      rss: s.rss ?? null,
      platform: s.platform ?? null,
      arch: s.arch ?? null,
      rtt: s.rtt ?? null,
    };
  }

  private facadeEnrollment(): Record<string, unknown> {
    return this.deps.enrollment() || {};
  }

  private facadeLogsTail(params: Record<string, unknown>): Record<string, unknown> {
    const lines = clampLogLines(params);
    if (!this.deps.logs || typeof this.deps.logs.tail !== "function") {
      return { lines, entries: [], source: "none", note: "log ring not attached" };
    }
    const entries = this.deps.logs.tail(lines);
    return { lines: entries.length, requested: lines, entries, source: "ring" };
  }

  private async facadeHealth(): Promise<Record<string, unknown>> {
    try {
      const local = this.deps.local ? this.deps.local() : null;
      const linkState = this.deps.linkState ? this.deps.linkState() : null;
      const report = await checkServicesHealth({ local, linkState });
      return report as unknown as Record<string, unknown>;
    } catch (e: any) {
      // health must not crash the plugin
      return {
        checkedAt: Date.now(),
        services: [],
        error: e && e.message ? String(e.message) : "health failed",
      };
    }
  }

  private facadeOps(which: "dsh.restart" | "plugin.reload" | "plugin.update", params: Record<string, unknown>): Record<string, unknown> {
    const policy = normalizeOpsPolicy(this.deps.opsPolicy ? this.deps.opsPolicy() : DEFAULT_OPS_POLICY);
    const gate =
      which === "dsh.restart" ? gateDshRestart(policy, params)
        : which === "plugin.reload" ? gatePluginReload(policy, params)
          : gatePluginUpdate(policy, params);
    if (!gate.ok) fail(gate.code, gate.message);
    return gate.data;
  }
}

/** Handle Hub control-plane messages. Returns a reply body (without type/id) or null if not a capability msg. */
export async function handleControlMessage(
  router: BridgeRouter,
  msg: any,
): Promise<Record<string, unknown> | null> {
  if (!msg || typeof msg !== "object") return null;
  if (msg.type === "capability.list") {
    const list = router.list();
    return { agentCapVersion: list.agentCapVersion, capabilities: list.capabilities };
  }
  if (msg.type === "capability.invoke") {
    const capability = String(msg.capability || msg.cap || "");
    const requestId = String(msg.requestId || "");
    const params = msg.params && typeof msg.params === "object" ? (msg.params as Record<string, unknown>) : {};
    const result = await router.invoke(capability, params, requestId);
    return result as unknown as Record<string, unknown>;
  }
  if (msg.type === "capability.cancel") {
    const requestId = String(msg.requestId || "");
    const ok = router.cancel(requestId);
    return { cancelled: ok, requestId };
  }
  return null;
}
