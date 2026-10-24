# DSH Remote · Android（A0.5 起步）

Kotlin + Jetpack Compose 原生壳：**登录 → 实例列表 → 工作台（capabilities + `instance.status`）**。

> **本仓库 CI / 云端盒子当前没有 Android SDK / JDK，这里是可打开的源码工程，不是已编好的 APK。**  
> 请在本机用 **Android Studio Ladybug+**（或带 JDK 17 的命令行）打开本目录编译。

## 打开与编译

1. 安装 [Android Studio](https://developer.android.com/studio)，勾选 Android SDK 35、Build-Tools。
2. **File → Open** 选择 `remote-mgmt/android/`（本目录）。
3. 等待 Gradle Sync（首次会下载 Gradle 8.9 与依赖）。
4. 选一台模拟器或真机，Run `app`。
5. 命令行（本机有 SDK 时）：

```bash
cd remote-mgmt/android
# 若缺少 gradlew 脚本，可在 Android Studio 里 Sync 一次自动生成，或：
# gradle wrapper --gradle-version 8.9
./gradlew :app:assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

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
- 单元测试 / CI 编 APK（本环境无 Android SDK）

## 包名

`cn.zhuhedong.remote` · 显示名「DSH 远程」· `versionName 0.1.0-a0`
