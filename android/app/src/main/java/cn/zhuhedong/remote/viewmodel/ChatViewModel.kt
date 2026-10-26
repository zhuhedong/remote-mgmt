package cn.zhuhedong.remote.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.zhuhedong.remote.data.AskPayload
import cn.zhuhedong.remote.data.ChatMsg
import cn.zhuhedong.remote.data.ChatParse
import cn.zhuhedong.remote.data.ChatSession
import cn.zhuhedong.remote.data.ChatSpace
import cn.zhuhedong.remote.data.DeviceInstance
import cn.zhuhedong.remote.data.ErrKind
import cn.zhuhedong.remote.data.Friendly
import cn.zhuhedong.remote.data.FriendlyError
import cn.zhuhedong.remote.data.HubRepository
import cn.zhuhedong.remote.data.InvokeResult
import cn.zhuhedong.remote.data.ModelOption
import cn.zhuhedong.remote.data.ModelSel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

data class SkillItem(val id: String, val name: String, val description: String, val source: String)

data class ChatUiState(
    val devices: List<DeviceInstance> = emptyList(),
    val device: DeviceInstance? = null,
    val l1: Boolean? = null, // null=unknown, false=agent lacks chat caps
    val sessions: List<ChatSession> = emptyList(),
    val spaces: List<ChatSpace> = emptyList(),
    val loadingList: Boolean = false,
    val sessionId: String? = null,
    val messages: List<ChatMsg> = emptyList(),
    val live: String = "",
    val running: Boolean = false,
    val sending: Boolean = false,
    val input: String = "",
    val models: List<ModelOption> = emptyList(),
    val model: ModelSel? = null,
    val error: FriendlyError? = null,
    val devicesLoaded: Boolean = false,
    val devicesError: FriendlyError? = null,
    val caps: Set<String> = emptySet(),
    val capsError: FriendlyError? = null,
    val toast: String? = null,
    /** Active ask_user_question waiting for a tap answer. */
    val pendingAsk: AskPayload? = null,
    /** 「+」 sheet open. */
    val plusSheet: Boolean = false,
    val skills: List<SkillItem> = emptyList(),
    val skillsLoading: Boolean = false,
    /** null = ok; otherwise message shown in the sheet (e.g. 请更新电脑端插件). */
    val skillsError: String? = null,
    /** Skills chosen for the next message (sent as DSH `/name` gestures by the agent). */
    val selectedSkills: List<SkillItem> = emptyList(),
    val answeringAsk: Boolean = false,
    /** Older pages fetched via chat.history (prepended before the follow window). */
    val older: List<ChatMsg> = emptyList(),
    val loadingOlder: Boolean = false,
    val hasMoreOlder: Boolean = true,
    /** Absolute or ~/… path chosen for the next create; kept in UI state so it can't desync from [pendingSpace]. */
    val pendingCwd: String? = null,
    val pendingSpace: String? = null,
    /** Set when Hub returns 401 so the shell can route to login. */
    val needsReLogin: Boolean = false,
) {
    val canRename: Boolean get() = "chat.session.rename" in caps
    val canDelete: Boolean get() = "chat.session.delete" in caps
    val current: ChatSession? get() = sessions.firstOrNull { it.sessionId == sessionId }
}

class ChatViewModel(private val hub: HubRepository) : ViewModel() {
    private val _ui = MutableStateFlow(ChatUiState())
    val ui: StateFlow<ChatUiState> = _ui.asStateFlow()
    private var followJob: Job? = null
    private var version = -1
    /** When false (app in background), follow loop sleeps instead of long-polling. */
    @Volatile private var foreground = true

    private fun set(f: (ChatUiState) -> ChatUiState) { _ui.value = f(_ui.value) }

    private suspend fun call(cap: String, params: JSONObject = JSONObject()): InvokeResult {
        val dev = _ui.value.device ?: return InvokeResult(false, "", code = "NO_DEVICE", message = "未选择设备")
        return withContext(Dispatchers.IO) {
            try {
                hub.invoke(dev.id, cap, params)
            } catch (e: Exception) {
                InvokeResult(false, "", code = "NETWORK", message = e.message ?: "network error", httpStatus = 0)
            }
        }
    }

