package cn.zhuhedong.remote.data

import android.content.Context
import android.content.SharedPreferences

/**
 * Minimal session cache. A0: SharedPreferences (not EncryptedSharedPreferences yet).
 * Cookie jar persistence is handled by HubClient CookieJar + these prefs.
 */
class SessionStore(ctx: Context) {
    private val prefs: SharedPreferences =
        ctx.getSharedPreferences("dsh_remote_session", Context.MODE_PRIVATE)

    var hubBase: String
        get() = prefs.getString(KEY_HUB, DEFAULT_HUB)?.trimEnd('/') ?: DEFAULT_HUB
        set(v) = prefs.edit().putString(KEY_HUB, v.trimEnd('/')).apply()

    var cookieHeader: String?
        get() = prefs.getString(KEY_COOKIE, null)
        set(v) {
            prefs.edit().apply {
                if (v.isNullOrBlank()) remove(KEY_COOKIE) else putString(KEY_COOKIE, v)
            }.apply()
        }

    var username: String?
        get() = prefs.getString(KEY_USER, null)
        set(v) = prefs.edit().putString(KEY_USER, v).apply()

    fun clearAuth() {
        prefs.edit().remove(KEY_COOKIE).remove(KEY_USER).apply()
    }

    companion object {
        const val DEFAULT_HUB = "https://remote.zhuhedong.cn"
        private const val KEY_HUB = "hub_base"
        private const val KEY_COOKIE = "cookie"
        private const val KEY_USER = "username"
    }
}
