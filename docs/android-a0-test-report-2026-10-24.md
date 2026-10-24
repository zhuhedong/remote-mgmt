# Android A0 测试报告（2026-10-24）

**时区**：Asia/Shanghai（CST, UTC+8）  
**仓库路径**：`/workspace/remote-mgmt`  
**结论**：**A0 箱内可完成项已完成**；Hub / Agent 自动化测试全绿；Android **源码完成、APK 未编**（无 Android SDK）。

---

## 1. 本轮做了什么

### 1.1 Android（`remote-mgmt/android/`）

| 项 | 状态 | 说明 |
|----|------|------|
| 工作台 · `instance.metrics` | 完成 | `WorkbenchViewModel.refresh` → invoke；UI「指标」区 |
| 工作台 · `instance.logs.tail` | 完成 | 默认 `lines=80`；UI 日志尾区 |
| 工作台 · `services.health` | 完成 | UI「健康」区 |
| 敏感操作 | 完成 | `dsh.restart` / `plugin.reload` / `plugin.update`；确认框 + dry-run / execute |
| `REAUTH_REQUIRED` | 完成 | 弹 reauth（密码或 TOTP）→ `POST /api/me/reauth` → 重试 invoke |
| 错误 / 离线空态 | 完成 | `OFFLINE` / HTTP 503 明确文案；其它错误展示 message |
| JSON 嵌套兼容 | 完成 | `HubRepository.coerce` 处理 `JSONArray`；`HubClient.getJsonArray` 解析 `code`/`error` |

主要文件：

- `app/.../viewmodel/AppViewModels.kt`（Workbench 状态机）
- `app/.../ui/workbench/WorkbenchScreen.kt`
- `app/.../data/HubClient.kt` / `HubRepository.kt`
- `android/README.md`（A0 L0 能力表已更新）

### 1.2 Hub / Agent（安全小修；真实重启仍 stub）

| 项 | 状态 | 说明 |
|----|------|------|
| capabilities / invoke 离线响应 | 小修 | 503 返回结构化 `code: OFFLINE`（`capability.go`），便于客户端识别 |
| HTTP 冒烟 | 新增 | `hub/smoke_capability_test.go` → `TestHTTPSmokeCapabilityFlow`（本地临时 Hub + fake agent，不碰生产） |
| `dsh.restart` 真重启 | **保持 stub** | Agent `ops gates` 测试覆盖：disabled / dry-run / stub execute；**未**对用户 DSH 做真实重启 |
| 其它 L0 | 既有 | bridge catalog、logs.tail 脱敏、services.health 白名单等保持通过 |

### 1.3 文档

- `docs/android-a0-plan.md`：步骤 1–5 进度标注为箱内源码完成；注明无 SDK、APK 未编。
- 本报告：`docs/android-a0-test-report-2026-10-24.md`。

---

## 2. 测试命令与结果

### 2.1 Hub

```bash
cd /workspace/remote-mgmt/hub && go test -count=1 -v ./...
```

**结果**：`ok remotehub`（约 1.0–1.1s）— **16 PASS / 0 FAIL**

| 测试 | 结果 |
|------|------|
| TestCapabilityOffline | PASS |
| TestCapabilityListAndInvokeStatus | PASS |
| TestCapabilityUnauthorized | PASS |
| TestAgentCallCapabilityListDirect | PASS |
| TestSensitiveReauthRequiredThenOK | PASS |
| TestReauthTOTP | PASS |
| TestInstancesAlias | PASS |
| TestNonSensitiveSkipsReauth | PASS |
| TestTOTPVector | PASS |
| TestPassword | PASS |
| TestServiceHost | PASS |
| TestSlugify | PASS |
| TestLimiter | PASS |
| TestSameOriginAndAsk | PASS |
| TestTrustedProxy | PASS |
| TestHTTPSmokeCapabilityFlow | PASS |

冒烟说明：`TestHTTPSmokeCapabilityFlow` 在进程内起临时 Hub + fake agent，覆盖 login 路径相关的 capability list/invoke 形状；**未**连接 `remote.zhuhedong.cn`。

### 2.2 Agent

```bash
cd /workspace/remote-mgmt/agent && npm test
```

**结果**：**14 pass / 0 fail**（约 0.25–0.26s）

含 L0 相关：

- bridge catalog（含 `instance.status` 与敏感 ops）
- bridge router / control message wire shape
- `logs.tail` ring + redact + clamp
- `services.health` loopback whitelist
- **ops gates：restart disabled / dry-run / stub execute**（确认真实重启未启用）

### 2.3 Android APK

| 环境 | 探测结果 |
|------|----------|
| Box（执行机） | 无 JDK / 无 Android SDK |
| Mac `6511783d-99a1-463e-8f30-5a397f9599b7` | JDK 21 可用；`ANDROID_HOME`/`ANDROID_SDK_ROOT` 空；`/Users/code/sdk` 仅为 **Flutter**；无 Android Studio.app；无 `sdkmanager` |

**结论**：**源码完成、APK 未编**。未在本轮安装完整 Android cmdline-tools/SDK（体积大、超出「有 SDK 则 assemble」前提）。

---

## 3. 已知限制

1. **无 APK**：无法侧载真机验收「登录 → L0 操作」闭环；需本机装 Android SDK 后 `./gradlew :app:assembleDebug`。
2. **证书 pinning**：仍 TODO（系统信任库）。
3. **凭证存储**：未上 EncryptedSharedPreferences / Keystore。
4. **敏感 restart**：Agent 侧仍为 stub；Hub reauth + dry-run/execute 路径可测，但不会杀桌面 DSH。
5. **生产冒烟未做**：刻意不碰 `remote.zhuhedong.cn`；仅本地 `go test` 冒烟。
6. **Android 无单元测试 / CI**：Gradle 工程可编，但本环境未接 CI 编包。
7. **Hub Web 控制台字段对齐**：计划中「与 Android 概览卡同一字段集」另议，本轮未改 Web UI。

---

## 4. 建议下一步

1. **装 Android SDK**（Mac 或 CI）：`sdkmanager` platform-tools + 目标 API，然后：
   ```bash
   cd /path/to/remote-mgmt/android && ./gradlew :app:assembleDebug
   ```
   产出期望：`app/build/outputs/apk/debug/app-debug.apk`。
2. **真机侧载**：对测试实例走登录 → 工作台 → metrics/logs/health → 敏感 dry-run → reauth → stub execute。
3. **A1**（计划已允许在 A0 后）：`models.catalog` → chat sessions → `models.select` → `chat.prompt` 流式（勿插回打断 A0 收尾）。
4. **加固**：证书 pinning、加密会话存储、可选 FCM（A0 明确不做，可排后期）。
5. **可选**：把 `assembleDebug` 挂到 CI；Hub Web 概览卡与 Android 字段集对齐。

---

## 5. 验收对照（计划 A0.1–A0.5）

| 里程碑 | 箱内状态 |
|--------|----------|
| A0.1 schema + Hub/Agent invoke 骨架 | 完成（测试绿） |
| A0.2 status/metrics/enrollment | 完成 |
| A0.3 logs.tail + services.health | 完成 |
| A0.4 敏感 restart/reload/update + reauth | 完成（restart=stub） |
| A0.5 Android L0 壳 | **源码完成**；发布侧载缺 APK |

**A0 可发布门槛**：源码与自动化测试已满足；**侧载发布**仍差一次带 SDK 的 `assembleDebug` + 真机冒烟。

---

*报告生成时间：2026-10-24 17:52 CST（Asia/Shanghai）*
