import net from "node:net";

export interface LocalEndpoint {
  host: string;
  port: number;
}

export interface HealthService {
  id: string;
  ok: boolean;
  host?: string;
  port?: number;
  latencyMs?: number | null;
  detail?: string | null;
  error?: string | null;
}

export interface HealthReport {
  checkedAt: number;
  services: HealthService[];
}

/** Only loopback / unspecified→loopback are allowed for TCP probes. */
export function isLoopbackHost(host: string): boolean {
  const h = String(host || "").trim().toLowerCase();
  if (!h || h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0" || h === "::") return true;
  // IPv4 127/8
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

export function normalizeProbeHost(host: string): string {
  const h = String(host || "").trim();
  if (!h || h === "0.0.0.0" || h === "::") return "127.0.0.1";
  return h;
}

/** TCP connect probe with hard timeout. Never throws. */
export function probeTcp(host: string, port: number, timeoutMs = 1500): Promise<{ ok: boolean; latencyMs: number | null; error: string | null }> {
  const start = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean, error: string | null) => {
      if (settled) return;
      settled = true;
      try { sock.destroy(); } catch {}
      resolve({ ok, latencyMs: ok ? Date.now() - start : null, error });
    };
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      resolve({ ok: false, latencyMs: null, error: "bad port" });
      return;
    }
    if (!isLoopbackHost(host)) {
      resolve({ ok: false, latencyMs: null, error: "host not in loopback whitelist" });
      return;
    }
    const target = normalizeProbeHost(host);
    const sock = net.connect({ host: target, port, family: 4 });
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true, null));
    sock.once("timeout", () => done(false, "timeout"));
    sock.once("error", (e) => done(false, e && (e as Error).message ? (e as Error).message : "connect failed"));
  });
}

/**
 * Whitelist-only health check. Does NOT scan ports.
 * - webServer: only if local endpoint provided
 * - hubLink: soft status from linkState string (no network)
 */
export async function checkServicesHealth(opts: {
  local: LocalEndpoint | null | undefined;
  linkState?: string | null;
}): Promise<HealthReport> {
  const services: HealthService[] = [];
  const local = opts.local;
  if (local && local.port) {
    if (!isLoopbackHost(local.host)) {
      services.push({
        id: "webServer",
        ok: false,
        host: local.host,
        port: local.port,
        latencyMs: null,
        error: "refused: webServer host is not loopback",
      });
    } else {
      const r = await probeTcp(local.host, local.port);
      services.push({
        id: "webServer",
        ok: r.ok,
        host: normalizeProbeHost(local.host),
        port: local.port,
        latencyMs: r.latencyMs,
        error: r.error,
      });
    }
  } else {
    services.push({
      id: "webServer",
      ok: false,
      detail: "not ready",
      error: "webServer endpoint unknown",
    });
  }

  const st = opts.linkState != null ? String(opts.linkState) : null;
  if (st != null) {
    services.push({
      id: "hubLink",
      ok: st === "online",
      detail: st,
      error: st === "online" ? null : st,
    });
  }

  return { checkedAt: Date.now(), services };
}
