package cn.zhuhedong.remote.data

import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Low-level Hub HTTP client (cookie session + X-Hub CSRF header).
 * TODO(A0.5+): certificate pinning — do not ship without reviewing TrustManager.
 */
class HubClient(private val store: SessionStore) {
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    private val jar = object : CookieJar {
        private val mem = mutableListOf<Cookie>()

        override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
            synchronized(mem) {
                mem.removeAll { c -> cookies.any { it.name == c.name && it.domain == c.domain } }
                mem.addAll(cookies)
                // Persist sid-like cookies for cold start
                val interesting = mem.filter {
                    it.name.contains("sid", ignoreCase = true) || it.name.contains("rh_", ignoreCase = true)
                }
                if (interesting.isNotEmpty()) {
                    store.cookieHeader = interesting.joinToString("; ") { "${it.name}=${it.value}" }
                }
            }
        }

        override fun loadForRequest(url: HttpUrl): List<Cookie> {
            synchronized(mem) {
                if (mem.isEmpty()) {
                    restoreFromStore(url)
                }
                return mem.filter { it.matches(url) }
            }
        }

        private fun restoreFromStore(url: HttpUrl) {
            val raw = store.cookieHeader ?: return
            raw.split(";").map { it.trim() }.forEach { part ->
                val i = part.indexOf('=')
                if (i > 0) {
                    val name = part.substring(0, i)
                    val value = part.substring(i + 1)
                    val c = Cookie.Builder()
                        .name(name)
                        .value(value)
                        .domain(url.host)
                        .path("/")
                        .build()
                    mem.add(c)
                }
            }
        }

        fun clear() {
            synchronized(mem) { mem.clear() }
        }
    }

    val http: OkHttpClient = OkHttpClient.Builder()
        .cookieJar(jar)
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    fun clearCookies() {
        jar.clear()
        store.clearAuth()
    }

    fun postJson(path: String, body: JSONObject = JSONObject()): JSONObject {
        val url = store.hubBase + path
        val req = Request.Builder()
            .url(url)
            .header("X-Hub", "1")
            .header("Accept", "application/json")
            .post(body.toString().toRequestBody(jsonType))
            .build()
        return execute(req)
    }

    fun getJson(path: String): JSONObject {
        val url = store.hubBase + path
        val req = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .get()
            .build()
        return execute(req)
    }

    fun getJsonArray(path: String): JSONArray {
        val url = store.hubBase + path
        val req = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .get()
            .build()
        http.newCall(req).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                val obj = runCatching { JSONObject(text) }.getOrNull()
                val code = obj?.optString("code")?.ifBlank { null } ?: "HTTP_${resp.code}"
                val err = obj?.optString("error")?.ifBlank { null }
                    ?: obj?.optString("message")?.ifBlank { null }
                    ?: "HTTP ${resp.code}"
                throw HubException(code, err, resp.code)
            }
            return if (text.isBlank()) JSONArray() else JSONArray(text)
        }
    }

    private fun execute(req: Request): JSONObject {
        http.newCall(req).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            val obj = if (text.isBlank()) JSONObject() else runCatching { JSONObject(text) }.getOrElse {
                throw HubException("PARSE", "invalid JSON (${resp.code})", resp.code)
            }
            if (!resp.isSuccessful) {
                val code = obj.optString("code").ifBlank { "HTTP_${resp.code}" }
                val msg = obj.optString("error").ifBlank { obj.optString("message").ifBlank { "HTTP ${resp.code}" } }
                throw HubException(code, msg, resp.code)
            }
            return obj
        }
    }
}
