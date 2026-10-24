package cn.zhuhedong.remote.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.zhuhedong.remote.BuildConfig
import cn.zhuhedong.remote.data.DeviceInstance
import cn.zhuhedong.remote.data.ModelOption
import cn.zhuhedong.remote.ui.common.DshCard
import cn.zhuhedong.remote.ui.common.ErrorState
import cn.zhuhedong.remote.ui.common.GhostButton
import cn.zhuhedong.remote.ui.common.Pill
import cn.zhuhedong.remote.ui.common.PrimaryButton
import cn.zhuhedong.remote.ui.common.SectionHeader
import cn.zhuhedong.remote.ui.common.SettingRow
import cn.zhuhedong.remote.ui.common.StateView
import cn.zhuhedong.remote.ui.common.StatusDot
import cn.zhuhedong.remote.ui.theme.Dsh
import cn.zhuhedong.remote.viewmodel.ChatUiState
import cn.zhuhedong.remote.viewmodel.ChatViewModel

/** Quick-start prompts shown on the empty chat and in 发现. Chips only fill the input; they never auto-send. */
internal val QuickPrompts = listOf(
    "总结一下这个项目的结构" to "项目",
    "帮我看看最近的 git 改动" to "代码",
    "跑一下测试并告诉我失败原因" to "代码",
    "检查磁盘空间，找出最大的目录" to "系统",
    "列出正在运行的开发服务器" to "系统",
    "把今天的工作写成一段日报" to "写作",
)

