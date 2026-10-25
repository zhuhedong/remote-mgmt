/** Capability Bridge types — aligned with Hub Go Descriptor and design v2 §4.1 */

import type { LogEntry } from "./logs.js";
import type { LocalEndpoint } from "./health.js";
import type { OpsPolicy } from "./ops.js";

export type CapPermission = "open" | "manage" | "restart" | "update";
export type CapCategory = "observe" | "operate" | "chat" | "config";

export interface CapabilityDescriptor {
  id: string;
  title: string;
  description?: string;
  /** JSON Schema object (simplified); kept as plain object for wire compatibility */
  params: Record<string, unknown>;
  stream: boolean;
  permission: CapPermission;
  sensitive: boolean;
  minAgentVersion?: string;
  category?: CapCategory;
}

export interface CapListResult {
  agentCapVersion: number;
  capabilities: CapabilityDescriptor[];
}

export interface InvokeRequest {
  /** Capability id, e.g. instance.status */
  capability: string;
  params?: Record<string, unknown>;
  requestId: string;
}

export interface InvokeOk {
  ok: true;
  requestId: string;
  data: unknown;
}

export interface InvokeErr {
  ok: false;
  requestId: string;
  code: string;
  message: string;
}

export type InvokeResult = InvokeOk | InvokeErr;

/** Dependencies adapters need from the plugin host (thin facades). */
export interface BridgeDeps {
  /** Same payload shape as HubLink status push (metrics + plugin flags). */
  status: () => Record<string, unknown>;
  /** Enrollment / connection summary for instance.enrollment */
  enrollment: () => Record<string, unknown>;
  /** Optional richer metrics; defaults to status() subset if omitted */
  metrics?: () => Record<string, unknown>;
  /** Redacted log ring tail */
  logs?: { tail: (lines: number) => LogEntry[] };
  /** Known dsh webServer loopback endpoint (whitelist health only) */
  local?: () => LocalEndpoint | null;
  /** Hub link state string for soft health (online/waiting/…) */
  linkState?: () => string | null;
  /** Sensitive ops policy */
  opsPolicy?: () => OpsPolicy;
  /** A1 chat/models bridge over DSH sessionController (optional). */
  chat?: import("./chat.js").ChatBridge;
  log?: { info: (m: string) => void; warn: (m: string) => void };
}

export const AGENT_CAP_VERSION = 3;

export const emptyObjectParams: Record<string, unknown> = {
  type: "object",
  properties: {},
  additionalProperties: false,
};
