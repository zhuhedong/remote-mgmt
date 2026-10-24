package cn.zhuhedong.remote.data

data class DeviceInstance(
    val id: String,
    val name: String,
    val slug: String,
    val status: String,
    val online: Boolean,
    val hostname: String? = null,
    val fingerprint: String? = null,
)

data class CapabilityDescriptor(
    val id: String,
    val title: String,
    val description: String? = null,
    val stream: Boolean = false,
    val permission: String = "open",
    val sensitive: Boolean = false,
    val category: String? = null,
)

data class CapListResult(
    val agentCapVersion: Int,
    val capabilities: List<CapabilityDescriptor>,
    val online: Boolean,
)

data class InvokeResult(
    val ok: Boolean,
    val requestId: String,
    val data: Map<String, Any?>? = null,
    val code: String? = null,
    val message: String? = null,
    val httpStatus: Int = 200,
)

class HubException(val code: String, message: String, val httpStatus: Int = 400) : Exception(message)
