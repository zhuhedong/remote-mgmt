package cn.zhuhedong.remote.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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
    /** Absolute or ~/… path chosen for the next create; kept in UI state so it can't desync from [pendingSpace]. */
    val pendingCwd: String? = null,
    val pendingSpace: String? = null,
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

    private fun set(f: (ChatUiState) -> ChatUiState) { _ui.value = f(_ui.value) }

    private suspend fun call(cap: String, params: JSONObject = JSONObject()): InvokeResult {
        val dev = _ui.value.device ?: return InvokeResult(false, "", code = "NO_DEVICE", message = "未选择设备")
        return withContext(Dispatchers.IO) { hub.invoke(dev.id, cap, params) }
    }

    private fun errText(r: InvokeResult): FriendlyError = Friendly.of(r)

    fun start() {
        if (_ui.value.devices.isNotEmpty()) return
        refreshDevices()
    }

    fun refreshDevices() {
        viewModelScope.launch {
            try {
                val list = withContext(Dispatchers.IO) { hub.listInstances() }
                val keep = _ui.value.device?.let { d -> list.firstOrNull { it.id == d.id } }
                val pick = keep ?: list.firstOrNull { it.online } ?: list.firstOrNull()
                set { it.copy(devices = list, device = pick, error = null, devicesLoaded = true, devicesError = null) }
                if (pick != null && keep == null) selectDevice(pick) else refreshSessions()
            } catch (e: Exception) {
                set { it.copy(devicesLoaded = true, devicesError = Friendly.of(e)) }
            }
        }
    }

    fun selectDevice(d: DeviceInstance) {
        stopFollow()
        set { it.copy(device = d, l1 = null, caps = emptySet(), capsError = null, sessions = emptyList(), spaces = emptyList(), sessionId = null, messages = emptyList(), live = "", running = false, models = emptyList(), model = null, pendingCwd = null, pendingSpace = null) }
        viewModelScope.launch {
            val res = runCatching { withContext(Dispatchers.IO) { hub.capabilities(d.id) } }
            val caps = res.getOrNull()
            val ids = caps?.capabilities?.map { it.id }?.toSet().orEmpty()
            val has = "chat.prompt" in ids
            set { it.copy(l1 = if (caps == null) null else has, caps = ids, capsError = res.exceptionOrNull()?.let(Friendly::of)) }
            if (has) { refreshSessions(); loadModels() }
        }
    }

    fun refreshSessions() {
        if (_ui.value.l1 != true) return
        viewModelScope.launch {
            set { it.copy(loadingList = true) }
            val r = call("chat.sessions.list")
            if (r.ok) {
                val (s, sp) = ChatParse.sessions(r.data)
                set { it.copy(sessions = s, spaces = sp, loadingList = false) }
            } else set { it.copy(loadingList = false, error = errText(r)) }
        }
    }

    fun loadModels() {
        viewModelScope.launch {
            val p = JSONObject(); _ui.value.sessionId?.let { p.put("sessionId", it) }
            val r = call("models.list", p)
            if (r.ok) { val (m, cur) = ChatParse.models(r.data); set { it.copy(models = m, model = cur ?: it.model) } }
        }
    }

    fun openSession(id: String) {
        stopFollow()
        set { it.copy(sessionId = id, messages = emptyList(), live = "", running = false, error = null, pendingCwd = null, pendingSpace = null) }
        startFollow(id)
        loadModels()
    }

    /** Blank composer with no project; session is created on first send. */
    fun newTask() {
        stopFollow()
        set { it.copy(pendingCwd = null, pendingSpace = null, sessionId = null, messages = emptyList(), live = "", running = false, error = null) }
    }

    fun newInSpace(cwd: String) {
        stopFollow()
        val c = cwd.trim().ifBlank { null }
        set { it.copy(pendingCwd = c, pendingSpace = c, sessionId = null, messages = emptyList(), live = "", running = false, error = null) }
    }

    fun updateInput(s: String) = set { it.copy(input = s) }

    fun send() {
        val text = _ui.value.input.trim()
        if (text.isEmpty() || _ui.value.sending) return
        viewModelScope.launch {
            set { it.copy(sending = true, error = null) }
            var sid = _ui.value.sessionId
            if (sid == null) {
                val want = _ui.value.pendingCwd
                val p = JSONObject(); want?.let { p.put("cwd", it) }
                val r = call("chat.session.create", p)
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
            val optimistic = ChatMsg(Long.MAX_VALUE, "user", text)
            set { it.copy(input = "", messages = it.messages + optimistic, running = true) }
            val r = call("chat.prompt", JSONObject().put("sessionId", sid).put("text", text))
            set { it.copy(sending = false, error = if (r.ok) null else errText(r), running = r.ok) }
            if (!r.ok) set { it.copy(input = text, messages = it.messages - optimistic) }
            refreshSessions()
        }
    }

    fun stop() {
        val sid = _ui.value.sessionId ?: return
        viewModelScope.launch {
            val r = call("chat.cancel", JSONObject().put("sessionId", sid))
            if (!r.ok) set { it.copy(error = errText(r)) }
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
            if (!r.ok) set { it.copy(model = prev, error = errText(r).let { e -> e.copy(title = "切换模型失败") }) }
        }
    }

    /** Screenshot tests only: render a fixed state. */
    fun seedForPreview(s: ChatUiState) { _ui.value = s }

    fun clearError() = set { it.copy(error = null) }
    fun clearToast() = set { it.copy(toast = null) }

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
        set { it.copy(pendingCwd = c, pendingSpace = c, sessionId = null, messages = emptyList(), live = "", running = false, error = null) }
    }

    fun renameSession(id: String, title: String) {
        viewModelScope.launch {
            val r = call("chat.session.rename", JSONObject().put("sessionId", id).put("title", title.trim()))
            if (r.ok) { set { it.copy(toast = "已重命名") }; refreshSessions() } else set { it.copy(error = errText(r)) }
        }
    }

    fun deleteSession(id: String) {
        viewModelScope.launch {
            val r = call("chat.session.delete", JSONObject().put("sessionId", id))
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
                val r = call("chat.follow", JSONObject().put("sessionId", sid).put("version", version).put("waitMs", 15000))
                if (_ui.value.sessionId != sid) break
                if (r.ok) {
                    backoff = 1000L
                    val f = ChatParse.follow(r.data)
                    if (!f.unchanged) {
                        version = f.version
                        val wasRunning = _ui.value.running
                        set { it.copy(messages = f.messages, live = f.live, running = f.running || (it.sending), error = f.error?.let { m -> Friendly.of("DSH_ERROR", m) } ?: it.error) }
                        if (wasRunning && !f.running) refreshSessions()
                    }
                } else {
                    set { it.copy(error = errText(r)) }
                    delay(backoff); backoff = (backoff * 2).coerceAtMost(15000L)
                }
            }
        }
    }

    private fun stopFollow() { followJob?.cancel(); followJob = null }

    override fun onCleared() { stopFollow() }

    companion object {
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
