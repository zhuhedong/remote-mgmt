package cn.zhuhedong.remote.ui.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddComment
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.zhuhedong.remote.data.ChatMsg
import cn.zhuhedong.remote.data.ChatSession
import cn.zhuhedong.remote.data.DeviceInstance
import cn.zhuhedong.remote.viewmodel.ChatUiState
import cn.zhuhedong.remote.viewmodel.ChatViewModel
import kotlinx.coroutines.launch

private val Bg = Color(0xFFF7F7F8)
private val CardBorder = Color(0xFFE6E7EA)
private val Muted = Color(0xFF8A8F98)
private val Ink = Color(0xFF1F2328)
private val Online = Color(0xFF10B981)
private val UserBubble = Color(0xFFEDEEF0)

/** Main shell modelled on WorkBuddy: chat-first 任务 tab with a left drawer + bottom tabs. */
@Composable
fun HomeScreen(
    vm: ChatViewModel,
    username: String?,
    onOpenWorkbench: (DeviceInstance) -> Unit,
    onLogout: () -> Unit,
) {
    val ui by vm.ui.collectAsState()
    LaunchedEffect(Unit) { vm.start() }
    var tab by rememberSaveable { mutableStateOf(0) }
    val tabs = listOf("任务" to Icons.Filled.ChatBubble, "定时任务" to Icons.Filled.Alarm, "发现" to Icons.Filled.Explore, "我的" to Icons.Filled.Person)
    Scaffold(
        containerColor = Bg,
        bottomBar = {
            NavigationBar(containerColor = Bg, tonalElevation = 0.dp) {
                tabs.forEachIndexed { i, (label, icon) ->
                    NavigationBarItem(selected = tab == i, onClick = { tab = i }, icon = { Icon(icon, label) }, label = { Text(label, fontSize = 11.sp) })
                }
            }
        },
    ) { pad ->
        Box(Modifier.padding(pad).fillMaxSize()) {
            when (tab) {
                0 -> TasksTab(vm, ui)
                1 -> Placeholder("定时任务", "即将支持：在手机上管理 DSH 定时任务")
                2 -> Placeholder("发现", "即将支持：技能与插件")
                else -> ProfileTab(ui, username, onOpenWorkbench, onLogout, onRefresh = vm::refreshDevices)
            }
        }
    }
}

@Composable
private fun Placeholder(title: String, sub: String) {
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text(title, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = Ink)
        Spacer(Modifier.height(8.dp))
        Text(sub, color = Muted)
    }
}

@Composable
private fun TasksTab(vm: ChatViewModel, ui: ChatUiState) {
    val drawer = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    fun close() = scope.launch { drawer.close() }
    ModalNavigationDrawer(
        drawerState = drawer,
        drawerContent = {
            ModalDrawerSheet(drawerContainerColor = Color(0xFFFAFAFA), modifier = Modifier.width(300.dp)) {
                DrawerContent(ui, vm,
                    onOpen = { vm.openSession(it); close() },
                    onNew = { vm.newTask(); close() },
                    onNewInSpace = { vm.newInSpace(it); close() })
            }
        },
    ) {
        ChatPane(vm, ui, onMenu = { scope.launch { drawer.open() } })
    }
}