internal val CapNames = mapOf(
    "instance.status" to "设备概览", "instance.metrics" to "性能指标", "services.health" to "服务健康", "instance.logs.tail" to "日志",
    "chat.sessions.list" to "任务列表", "chat.session.create" to "新建任务", "chat.prompt" to "对话", "chat.follow" to "实时回复",
    "chat.cancel" to "停止回复", "chat.history" to "历史消息", "chat.session.rename" to "重命名任务", "chat.session.delete" to "删除任务",
    "models.list" to "模型目录", "models.select" to "切换模型", "dsh.restart" to "重启 DSH", "plugin.reload" to "重载插件", "plugin.update" to "升级插件",
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ChatEmpty(ui: ChatUiState, vm: ChatViewModel, modifier: Modifier) {
    val dev = ui.device
    val de = ui.devicesError
    val ce = ui.capsError
    Box(modifier.fillMaxWidth()) {
        when {
            de != null -> ErrorState(de, vm::retry)
            !ui.devicesLoaded -> Loading("正在连接 Hub…")
            ui.devices.isEmpty() -> StateView(Icons.Filled.Computer, "还没有可用的电脑",
                "在电脑上打开 DSH Desktop，启用 dsh-remote-agent 插件并登记到 Hub 后，它会出现在这里。", action = "刷新", onAction = vm::refreshDevices)
            dev != null && !dev.online -> StateView(Icons.Filled.CloudOff, "${dev.name} 离线",
                "请确认电脑已开机、DSH Desktop 正在运行。插件连上 Hub 后会自动恢复。", action = "重新连接", onAction = vm::refreshDevices, tint = Dsh.c.muted)
            ce != null -> ErrorState(ce, vm::retry)
            ui.l1 == null -> Loading("正在检测 ${dev?.name ?: "电脑"} 的能力…")
            ui.l1 == false -> StateView(Icons.Filled.SystemUpdate, "远程插件需要升级",
                "${dev?.name ?: "这台电脑"} 上的 dsh-remote-agent 还不支持对话。升级到 0.2.0 或更高版本并重启 DSH 后即可使用；监控功能在「我的 → 设备」里仍可用。", action = "重新检测", onAction = vm::retry)
            else -> Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("有什么可以帮你？", fontSize = 24.sp, fontWeight = FontWeight.SemiBold, color = Dsh.c.ink)
                Spacer(Modifier.height(6.dp))
                Text((ui.pendingCwd ?: ui.pendingSpace)?.let { "将在 ${it.substringAfterLast('/')} 中新建任务" } ?: "消息会发到 ${dev?.name ?: "DSH"} 上执行", color = Dsh.c.muted, fontSize = 13.sp)
                Spacer(Modifier.height(20.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    QuickPrompts.take(4).forEach { (p, _) ->
                        Surface(onClick = { vm.updateInput(p) }, shape = RoundedCornerShape(18.dp), color = Dsh.c.card, modifier = Modifier.border(1.dp, Dsh.c.border, RoundedCornerShape(18.dp))) {
                            Text(p, fontSize = 13.sp, color = Dsh.c.ink, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Loading(text: String) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = Dsh.c.muted)
        Spacer(Modifier.height(12.dp)); Text(text, color = Dsh.c.muted, fontSize = 14.sp)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ModelSheet(ui: ChatUiState, onDismiss: () -> Unit, onPick: (ModelOption) -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Dsh.c.card) {
        Text("选择模型", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = Dsh.c.ink, modifier = Modifier.padding(horizontal = 24.dp))
        Text(if (ui.sessionId == null) "将用于新任务" else "仅切换当前任务", fontSize = 13.sp, color = Dsh.c.muted, modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp))
        LazyColumn(Modifier.fillMaxWidth().padding(bottom = 24.dp)) {
            ui.models.groupBy { it.providerName }.forEach { (provider, list) ->
                item(key = "h-$provider") { Text(provider, fontSize = 12.sp, color = Dsh.c.muted, modifier = Modifier.padding(start = 24.dp, top = 16.dp, bottom = 4.dp)) }
                items(list, key = { it.provider + "/" + it.id }) { m ->
                    val on = m.provider == ui.model?.provider && m.id == ui.model?.model
                    Row(Modifier.fillMaxWidth().clickable { onPick(m) }.padding(horizontal = 24.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(m.name, fontSize = 16.sp, color = Dsh.c.ink, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal)
                            if (m.name != m.id) Text(m.id, fontSize = 11.sp, color = Dsh.c.muted, fontFamily = FontFamily.Monospace)
                        }
                        if (on) Icon(Icons.Filled.CheckCircle, null, tint = Dsh.c.online, modifier = Modifier.size(20.dp))
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
internal fun NewTaskSheet(ui: ChatUiState, onDismiss: () -> Unit, onStart: (DeviceInstance?, String?) -> Unit) {
    var dev by remember { mutableStateOf(ui.device) }
    val initialSpaces = if (ui.device != null) ui.spaces else emptyList()
    val defaultCwd = ui.pendingCwd ?: initialSpaces.firstOrNull()?.cwd
    var cwd by remember { mutableStateOf<String?>(defaultCwd) }
    var custom by remember { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Dsh.c.card) {
        Column(Modifier.padding(horizontal = 24.dp).padding(bottom = 24.dp).verticalScroll(rememberScrollState())) {
            Text("新建任务", fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = Dsh.c.ink)
            SectionHeader("在哪台电脑上运行")
            ui.devices.forEach { d ->
                val sel = d.id == dev?.id
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (sel) Dsh.c.selected else Dsh.c.card)
                    .clickable(enabled = d.online) {
                        dev = d
                        val sp = if (d.id == ui.device?.id) ui.spaces else emptyList()
                        cwd = ui.pendingCwd?.takeIf { d.id == ui.device?.id } ?: sp.firstOrNull()?.cwd
                        custom = ""
                    }.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Computer, null, tint = if (d.online) Dsh.c.ink else Dsh.c.muted)
                    Spacer(Modifier.width(10.dp))
                    Text(d.name, color = if (d.online) Dsh.c.ink else Dsh.c.muted, fontSize = 15.sp, modifier = Modifier.weight(1f))
                    if (!d.online) Text("离线", fontSize = 12.sp, color = Dsh.c.muted) else if (sel) Icon(Icons.Filled.CheckCircle, null, tint = Dsh.c.online, modifier = Modifier.size(18.dp))
                }
            }
            SectionHeader("工作目录（可选）")
            val spaces = if (dev?.id == ui.device?.id) ui.spaces else emptyList()
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Chip("不指定", cwd == null && custom.isBlank()) { cwd = null; custom = "" }
                spaces.forEach { sp -> Chip(sp.name, cwd == sp.cwd, Icons.Filled.Folder) { cwd = sp.cwd; custom = "" } }
            }
            val shown = custom.ifBlank { cwd }
            if (!shown.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(shown, fontSize = 12.sp, color = Dsh.c.muted, fontFamily = FontFamily.Monospace, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(custom, { custom = it; if (it.isNotBlank()) cwd = null }, placeholder = { Text("或输入电脑上的路径，如 ~/code/app") }, singleLine = true,
                shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(20.dp))
            PrimaryButton("开始", { onStart(dev, custom.ifBlank { cwd }) }, Modifier.fillMaxWidth(), enabled = dev?.online == true)
        }
    }
}

@Composable
private fun Chip(text: String, selected: Boolean, icon: ImageVector? = null, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = RoundedCornerShape(18.dp), color = if (selected) Dsh.c.ink else Dsh.c.card,
        modifier = Modifier.border(1.dp, if (selected) Dsh.c.ink else Dsh.c.border, RoundedCornerShape(18.dp))) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) { Icon(icon, null, tint = if (selected) Dsh.c.bg else Dsh.c.muted, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(6.dp)) }
            Text(text, fontSize = 13.sp, color = if (selected) Dsh.c.bg else Dsh.c.ink)
        }
    }
}

@Composable
internal fun RenameDialog(current: String, onDismiss: () -> Unit, onOk: (String) -> Unit) {
    var t by remember { mutableStateOf(current) }
    AlertDialog(onDismissRequest = onDismiss, containerColor = Dsh.c.card, title = { Text("重命名任务") },
        text = { OutlinedTextField(t, { t = it }, singleLine = true, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) },
        confirmButton = { TextButton(onClick = { onOk(t) }, enabled = t.isNotBlank()) { Text("保存") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("取消") } })
}

@Composable
internal fun DeleteDialog(title: String, onDismiss: () -> Unit, onOk: () -> Unit) {
    AlertDialog(onDismissRequest = onDismiss, containerColor = Dsh.c.card, title = { Text("删除任务？") },
        text = { Text("「$title」会从电脑上的 DSH 中删除，无法恢复。") },
        confirmButton = { TextButton(onClick = onOk) { Text("删除", color = Dsh.c.danger) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("取消") } })
}

@Composable
private fun PageTitle(t: String, sub: String? = null) {
    Spacer(Modifier.height(20.dp))
    Text(t, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Dsh.c.ink)
    if (sub != null) { Spacer(Modifier.height(4.dp)); Text(sub, fontSize = 14.sp, color = Dsh.c.muted) }
}

/** 定时任务: DSH has no scheduler exposed to the remote plugin yet, so this is a designed "coming soon". */
@Composable
internal fun ScheduleTab(ui: ChatUiState, onGoChat: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        PageTitle("定时任务", "让电脑上的 DSH 按时自动干活")
        Spacer(Modifier.height(16.dp))
        DshCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Dsh.c.accentBg), contentAlignment = Alignment.Center) { Icon(Icons.Filled.Schedule, null, tint = Dsh.c.accent) }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("即将推出", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Dsh.c.ink)
                    Text("远程插件还没有开放 DSH 的定时能力", fontSize = 13.sp, color = Dsh.c.muted)
                }
                Pill("规划中", Dsh.c.accent, Dsh.c.accentBg)
            }
            Spacer(Modifier.height(12.dp))
            Text("开放后，你可以在手机上创建「每天 9:00 汇总昨天的 git 提交」这类任务，到点由电脑上的 DSH 执行，结果推送到这里。", fontSize = 14.sp, color = Dsh.c.muted, lineHeight = 21.sp)
        }
        SectionHeader("预览")
        SampleSchedule("每天 09:00", "汇总昨天的代码改动并写成日报", ui.device?.name ?: "我的电脑")
        Spacer(Modifier.height(10.dp))
        SampleSchedule("每周一 10:00", "检查依赖更新与安全公告", ui.device?.name ?: "我的电脑")
        SectionHeader("会包含")
        DshCard {
            listOf(Icons.Filled.Alarm to "按天 / 周 / 自定义 cron 运行任务", Icons.Filled.Notifications to "完成或失败时通知手机", Icons.Filled.Info to "查看每次运行的记录与输出").forEachIndexed { i, (ic, t) ->
                if (i > 0) Spacer(Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) { Icon(ic, null, tint = Dsh.c.ink, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(10.dp)); Text(t, fontSize = 14.sp, color = Dsh.c.ink) }
            }
        }
        Spacer(Modifier.height(20.dp))
        GhostButton("现在先用对话完成一次性任务", onGoChat, Modifier.fillMaxWidth())
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun SampleSchedule(time: String, what: String, dev: String) {
    DshCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(time, fontSize = 13.sp, color = Dsh.c.muted)
                Text(what, fontSize = 15.sp, color = Dsh.c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(dev, fontSize = 12.sp, color = Dsh.c.muted)
            }
            Pill("示例", Dsh.c.muted, Dsh.c.code)
        }
    }
}