    private fun noteAuth(r: InvokeResult): Boolean {
        if (r.httpStatus == 401 || r.code == "UNAUTHORIZED" || r.code == "HTTP_401") {
            set { it.copy(needsReLogin = true, error = Friendly.of(r)) }
            return true
        }
        return false
    }

    private fun errText(r: InvokeResult): FriendlyError = Friendly.of(r)

    fun start() {
        if (_ui.value.devices.isNotEmpty()) return
        refreshDevices()
    }

    /** Called when Activity returns to foreground: refresh devices and resume follow safely. */
    fun onAppForeground() {
        foreground = true
        viewModelScope.launch {
            try {
                refreshDevicesQuiet()
                val sid = _ui.value.sessionId
                if (sid != null && (followJob == null || followJob?.isActive != true)) {
                    startFollow(sid)
                }
            } catch (e: Exception) {
                set { it.copy(error = Friendly.of(e)) }
            }
        }
    }

    fun onAppBackground() {
        foreground = false
    }

    fun refreshDevices() {
        viewModelScope.launch {
            try {
                val list = withContext(Dispatchers.IO) { hub.listInstances() }
                val keep = _ui.value.device?.let { d -> list.firstOrNull { it.id == d.id } }
                val pick = keep ?: list.firstOrNull { it.online } ?: list.firstOrNull()
                set { it.copy(devices = list, device = pick, error = null, devicesLoaded = true, devicesError = null, needsReLogin = false) }
                if (pick != null && keep == null) selectDevice(pick) else refreshSessions()
            } catch (e: Exception) {
                val fe = Friendly.of(e)
                set {
                    it.copy(
                        devicesLoaded = true,
                        devicesError = fe,
                        needsReLogin = fe.kind == ErrKind.AUTH,
                    )
                }
            }
        }
    }

    /** Soft refresh used on resume — keep current device selection, don't reset chat. */
    private suspend fun refreshDevicesQuiet() {
        try {
            val list = withContext(Dispatchers.IO) { hub.listInstances() }
            val keep = _ui.value.device?.let { d -> list.firstOrNull { it.id == d.id } }
            val pick = keep ?: _ui.value.device ?: list.firstOrNull { it.online } ?: list.firstOrNull()
            set { it.copy(devices = list, device = pick, devicesLoaded = true, devicesError = null) }
            if (pick != null && _ui.value.l1 == null) selectDevice(pick)
            else if (_ui.value.l1 == true) refreshSessions()
        } catch (e: Exception) {
            val fe = Friendly.of(e)
            if (fe.kind == ErrKind.AUTH) set { it.copy(needsReLogin = true, devicesError = fe) }
            // swallow network blips on resume — follow loop will surface them
        }
    }

    fun selectDevice(d: DeviceInstance) {
        stopFollow()
        set { it.copy(device = d, l1 = null, caps = emptySet(), capsError = null, sessions = emptyList(), spaces = emptyList(), sessionId = null, messages = emptyList(), older = emptyList(), loadingOlder = false, hasMoreOlder = true, live = "", running = false, models = emptyList(), model = null, pendingCwd = null, pendingSpace = null) }
        viewModelScope.launch {
            val res = runCatching { withContext(Dispatchers.IO) { hub.capabilities(d.id) } }
            val caps = res.getOrNull()
            val ids = caps?.capabilities?.map { it.id }?.toSet().orEmpty()
            val has = "chat.prompt" in ids
            val err = res.exceptionOrNull()?.let(Friendly::of)
            set { it.copy(l1 = if (caps == null) null else has, caps = ids, capsError = err, needsReLogin = err?.kind == ErrKind.AUTH) }
            if (has) { refreshSessions(); loadModels() }
        }
    }

    fun refreshSessions() {
        if (_ui.value.l1 != true) return
        viewModelScope.launch {
            set { it.copy(loadingList = true) }
            val r = call("chat.sessions.list")
            if (noteAuth(r)) { set { it.copy(loadingList = false) }; return@launch }
            if (r.ok) {
                val (s, sp) = ChatParse.sessions(r.data)
                set { it.copy(sessions = s, spaces = sp, loadingList = false) }
            } else set { it.copy(loadingList = false, error = errText(r)) }
        }
    }