@Composable
private fun DrawerContent(ui: ChatUiState, vm: ChatViewModel, onOpen: (String) -> Unit, onNew: () -> Unit, onNewInSpace: (String) -> Unit) {
    var devMenu by remember { mutableStateOf(false) }
    var spacesOpen by rememberSaveable { mutableStateOf(true) }
    val expanded = remember { mutableStateMapOf<String, Boolean>() }
    LaunchedEffect(Unit) { vm.refreshSessions() }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 14.dp)) {
        item {
            Box {
                Row(Modifier.padding(top = 18.dp, bottom = 14.dp).clickable { devMenu = true }, verticalAlignment = Alignment.CenterVertically) {
                    Box {
                        Icon(Icons.Filled.Computer, null, tint = Ink, modifier = Modifier.size(26.dp))
                        if (ui.device?.online == true) Box(Modifier.size(8.dp).clip(CircleShape).background(Online).align(Alignment.TopEnd))
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(ui.device?.name ?: "选择设备", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                    Icon(Icons.Filled.ExpandMore, null, tint = Ink)
                }
                DropdownMenu(expanded = devMenu, onDismissRequest = { devMenu = false }) {
                    ui.devices.forEach { d ->
                        DropdownMenuItem(
                            text = { Text(d.name + if (d.online) "" else "（离线）") },
                            leadingIcon = { Box(Modifier.size(8.dp).clip(CircleShape).background(if (d.online) Online else Muted)) },
                            onClick = { devMenu = false; vm.selectDevice(d) },
                        )
                    }
                }
            }
            Surface(
                onClick = onNew, shape = RoundedCornerShape(16.dp), color = Color.White,
                modifier = Modifier.fillMaxWidth().border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
            ) {
                Row(Modifier.padding(vertical = 14.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.AddComment, null, tint = Ink); Spacer(Modifier.width(8.dp)); Text("新建任务", fontSize = 17.sp, color = Ink)
                }
            }
            Spacer(Modifier.height(12.dp))
        }
        val loose = ui.sessions.filter { it.cwd == null }
        if (ui.l1 == false) item { Text("远程插件需升级到 0.2.0 才能对话", color = Muted, modifier = Modifier.padding(vertical = 24.dp)) }
        else if (loose.isEmpty()) item { Text("暂无任务", color = Muted, modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center) }
        items(loose, key = { "l-" + it.sessionId }) { SessionRow(it, ui.sessionId == it.sessionId, indent = false) { onOpen(it.sessionId) } }
        if (ui.spaces.isNotEmpty()) {
            item {
                Row(Modifier.padding(top = 16.dp, bottom = 6.dp).clickable { spacesOpen = !spacesOpen }, verticalAlignment = Alignment.CenterVertically) {
                    Text("Spaces (${ui.spaces.size})", color = Muted, fontSize = 14.sp)
                    Icon(if (spacesOpen) Icons.Filled.ExpandMore else Icons.Filled.ExpandLess, null, tint = Muted, modifier = Modifier.size(18.dp))
                }
            }
            if (spacesOpen) ui.spaces.forEach { sp ->
                val open = expanded[sp.cwd] ?: true
                item(key = "s-" + sp.cwd) {
                    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Folder, null, tint = Ink, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(sp.name, fontSize = 17.sp, color = Ink, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        IconButton(onClick = { expanded[sp.cwd] = !open }) { Icon(if (open) Icons.Filled.ExpandMore else Icons.AutoMirrored.Filled.ArrowForward, "展开", tint = Muted) }
                        IconButton(onClick = { onNewInSpace(sp.cwd) }) { Icon(Icons.Filled.Add, "在此新建", tint = Muted) }
                    }
                }
                if (open) items(ui.sessions.filter { it.cwd == sp.cwd }, key = { "c-" + it.sessionId }) {
                    SessionRow(it, ui.sessionId == it.sessionId, indent = true) { onOpen(it.sessionId) }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun SessionRow(s: ChatSession, selected: Boolean, indent: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (selected) Color(0xFFEDEDEF) else Color.Transparent)
            .clickable(onClick = onClick).padding(start = if (indent) 30.dp else 10.dp, end = 10.dp, top = 12.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(s.displayTitle(), color = Ink, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        if (s.running) CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp, color = Online)
    }
}

@Composable
private fun ChatPane(vm: ChatViewModel, ui: ChatUiState, onMenu: () -> Unit) {
    var more by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().background(Bg).imePadding()) {
        // Header: menu · title/subtitle · new-chat · more
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            RoundIcon(Icons.Filled.Menu, "菜单", onMenu)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(ui.current?.displayTitle() ?: "新任务", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(6.dp).clip(CircleShape).background(if (ui.device?.online == true) Online else Muted))
                    Spacer(Modifier.width(4.dp))
                    val sub = listOfNotNull(ui.device?.name, ui.current?.space).joinToString("  |  ")
                    Text(sub.ifBlank { "未连接设备" }, fontSize = 12.sp, color = Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Surface(shape = RoundedCornerShape(24.dp), color = Color.White, modifier = Modifier.border(1.dp, CardBorder, RoundedCornerShape(24.dp))) {
                Row {
                    IconButton(onClick = vm::newTask) { Icon(Icons.Filled.AddComment, "新对话", tint = Ink) }
                    Box {
                        IconButton(onClick = { more = true }) { Icon(Icons.Filled.MoreHoriz, "更多", tint = Ink) }
                        DropdownMenu(expanded = more, onDismissRequest = { more = false }) {
                            DropdownMenuItem(text = { Text("刷新") }, onClick = { more = false; vm.refreshSessions(); ui.sessionId?.let(vm::openSession) })
                            if (ui.running) DropdownMenuItem(text = { Text("停止回复") }, onClick = { more = false; vm.stop() })
                        }
                    }
                }
            }
        }
        ui.error?.let {
            Text(it, color = Color(0xFFB42318), fontSize = 13.sp, modifier = Modifier.fillMaxWidth().background(Color(0xFFFEF3F2)).clickable { vm.clearError() }.padding(horizontal = 16.dp, vertical = 8.dp))
        }
        val chatItems = remember(ui.messages, ui.live) { groupChat(ui.messages, ui.live) }
        val listState = rememberLazyListState()
        LaunchedEffect(chatItems.size, ui.live.length) { if (chatItems.isNotEmpty()) listState.animateScrollToItem(chatItems.size) }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (chatItems.isEmpty()) {
                Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("有什么可以帮你？", fontSize = 22.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                    Spacer(Modifier.height(6.dp))
                    Text(if (ui.l1 == false) "该设备远程插件需升级" else "消息会发到 ${ui.device?.name ?: "DSH"} 上执行", color = Muted, fontSize = 13.sp)
                }
            }
            LazyColumn(state = listState, modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                item { Spacer(Modifier.height(4.dp)) }
                items(chatItems) { ChatItemView(it, ui.running) }
                if (ui.running && ui.live.isBlank() && chatItems.lastOrNull() !is ChatItem.Steps) item { InProgress("进行中") }
                item { Spacer(Modifier.height(8.dp)) }
            }
        }
        Composer(vm, ui)
    }
}

@Composable
private fun RoundIcon(icon: ImageVector, desc: String, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = CircleShape, color = Color.White, modifier = Modifier.size(44.dp).border(1.dp, CardBorder, CircleShape)) {
        Box(contentAlignment = Alignment.Center) { Icon(icon, desc, tint = Ink) }
    }
}

@Composable
private fun InProgress(label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp, color = Muted)
        Spacer(Modifier.width(8.dp))
        Text(label, color = Muted, fontSize = 15.sp)
    }
}

