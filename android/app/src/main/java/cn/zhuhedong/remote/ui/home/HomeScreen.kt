package cn.zhuhedong.remote.ui.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.AutoAwesome
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
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
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.zhuhedong.remote.data.AskPayload
import cn.zhuhedong.remote.data.AskQuestion
import cn.zhuhedong.remote.data.ChatMsg
import cn.zhuhedong.remote.data.ChatSession
import cn.zhuhedong.remote.data.DeviceInstance
import cn.zhuhedong.remote.viewmodel.ChatUiState
import cn.zhuhedong.remote.viewmodel.ChatViewModel
import cn.zhuhedong.remote.ui.theme.Dsh
import cn.zhuhedong.remote.ui.common.ErrorBanner
import cn.zhuhedong.remote.ui.common.Skeleton
import kotlinx.coroutines.launch

private val Bg: Color @Composable get() = Dsh.c.bg
private val CardBorder: Color @Composable get() = Dsh.c.border
private val Muted: Color @Composable get() = Dsh.c.muted
private val Ink: Color @Composable get() = Dsh.c.ink
private val Online: Color @Composable get() = Dsh.c.online
private val UserBubble: Color @Composable get() = Dsh.c.userBubble


/** Soft-wrap long ASCII tokens in plain (non-markdown) bubbles. */
private fun softBreak(text: String): String = softBreakAscii(text, every = 36)


/** Main shell modelled on WorkBuddy: chat-first 任务 tab with a left drawer + bottom tabs. */
@Composable
fun HomeScreen(
    vm: ChatViewModel,
    username: String?,
    hubBase: String = "",
    onOpenWorkbench: (DeviceInstance) -> Unit,
    onLogout: () -> Unit,
    initialTab: Int = 0,
) {
    val ui by vm.ui.collectAsState()
    LaunchedEffect(Unit) { vm.start() }
    var tab by rememberSaveable { mutableStateOf(initialTab) }
    // Hoisted so we can close the drawer *before* switching tabs. Disposing
    // ModalNavigationDrawer while open leaves a stuck scrim that eats all taps.
    val drawer = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    var newSheet by remember { mutableStateOf(false) }
    val tabs = listOf("任务" to Icons.Filled.ChatBubble, "定时任务" to Icons.Filled.Alarm, "发现" to Icons.Filled.Explore, "我的" to Icons.Filled.Person)

    fun selectTab(i: Int) {
        if (i == tab) return
        scope.launch {
            if (drawer.isOpen) runCatching { drawer.close() }
            newSheet = false
            tab = i
        }
    }

    // Drop Dialog-hosted overlays before navigating away from Home, otherwise a
    // leaked ModalBottomSheet/drawer scrim can sit above the device detail page
    // and swallow system back + the top-bar back button.
    fun openWorkbench(d: DeviceInstance) {
        scope.launch {
            if (drawer.isOpen) runCatching { drawer.close() }
            newSheet = false
            onOpenWorkbench(d)
        }
    }

    Scaffold(
        containerColor = Bg,
        contentWindowInsets = WindowInsets.safeDrawing,
        bottomBar = {
            NavigationBar(
                containerColor = Bg,
                tonalElevation = 0.dp,
                windowInsets = WindowInsets.navigationBars,
            ) {
                tabs.forEachIndexed { i, (label, icon) ->
                    NavigationBarItem(selected = tab == i, onClick = { selectTab(i) }, icon = { Icon(icon, label) }, label = { Text(label, fontSize = 11.sp) },
                        colors = androidx.compose.material3.NavigationBarItemDefaults.colors(selectedIconColor = Ink, selectedTextColor = Ink, indicatorColor = Dsh.c.selected, unselectedIconColor = Muted, unselectedTextColor = Muted))
                }
            }
        },
    ) { pad ->
        Box(Modifier.padding(pad).fillMaxSize()) {
            when (tab) {
                0 -> TasksTab(vm, ui, drawer, newSheet, onNewSheet = { newSheet = it })
                1 -> ScheduleTab(ui, onGoChat = { selectTab(0) })
                2 -> DiscoverTab(ui, onUsePrompt = { if (ui.sessionId != null) vm.newTask(); vm.updateInput(it); selectTab(0) }, onRetry = vm::retry)
                else -> ProfileTab(ui, username, hubBase, { openWorkbench(it) }, onLogout, onRefresh = vm::refreshDevices)
            }
        }
    }
}

