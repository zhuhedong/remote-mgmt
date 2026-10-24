/** A0.4 skeleton: safety gates + dry-run / stub. No real process kill or package install. */

export interface OpsPolicy {
  /** When false, dsh.restart is refused. Default false. */
  remoteRestart: boolean;
  /** When false, plugin.reload is refused. Default false. */
  allowPluginReload: boolean;
  /** When false, plugin.update is refused. Default false. */
  allowPluginUpdate: boolean;
}

export const DEFAULT_OPS_POLICY: OpsPolicy = {
  remoteRestart: false,
  allowPluginReload: false,
  allowPluginUpdate: false,
};

export function normalizeOpsPolicy(raw: Partial<OpsPolicy> | null | undefined): OpsPolicy {
  const r = raw || {};
  return {
    remoteRestart: r.remoteRestart === true,
    allowPluginReload: r.allowPluginReload === true,
    allowPluginUpdate: r.allowPluginUpdate === true,
  };
}

function wantExecute(params: Record<string, unknown>): boolean {
  return params && (params.execute === true || params.dryRun === false);
}

export type OpsGateResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: string; message: string };

/** dsh.restart gate — never actually restarts in this skeleton. */
export function gateDshRestart(policy: OpsPolicy, params: Record<string, unknown>): OpsGateResult {
  if (!policy.remoteRestart) {
    return {
      ok: false,
      code: "REMOTE_RESTART_DISABLED",
      message: "remoteRestart is disabled on this agent (set config.remoteRestart=true to allow dry-run/execute path)",
    };
  }
  if (!wantExecute(params)) {
    return {
      ok: true,
      data: {
        capability: "dsh.restart",
        dryRun: true,
        allowed: true,
        executed: false,
        message: "dry-run only; pass execute:true to request restart (still stubbed in A0.4)",
      },
    };
  }
  // Safety: refuse real restart even when policy allows — wire later.
  return {
    ok: false,
    code: "STUB",
    message: "dsh.restart execute is stubbed; real restart not wired yet (A0.4 skeleton)",
  };
}

export function gatePluginReload(policy: OpsPolicy, params: Record<string, unknown>): OpsGateResult {
  if (!policy.allowPluginReload) {
    return {
      ok: false,
      code: "RELOAD_DISABLED",
      message: "plugin.reload disabled (config.allowPluginReload=true to enable gate)",
    };
  }
  if (!wantExecute(params)) {
    return {
      ok: true,
      data: {
        capability: "plugin.reload",
        dryRun: true,
        allowed: true,
        executed: false,
        message: "dry-run only; Cordis hot-reload not wired",
      },
    };
  }
  return {
    ok: false,
    code: "STUB",
    message: "plugin.reload execute is stubbed; hot-reload not wired yet",
  };
}

export function gatePluginUpdate(policy: OpsPolicy, params: Record<string, unknown>): OpsGateResult {
  if (!policy.allowPluginUpdate) {
    return {
      ok: false,
      code: "UPDATE_DISABLED",
      message: "plugin.update disabled (config.allowPluginUpdate=true to enable gate)",
    };
  }
  if (!wantExecute(params)) {
    return {
      ok: true,
      data: {
        capability: "plugin.update",
        dryRun: true,
        allowed: true,
        executed: false,
        message: "dry-run only; signed update path not wired",
      },
    };
  }
  return {
    ok: false,
    code: "STUB",
    message: "plugin.update execute is stubbed; signed self-update not wired yet",
  };
}