    fun openPlus(open: Boolean) {
        set { it.copy(plusSheet = open) }
        if (open) loadSkills()
    }

    fun toggleSkill(k: SkillItem) = set { s ->
        s.copy(selectedSkills = if (s.selectedSkills.any { it.id == k.id }) s.selectedSkills.filter { it.id != k.id } else s.selectedSkills + k)
    }

    fun removeSkill(id: String) = set { s -> s.copy(selectedSkills = s.selectedSkills.filter { it.id != id }) }

    fun loadSkills() {
        val st = _ui.value
        if ("chat.skills" !in st.caps) { set { it.copy(skillsError = "请更新电脑端插件", skills = emptyList()) }; return }
        // skills/list is Session-addressed; before the first message, use a session in the chosen space.
        val sid = st.sessionId
            ?: st.sessions.firstOrNull { st.pendingCwd != null && it.cwd == st.pendingCwd }?.sessionId
            ?: st.sessions.firstOrNull()?.sessionId
        if (sid == null) { set { it.copy(skillsError = "先发一条消息创建任务后即可选择技能", skills = emptyList()) }; return }
        viewModelScope.launch {
            set { it.copy(skillsLoading = true, skillsError = null) }
            val r = call("chat.skills", JSONObject().put("sessionId", sid))
            if (noteAuth(r)) { set { it.copy(skillsLoading = false) }; return@launch }
            if (!r.ok) {
                val upgrade = r.code == "NOT_FOUND" || (r.message ?: "").contains("unknown capability")
                set { it.copy(skillsLoading = false, skillsError = if (upgrade) "请更新电脑端插件" else errText(r).title) }
                return@launch
            }
            val list = (r.data?.get("skills") as? List<*>).orEmpty().mapNotNull { o ->
                val m = o as? Map<*, *> ?: return@mapNotNull null
                val n = m["name"] as? String ?: return@mapNotNull null
                SkillItem((m["id"] as? String) ?: n, n, (m["description"] as? String).orEmpty(), (m["source"] as? String).orEmpty())
            }.sortedBy { it.name }
            set { it.copy(skillsLoading = false, skills = list, skillsError = null) }
        }
    }

    fun loadModels() {
        viewModelScope.launch {
            val p = JSONObject(); _ui.value.sessionId?.let { p.put("sessionId", it) }
            val r = call("models.list", p)
            if (noteAuth(r)) return@launch
            if (r.ok) { val (m, cur) = ChatParse.models(r.data); set { it.copy(models = m, model = cur ?: it.model) } }
        }
    }

    fun openSession(id: String) {
        stopFollow()
        // Re-opening the current session (刷新) keeps the transcript on screen — wiping it
        // made the list blank then refill, which flashed.
        if (_ui.value.sessionId == id) set { it.copy(error = null, loadingOlder = false) }
        else set { it.copy(sessionId = id, messages = emptyList(), older = emptyList(), loadingOlder = false, hasMoreOlder = true, live = "", running = false, error = null, pendingCwd = null, pendingSpace = null) }
        startFollow(id)
        loadModels()
    }

    /** Blank composer with no project; session is created on first send. */
    fun newTask() {
        stopFollow()
        set { it.copy(pendingCwd = null, pendingSpace = null, sessionId = null, messages = emptyList(), older = emptyList(), loadingOlder = false, hasMoreOlder = true, live = "", running = false, error = null) }
    }

    fun newInSpace(cwd: String) {
        stopFollow()
        val c = cwd.trim().ifBlank { null }
        set { it.copy(pendingCwd = c, pendingSpace = c, sessionId = null, messages = emptyList(), older = emptyList(), loadingOlder = false, hasMoreOlder = true, live = "", running = false, pendingAsk = null, error = null) }
    }

    fun updateInput(s: String) = set { it.copy(input = s) }