@Composable
private fun TasksTab(
    vm: ChatViewModel,
    ui: ChatUiState,
    drawer: androidx.compose.material3.DrawerState,
    newSheet: Boolean,
    onNewSheet: (Boolean) -> Unit,
) {
    val scope = rememberCoroutineScope()
    fun close() = scope.launch { drawer.close() }
    // Defensive: if this tab leaves composition with the drawer mid-open, force-close state.
    DisposableEffect(drawer) {
        onDispose {
            if (drawer.isOpen) scope.launch { runCatching { drawer.close() } }
            onNewSheet(false)
        }
    }
    if (newSheet) NewTaskSheet(ui, onDismiss = { onNewSheet(false) }) { d, cwd -> onNewSheet(false); vm.startTask(d, cwd) }
    ModalNavigationDrawer(
        drawerState = drawer,
        gesturesEnabled = true,
        drawerContent = {
            ModalDrawerSheet(drawerContainerColor = Dsh.c.drawer, modifier = Modifier.fillMaxWidth(0.86f).widthIn(max = 320.dp)) {
                DrawerContent(ui, vm,
                    onOpen = { vm.openSession(it); close() },
                    onNew = { close(); onNewSheet(true) },
                    onNewInSpace = { vm.newInSpace(it); close() })
            }
        },
    ) {
        ChatPane(vm, ui, onMenu = { scope.launch { drawer.open() } }, onNew = { onNewSheet(true) })
    }
    if (ui.plusSheet) PlusSheet(vm, ui, onNewTask = { vm.openPlus(false); onNewSheet(true) })
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
                onClick = onNew, shape = RoundedCornerShape(16.dp), color = Dsh.c.card,
                modifier = Modifier.fillMaxWidth().border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
            ) {
                Row(Modifier.padding(vertical = 14.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.AddComment, null, tint = Ink); Spacer(Modifier.width(8.dp)); Text("新建任务", fontSize = 17.sp, color = Ink)
                }
            }
            Spacer(Modifier.height(12.dp))
        }
        val loose = ui.sessions.filter { it.cwd == null }
        if (ui.l1 == false) item { Text("这台电脑的远程插件需要升级后才能对话", color = Muted, fontSize = 14.sp, modifier = Modifier.padding(vertical = 24.dp)) }
        else if (ui.loadingList && ui.sessions.isEmpty()) items(4) { Skeleton(Modifier.fillMaxWidth().padding(vertical = 10.dp), 18.dp) }
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
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (selected) Dsh.c.selected else Color.Transparent)
            .clickable(onClick = onClick).padding(start = if (indent) 30.dp else 10.dp, end = 10.dp, top = 12.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(s.displayTitle(), color = Ink, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        if (s.running) CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp, color = Online)
    }
}