@Composable
private fun ChatItemView(item: ChatItem, running: Boolean) {
    when (item) {
        is ChatItem.User -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Surface(shape = RoundedCornerShape(20.dp), color = UserBubble, modifier = Modifier.widthIn(max = 300.dp)) {
                Text(item.msg.text, color = Ink, fontSize = 16.sp, modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp))
            }
        }
        is ChatItem.Assistant -> MarkdownText(item.text)
        is ChatItem.Steps -> StepsCard(item.steps, running && item.running)
    }
}

@Composable
private fun StepsCard(steps: List<ChatMsg>, active: Boolean) {
    var open by remember { mutableStateOf(active) }
    LaunchedEffect(active) { if (active) open = true }
    Column {
        Row(Modifier.clickable { open = !open }, verticalAlignment = Alignment.CenterVertically) {
            if (active) CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp, color = Muted)
            else Icon(Icons.Filled.CheckCircle, null, tint = Muted, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(if (active) "进行中：运行命令" else "已运行 ${steps.size} 个步骤", color = Muted, fontSize = 15.sp)
            Icon(if (open) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, null, tint = Muted, modifier = Modifier.size(18.dp))
        }
        AnimatedVisibility(open) {
            Surface(shape = RoundedCornerShape(14.dp), color = Color.White, modifier = Modifier.padding(top = 8.dp).fillMaxWidth().border(1.dp, CardBorder, RoundedCornerShape(14.dp))) {
                Column(Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) {
                    steps.takeLast(12).forEach { s ->
                        Row(Modifier.padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                            when (s.status) {
                                "running" -> CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 1.5.dp, color = Muted)
                                "error" -> Icon(Icons.Filled.Error, null, tint = Color(0xFFD92D20), modifier = Modifier.size(16.dp))
                                else -> Icon(Icons.Filled.CheckCircle, null, tint = Online, modifier = Modifier.size(16.dp))
                            }
                            Spacer(Modifier.width(10.dp))
                            Text((if (s.status == "running") "正在执行 " else "已执行 ") + s.text, color = Muted, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MarkdownText(text: String) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        parseMarkdown(text).forEach { b ->
            when (b) {
                is MdBlock.Heading -> Text(inlineMd(b.text), fontSize = (22 - b.level * 2).coerceAtLeast(15).sp, fontWeight = FontWeight.SemiBold, color = Ink)
                is MdBlock.Bullet -> Row { Text(b.marker + " ", color = Ink, fontSize = 16.sp); Text(inlineMd(b.text), color = Ink, fontSize = 16.sp, lineHeight = 24.sp) }
                is MdBlock.Code -> Surface(shape = RoundedCornerShape(10.dp), color = Color(0xFFF1F2F4), modifier = Modifier.fillMaxWidth()) {
                    Text(b.code, fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = Ink, modifier = Modifier.horizontalScroll(rememberScrollState()).padding(12.dp))
                }
                is MdBlock.Para -> Text(inlineMd(b.text), color = Ink, fontSize = 16.sp, lineHeight = 25.sp)
            }
        }
    }
}

@Composable
private fun Composer(vm: ChatViewModel, ui: ChatUiState) {
    var modelMenu by remember { mutableStateOf(false) }
    var voiceHint by remember { mutableStateOf(false) }
    val enabled = ui.l1 == true && ui.device?.online == true
    Surface(
        shape = RoundedCornerShape(24.dp), color = Color.White,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp).border(1.dp, CardBorder, RoundedCornerShape(24.dp)),
    ) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
            Box(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                if (ui.input.isEmpty()) Text("发消息…", color = Muted, fontSize = 17.sp)
                BasicTextField(
                    value = ui.input, onValueChange = vm::updateInput, enabled = enabled,
                    textStyle = TextStyle(fontSize = 17.sp, color = Ink), cursorBrush = SolidColor(Ink), maxLines = 6,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { voiceHint = true }) { Icon(Icons.Filled.Mic, "语音", tint = Muted) }
                Box(Modifier.weight(1f)) {
                    val cur = ui.models.firstOrNull { it.provider == ui.model?.provider && it.id == ui.model?.model }
                    TextButton(onClick = { if (ui.models.isNotEmpty()) modelMenu = true else vm.loadModels() }) {
                        Text(cur?.name ?: ui.model?.model ?: "选择模型", color = Ink, fontSize = 15.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Icon(Icons.Filled.ExpandMore, null, tint = Ink, modifier = Modifier.size(18.dp))
                    }
                    DropdownMenu(expanded = modelMenu, onDismissRequest = { modelMenu = false }) {
                        var lastProvider: String? = null
                        ui.models.forEach { m ->
                            if (m.provider != lastProvider) {
                                lastProvider = m.provider
                                Text(m.providerName, color = Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp))
                            }
                            val on = m.provider == ui.model?.provider && m.id == ui.model?.model
                            DropdownMenuItem(
                                text = { Text(m.name, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal) },
                                trailingIcon = { if (on) Icon(Icons.Filled.CheckCircle, null, tint = Online, modifier = Modifier.size(16.dp)) },
                                onClick = { modelMenu = false; vm.selectModel(m) },
                            )
                        }
                    }
                }
                IconButton(onClick = vm::newTask) { Icon(Icons.Filled.Add, "新建", tint = Ink) }
                val canSend = enabled && ui.input.isNotBlank() && !ui.sending
                Surface(
                    onClick = { if (ui.running && ui.input.isBlank()) vm.stop() else vm.send() },
                    shape = CircleShape, color = if (ui.running || canSend) Ink else Color(0xFFD0D3D8), modifier = Modifier.size(40.dp),
                    enabled = ui.running || canSend,
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        if (ui.sending) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White)
                        else Icon(if (ui.running && ui.input.isBlank()) Icons.Filled.Stop else Icons.Filled.ArrowUpward, if (ui.running) "停止" else "发送", tint = Color.White)
                    }
                }
            }
            if (voiceHint) {
                LaunchedEffect(Unit) { kotlinx.coroutines.delay(1800); voiceHint = false }
                Text("语音输入即将支持", color = Muted, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun ProfileTab(ui: ChatUiState, username: String?, onOpenWorkbench: (DeviceInstance) -> Unit, onLogout: () -> Unit, onRefresh: () -> Unit) {
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Spacer(Modifier.height(16.dp))
            Text(username ?: "我的", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Ink)
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("我的设备", color = Muted, modifier = Modifier.weight(1f))
                TextButton(onClick = onRefresh) { Text("刷新") }
            }
        }
        items(ui.devices, key = { it.id }) { d ->
            Surface(onClick = { onOpenWorkbench(d) }, shape = RoundedCornerShape(16.dp), color = Color.White, modifier = Modifier.fillMaxWidth().border(1.dp, CardBorder, RoundedCornerShape(16.dp))) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Computer, null, tint = Ink)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(d.name, fontSize = 16.sp, color = Ink, fontWeight = FontWeight.Medium)
                        Text((if (d.online) "在线" else "离线") + " · 监控 / 指标 / 健康 / 日志", fontSize = 12.sp, color = Muted)
                    }
                    Box(Modifier.size(8.dp).clip(CircleShape).background(if (d.online) Online else Muted))
                }
            }
        }
        item {
            HorizontalDivider(color = CardBorder, modifier = Modifier.padding(vertical = 8.dp))
            TextButton(onClick = onLogout) {
                Icon(Icons.AutoMirrored.Filled.Logout, null); Spacer(Modifier.width(6.dp)); Text("退出登录")
            }
        }
    }
}
