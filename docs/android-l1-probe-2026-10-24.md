# Android L1 探针报告（只读）

- **日期**：2026-10-24（Asia/Shanghai）
- **机器**：`codedeMac-Pro.local` / machineId `6511783d-99a1-463e-8f30-5a397f9599b7`
- **App**：`/Applications/DSH Desktop.app`（运行中）
- **Profile**：`~/Library/Application Support/dsh-desktop/harness/profiles/web/`
- **Harness 包版本抽样**：`@deepseek-ai/*` **0.2.1-rc.2**（来自 `app.asar`）
- **约束**：只读；未改配置、未发聊天、未重启 DSH。

---

## 结论（一句话）

**L1 可以走「宿主机插件注入 / Typert Remote `session.*`」封装，而不是再套网页；chat / models 都有可指名的稳定入口，但属于内部 Remote 面（随 Desktop 0.2.x 绑定），需要在 Agent 里做版本门控与流式 mux，不能当公开 HTTP API 直接打。**

---

## chat 可否做

**是（有条件）**

证据：

1. 宿主服务 `@deepseek-ai/dsh-api-session-controller` 以 Cordis Service 名 **`sessionController`** 注册，Typert namespace **`session`**。
2. 已装饰为 Remote 的方法（从 `lib/types/index.js` 抽出）包括：  
   `create` · `list` · `search` · `prompt` · `selectModel` · `modelCatalog` · `cancel` · `control` · `follow` · `fork` · `delete` · `rename` · `page` · `projections` · `updateQueue` · `initializeDefaultModel` · `attachment` · `openWorkspacePath` · …
3. Web 客户端同一路径：`ctx.remote.session.prompt(...)` / `follow(...)` / `create`；流式依赖 Gateway **`/api/remote.mux`**（`REMOTE_STREAM_MUX_PATH`）。
4. `dsh-remote-agent` 已在同进程注入 `connection` + `webServer`，具备继续 `inject`/`get` 其它宿主服务的先例（与 tunnel 插件同一模式）。

条件 / 缺口：

- 这是 **Typert Remote 内部契约**，不是 npm 上给第三方的稳定 HTTP 文档；应用 `agentCapVersion` + Desktop/harness 版本门控。
- 真正「像桌面一样对话」（工具、子代理、审批）必须走 **session/agent loop**，不能只调 `ctx.llm` 的 `stream`（那是 provider 生成层）。
- 流式要接 Gateway mux 或由 Bridge 把 `follow` 帧转成 `capability.chunk`；探针未做鉴权升级，未实测 mux 帧。
- Host 侧调用是否需要 `principal`/peer 上下文，需在 A1 实现时用最小 `list`/`modelCatalog` 试调验证（仍可不发用户消息）。

---

## models 可否做

**是（列表 + 会话内选择）；不是「外部随意 set provider」**

证据：

1. **会话级（推荐给 App）**  
   - `session.modelCatalog` — 模型目录投影  
   - `session.selectModel` — 为当前 session 选模型  
   - `session.initializeDefaultModel`
2. **LLM 服务层**  
   - Cordis Service 名 **`llm`**（`@deepseek-ai/dsh-llm`）  
   - `registerAdapter` / `listModels(provider)` / `registerModelDiscovery` / `registerConfigurableProviders`
3. **`dsh-our-free-model` 2.5.9**  
   - 通过 `ctx.llm.registerAdapter(['our-free-model','our-free-model-region'], adapter)` 挂上  
   - 另有 `registerModelDiscovery`、`registerConfigurableProviders`  
   - 数据目录 `harness/our-free-model/catalog.json` 当前 **9** 个 id（如 `deepseek-v4.1-flash-free`、`glm-5.3-flash-free`…）  
   - **本质是 LLM provider adapter**，不是独立聊天 API；外部「切换模型」应走 DSH 的 `selectModel` / UI 同源路径，而不是改 `catalog.json` 或假冒 provider。

---

## 本机监听（webServer 等）

| 地址 | PID / 进程 | 判定 | GET 探活（无副作用） |
|------|------------|------|----------------------|
| `127.0.0.1:43129` | DSH Helper `87324`（node utility） | **dsh `webServer`** | `/` → 401，正文含 `dsh web authentication required; reopen the URL printed by dsh web`（与 `connection.authenticatedUrl` 文案一致）；`/api`、`/dsh-remote-agent` → 401 `unauthorized`；`/health` → 404 |
| `*:43127` | DSH Desktop 主进程 `86855` | Desktop 壳 / 配对页 | `/` → 200 HTML；多数 API → 401 `Pair your phone again.` |
| `127.0.0.1:8326` | 同 `87324` | OpenAI 兼容网关（非 dsh web UI） | 任意路径 → 401 JSON `invalid_api_key`；OPTIONS `/` → 204 CORS |
| `127.0.0.1:55960` | 同 `87324` | 未完全定性的内部口 | 一律 401 `authentication required` |

说明：

- Agent 源码已用 `ctx.inject(['webServer'], …)` 读 `webServer.port`；与 **43129** 行为吻合。
- `our-free-model` 设置里 forward `18899` / chan relay `18326` 当前均为 **disabled**；**8326 不是**该插件配置的 forward 口（`index.js` 无 `8326`/`listen`）。
- Cloudflare tunnel 子进程另有 metrics `127.0.0.1:55966`（与上表无关）。

---

## `connection` 服务：已知面

