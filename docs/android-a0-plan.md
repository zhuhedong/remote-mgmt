# Android A0 实施顺序（冻结）

- **依据**：设计稿 v2 + 用户确认推进（2026-10-24）+ L1 探针 `android-l1-probe-2026-10-24.md`
- **目标**：先交付「原生遥控器 L0」；**A1（chat/models）仅在探针通过后开工**——本次探针结论为 **通过（有条件）**，故 A1 可排在 A0 之后，但 **不得插入打断 A0**。

---

## 范围边界

| 做（A0） | 不做（A0） |
|----------|------------|
| Hub：`capabilities` / `invoke` / chunk 事件通道 | 原生对话、切模型 UI（→ A1） |
| Agent：Capability Bridge 骨架 + **全部 L0 facade** | 把 WebView 当主路径 |
| Android：登录 TOTP → 实例列表 → 工作台 L0 屏 | FCM 离线推送 |
| 敏感操作重验证 + 审计 + 参数脱敏 | 改 DSH 官方包 / 发真实聊天做联调 |

L0 能力 id（与 v2 §5.1 对齐）：

- `instance.status` · `instance.metrics` · `instance.enrollment`
- `instance.logs.tail` · `services.health`
- `dsh.restart` · `plugin.reload` · `plugin.update`（敏感）

---

## 默认实施顺序（写死）

### 1. Hub + Agent：`capability.list` / `invoke` 骨架 + L0 facade

- 冻结 Descriptor schema（id / title / params / stream / permission / sensitive / agentCapVersion）。
- Hub：`GET/POST` 能力目录、`POST /api/instances/:id/invoke`（或 WSS `capability.invoke`）、`capability.chunk` / `done` / `cancel`。
- Agent：`bridge/` 目录；把既有控制消息 **薄映射** 为 L0，不双轨语义。
- 验收：假 Agent 或单测可 list + invoke `instance.status` 打通。

**进度（2026-10-24）— 步骤 1 已完成（箱内源码）：**

- [x] Descriptor schema 冻结：`agent/src/bridge/types.ts` ↔ `hub/capability.go`（`agentCapVersion=1`）
- [x] Agent `bridge/`：`catalog`（全 L0 声明）/ `router`（list·invoke·cancel）/ 控制流 `capability.*`
- [x] L0 facade：status/metrics/enrollment/logs.tail/services.health 可用；敏感 ops 为安全闸（非 NOT_IMPLEMENTED）
- [x] Hub：`GET /api/instances/{id}/capabilities`、`POST /api/instances/{id}/invoke`（已登录；离线 503；owner 暂全过）
- [x] 单测：`agent` bridge list+invoke status；`hub` fake Agent list+invoke status
- [ ] 客户端 WSS chunk/done 推送（流式通道，长任务用；同步短任务已通）
- [x] 敏感重验证窗口（见步骤 4）

### 2. `instance.status` / `metrics` / `enrollment`

- 复用现有 Agent `status` 指标与登记态（hub、fingerprint 前缀、dshReady、plugin 版本）。
- Hub 控制台与 Android 工作台概览卡同一字段集。
- 验收：实例 online 时 App 概览卡有版本与延迟；offline 有明确空态。

**进度（2026-10-24）— Agent facade 已薄实现；App/控制台 UI 未做：**

- [x] Agent：`instance.status` / `metrics` / `enrollment` 可 invoke 返回结构化数据
- [x] Android 工作台已展示 status/metrics 字段；Hub Web 控制台对齐另议

### 3. `instance.logs.tail` / `services.health`

- 日志：环形缓冲 / 白名单文件 + **既有脱敏**（禁止密钥、token、cookie）。
- health：仅白名单本机探活（含已知 `webServer` loopback，勿扫全端口）。
- 验收：尾日志无敏感明文；health 失败不导致插件崩溃。

**进度（2026-10-24）— 已完成（箱内源码）：**

