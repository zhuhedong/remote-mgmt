package cn.zhuhedong.remote.data

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class HubRepository(private val store: SessionStore) {
    private val client = HubClient(store)

    fun setHubBase(base: String) {
        store.hubBase = base.trimEnd('/')
    }

    fun hubBase(): String = store.hubBase

    fun isLoggedIn(): Boolean = !store.cookieHeader.isNullOrBlank()

    /** Step 1: password → expects {totp:true} and sets pre cookie. */
    fun loginPassword(username: String, password: String) {
        val body = JSONObject().put("username", username).put("password", password)
        client.postJson("/api/auth/login", body)
        store.username = username
    }

    /** Step 2: TOTP → sets sid cookie. */
    fun loginTotp(code: String) {
        client.postJson("/api/auth/totp", JSONObject().put("code", code))
    }

    fun logout() {
        runCatching { client.postJson("/api/auth/logout") }
        client.clearCookies()
    }

    fun me(): JSONObject = client.getJson("/api/me")

    fun listInstances(): List<DeviceInstance> {
        val arr = client.getJsonArray("/api/instances")
        val out = ArrayList<DeviceInstance>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            out.add(
                DeviceInstance(
                    id = o.getString("id"),
                    name = o.optString("name"),
                    slug = o.optString("slug"),
                    status = o.optString("status"),
                    online = o.optBoolean("online"),
                    hostname = o.optString("hostname").ifBlank { null },
                    fingerprint = o.optString("fingerprint").ifBlank { null },
                )
            )
        }
        return out
    }

    fun capabilities(instanceId: String): CapListResult {
        val o = client.getJson("/api/instances/$instanceId/capabilities")
        val caps = mutableListOf<CapabilityDescriptor>()
        val arr = o.optJSONArray("capabilities")
        if (arr != null) {
            for (i in 0 until arr.length()) {
                val c = arr.getJSONObject(i)
                caps.add(
                    CapabilityDescriptor(
                        id = c.getString("id"),
                        title = c.optString("title", c.getString("id")),
                        description = c.optString("description").ifBlank { null },
                        stream = c.optBoolean("stream"),
                        permission = c.optString("permission", "open"),
                        sensitive = c.optBoolean("sensitive"),
                        category = c.optString("category").ifBlank { null },
                    )
                )
            }
        }
        return CapListResult(
            agentCapVersion = o.optInt("agentCapVersion", 0),
            capabilities = caps,
            online = o.optBoolean("online", true),
        )
    }

    fun invoke(instanceId: String, capabilityId: String, params: JSONObject = JSONObject()): InvokeResult {
        val requestId = UUID.randomUUID().toString()
        val body = JSONObject()
            .put("id", capabilityId)
            .put("params", params)
            .put("requestId", requestId)
        return try {
            val o = client.postJson("/api/instances/$instanceId/invoke", body)
            InvokeResult(
                ok = o.optBoolean("ok"),
                requestId = o.optString("requestId", requestId),
                data = o.optJSONObject("data")?.toMap(),
                code = o.optString("code").ifBlank { null },
                message = o.optString("message").ifBlank { null },
                httpStatus = 200,
            )
        } catch (e: HubException) {
            InvokeResult(
                ok = false,
                requestId = requestId,
                code = e.code,
                message = e.message,
                httpStatus = e.httpStatus,
            )
        }
    }

    fun reauth(password: String? = null, code: String? = null): JSONObject {
        val body = JSONObject()
        if (!password.isNullOrBlank()) body.put("password", password)
        if (!code.isNullOrBlank()) body.put("code", code)
        return client.postJson("/api/me/reauth", body)
    }

    private fun JSONObject.toMap(): Map<String, Any?> {
        val m = linkedMapOf<String, Any?>()
        keys().forEach { k -> m[k] = coerce(opt(k)) }
        return m
    }

    private fun coerce(v: Any?): Any? = when (v) {
        null, JSONObject.NULL -> null
        is JSONObject -> v.toMap()
        is JSONArray -> (0 until v.length()).map { coerce(v.get(it)) }
        else -> v
    }
}