    /** Send the composer text, or [override] (e.g. a dsh-ui [genui-action]) without touching the draft. */
    fun send(override: String? = null) {
        val fromComposer = override == null
        val text = (override ?: _ui.value.input).trim()
        if (text.isEmpty() || _ui.value.sending) return
        viewModelScope.launch {
            set { it.copy(sending = true, error = null) }
            var sid = _ui.value.sessionId
            if (sid == null) {
                val want = _ui.value.pendingCwd
                val p = JSONObject(); want?.let { p.put("cwd", it) }
                val r = call("chat.session.create", p)
                if (noteAuth(r)) { set { it.copy(sending = false) }; return@launch }
                sid = r.data?.get("sessionId") as? String
                if (!r.ok || sid == null) { set { it.copy(sending = false, error = errText(r)) }; return@launch }
                val got = r.data?.get("cwd") as? String
                if (!cwdMatches(want, got)) {
                    set {
                        it.copy(
                            sending = false,
                            sessionId = null,
                            error = FriendlyError(
                                ErrKind.GENERIC,
                                "工作目录不对",
                                "新建的会话在 ${got ?: "（未知）"}，不是你选的 $want。请重新选项目后再发。",
                                "知道了",
                                "cwd want=$want got=$got",
                            ),
                        )
                    }
                    return@launch
                }
                set { it.copy(sessionId = sid, pendingCwd = null, pendingSpace = got ?: want) }
                startFollow(sid)
                _ui.value.model?.let { m -> call("models.select", JSONObject().put("sessionId", sid).put("provider", m.provider).put("model", m.model)) }
                refreshSessions()
            }
            val picked = if (fromComposer) _ui.value.selectedSkills else emptyList()
            val shown = if (picked.isEmpty()) text else picked.joinToString(" ") { "/" + it.name } + " " + text
            val optimistic = ChatMsg(Long.MAX_VALUE, "user", shown)
            set { if (fromComposer) it.copy(input = "", messages = it.messages + optimistic, running = true, selectedSkills = emptyList()) else it.copy(messages = it.messages + optimistic, running = true) }
            val p = JSONObject().put("sessionId", sid).put("text", text)
            if (picked.isNotEmpty()) p.put("skills", org.json.JSONArray(picked.map { it.name }))
            val r = call("chat.prompt", p)
            if (noteAuth(r)) { set { if (fromComposer) it.copy(sending = false, running = false, input = text, selectedSkills = picked, messages = it.messages - optimistic) else it.copy(sending = false, running = false, messages = it.messages - optimistic) }; return@launch }
            set { it.copy(sending = false, error = if (r.ok) null else errText(r), running = r.ok) }
            if (!r.ok) set { if (fromComposer) it.copy(input = text, selectedSkills = picked, messages = it.messages - optimistic) else it.copy(messages = it.messages - optimistic) }
            refreshSessions()
        }
    }


    /** Submit answers for a parked ask_user_question (options are option labels). */
    fun answerAsk(callId: String, answers: List<Pair<String, List<String>>>, customs: Map<String, String> = emptyMap()) {
        val sid = _ui.value.sessionId ?: return
        if (_ui.value.answeringAsk) return
        viewModelScope.launch {
            set { it.copy(answeringAsk = true, error = null) }
            val arr = org.json.JSONArray()
            for ((id, selected) in answers) {
                val o = JSONObject().put("id", id)
                val sel = org.json.JSONArray()
                selected.forEach { sel.put(it) }
                o.put("selected", sel)
                customs[id]?.takeIf { it.isNotBlank() }?.let { o.put("custom", it) }
                arr.put(o)
            }
            val r = call(
                "chat.answerAsk",
                JSONObject().put("sessionId", sid).put("callId", callId).put("answers", arr),
            )
            if (noteAuth(r)) { set { it.copy(answeringAsk = false) }; return@launch }
            if (r.ok) {
                set { it.copy(answeringAsk = false, pendingAsk = null, toast = "已提交回答") }
            } else {
                set { it.copy(answeringAsk = false, error = errText(r).let { e -> e.copy(title = "提交回答失败") }) }
            }
        }
    }

