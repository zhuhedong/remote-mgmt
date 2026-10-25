package cn.zhuhedong.remote.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import cn.zhuhedong.remote.data.CapListResult
import cn.zhuhedong.remote.data.DeviceInstance
import cn.zhuhedong.remote.data.HubException
import cn.zhuhedong.remote.data.HubRepository
import cn.zhuhedong.remote.data.InvokeResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

data class LoginUiState(
    val hubBase: String = "",
    val username: String = "",
    val password: String = "",
    val totp: String = "",
    val step: Int = 1,
    val loading: Boolean = false,
    val error: String? = null,
)

private fun loginErr(e: Exception, authMsg: String): String {
    val f = cn.zhuhedong.remote.data.Friendly.of(e)
    return when {
        e is HubException && (e.httpStatus == 401 || e.httpStatus == 400 || e.httpStatus == 403) -> authMsg
        e is HubException && e.httpStatus == 429 -> "尝试次数过多，请稍后再试"
        else -> f.title + "：" + f.hint
    }
}

class LoginViewModel(private val hub: HubRepository) : ViewModel() {
    private val _ui = MutableStateFlow(LoginUiState(hubBase = hub.hubBase()))
    val ui: StateFlow<LoginUiState> = _ui.asStateFlow()

    fun update(block: (LoginUiState) -> LoginUiState) {
        _ui.value = block(_ui.value)
    }

    fun submitPassword(onNeedTotp: () -> Unit) {
        val s = _ui.value
        viewModelScope.launch {
            _ui.value = s.copy(loading = true, error = null)
            try {
                hub.setHubBase(s.hubBase)
                withContext(Dispatchers.IO) { hub.loginPassword(s.username.trim(), s.password) }
                _ui.value = _ui.value.copy(loading = false, step = 2, password = "")
                onNeedTotp()
            } catch (e: Exception) {
                _ui.value = _ui.value.copy(loading = false, error = loginErr(e, "用户名或密码不正确"))
            }
        }
    }

    fun submitTotp(onSuccess: () -> Unit) {
        val s = _ui.value
        viewModelScope.launch {
            _ui.value = s.copy(loading = true, error = null)
            try {
                withContext(Dispatchers.IO) { hub.loginTotp(s.totp.trim()) }
                _ui.value = _ui.value.copy(loading = false, totp = "")
                onSuccess()
            } catch (e: Exception) {
                _ui.value = _ui.value.copy(loading = false, error = loginErr(e, "验证码不正确或已过期，请等下一个码再试"))
            }
        }
    }
}

data class InstancesUiState(
    val loading: Boolean = false,
    val items: List<DeviceInstance> = emptyList(),
    val error: String? = null,
)

class InstancesViewModel(private val hub: HubRepository) : ViewModel() {
    private val _ui = MutableStateFlow(InstancesUiState())
    val ui: StateFlow<InstancesUiState> = _ui.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _ui.value = _ui.value.copy(loading = true, error = null)
            try {
                val list = withContext(Dispatchers.IO) { hub.listInstances() }
                _ui.value = InstancesUiState(loading = false, items = list)
            } catch (e: HubException) {
                val msg = when {
                    e.httpStatus == 401 -> "登录已失效，请重新登录"
                    else -> "${e.code}: ${e.message}"
                }
                _ui.value = _ui.value.copy(loading = false, error = msg)
            } catch (e: Exception) {
                _ui.value = _ui.value.copy(loading = false, error = e.message ?: "加载失败")
            }
        }
    }

    fun logout(done: () -> Unit) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { hub.logout() }
            done()
        }
    }
}

data class PendingSensitive(
    val capabilityId: String,
    val title: String,
    val execute: Boolean,
)