/** 发现: quick prompts (real, sent to DSH chat) + the device's live capability catalog + skills coming soon. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun DiscoverTab(ui: ChatUiState, onUsePrompt: (String) -> Unit, onRetry: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        PageTitle("发现", "常用任务与电脑上可用的能力")
        SectionHeader("快捷任务")
        QuickPrompts.forEach { (p, tag) ->
            DshCard(Modifier.padding(bottom = 10.dp), onClick = { onUsePrompt(p) }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.AutoAwesome, null, tint = Dsh.c.accent, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(10.dp))
                    Text(p, fontSize = 15.sp, color = Dsh.c.ink, modifier = Modifier.weight(1f))
                    Pill(tag, Dsh.c.muted, Dsh.c.code)
                }
            }
        }
        SectionHeader("${ui.device?.name ?: "电脑"} 的能力", trailing = { IconButton(onClick = onRetry) { Icon(Icons.Filled.Refresh, "刷新", tint = Dsh.c.muted, modifier = Modifier.size(18.dp)) } })
        DshCard {
            when {
                ui.device == null -> Text("还没有选择电脑", color = Dsh.c.muted, fontSize = 14.sp)
                ui.device?.online != true -> Text("电脑离线，连上后显示", color = Dsh.c.muted, fontSize = 14.sp)
                ui.caps.isEmpty() -> Text(if (ui.capsError != null) ui.capsError.title else "正在读取…", color = Dsh.c.muted, fontSize = 14.sp)
                else -> FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ui.caps.sorted().forEach { id -> Pill(CapNames[id] ?: id, Dsh.c.ink, Dsh.c.code) }
                }
            }
        }
        SectionHeader("技能与插件")
        DshCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Extension, null, tint = Dsh.c.ink); Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text("技能市场即将开放", fontSize = 15.sp, fontWeight = FontWeight.Medium, color = Dsh.c.ink)
                    Text("将来可在这里浏览、启用 DSH 的技能与插件。目前请在电脑上的 DSH 中管理。", fontSize = 13.sp, color = Dsh.c.muted, lineHeight = 19.sp)
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

/** 我的: profile, devices, settings, about, logout. */
@Composable
internal fun ProfileTab(ui: ChatUiState, username: String?, hubBase: String, onOpenWorkbench: (DeviceInstance) -> Unit, onLogout: () -> Unit, onRefresh: () -> Unit) {
    var confirmLogout by remember { mutableStateOf(false) }
    if (confirmLogout) AlertDialog(onDismissRequest = { confirmLogout = false }, containerColor = Dsh.c.card, title = { Text("退出登录？") },
        text = { Text("退出后需要重新输入密码和验证码。电脑上的 DSH 不受影响。") },
        confirmButton = { TextButton(onClick = { confirmLogout = false; onLogout() }) { Text("退出", color = Dsh.c.danger) } },
        dismissButton = { TextButton(onClick = { confirmLogout = false }) { Text("取消") } })
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        Spacer(Modifier.height(20.dp))
        DshCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(52.dp).clip(CircleShape).background(Dsh.c.ink), contentAlignment = Alignment.Center) {
                    Text((username ?: "我").take(1).uppercase(), color = Dsh.c.bg, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(username ?: "未登录", fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = Dsh.c.ink)
                    Text(hubBase.removePrefix("https://").ifBlank { "Hub" }, fontSize = 13.sp, color = Dsh.c.muted)
                }
            }
        }
        SectionHeader("我的设备 (${ui.devices.size})", trailing = { IconButton(onClick = onRefresh) { Icon(Icons.Filled.Refresh, "刷新", tint = Dsh.c.muted, modifier = Modifier.size(18.dp)) } })
        if (ui.devicesError != null) DshCard { Text(ui.devicesError.title, color = Dsh.c.danger); Text(ui.devicesError.hint, fontSize = 13.sp, color = Dsh.c.muted) }
        else if (ui.devices.isEmpty()) DshCard { Text(if (ui.devicesLoaded) "还没有登记的电脑" else "加载中…", color = Dsh.c.muted, fontSize = 14.sp) }
        else Surface(shape = RoundedCornerShape(16.dp), color = Dsh.c.card, modifier = Modifier.fillMaxWidth().border(1.dp, Dsh.c.border, RoundedCornerShape(16.dp))) {
            Column {
                ui.devices.forEach { d ->
                    Row(Modifier.fillMaxWidth().clickable { onOpenWorkbench(d) }.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Computer, null, tint = Dsh.c.ink); Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(d.name, fontSize = 15.sp, color = Dsh.c.ink, fontWeight = FontWeight.Medium)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                StatusDot(d.online, 6.dp); Spacer(Modifier.width(4.dp))
                                Text((if (d.online) "在线" else "离线") + (d.hostname?.let { " · $it" } ?: ""), fontSize = 12.sp, color = Dsh.c.muted)
                            }
                        }
                        if (d.id == ui.device?.id) Pill("当前", Dsh.c.accent, Dsh.c.accentBg)
                        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = Dsh.c.muted)
                    }
                }
            }
        }
        SectionHeader("设置")
        Surface(shape = RoundedCornerShape(16.dp), color = Dsh.c.card, modifier = Modifier.fillMaxWidth().border(1.dp, Dsh.c.border, RoundedCornerShape(16.dp))) {
            Column {
                SettingRow(Icons.Filled.Dns, "服务器", hubBase.removePrefix("https://"))
                SettingRow(Icons.Filled.DarkMode, "外观", "跟随系统")
                SettingRow(Icons.Filled.Notifications, "通知", "即将支持")
            }
        }
        SectionHeader("关于")
        Surface(shape = RoundedCornerShape(16.dp), color = Dsh.c.card, modifier = Modifier.fillMaxWidth().border(1.dp, Dsh.c.border, RoundedCornerShape(16.dp))) {
            Column {
                SettingRow(Icons.Filled.Info, "App 版本", BuildConfig.VERSION_NAME)
                SettingRow(Icons.Filled.Extension, "当前设备能力", if (ui.caps.isEmpty()) "—" else "${ui.caps.size} 项")
            }
        }
        Spacer(Modifier.height(16.dp))
        Surface(shape = RoundedCornerShape(16.dp), color = Dsh.c.card, modifier = Modifier.fillMaxWidth().border(1.dp, Dsh.c.border, RoundedCornerShape(16.dp))) {
            SettingRow(Icons.AutoMirrored.Filled.Logout, "退出登录", danger = true) { confirmLogout = true }
        }
        Spacer(Modifier.height(24.dp))
        Text("DSH Remote · 通过 Hub 连接你电脑上的 DSH", fontSize = 12.sp, color = Dsh.c.muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(24.dp))
    }
}