    fun stop() {
        val sid = _ui.value.sessionId ?: return
        viewModelScope.launch {
            val r = call("chat.cancel", JSONObject().put("sessionId", sid))
            if (!r.ok && !noteAuth(r)) set { it.copy(error = errText(r)) }
        }
    }

    fun selectModel(m: ModelOption) {
        val sel = ModelSel(m.provider, m.id)
        val sid = _ui.value.sessionId
        val prev = _ui.value.model
        set { it.copy(model = sel) }
        if (sid == null) return // applied on first send
        viewModelScope.launch {
            val r = call("models.select", JSONObject().put("sessionId", sid).put("provider", m.provider).put("model", m.id))
            if (!r.ok && !noteAuth(r)) set { it.copy(model = prev, error = errText(r).let { e -> e.copy(title = "切换模型失败") }) }
        }
    }

    /** Screenshot tests only: render a fixed state. */
    fun seedForPreview(s: ChatUiState) { _ui.value = s }

    fun clearError() = set { it.copy(error = null) }
    fun clearToast() = set { it.copy(toast = null) }
    fun clearNeedsReLogin() = set { it.copy(needsReLogin = false) }

    /** Retry whatever failed: device list, capability probe, or the current session. */
    fun retry() {
        val s = _ui.value
        when {
            s.devicesError != null || s.devices.isEmpty() -> refreshDevices()
            s.device != null && (s.l1 != true) -> selectDevice(s.device)
            else -> { refreshSessions(); s.sessionId?.let(::openSession) }
        }
    }

    /** New-task sheet: optionally switch device, then start a blank task in [cwd]. */
    fun startTask(device: DeviceInstance?, cwd: String?) {
        if (device != null && device.id != _ui.value.device?.id) selectDevice(device)
        val c = cwd?.trim()?.ifBlank { null }
        stopFollow()
        set { it.copy(pendingCwd = c, pendingSpace = c, sessionId = null, messages = emptyList(), older = emptyList(), loadingOlder = false, hasMoreOlder = true, live = "", running = false, pendingAsk = null, error = null) }
    }

    fun renameSession(id: String, title: String) {
        viewModelScope.launch {
            val r = call("chat.session.rename", JSONObject().put("sessionId", id).put("title", title.trim()))
            if (noteAuth(r)) return@launch
            if (r.ok) { set { it.copy(toast = "已重命名") }; refreshSessions() } else set { it.copy(error = errText(r)) }
        }
    }

    fun deleteSession(id: String) {
        viewModelScope.launch {
            val r = call("chat.session.delete", JSONObject().put("sessionId", id))
            if (noteAuth(r)) return@launch
            if (r.ok) {
                if (_ui.value.sessionId == id) newTask()
                set { it.copy(toast = "已删除", sessions = it.sessions.filterNot { s -> s.sessionId == id }) }
                refreshSessions()
            } else set { it.copy(error = errText(r)) }
        }
    }

    private fun startFollow(sid: String) {
        followJob?.cancel()
        version = -1
        followJob = viewModelScope.launch {
            var backoff = 1000L
            while (isActive && _ui.value.sessionId == sid) {
                // Pause long-poll while backgrounded — OS often kills the socket and an
                // uncaught failure used to take down the whole process on resume.
                if (!foreground) {
                    delay(500)
                    continue
                }
                val r = try {
                    call("chat.follow", JSONObject().put("sessionId", sid).put("version", version).put("waitMs", 15000))
                } catch (e: Exception) {
                    InvokeResult(false, "", code = "NETWORK", message = e.message, httpStatus = 0)
                }
                if (_ui.value.sessionId != sid) break
                if (noteAuth(r)) break
                if (r.ok) {
                    backoff = 1000L
                    val f = try {
                        ChatParse.follow(r.data)
                    } catch (e: Exception) {
                        set { it.copy(error = Friendly.of(e)) }
                        delay(backoff)
                        continue
                    }
                    if (!f.unchanged) {
                        version = f.version
                        val wasRunning = _ui.value.running
                        set {
                            // Keep local card if agent briefly omits pendingAsk while a running
                            // ask step (or in-flight submit) still exists — avoids "已关闭" while
                            // desktop DSH is still waiting.
                            val mergedAsk = f.pendingAsk
                                ?: it.pendingAsk?.takeIf { cur ->
                                    it.answeringAsk || f.messages.any { m ->
                                        m.ask?.callId == cur.callId && m.status == "running"
                                    }
                                }
                            it.copy(
                                messages = mergeHistory(it.older, f.messages),
                                live = f.live,
                                running = f.running || it.sending,
                                pendingAsk = mergedAsk,
                                error = f.error?.let { m -> Friendly.of("DSH_ERROR", m) } ?: it.error,
                            )
                        }
                        if (wasRunning && !f.running) refreshSessions()
                    }
                } else {
                    // Soft network errors during follow: backoff without clearing the transcript.
                    val soft = r.code == "NETWORK" || r.code == "TIMEOUT" || r.code == "NO_DEVICE"
                    if (!soft) set { it.copy(error = errText(r)) }
                    delay(backoff)
                    backoff = (backoff * 2).coerceAtMost(15000L)
                }
            }
        }
    }

