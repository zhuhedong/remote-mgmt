package cn.zhuhedong.remote.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.zhuhedong.remote.data.ChatMsg
import cn.zhuhedong.remote.data.ChatParse
import cn.zhuhedong.remote.data.ChatSession
import cn.zhuhedong.remote.data.ChatSpace
import cn.zhuhedong.remote.data.DeviceInstance
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
    val error: String? = null,
) {
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

    private fun errText(r: InvokeResult): String = when (r.code) {
        "OFFLINE" -> "设备离线"
        "NOT_FOUND" -> "远程插件版本过旧，请升级到 0.2.0+"
        "UNAVAILABLE" -> r.message ?: "DSH 会话服务不可用"
        else -> r.message ?: r.code ?: "请求失败"
    }

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
                set { it.copy(devices = list, device = pick, error = null) }
                if (pick != null && keep == null) selectDevice(pick) else refreshSessions()
            } catch (e: Exception) {
                set { it.copy(error = e.message ?: "加载设备失败") }
            }
        }
    }

    fun selectDevice(d: DeviceInstance) {
        stopFollow()
        set { it.copy(device = d, l1 = null, sessions = emptyList(), spaces = emptyList(), sessionId = null, messages = emptyList(), live = "", running = false, models = emptyList(), model = null) }
        viewModelScope.launch {
            val caps = runCatching { withContext(Dispatchers.IO) { hub.capabilities(d.id) } }.getOrNull()
            val has = caps?.capabilities?.any { it.id == "chat.prompt" } == true
            set { it.copy(l1 = has, error = if (caps != null && !has) "该设备的远程插件还不支持对话（需升级到 0.2.0）" else null) }
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
        set { it.copy(sessionId = id, messages = emptyList(), live = "", running = false, error = null) }
        startFollow(id)
        loadModels()
    }

    /** "新建任务": clear to a blank composer; the session is created on first send. */
    fun newTask() {
        stopFollow()
        pendingCwd = null
        set { it.copy(sessionId = null, messages = emptyList(), live = "", running = false, error = null) }
    }

    private var pendingCwd: String? = null

    fun newInSpace(cwd: String) { newTask(); pendingCwd = cwd }

    fun updateInput(s: String) = set { it.copy(input = s) }

    fun send() {
        val text = _ui.value.input.trim()
        if (text.isEmpty() || _ui.value.sending) return
        viewModelScope.launch {
            set { it.copy(sending = true, error = null) }
            var sid = _ui.value.sessionId
            if (sid == null) {
                val p = JSONObject(); pendingCwd?.let { p.put("cwd", it) }
                val r = call("chat.session.create", p)
                sid = r.data?.get("sessionId") as? String
                if (!r.ok || sid == null) { set { it.copy(sending = false, error = errText(r)) }; return@launch }
                pendingCwd = null
                set { it.copy(sessionId = sid) }
                startFollow(sid)
                // carry the composer's chosen model into the new session
                _ui.value.model?.let { m -> call("models.select", JSONObject().put("sessionId", sid).put("provider", m.provider).put("model", m.model)) }
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
            if (!r.ok) set { it.copy(model = prev, error = "切换模型失败：" + errText(r)) }
        }
    }

    fun clearError() = set { it.copy(error = null) }

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
                        set { it.copy(messages = f.messages, live = f.live, running = f.running || (it.sending), error = f.error ?: it.error) }
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
}