@Composable
private fun ChatPane(vm: ChatViewModel, ui: ChatUiState, onMenu: () -> Unit, onNew: () -> Unit) {
    var more by remember { mutableStateOf(false) }
    var renaming by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    ui.current?.let { cur ->
        if (renaming) RenameDialog(cur.displayTitle(), onDismiss = { renaming = false }) { renaming = false; vm.renameSession(cur.sessionId, it) }
        if (deleting) DeleteDialog(cur.displayTitle(), onDismiss = { deleting = false }) { deleting = false; vm.deleteSession(cur.sessionId) }
    }
    ui.toast?.let { t -> LaunchedEffect(t) { kotlinx.coroutines.delay(1600); vm.clearToast() } }
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
                    val sub = listOfNotNull(ui.device?.name?.let { n -> if (ui.device?.online == true) n else "$n（离线）" }, ui.current?.space ?: ui.pendingSpace?.substringAfterLast('/')).joinToString("  |  ")
                    Text(sub.ifBlank { "未连接设备" }, fontSize = 12.sp, color = Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Surface(shape = RoundedCornerShape(24.dp), color = Dsh.c.card, modifier = Modifier.border(1.dp, CardBorder, RoundedCornerShape(24.dp))) {
                Row {
                    IconButton(onClick = onNew) { Icon(Icons.Filled.AddComment, "新对话", tint = Ink) }
                    Box {
                        IconButton(onClick = { more = true }) { Icon(Icons.Filled.MoreHoriz, "更多", tint = Ink) }
                        DropdownMenu(expanded = more, onDismissRequest = { more = false }) {
                            DropdownMenuItem(text = { Text("刷新") }, onClick = { more = false; vm.refreshSessions(); ui.sessionId?.let(vm::openSession) })
                            if (ui.running) DropdownMenuItem(text = { Text("停止回复") }, onClick = { more = false; vm.stop() })
                            if (ui.current != null && ui.canRename) DropdownMenuItem(text = { Text("重命名") }, onClick = { more = false; renaming = true })
                            if (ui.current != null && ui.canDelete) DropdownMenuItem(text = { Text("删除任务", color = Dsh.c.danger) }, onClick = { more = false; deleting = true })
                            if (ui.current != null && !ui.canRename) DropdownMenuItem(text = { Text("重命名 / 删除需升级插件", color = Muted, fontSize = 13.sp) }, enabled = false, onClick = {})
                        }
                    }
                }
            }
        }
        ui.error?.let { e -> ErrorBanner(e, onDismiss = vm::clearError, onAction = { vm.clearError(); vm.retry() }) }
        ui.toast?.let { Text(it, color = Muted, fontSize = 13.sp, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center) }
        val chatItems = remember(ui.messages, ui.live, ui.pendingAsk) { groupChat(ui.messages, ui.live, ui.pendingAsk) }
        val listState = rememberLazyListState()
        // Index 0 is the header (加载中 / spacer), chat items start at 1.
        val prev = remember(ui.sessionId) { mutableStateOf<Pair<Int, ChatItem?>>(0 to null) }
        LaunchedEffect(chatItems, ui.live.length) {
            if (chatItems.isEmpty()) { prev.value = 0 to null; return@LaunchedEffect }
            val (oldSize, oldFirst) = prev.value
            prev.value = chatItems.size to chatItems.first()
            kotlinx.coroutines.yield()
            val info = listState.layoutInfo
            val total = info.totalItemsCount
            if (total <= 0) return@LaunchedEffect
            if (oldSize == 0) { runCatching { listState.scrollToItem(total - 1) }; return@LaunchedEffect }
            val grewTop = oldFirst != null && chatItems.first() != oldFirst && chatItems.size > oldSize &&
                chatItems.indexOf(oldFirst).let { it > 0 }
            if (grewTop) {
                // Prepended an older page: keep the viewport on the same message.
                val delta = chatItems.indexOf(oldFirst)
                runCatching { listState.scrollToItem((listState.firstVisibleItemIndex + delta).coerceAtMost(total - 1), listState.firstVisibleItemScrollOffset) }
                return@LaunchedEffect
            }
            val lastVisible = info.visibleItemsInfo.lastOrNull()?.index ?: 0
            if (lastVisible >= total - 4) runCatching { listState.animateScrollToItem(total - 1) }
        }
        val nearTop by remember { derivedStateOf { listState.firstVisibleItemIndex <= 1 } }
        LaunchedEffect(nearTop, ui.sessionId, ui.hasMoreOlder, ui.loadingOlder, chatItems.size) {
            if (nearTop && chatItems.isNotEmpty() && ui.hasMoreOlder && !ui.loadingOlder) vm.loadOlder()
        }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (chatItems.isEmpty()) ChatEmpty(ui, vm, Modifier.align(Alignment.Center))
            LazyColumn(state = listState, modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    if (ui.loadingOlder) Box(Modifier.fillMaxWidth().padding(vertical = 6.dp), contentAlignment = Alignment.Center) { InProgress("加载中") }
                    else if (!ui.hasMoreOlder && chatItems.isNotEmpty()) Text("没有更早的消息了", color = Muted, fontSize = 12.sp, modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    else Spacer(Modifier.height(4.dp))
                }
                items(chatItems) {
                    cn.zhuhedong.remote.ui.genui.ProvideGenUiAction({ a, payload -> vm.send(cn.zhuhedong.remote.ui.genui.genUiActionMessage(a, payload)) }) {
                        ChatItemView(it, ui.running, ui.answeringAsk) { callId, answers, customs -> vm.answerAsk(callId, answers, customs) }
                    }
                }
                if (ui.running && ui.live.isBlank() && chatItems.lastOrNull() !is ChatItem.Steps && chatItems.none { it is ChatItem.Ask && !it.answered }) item { InProgress("进行中") }
                item { Spacer(Modifier.height(8.dp)) }
            }
        }
        Composer(vm, ui, onNew = onNew)
    }
}

