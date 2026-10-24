# DSH Remote · Android（A0.5 起步）

Kotlin + Jetpack Compose 原生壳：**登录 → 实例列表 → 工作台（capabilities + invoke）**。

## CI 自动编 APK

本仓库已接 GitHub Actions：

| 触发 | Workflow | 产物 |
|------|----------|------|
| push / PR → `master` | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | **debug APK** 上传为 artifact `app-debug`（保留 14 天） |
| push tag `v*`，或 Actions → **Release** 手动跑 | [`.github/workflows/release.yml`](../.github/workflows/release.yml) | [GitHub Releases](https://github.com/zhuhedong/remote-mgmt/releases) 附 Hub 二进制、Agent tgz、APK、`SHA256SUMS` |

下载：

1. **日常调试包**：打开仓库 [Actions](https://github.com/zhuhedong/remote-mgmt/actions) → 选中一次成功的 **CI** → Artifacts → `app-debug`
2. **发版包**：打开 [Releases](https://github.com/zhuhedong/remote-mgmt/releases) → 选版本下载 APK（未配置签名 secrets 时仍为 **debug** APK，release notes 会写明）

本地编译（可选）：

```bash
cd android
./gradlew :app:assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

需要 JDK 17 + Android SDK 35。仓库已含完整 Gradle Wrapper（8.9）。不要提交 `local.properties`。

### Release 签名（可选）

在仓库 Settings → Secrets 配置后，Release workflow 会打 **signed release** APK：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

未配置时自动退回 `assembleDebug`。

## 功能（A0 L0）

| 屏 | Hub API |
|----|---------|
| 登录 | `POST /api/auth/login` → `POST /api/auth/totp`（Cookie 会话） |
| 实例列表 | `GET /api/instances`（`/api/devices` 别名） |
| 工作台 | capabilities + invoke：`instance.status` / `metrics` / `logs.tail` / `services.health` |
| 敏感操作 | `dsh.restart` / `plugin.reload` / `plugin.update`；`REAUTH_REQUIRED` → `POST /api/me/reauth` 再重试 |

- 默认 Hub：`https://remote.zhuhedong.cn`（登录页可改）。
- OkHttp + CookieJar；请求带 `X-Hub: 1`（CSRF）。
- 真实重启仍为 Agent **STUB**（不会杀 DSH 进程）。
- **证书 pinning：TODO**（见 `HubClient.kt`）。

## 尚未做

- EncryptedSharedPreferences / Keystore
- 证书锁定、侧载更新检查
- 单元测试

## 包名

`cn.zhuhedong.remote` · 显示名「DSH 远程」· `versionName 0.1.0-a0`
