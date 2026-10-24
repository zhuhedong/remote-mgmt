# A1：原生对话 + 模型切换（2026-10-24）

## Agent（dsh-remote-agent 0.2.0，agentCapVersion=2）
同进程 `ctx.inject(['sessionController'])`（`@deepseek-ai/dsh-api-session-controller`，Typert `session.*`）。探测不到则**不声明** L1，App 提示升级。

| 能力 | 宿主调用 | 风险 |
|---|---|---|
| `chat.sessions.list` | `list({})` → sessions + Spaces（按 cwd 分组） | observe |
| `chat.session.create` | `create({cwd?})` | normal |
| `chat.history` | `page({address:{kind:'session',sessionId},maxMessages,beforeSeq})` | observe |
| `chat.prompt` | `prompt({requestId,sessionId,mode:'followup',content:[{type:'text',text}]}, signal)` | normal |
| `chat.follow` | 长轮询；Agent 内部常驻 `follow({address,assistantStream:true})`，折叠 snapshot / event / assistant-stream(`text-delta`) 为 `{version,messages,live,running}` | observe |
| `chat.cancel` | `cancel({sessionId})` | normal |
| `models.list` | `modelCatalog()` + `projections({sessionId}).values.modelSelection.next` | observe |
| `models.select` | `selectModel({sessionId,provider,model,reasoningEffort?})` | normal |

流式：App 调 `chat.follow {version, waitMs≤20000}`，有变化立即返回，否则等待；follower 空闲 120s 自动关闭。不走公开 HTTP / mux。

## Hub
`invokeTimeout`（follow 28s，prompt/list 45s）、`capabilityRisk`（prompt/select=normal，不需重验证）、高频读轮询不写成功审计。

## Android（参照 WorkBuddy）
底部 Tab：任务 / 定时任务 / 发现 / 我的；任务=对话优先，左抽屉含设备切换、新建任务、任务列表、Spaces（项目文件夹，可展开，+ 新建，运行中转圈）；对话头部标题+设备|项目副标题、新对话、更多；用户消息右侧气泡、回复纯文本+基础 Markdown、工具步骤折叠卡片；输入框含语音（占位）、模型选择 chip（就地切换）、+、发送/停止。A0 监控页移到「我的 → 设备」。