data class WorkbenchUiState(
    val loading: Boolean = false,
    val offline: Boolean = false,
    val caps: CapListResult? = null,
    val status: InvokeResult? = null,
    val metrics: InvokeResult? = null,
    val logs: InvokeResult? = null,
    val health: InvokeResult? = null,
    val opResult: InvokeResult? = null,
    val opBusy: Boolean = false,
    val error: String? = null,
    /** When set, show reauth dialog; after success retry this op. */
    val pendingSensitive: PendingSensitive? = null,
    val showReauth: Boolean = false,
    val reauthPassword: String = "",
    val reauthCode: String = "",
    val reauthError: String? = null,
    val reauthBusy: Boolean = false,
    val confirmSensitive: PendingSensitive? = null,
    val fatal: cn.zhuhedong.remote.data.FriendlyError? = null,
    val cpuHist: List<Float> = emptyList(),
    val memHist: List<Float> = emptyList(),
)

class WorkbenchViewModel(private val hub: HubRepository, private val instanceId: String) : ViewModel() {
    private val _ui = MutableStateFlow(WorkbenchUiState())
    val ui: StateFlow<WorkbenchUiState> = _ui.asStateFlow()

    fun load() {
        viewModelScope.launch {
            _ui.value = _ui.value.copy(loading = true, error = null, offline = false, opResult = null, fatal = null)
            try {
                val caps = withContext(Dispatchers.IO) { hub.capabilities(instanceId) }
                val status = withContext(Dispatchers.IO) { hub.invoke(instanceId, "instance.status") }
                val metrics = withContext(Dispatchers.IO) { hub.invoke(instanceId, "instance.metrics") }
                val logs = withContext(Dispatchers.IO) {
                    hub.invoke(instanceId, "instance.logs.tail", JSONObject().put("lines", 80))
                }
                val health = withContext(Dispatchers.IO) { hub.invoke(instanceId, "services.health") }
                _ui.value = _ui.value.copy(
                    loading = false,
                    caps = caps,
                    status = status,
                    metrics = metrics,
                    logs = logs,
                    health = health,
                    offline = false,
                )
                pushSample(metrics)
            } catch (e: HubException) {
                val offline = e.code == "OFFLINE" || e.httpStatus == 503 ||
                    e.message?.contains("OFFLINE", ignoreCase = true) == true
                _ui.value = _ui.value.copy(
                    loading = false,
                    offline = offline,
                    error = if (offline) {
                        "实例当前离线：桌面 DSH / 远程插件未连上 Hub。请确认电脑开机且插件已连接，然后下拉刷新。"
                    } else {
                        "${e.code}: ${e.message}"
                    },
                    caps = null,
                    fatal = cn.zhuhedong.remote.data.Friendly.of(e),
                )
            } catch (e: Exception) {
                _ui.value = _ui.value.copy(loading = false, error = e.message ?: "加载失败", fatal = cn.zhuhedong.remote.data.Friendly.of(e))
            }
        }
    }

    private fun num(v: Any?): Float? = when (v) { is Number -> v.toFloat(); is String -> v.toFloatOrNull(); else -> null }

    private fun pushSample(r: InvokeResult) {
        if (!r.ok) return
        val d = r.data.orEmpty()
        val cpu = num(d["cpu"]) ?: return
        val mem = num(d["memUsed"]) ?: 0f
        val s = _ui.value
        _ui.value = s.copy(
            cpuHist = (s.cpuHist + cpu).takeLast(30),
            memHist = (s.memHist + mem).takeLast(30),
        )
    }

    /** Light polling of instance.metrics while the device page is visible (sparkline data). */
    private var pollJob: kotlinx.coroutines.Job? = null
    fun pollMetrics() {
        if (pollJob?.isActive == true) return
        pollJob = viewModelScope.launch {
            while (true) {
                try {
                    kotlinx.coroutines.delay(5000)
                    if (_ui.value.offline || _ui.value.fatal != null) continue
                    val r = runCatching { withContext(Dispatchers.IO) { hub.invoke(instanceId, "instance.metrics") } }.getOrNull() ?: continue
                    if (r.ok) { _ui.value = _ui.value.copy(metrics = r); pushSample(r) }
                } catch (_: Exception) {
                    // never crash the process from a metrics poll
                }
            }
        }
    }

    fun stopPolling() {
        pollJob?.cancel()
        pollJob = null
    }