    /** Scroll-to-top pager: chat.history(beforeSeq) exists since agent A1, so works with 0.2.5. */
    fun loadOlder() {
        val st = _ui.value
        val sid = st.sessionId ?: return
        if (st.loadingOlder || !st.hasMoreOlder) return
        val before = st.messages.map { it.seq }.filter { it > 0 }.minOrNull()
        if (before == null) { if (st.messages.isNotEmpty()) set { it.copy(hasMoreOlder = false) }; return }
        set { it.copy(loadingOlder = true) }
        viewModelScope.launch {
            val r = try {
                call("chat.history", JSONObject().put("sessionId", sid).put("maxMessages", 50).put("beforeSeq", before))
            } catch (e: Exception) {
                InvokeResult(false, "", code = "NETWORK", message = e.message, httpStatus = 0)
            }
            if (_ui.value.sessionId != sid) return@launch
            if (!r.ok) {
                val unsupported = r.code == "UNKNOWN_CAPABILITY" || r.code == "NOT_FOUND" || r.code == "VALIDATION"
                set { it.copy(loadingOlder = false, hasMoreOlder = !unsupported && it.hasMoreOlder) }
                return@launch
            }
            val page = ChatParse.messages(r.data?.get("messages")).filter { it.seq in 1 until before }
            val more = r.data?.get("hasMore") == true && page.isNotEmpty()
            set { cur ->
                val older = (page + cur.older).distinctBy { Triple(it.seq, it.role, it.callId) }.sortedBy { it.seq }
                cur.copy(older = older, messages = mergeHistory(older, cur.messages), loadingOlder = false, hasMoreOlder = more)
            }
        }
    }

    private fun stopFollow() { followJob?.cancel(); followJob = null }

    override fun onCleared() { stopFollow() }

    companion object {
        /** Older pages strictly before the first live message, then the live window. */
        fun mergeHistory(older: List<ChatMsg>, live: List<ChatMsg>): List<ChatMsg> {
            val firstLive = live.map { it.seq }.filter { it > 0 }.minOrNull() ?: Long.MAX_VALUE
            val liveKeys = live.map { Triple(it.seq, it.role, it.callId) }.toHashSet()
            val head = older.filter { it.seq in 1 until firstLive && Triple(it.seq, it.role, it.callId) !in liveKeys }
            val tail = live.filter { m -> head.none { it.seq == m.seq && it.role == m.role && it.callId == m.callId } }
            return head + tail
        }

        /** True when create landed in the project the user picked (handles ~/… vs absolute). */
        fun cwdMatches(pending: String?, actual: String?): Boolean {
            if (pending.isNullOrBlank()) return true
            if (actual.isNullOrBlank()) return true // old agent: can't verify
            val a = actual.trim().trimEnd('/', '\\')
            val p = pending.trim().trimEnd('/', '\\')
            if (a == p) return true
            if (p == "~") return true
            if (p.startsWith("~/") || p.startsWith("~\\")) {
                val rest = p.drop(2).replace('\\', '/')
                val ar = a.replace('\\', '/')
                return ar.endsWith("/$rest") || ar.endsWith(rest)
            }
            return false
        }
    }
}
