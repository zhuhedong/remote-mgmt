package cn.zhuhedong.remote.data

import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.io.InterruptedIOException
import java.net.SocketTimeoutException
import java.util.concurrent.TimeUnit

/**
 * Low-level Hub HTTP client (cookie session + X-Hub CSRF header).
 * All transport failures are mapped to [HubException] so callers never see raw IOExceptions
 * (uncaught IOException in viewModelScope would crash the process — common after background).
 */
class HubClient(private val store: SessionStore) {
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    private val jar = object : CookieJar {
        private val mem = mutableListOf<Cookie>()

        override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
            synchronized(mem) {
                mem.removeAll { c -> cookies.any { it.name == c.name && it.domain == c.domain } }
                mem.addAll(cookies)
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
            val host = url.host
            if (host.isBlank()) return
            raw.split(";").map { it.trim() }.forEach { part ->
                val i = part.indexOf('=')
                if (i <= 0) return@forEach
                val name = part.substring(0, i).trim()
                val value = part.substring(i + 1).trim()
                if (name.isEmpty() || value.isEmpty()) return@forEach
                runCatching {
                    Cookie.Builder()
                        .name(name)
                        .value(value)
                        .domain(host)
                        .path("/")
                        .build()
                }.onSuccess { mem.add(it) }
            }
        }

        fun clear() {
            synchronized(mem) { mem.clear() }
        }
    }

    val http: OkHttpClient = OkHttpClient.Builder()
        .cookieJar(jar)
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    fun clearCookies() {
        jar.clear()
        store.clearAuth()
    }

    fun postJson(path: String, body: JSONObject = JSONObject()): JSONObject {
        val req = Request.Builder()
            .url(absoluteUrl(path))
            .header("X-Hub", "1")
            .header("Accept", "application/json")
            .post(body.toString().toRequestBody(jsonType))
            .build()
        return execute(req)
    }

    fun getJson(path: String): JSONObject {
        val req = Request.Builder()
            .url(absoluteUrl(path))
            .header("Accept", "application/json")
            .get()
            .build()
        return execute(req)
    }

    fun getJsonArray(path: String): JSONArray {
        val req = Request.Builder()
            .url(absoluteUrl(path))
            .header("Accept", "application/json")
            .get()
            .build()
        return try {
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
                if (text.isBlank()) JSONArray() else JSONArray(text)
            }
        } catch (e: HubException) {
            throw e
        } catch (e: Exception) {
            throw mapTransport(e)
        }
    }

    private fun absoluteUrl(path: String): String {
        val base = store.hubBase.trim().trimEnd('/')
        if (base.isBlank() || base.toHttpUrlOrNull() == null) {
            throw HubException("NETWORK", "Hub 地址无效", 0)
        }
        val p = if (path.startsWith("/")) path else "/$path"
        return base + p
    }

    private fun execute(req: Request): JSONObject {
        return try {
            http.newCall(req).execute().use { resp ->
                val text = resp.body?.string().orEmpty()
                val obj = if (text.isBlank()) JSONObject() else runCatching { JSONObject(text) }.getOrElse {
                    throw HubException("PARSE", "invalid JSON (${resp.code})", resp.code)
                }
                if (!resp.isSuccessful) {
                    val code = obj.optString("code").ifBlank { "HTTP_${resp.code}" }
                    val msg = obj.optString("error").ifBlank {
                        obj.optString("message").ifBlank { "HTTP ${resp.code}" }
                    }
                    throw HubException(code, msg, resp.code)
                }
                obj
            }
        } catch (e: HubException) {
            throw e
        } catch (e: Exception) {
            throw mapTransport(e)
        }
    }

    companion object {
        fun mapTransport(e: Exception): HubException {
            if (e is HubException) return e
            val msg = e.message ?: e.javaClass.simpleName
            val code = when (e) {
                is SocketTimeoutException -> "TIMEOUT"
                is InterruptedIOException -> "TIMEOUT"
                is IOException -> "NETWORK"
                else -> "NETWORK"
            }
            return HubException(code, msg, 0)
        }
    }
}