    /**
     * Drop confirm/reauth sheet flags immediately.
     * Material3 ModalBottomSheet is hosted in a Dialog window; if the destination is
     * popped while a sheet (or its dismiss animation) is still up, the invisible scrim
     * can remain and swallow all touches on Home. Call this on leave / before popBackStack.
     */
    fun clearOverlays() {
        val s = _ui.value
        if (s.confirmSensitive == null && !s.showReauth && s.pendingSensitive == null &&
            s.reauthPassword.isEmpty() && s.reauthCode.isEmpty() && s.reauthError == null && !s.reauthBusy
        ) return
        _ui.value = s.copy(
            confirmSensitive = null,
            showReauth = false,
            pendingSensitive = null,
            reauthBusy = false,
            reauthError = null,
            reauthPassword = "",
            reauthCode = "",
        )
    }

    override fun onCleared() {
        stopPolling()
        clearOverlays()
        super.onCleared()
    }

    /** Screenshot tests only. */
    fun seedForPreview(s: WorkbenchUiState) { _ui.value = s }

    fun updateReauth(block: (WorkbenchUiState) -> WorkbenchUiState) {
        _ui.value = block(_ui.value)
    }

    fun requestSensitive(capabilityId: String, title: String, execute: Boolean) {
        _ui.value = _ui.value.copy(
            confirmSensitive = PendingSensitive(capabilityId, title, execute),
            opResult = null,
        )
    }

    fun dismissConfirm() {
        _ui.value = _ui.value.copy(confirmSensitive = null)
    }

    fun confirmSensitive() {
        val pending = _ui.value.confirmSensitive ?: return
        _ui.value = _ui.value.copy(confirmSensitive = null)
        runSensitive(pending)
    }

    private fun runSensitive(pending: PendingSensitive) {
        viewModelScope.launch {
            _ui.value = _ui.value.copy(opBusy = true, opResult = null, error = null)
            val params = JSONObject().put("dryRun", !pending.execute).put("execute", pending.execute)
            val result = withContext(Dispatchers.IO) {
                hub.invoke(instanceId, pending.capabilityId, params)
            }
            if (!result.ok && result.code == "REAUTH_REQUIRED") {
                _ui.value = _ui.value.copy(
                    opBusy = false,
                    pendingSensitive = pending,
                    showReauth = true,
                    reauthError = null,
                    reauthPassword = "",
                    reauthCode = "",
                    opResult = result,
                )
                return@launch
            }
            _ui.value = _ui.value.copy(opBusy = false, opResult = result)
        }
    }

    fun dismissReauth() {
        _ui.value = _ui.value.copy(
            showReauth = false,
            pendingSensitive = null,
            reauthPassword = "",
            reauthCode = "",
            reauthError = null,
        )
    }

    fun submitReauth() {
        val s = _ui.value
        val pending = s.pendingSensitive ?: return
        viewModelScope.launch {
            _ui.value = s.copy(reauthBusy = true, reauthError = null)
            try {
                withContext(Dispatchers.IO) {
                    hub.reauth(
                        password = s.reauthPassword.ifBlank { null },
                        code = s.reauthCode.ifBlank { null },
                    )
                }
                _ui.value = _ui.value.copy(
                    showReauth = false,
                    reauthBusy = false,
                    pendingSensitive = null,
                    reauthPassword = "",
                    reauthCode = "",
                )
                runSensitive(pending)
            } catch (e: Exception) {
                _ui.value = _ui.value.copy(
                    reauthBusy = false,
                    reauthError = e.message ?: "重验证失败",
                )
            }
        }
    }
}

@Suppress("UNCHECKED_CAST")
class VmFactory(private val hub: HubRepository, private val instanceId: String? = null) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return when {
            modelClass.isAssignableFrom(LoginViewModel::class.java) -> LoginViewModel(hub) as T
            modelClass.isAssignableFrom(InstancesViewModel::class.java) -> InstancesViewModel(hub) as T
            modelClass.isAssignableFrom(WorkbenchViewModel::class.java) ->
                WorkbenchViewModel(hub, instanceId ?: error("instanceId")) as T
            modelClass.isAssignableFrom(ChatViewModel::class.java) -> ChatViewModel(hub) as T
            else -> error("unknown vm")
        }
    }
}
