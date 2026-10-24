import {
  AGENT_CAP_VERSION,
  emptyObjectParams,
  type CapListResult,
  type CapabilityDescriptor,
} from "./types.js";

export { AGENT_CAP_VERSION };

/** L0 capability directory. Adapters may still return NOT_IMPLEMENTED until A0.2–A0.4. */
export const L0_CATALOG: CapabilityDescriptor[] = [
  {
    id: "instance.status",
    title: "实例状态",
    description: "在线、DSH/插件/OS/Node 版本、就绪态",
    params: emptyObjectParams,
    stream: false,
    permission: "open",
    sensitive: false,
    minAgentVersion: "0.1.0",
    category: "observe",
  },
  {
    id: "instance.metrics",
    title: "实时指标",
    description: "CPU / 内存 / 负载 / RSS",
    params: emptyObjectParams,
    stream: false,
    permission: "open",
    sensitive: false,
    minAgentVersion: "0.1.0",
    category: "observe",
  },
  {
    id: "instance.enrollment",
    title: "登记摘要",
    description: "指纹前缀、Hub、延迟、连接态",
    params: emptyObjectParams,
    stream: false,
    permission: "open",
    sensitive: false,
    minAgentVersion: "0.1.0",
    category: "observe",
  },
  {
    id: "instance.logs.tail",
    title: "日志尾",
    description: "脱敏日志尾（环形缓冲）",
    params: {
      type: "object",
      properties: {
        lines: { type: "integer", minimum: 1, maximum: 500, default: 100 },
      },
      additionalProperties: false,
    },
    stream: false,
    permission: "manage",
    sensitive: false,
    minAgentVersion: "0.1.0",
    category: "observe",
  },
  {
    id: "services.health",
    title: "本机服务健康",
    description: "白名单 loopback 探活",
    params: emptyObjectParams,
    stream: false,
    permission: "open",
    sensitive: false,
    minAgentVersion: "0.1.0",
    category: "observe",
  },
  {
    id: "dsh.restart",
    title: "重启 DSH",
    description: "需本机允许远程重启",
    params: {
      type: "object",
      properties: {
        dryRun: { type: "boolean", default: true },
        execute: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
    stream: false,
    permission: "restart",
    sensitive: true,
    minAgentVersion: "0.1.0",
    category: "operate",
  },
  {
    id: "plugin.reload",
    title: "重载远程插件",
    description: "热重载 dsh-remote-agent（若运行时支持）",
    params: {
      type: "object",
      properties: {
        dryRun: { type: "boolean", default: true },
        execute: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
    stream: false,
    permission: "restart",
    sensitive: true,
    minAgentVersion: "0.1.0",
    category: "operate",
  },
  {
    id: "plugin.update",
    title: "升级远程插件",
    description: "验签后自升级",
    params: {
      type: "object",
      properties: {
        dryRun: { type: "boolean", default: true },
        execute: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
    stream: false,
    permission: "update",
    sensitive: true,
    minAgentVersion: "0.1.0",
    category: "operate",
  },
];

export function listCapabilities(): CapListResult {
  return { agentCapVersion: AGENT_CAP_VERSION, capabilities: L0_CATALOG.map((c) => ({ ...c })) };
}

export function findCapability(id: string): CapabilityDescriptor | undefined {
  return L0_CATALOG.find((c) => c.id === id);
}