来源：`@deepseek-ai/dsh-client-connection` + 已装插件 + `dsh-remote-agent` 源码。

| 符号 | 作用 |
|------|------|
| `authenticatedUrl(baseUrl)` | 给干净应用 URL 加上进程 launch token（query）；**token 不应出本机**（Agent SSO 已本地兑换 cookie） |
| `requestRejection(req)` | Host/Origin + Peer 围栏；控制路由前必查 |
| `rpc.call(channel, endpoint, payload)` | 客户端一元 RPC；channel 形如 `/dsh-remote-agent` |
| `rpc.handle(channel, handler, { authority })` | 宿主注册（Agent fallback 路径） |
| `rpc.intercept('/api', …)` | **Gateway** 挂在 `/api` 上分发 Typert RPC |
| `trustedHosts` | 写入 `cordis.patch.yml` 的 host allowlist（Agent 已维护） |

**已知 RPC channel / 前缀（本机可见）：**

| 前缀 | 来源 |
|------|------|
| `/api` | `dsh-api-gateway` intercept（业务 Remote，含 session） |
| `/api/remote.mux` | Gateway WebSocket mux（事件/流） |
| `/dsh-remote-agent` | 本插件 `PREFIX`（status/enroll/connect/…） |
| `/dsh-cloudflare-tunnel` | 隧道插件 |

Channel 名模式（client）：`/^\/[A-Za-z0-9._~-]+$/`；endpoint 段：`/^[A-Za-z0-9_$.-]+$/`。

---

## 可用入口表（给 Capability Bridge）

| 能力意向 | 推荐封装入口 | 备选 | 稳定程度 | 备注 |
|----------|--------------|------|----------|------|
| 列会话 | `sessionController` / `remote.session.list` | — | 高（UI 同路径） | L1 |
| 建会话 | `remote.session.create` | — | 高 | L1 |
| 发消息 | `remote.session.prompt` | 误用 `llm.stream` ❌ | 高 | 需 requestId；会驱动 agent loop |
| 流式回复 | `remote.session.follow` + mux | Bridge 轮询 page ❌ | 中高 | 需把帧映射为 `capability.chunk` |
| 取消 | `remote.session.cancel` | — | 高 | |
| 模型目录 | `remote.session.modelCatalog` | `llm.listModels` + providers | 高 | App 优先 session 投影 |
| 切模型 | `remote.session.selectModel` | 改 our-free `catalog.json` ❌ | 高 | 会话作用域 |
| Our Free 列表旁路 | 读 `harness/our-free-model/catalog.json` | — | 低（插件私有） | 仅调试；不作为正式 API |
| 打开网页兜底 | 现有 `authenticatedUrl` SSO | 子域代理 | 已落地 | **非** L1 主路径 |
| 管理 L0 | 现有 Agent status/metrics + 扩展 | — | 已部分有 | 见 A0 |

---

## 风险

1. **版本绑定**：入口随 `@deepseek-ai/*@0.2.1-rc.2`；Desktop 升级可能改 Remote 名或参数。必须 `agentCapVersion` + 运行时探测（`typeof session.prompt`）。
2. **权限 / principal**：Host 插件直接调 `prompt` 可能与浏览器 Peer 鉴权模型不一致；A1 先试 `list`/`modelCatalog`，再试空会话，最后才 `prompt`。
3. **副作用**：`prompt`/`create`/`selectModel` 会写 session 持久化；实现阶段要显式用户手势，探针阶段禁止。
4. **流式复杂度**：mux、审批、工具卡片、子代理事件都比「纯文本 chunk」重；A1 可先文本增量，工具 UI 放 A1.1。
5. **密钥面**：`openai-gateway/api-key`、`.credentials.yaml`、launch token 均在本机；Bridge 不得外泄。
6. **8326 OpenAI 口**：若误当成聊天入口，会绕过 session/agent，与桌面行为不一致，且需 API key。

---

## 建议范围

### A0（立即做，不依赖本次 L1 成功条件以外的事）

按 `android-a0-plan.md`：Hub + Agent `capability.list`/`invoke` 骨架 + **全部 L0 facade** + Android 壳（登录 → 实例 → 工作台 L0）。  
网页打开保留给 Web 管理台 / 可选兜底，**默认关闭**于 Android 主路径。

### A1（探针通过 → 可排期）

1. Agent Bridge adapters：  
   `chat.sessions.list|create` · `chat.prompt`（stream）· `chat.cancel` · `models.catalog` · `models.select`
2. 实现顺序：`modelCatalog` → `list` → `create` → `selectModel` → `prompt`+`follow` 映射 chunk  
3. 版本门控：harness/`sessionController` 探测失败则 capability 目录不声明 L1，App 显示「需升级 Desktop/插件」
4. **不做**：把 our-free HTTP/catalog 当官方聊天协议；不做无鉴权 loopback POST 聊天

### 明确暂缓

- 完整工具/审批/子代理原生 UI（A1.1+）
- 自定义 Tabs / WebView 主路径（与 v2 能力桥目标相反）

---

## 探针方法摘要

- `lsof` + 进程表；Python `urllib` 对 8326/43127/43129/55960 做 GET/OPTIONS  
- Electron-as-Node 读取 `app.asar/node_modules/@deepseek-ai/**`  
- 阅读已装 `dsh-remote-agent`、`dsh-our-free-model` 与 box 上 Agent 源码  
- **未**调用 `prompt`、未写入配置、未重启
