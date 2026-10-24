package cn.zhuhedong.remote

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.core.app.ApplicationProvider
import cn.zhuhedong.remote.data.CapListResult
import cn.zhuhedong.remote.data.CapabilityDescriptor
import cn.zhuhedong.remote.data.ChatMsg
import cn.zhuhedong.remote.data.ChatSession
import cn.zhuhedong.remote.data.ChatSpace
import cn.zhuhedong.remote.data.DeviceInstance
import cn.zhuhedong.remote.data.Friendly
import cn.zhuhedong.remote.data.HubRepository
import cn.zhuhedong.remote.data.InvokeResult
import cn.zhuhedong.remote.data.ModelOption
import cn.zhuhedong.remote.data.ModelSel
import cn.zhuhedong.remote.data.SessionStore
import cn.zhuhedong.remote.ui.home.HomeScreen
import cn.zhuhedong.remote.ui.login.LoginScreen
import cn.zhuhedong.remote.ui.theme.DshRemoteTheme
import cn.zhuhedong.remote.ui.workbench.WorkbenchScreen
import cn.zhuhedong.remote.viewmodel.ChatUiState
import cn.zhuhedong.remote.viewmodel.ChatViewModel
import cn.zhuhedong.remote.viewmodel.LoginViewModel
import cn.zhuhedong.remote.viewmodel.WorkbenchUiState
import cn.zhuhedong.remote.viewmodel.WorkbenchViewModel
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w390dp-h844dp-xxhdpi", application = android.app.Application::class)
class ScreenshotTest {
    @get:Rule val rule = createComposeRule()
    private val dir = System.getProperty("shots.dir") ?: "build/shots"
    private fun hub() = HubRepository(SessionStore(ApplicationProvider.getApplicationContext()))

    private val mac = DeviceInstance("d1", "code的Mac Pro", "mac", "active", true, "codedeMac-Pro.local")
    private val win = DeviceInstance("d2", "办公室 Windows", "win", "active", false)
    private val caps = setOf("instance.status", "instance.metrics", "services.health", "instance.logs.tail", "chat.sessions.list", "chat.session.create",
        "chat.prompt", "chat.follow", "chat.cancel", "chat.history", "chat.session.rename", "chat.session.delete", "models.list", "models.select")
    private val base = ChatUiState(
        devices = listOf(mac, win), device = mac, l1 = true, devicesLoaded = true, caps = caps,
        sessions = listOf(ChatSession("s1", "清理 web 页面", "/Users/code/inpass-engine", "inpass-engine", 0, false, false),
            ChatSession("s2", "修复登录 404", null, null, 0, false, false)),
        spaces = listOf(ChatSpace("inpass-engine", "/Users/code/inpass-engine", 1), ChatSpace("remote-mgmt", "/Users/code/remote-mgmt", 3)),
        models = listOf(ModelOption("ds", "DeepSeek", "deepseek-chat", "DeepSeek V3"), ModelOption("ds", "DeepSeek", "deepseek-reasoner", "DeepSeek R1")),
        model = ModelSel("ds", "deepseek-chat"),
    )

    private fun home(name: String, s: ChatUiState, tab: Int = 0) {
        val vm = ChatViewModel(hub()); vm.seedForPreview(s)
        rule.setContent { DshRemoteTheme { HomeScreen(vm, "zhuhedong", "https://remote.zhuhedong.cn", {}, {}, initialTab = tab) } }
        rule.onRoot().captureRoboImage("$dir/$name.png")
    }

    @Test fun chat() = home("02-chat", base.copy(sessionId = "s2", messages = listOf(
        ChatMsg(1, "user", "登录后 App 显示 404，帮我查一下"),
        ChatMsg(2, "step", "rg \"/api/instances\" hub/", "done"),
        ChatMsg(3, "step", "curl -I https://remote.zhuhedong.cn/api/instances", "done"),
        ChatMsg(4, "assistant", "原因是服务器上的 **Hub 版本过旧**，没有 `/api/instances` 接口。\n\n- 部署新版 Hub\n- 重新登录 App"),
    )))
    @Test fun chatEmpty() = home("03-chat-empty", base)
    @Test fun upgradePlugin() = home("04-state-upgrade-plugin", base.copy(l1 = false))
    @Test fun offline() = home("05-state-offline", base.copy(device = win))
    @Test fun schedule() = home("06-schedule", base, 1)
    @Test fun discover() = home("07-discover", base, 2)
    @Test fun profile() = home("08-profile", base, 3)

    @Test fun login() {
        val vm = LoginViewModel(hub()); vm.update { it.copy(step = 2, username = "zhuhedong", totp = "1234") }
        rule.setContent { DshRemoteTheme { LoginScreen(vm) {} } }
        rule.onRoot().captureRoboImage("$dir/01-login-totp.png")
    }

    @Test fun device() {
        val vm = WorkbenchViewModel(hub(), "d1")
        vm.seedForPreview(WorkbenchUiState(
            status = InvokeResult(true, "", mapOf("plugin" to "0.2.1", "dshReady" to true, "platform" to "darwin", "arch" to "arm64", "uptime" to 93000, "rss" to 84)),
            metrics = InvokeResult(true, "", mapOf("cpu" to 23, "memUsed" to 61, "load" to "2.1 1.8 1.6", "rtt" to 42)),
            health = InvokeResult(true, "", mapOf("services" to listOf(mapOf("id" to "dsh.session", "ok" to true, "latencyMs" to 12), mapOf("id" to "hub.link", "ok" to true, "latencyMs" to 41), mapOf("id" to "deepseek.api", "ok" to false, "error" to "timeout")))),
            logs = InvokeResult(true, "", mapOf("entries" to listOf(mapOf("source" to "bridge", "text" to "invoke chat.prompt ok 812ms"), mapOf("source" to "link", "text" to "connected to hub")))),
            caps = CapListResult(2, listOf(CapabilityDescriptor("dsh.restart", "重启 DSH", sensitive = true)), true),
            cpuHist = listOf(12f, 18f, 30f, 22f, 25f, 40f, 28f, 23f), memHist = listOf(55f, 57f, 58f, 60f, 61f, 60f, 61f, 61f),
        ))
        rule.setContent { DshRemoteTheme { WorkbenchScreen("code的Mac Pro", vm, {}, autoLoad = false) } }
        rule.onRoot().captureRoboImage("$dir/09-device-detail.png")
    }

    @Test fun deviceError() {
        val vm = WorkbenchViewModel(hub(), "d1")
        vm.seedForPreview(WorkbenchUiState(fatal = Friendly.of("HTTP_502", "agent: unsupported", 502)))
        rule.setContent { DshRemoteTheme { WorkbenchScreen("code的Mac Pro", vm, {}, autoLoad = false) } }
        rule.onRoot().captureRoboImage("$dir/10-device-error.png")
    }

    @Config(qualifiers = "+night")
    @Test fun chatDark() = home("11-chat-dark", base.copy(sessionId = "s2", messages = listOf(ChatMsg(1, "user", "检查磁盘空间"), ChatMsg(2, "assistant", "根目录还剩 **182 GB**，最大的是 `~/Library/Caches`。"))))
}