@Composable
private fun RoundIcon(icon: ImageVector, desc: String, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = CircleShape, color = Dsh.c.card, modifier = Modifier.size(44.dp).border(1.dp, CardBorder, CircleShape)) {
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
private fun ChatItemView(
    item: ChatItem,
    running: Boolean,
    answering: Boolean = false,
    onAnswer: (callId: String, answers: List<Pair<String, List<String>>>, customs: Map<String, String>) -> Unit = { _, _, _ -> },
) {
    when (item) {
        is ChatItem.User -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Surface(shape = RoundedCornerShape(20.dp), color = UserBubble, modifier = Modifier.fillMaxWidth(0.86f)) {
                Text(softBreak(item.msg.text), color = Ink, fontSize = 16.sp, modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp))
            }
        }
        is ChatItem.Assistant -> MarkdownText(item.text)
        is ChatItem.Steps -> StepsCard(item.steps, running && item.running)
        is ChatItem.Ui -> cn.zhuhedong.remote.ui.genui.GenUiBlock(item.json)
        is ChatItem.Ask -> AskCard(item.ask, answered = item.answered, busy = answering, onSubmit = onAnswer)
    }
}

@Composable
private fun AskCard(
    ask: AskPayload,
    answered: Boolean,
    busy: Boolean,
    onSubmit: (callId: String, answers: List<Pair<String, List<String>>>, customs: Map<String, String>) -> Unit,
) {
    val selected = remember(ask.callId) { mutableStateMapOf<String, Set<String>>() }
    val customs = remember(ask.callId) { mutableStateMapOf<String, String>() }
    val locked = answered || busy

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Dsh.c.card,
        modifier = Modifier.fillMaxWidth().border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                if (answered) "已回答" else "需要你确认",
                color = Muted,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
            )
            ask.questions.forEach { q ->
                AskQuestionBlock(
                    question = q,
                    selected = selected[q.id].orEmpty(),
                    custom = customs[q.id] ?: "",
                    locked = locked,
                    onToggle = { label ->
                        if (locked) return@AskQuestionBlock
                        val cur = selected[q.id].orEmpty()
                        selected[q.id] = if (q.multiSelect) {
                            if (label in cur) cur - label else cur + label
                        } else {
                            setOf(label)
                        }
                        if (!q.multiSelect) customs[q.id] = ""
                    },
                    onCustom = { text ->
                        if (locked) return@AskQuestionBlock
                        customs[q.id] = text
                        if (!q.multiSelect && text.isNotBlank()) selected[q.id] = emptySet()
                    },
                )
            }
            if (!answered) {
                val canSubmit = ask.questions.all { q ->
                    val sel = selected[q.id].orEmpty()
                    val custom = customs[q.id].orEmpty().trim()
                    sel.isNotEmpty() || custom.isNotEmpty()
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(
                        enabled = canSubmit && !busy,
                        onClick = {
                            val answers = ask.questions.map { q ->
                                q.id to (selected[q.id]?.toList() ?: emptyList())
                            }
                            onSubmit(ask.callId, answers, customs.toMap())
                        },
                    ) {
                        if (busy) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = Ink)
                        else Text("提交", color = Ink, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

@Composable
private fun AskQuestionBlock(
    question: AskQuestion,
    selected: Set<String>,
    custom: String,
    locked: Boolean,
    onToggle: (String) -> Unit,
    onCustom: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        question.header?.takeIf { it.isNotBlank() }?.let {
            Text(it, color = Muted, fontSize = 12.sp)
        }
        Text(question.question, color = Ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        question.options.forEachIndexed { idx, opt ->
            val on = opt.label in selected
            Surface(
                onClick = { onToggle(opt.label) },
                enabled = !locked,
                shape = RoundedCornerShape(12.dp),
                color = if (on) Dsh.c.userBubble else Dsh.c.bg,
                modifier = Modifier.fillMaxWidth().border(1.dp, if (on) Ink.copy(alpha = 0.35f) else CardBorder, RoundedCornerShape(12.dp)),
            ) {
                Row(Modifier.padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        if (question.multiSelect) (if (on) "☑" else "☐") else "${idx + 1}",
                        color = if (on) Ink else Muted,
                        fontSize = 14.sp,
                        modifier = Modifier.width(22.dp),
                    )
                    Column(Modifier.weight(1f)) {
                        Text(opt.label, color = Ink, fontSize = 15.sp)
                        opt.description?.takeIf { it.isNotBlank() }?.let {
                            Text(it, color = Muted, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
        // Free-text fallback
        BasicTextField(
            value = custom,
            onValueChange = onCustom,
            enabled = !locked,
            singleLine = true,
            textStyle = androidx.compose.ui.text.TextStyle(color = Ink, fontSize = 14.sp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, CardBorder, RoundedCornerShape(10.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp),
            decorationBox = { inner ->
                Box {
                    if (custom.isEmpty()) Text("其他（可选）…", color = Muted, fontSize = 14.sp)
                    inner()
                }
            },
        )
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
            Surface(shape = RoundedCornerShape(14.dp), color = Dsh.c.card, modifier = Modifier.padding(top = 8.dp).fillMaxWidth().border(1.dp, CardBorder, RoundedCornerShape(14.dp))) {
                Column(Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) {
                    steps.takeLast(12).forEach { s ->
                        Row(Modifier.padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                            when (s.status) {
                                "running" -> CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 1.5.dp, color = Muted)
                                "error" -> Icon(Icons.Filled.Error, null, tint = Dsh.c.danger, modifier = Modifier.size(16.dp))
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
    val codeBg = Dsh.c.code
    val link = Dsh.c.accent
    val border = CardBorder
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        parseMarkdown(text).forEach { b ->
            when (b) {
                is MdBlock.Heading -> Text(
                    inlineMd(b.text, codeBg, link),
                    fontSize = (22 - b.level * 2).coerceAtLeast(15).sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Ink,
                    lineHeight = (28 - b.level).coerceAtLeast(20).sp,
                    modifier = Modifier.fillMaxWidth(),
                )
                is MdBlock.Bullet -> Row(
                    Modifier.fillMaxWidth().padding(start = (b.indent * 14).dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Text(
                        b.marker,
                        color = Ink,
                        fontSize = 16.sp,
                        lineHeight = 24.sp,
                        modifier = Modifier.widthIn(min = 22.dp),
                    )
                    Text(
                        inlineMd(b.text, codeBg, link),
                        color = Ink,
                        fontSize = 16.sp,
                        lineHeight = 24.sp,
                        modifier = Modifier.weight(1f),
                    )
                }
                is MdBlock.Quote -> Row(
                    Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                    verticalAlignment = Alignment.Top,
                ) {
                    Box(
                        Modifier
                            .padding(end = 10.dp)
                            .width(3.dp)
                            .fillMaxHeight()
                            .background(Dsh.c.accent.copy(alpha = 0.45f), RoundedCornerShape(2.dp)),
                    )
                    Text(
                        inlineMd(b.text, codeBg, link),
                        color = Muted,
                        fontSize = 15.sp,
                        lineHeight = 23.sp,
                        fontStyle = FontStyle.Italic,
                        modifier = Modifier.weight(1f),
                    )
                }
                is MdBlock.Code -> {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = codeBg,
                        modifier = Modifier.fillMaxWidth().border(1.dp, border, RoundedCornerShape(10.dp)),
                    ) {
                        Column {
                            if (!b.lang.isNullOrBlank()) {
                                Text(
                                    b.lang!!,
                                    color = Muted,
                                    fontSize = 11.sp,
                                    modifier = Modifier.padding(start = 12.dp, top = 8.dp, end = 12.dp),
                                )
                            }
                            val hScroll = rememberScrollState()
                            val vScroll = rememberScrollState()
                            Text(
                                b.code.ifEmpty { " " },
                                fontFamily = FontFamily.Monospace,
                                fontSize = 12.sp,
                                color = Ink,
                                softWrap = false,
                                modifier = Modifier
                                    .heightIn(max = 280.dp)
                                    .horizontalScroll(hScroll)
                                    .verticalScroll(vScroll)
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                            )
                        }
                    }
                }
                is MdBlock.Table -> MdTable(b.headers, b.rows)
                is MdBlock.GenUi -> cn.zhuhedong.remote.ui.genui.GenUiBlock(b.json, b.closed)
                is MdBlock.Hr -> HorizontalDivider(
                    color = border,
                    thickness = 1.dp,
                    modifier = Modifier.padding(vertical = 4.dp),
                )
                is MdBlock.Para -> Text(
                    inlineMd(b.text, codeBg, link),
                    color = Ink,
                    fontSize = 16.sp,
                    lineHeight = 25.sp,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun MdTable(headers: List<String>, rows: List<List<String>>) {
    val border = CardBorder
    val hScroll = rememberScrollState()
    val cols = maxOf(headers.size, rows.maxOfOrNull { it.size } ?: 0).coerceAtLeast(1)
    // Horizontal scroll + min content width so columns aren't crushed by the bubble;
    // cells run through inlineMd (links / `code` / **bold**).
    val cellMod = Modifier.widthIn(min = 112.dp, max = 280.dp).padding(horizontal = 8.dp, vertical = 6.dp)
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = Dsh.c.card,
        modifier = Modifier.fillMaxWidth().border(1.dp, border, RoundedCornerShape(10.dp)),
    ) {
        Column(Modifier.horizontalScroll(hScroll).padding(1.dp)) {
            fun cell(i: Int, list: List<String>) = list.getOrElse(i) { "" }
            Row(Modifier.background(Dsh.c.selected)) {
                for (i in 0 until cols) {
                    Text(
                        inlineMd(cell(i, headers), Dsh.c.code, Dsh.c.accent),
                        color = Ink,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = cellMod,
                    )
                }
            }
            rows.forEachIndexed { idx, row ->
                Row(Modifier.background(if (idx % 2 == 0) Dsh.c.card else Dsh.c.bg)) {
                    for (i in 0 until cols) {
                        Text(
                            inlineMd(cell(i, row), Dsh.c.code, Dsh.c.accent),
                            color = Ink,
                            fontSize = 13.sp,
                            modifier = cellMod,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun Composer(vm: ChatViewModel, ui: ChatUiState, onNew: () -> Unit) {
    var modelMenu by remember { mutableStateOf(false) }
    var voiceHint by remember { mutableStateOf(false) }
    val enabled = ui.l1 == true && ui.device?.online == true
    Surface(
        shape = RoundedCornerShape(24.dp), color = Dsh.c.card,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp).border(1.dp, CardBorder, RoundedCornerShape(24.dp)),
    ) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
            if (ui.selectedSkills.isNotEmpty()) SkillChips(ui.selectedSkills) { vm.removeSkill(it) }
            Box(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                if (ui.input.isEmpty()) Text(when { enabled -> "发消息…"; ui.l1 == false -> "升级远程插件后即可发消息"; else -> "电脑连上后即可发消息" }, color = Muted, fontSize = 17.sp)
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
                    if (modelMenu) ModelSheet(ui, onDismiss = { modelMenu = false }) { modelMenu = false; vm.selectModel(it) }
                }
                IconButton(onClick = { vm.openPlus(true) }) { Icon(Icons.Filled.Add, "更多", tint = Ink) }
                val canSend = enabled && ui.input.isNotBlank() && !ui.sending
                Surface(
                    onClick = { if (ui.running && ui.input.isBlank()) vm.stop() else vm.send() },
                    shape = CircleShape, color = if (ui.running || canSend) Ink else Dsh.c.skeleton, modifier = Modifier.size(40.dp),
                    enabled = ui.running || canSend,
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        if (ui.sending) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = Dsh.c.card)
                        else Icon(if (ui.running && ui.input.isBlank()) Icons.Filled.Stop else Icons.Filled.ArrowUpward, if (ui.running) "停止" else "发送", tint = Bg)
                    }
                }
            }
            if (voiceHint) {
                LaunchedEffect(Unit) { kotlinx.coroutines.delay(1800); voiceHint = false }
                Text("语音输入即将支持，可先用输入法自带的语音键", color = Muted, fontSize = 12.sp)
            }
        }
    }
}



@Composable
private fun SkillChips(list: List<cn.zhuhedong.remote.viewmodel.SkillItem>, onRemove: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        list.forEach { k ->
            Surface(shape = RoundedCornerShape(14.dp), color = Dsh.c.selected) {
                Row(Modifier.padding(start = 10.dp, end = 4.dp, top = 4.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.AutoAwesome, null, tint = Dsh.c.accent, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("/" + k.name, fontSize = 13.sp, color = Ink, maxLines = 1)
                    Box(Modifier.size(22.dp).clip(CircleShape).clickable { onRemove(k.id) }, contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.Close, "移除技能", tint = Muted, modifier = Modifier.size(14.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun PlusSheet(vm: ChatViewModel, ui: ChatUiState, onNewTask: () -> Unit) {
    var q by remember { mutableStateOf("") }
    cn.zhuhedong.remote.ui.common.InLayoutBottomSheet(onDismiss = { vm.openPlus(false) }) {
        Column(Modifier.fillMaxWidth().heightIn(max = 560.dp).padding(horizontal = 20.dp, vertical = 16.dp)) {
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClick = onNewTask).padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.AddComment, null, tint = Ink); Spacer(Modifier.width(10.dp)); Text("新建任务", fontSize = 16.sp, color = Ink)
            }
            Text("技能", fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 10.dp, bottom = 6.dp))
            Surface(shape = RoundedCornerShape(12.dp), color = Dsh.c.skeleton, modifier = Modifier.fillMaxWidth()) {
                Box(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
                    if (q.isEmpty()) Text("搜索技能", color = Muted, fontSize = 15.sp)
                    BasicTextField(value = q, onValueChange = { q = it }, singleLine = true, textStyle = TextStyle(fontSize = 15.sp, color = Ink), cursorBrush = SolidColor(Ink), modifier = Modifier.fillMaxWidth())
                }
            }
            Spacer(Modifier.height(6.dp))
            when {
                ui.skillsLoading -> Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp) }
                ui.skillsError != null -> Text(ui.skillsError, color = Muted, fontSize = 14.sp, modifier = Modifier.padding(vertical = 16.dp))
                else -> {
                    val f = q.trim().lowercase()
                    val shown = ui.skills.filter { f.isEmpty() || it.name.lowercase().contains(f) || it.description.lowercase().contains(f) }
                    if (shown.isEmpty()) Text(if (ui.skills.isEmpty()) "暂无可用技能" else "没有匹配的技能", color = Muted, fontSize = 14.sp, modifier = Modifier.padding(vertical = 16.dp))
                    LazyColumn(Modifier.fillMaxWidth()) {
                        items(shown, key = { it.id }) { k ->
                            val on = ui.selectedSkills.any { it.id == k.id }
                            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable { vm.toggleSkill(k); if (!on) vm.openPlus(false) }.padding(vertical = 10.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(k.name, fontSize = 15.sp, color = Ink, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal)
                                    if (k.description.isNotBlank()) Text(k.description, fontSize = 12.sp, color = Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                if (on) Icon(Icons.Filled.CheckCircle, null, tint = Dsh.c.online, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}
