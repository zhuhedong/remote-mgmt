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

const sid = { type: "string", minLength: 1, maxLength: 200 };
function l1(id: string, title: string, description: string, properties: Record<string, unknown>, required: string[], category: "chat" | "config", stream = false): CapabilityDescriptor {
  return {
    id, title, description,
    params: { type: "object", properties, required, additionalProperties: false },
    stream, permission: "open", sensitive: false, minAgentVersion: "0.2.0", category,
  };
}

/** L1 (A1) chat/models over DSH sessionController. Declared only when the host exposes it. */
export const L1_CATALOG: CapabilityDescriptor[] = [
  l1("chat.sessions.list", "会话列表", "DSH 会话与 Spaces（按工作目录分组）", {}, [], "chat"),
  l1("chat.session.create", "新建会话", "新建 DSH 会话（可指定 cwd）", { cwd: { type: "string", maxLength: 1000 } }, [], "chat"),
  l1("chat.session.rename", "重命名会话", "修改会话标题", { sessionId: sid, title: { type: "string", minLength: 1, maxLength: 200 } }, ["sessionId", "title"], "chat"),
  l1("chat.session.delete", "删除会话", "删除一个 DSH 会话", { sessionId: sid }, ["sessionId"], "chat"),
  l1("chat.history", "会话历史", "按页读取会话消息", { sessionId: sid, maxMessages: { type: "integer", minimum: 1, maximum: 200 }, beforeSeq: { type: "integer", minimum: 0 } }, ["sessionId"], "chat"),
  l1("chat.prompt", "发送消息", "向会话发送一条消息（驱动 DSH agent loop）", { sessionId: sid, text: { type: "string", minLength: 1, maxLength: 20000 }, mode: { type: "string", enum: ["followup", "steer"] }, clientRequestId: { type: "string" } }, ["sessionId", "text"], "chat"),
  l1("chat.follow", "跟随回复", "长轮询会话状态（version 游标），流式文本在 live 字段", { sessionId: sid, version: { type: "integer" }, waitMs: { type: "integer", minimum: 0, maximum: 20000 } }, ["sessionId"], "chat", true),
  l1("chat.cancel", "停止回复", "取消当前回合", { sessionId: sid }, ["sessionId"], "chat"),
  l1("chat.answerAsk", "回答提问", "回答 ask_user_question（选项/自定义文本）", {
    sessionId: sid,
    callId: { type: "string", minLength: 1 },
    answers: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["id", "selected"],
        properties: {
          id: { type: "string" },
          selected: { type: "array", items: { type: "string" } },
          custom: { type: "string" },
        },
      },
    },
  }, ["sessionId", "callId", "answers"], "chat"),
  l1("models.list", "模型目录", "可用模型与当前选择", { sessionId: sid }, [], "config"),
  l1("models.select", "切换模型", "为会话选择模型", { sessionId: sid, provider: { type: "string" }, model: { type: "string" }, reasoningEffort: { type: "string" } }, ["sessionId", "provider", "model"], "config"),
];

export function listCapabilities(includeL1 = false): CapListResult {
  const all = includeL1 ? [...L0_CATALOG, ...L1_CATALOG] : L0_CATALOG;
  return { agentCapVersion: AGENT_CAP_VERSION, capabilities: all.map((c) => ({ ...c })) };
}

export function findCapability(id: string, includeL1 = false): CapabilityDescriptor | undefined {
  return L0_CATALOG.find((c) => c.id === id) || (includeL1 ? L1_CATALOG.find((c) => c.id === id) : undefined);
}
