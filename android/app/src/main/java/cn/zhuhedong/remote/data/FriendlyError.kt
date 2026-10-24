package cn.zhuhedong.remote.data

/** Maps raw Hub/agent error codes ("HTTP_404", "HTTP_502: agent: unsupported" …) to user-facing states. */
enum class ErrKind { OFFLINE, UPGRADE_PLUGIN, UPGRADE_HUB, AUTH, NETWORK, DSH_DOWN, GENERIC }

data class FriendlyError(val kind: ErrKind, val title: String, val hint: String, val action: String = "重试", val raw: String? = null)

object Friendly {
    fun of(code: String?, message: String?, httpStatus: Int = 0): FriendlyError {
        val c = code.orEmpty()
        val m = message.orEmpty()
        val raw = listOf(c, m).filter { it.isNotBlank() }.joinToString(": ").ifBlank { null }
        return when {
            httpStatus == 401 || c == "UNAUTHORIZED" || c == "HTTP_401" ->
                FriendlyError(ErrKind.AUTH, "登录已过期", "请重新登录 Hub 后再试。", "重新登录", raw)
            c == "OFFLINE" || httpStatus == 503 || m.contains("offline", true) ->
                FriendlyError(ErrKind.OFFLINE, "电脑离线", "请确认电脑已开机、DSH Desktop 正在运行，且远程插件已连上 Hub。", "重试", raw)
            m.contains("unsupported", true) || c == "NOT_FOUND" && m.contains("capability", true) || c == "NOT_FOUND" ->
                FriendlyError(ErrKind.UPGRADE_PLUGIN, "远程插件需要升级", "这台电脑上的 dsh-remote-agent 版本过旧，不支持该功能。请在电脑上升级插件后重启 DSH。", "重新检测", raw)
            c == "HTTP_404" ->
                FriendlyError(ErrKind.UPGRADE_HUB, "服务器版本过旧", "Hub 还没有这个接口，请先升级服务器上的 Hub。", "重试", raw)
            c == "UNAVAILABLE" || c == "DSH_ERROR" ->
                FriendlyError(ErrKind.DSH_DOWN, "DSH 暂时不可用", m.ifBlank { "DSH 会话服务没有响应，稍后再试或在电脑上重启 DSH。" }, "重试", raw)
            c == "NETWORK" || c == "TIMEOUT" || m.contains("timeout", true) || m.contains("Unable to resolve", true) || m.contains("failed to connect", true) ->
                FriendlyError(ErrKind.NETWORK, "网络连接失败", "无法连到 Hub，请检查手机网络后重试。", "重试", raw)
            c.startsWith("HTTP_5") ->
                FriendlyError(ErrKind.GENERIC, "服务器出错了", "Hub 暂时无法处理请求，请稍后重试。", "重试", raw)
            else -> FriendlyError(ErrKind.GENERIC, "出了点问题", m.ifBlank { c.ifBlank { "请求失败" } }, "重试", raw)
        }
    }

    fun of(r: InvokeResult) = of(r.code, r.message, r.httpStatus)
    fun of(e: Throwable): FriendlyError = when (e) {
        is HubException -> of(e.code, e.message, e.httpStatus)
        is java.io.IOException -> of("NETWORK", e.message)
        else -> of(null, e.message)
    }
}