- [x] `LogRing` + `redact`；`instance.logs.tail` 返回脱敏 entries（默认 100 行，上限 500）
- [x] `services.health`：仅探 `webServer` loopback + `hubLink` 软状态；非 loopback 拒绝；失败不抛崩
- [x] 单测覆盖脱敏与 health 白名单

### 4. `dsh.restart` / `plugin.reload` / `plugin.update`（敏感 + 重验证）

- Hub：10 分钟重验证窗口；每次审计 user/instance/capability/requestId。
- Agent：restart 需本机策略允许；update 走 v3.1 验签发布。
- App：确认对话框 + 二次验证后再 invoke。
- 验收：无重验证时返回明确错误码；有重验证才执行。

**进度（2026-10-24）— Agent 闸门 + Hub 重验证已做；真实动作未做：**

- [x] Agent 闸门：`remoteRestart` / `allowPluginReload` / `allowPluginUpdate`（默认全关）→ 明确错误码
- [x] 策略开且未 `execute` → dry-run（`executed:false`）；`execute:true` → `STUB`（**不**真重启/重载/升级）
- [x] Hub：敏感 invoke 无近期 reauth → `REAUTH_REQUIRED`（不下发 Agent）；`POST /api/me/reauth`（密码或 TOTP）；审计
- [ ] 真实 restart / Cordis reload / 验签 update
- [x] App 确认对话框 + 调 reauth（Android 工作台）

### 5. Android 壳：登录 TOTP → 实例列表 → 工作台 L0 屏

- Kotlin + Compose；证书锁定按 v2。
- 屏：登录 → 实例列表 → 工作台（概览 / 指标 / 日志 / 操作）。
- 能力卡片 = `capability.list` ∩ App 已知渲染器；缺关键 L0 →「请升级远程插件」。
- 验收：侧载安装后可完成登录到 L0 操作闭环（对测试实例）。

**进度（2026-10-24）— L0 壳源码完成（无 Android SDK，APK 未编）：**

- [x] 登录 / 实例列表 / 工作台：status · metrics · logs.tail · health
- [x] 敏感操作确认框 + `REAUTH_REQUIRED` → reauth 对话框 → 重试 invoke
- [x] 离线 / 错误空态文案
- [x] OkHttp + 可配 Hub；`GET /api/instances` 别名
- [ ] 本机 Android Studio 编 APK / 证书 pinning / EncryptedSharedPreferences

### 6. A1 仅当探针通过

- **探针状态（2026-10-24）：通过（有条件）** — 见 `android-l1-probe-2026-10-24.md`。
- A1 入口：`session.*` Remote（`prompt` / `follow` / `modelCatalog` / `selectModel`…），经 Agent Bridge 暴露为 `chat.*` / `models.*`。
- A1 **排在步骤 1–5 完成之后**；实现顺序建议：`models.catalog` → `chat.sessions.list/create` → `models.select` → `chat.prompt` 流式。
- 若后续 Desktop 升级导致探测失败：目录不声明 L1，不阻塞 L0 发布。

---

## 里程碑与依赖

```
A0.1  schema + Hub/Agent invoke 骨架
A0.2  status/metrics/enrollment
A0.3  logs.tail + services.health
A0.4  敏感 restart/reload/update
A0.5  Android L0 壳
───── A0 可发布 ─────
A1.0  session 探测 + models.catalog / select
A1.1  chat prompt + follow → chunk
A1.2  工具/审批原生（可选）
```

并行允许：Hub 登录/登记/WSS（v3.1 0.1–0.3）与 A0.1 一起做；**禁止**并行把 WebView 对话当 A0 交付物。

---

## 回滚

- Agent：feature flag 关闭 Bridge L1 声明；L0 facade 可单独关敏感能力。
- App：已知能力表降级；缺能力只藏卡片，不崩。
- Hub：invoke 未知 id → 明确 error，不影响既有 open/SSO 管理流。
