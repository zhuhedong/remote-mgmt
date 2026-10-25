package cn.zhuhedong.remote.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import cn.zhuhedong.remote.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.io.File
import java.util.concurrent.TimeUnit

data class ReleaseInfo(val version: String, val notes: String, val apkUrl: String, val size: Long, val pageUrl: String)

sealed interface UpdateState {
    data object Idle : UpdateState
    data object Checking : UpdateState
    data class UpToDate(val manual: Boolean) : UpdateState
    data class Available(val rel: ReleaseInfo) : UpdateState
    data class Downloading(val rel: ReleaseInfo, val progress: Float, val source: String) : UpdateState
    data class Ready(val rel: ReleaseInfo, val file: File) : UpdateState
    data class NeedPermission(val rel: ReleaseInfo, val file: File) : UpdateState
    data class Failed(val msg: String, val rel: ReleaseInfo?) : UpdateState
}

object Updater {
    private const val REPO = "zhuhedong/remote-mgmt"
    private const val THROTTLE_MS = 6 * 3600_000L
    // Mirrors tried in order when downloading release assets (GitHub can be slow in China).
    private val MIRRORS = listOf("" to "GitHub", "https://ghfast.top/" to "镜像 ghfast", "https://gh-proxy.com/" to "镜像 gh-proxy")

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val http = OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).build()
    private val _state = MutableStateFlow<UpdateState>(UpdateState.Idle)
    val state: StateFlow<UpdateState> = _state
    private var job: Job? = null

    private val tagRe = Regex("^v(\\d+)\\.(\\d+)\\.(\\d+)$")

    fun parse(v: String): List<Int>? = tagRe.find(v.trim().let { if (it.startsWith("v")) it else "v$it" })?.groupValues?.drop(1)?.map { it.toInt() }

    fun isNewer(remote: String, local: String): Boolean {
        val r = parse(remote) ?: return false
        val l = parse(local) ?: return true
        for (i in 0..2) if (r[i] != l[i]) return r[i] > l[i]
        return false
    }

    /** Picks the newest app release (vX.Y.Z, not draft/prerelease, with .apk asset) from the releases JSON. */
    fun pickLatest(json: String): ReleaseInfo? {
        val arr = JSONArray(json)
        var best: ReleaseInfo? = null
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            if (o.optBoolean("draft") || o.optBoolean("prerelease")) continue
            val tag = o.optString("tag_name")
            if (parse(tag) == null) continue
            val assets = o.optJSONArray("assets") ?: continue
            var url: String? = null; var size = 0L
            for (j in 0 until assets.length()) {
                val a = assets.getJSONObject(j)
                if (a.optString("name").endsWith(".apk")) { url = a.optString("browser_download_url"); size = a.optLong("size"); break }
            }
            if (url == null) continue
            val ri = ReleaseInfo(tag.removePrefix("v"), o.optString("body"), url, size, o.optString("html_url"))
            if (best == null || isNewer(ri.version, best.version)) best = ri
        }
        return best
    }

    fun check(ctx: Context, manual: Boolean) {
        val prefs = ctx.getSharedPreferences("updater", Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        if (!manual && now - prefs.getLong("last", 0) < THROTTLE_MS) return
        if (job?.isActive == true) return
        job = scope.launch {
            _state.value = UpdateState.Checking
            try {
                val req = Request.Builder().url("https://api.github.com/repos/$REPO/releases?per_page=30")
                    .header("Accept", "application/vnd.github+json").build()
                val body = http.newCall(req).execute().use { r ->
                    if (!r.isSuccessful) throw RuntimeException("HTTP ${r.code}")
                    r.body?.string() ?: ""
                }
                prefs.edit().putLong("last", now).apply()
                val rel = pickLatest(body)
                val skipped = prefs.getString("skip", null)
                _state.value = when {
                    rel == null || !isNewer(rel.version, BuildConfig.VERSION_NAME) -> if (manual) UpdateState.UpToDate(true) else UpdateState.Idle
                    !manual && skipped == rel.version -> UpdateState.Idle
                    else -> UpdateState.Available(rel)
                }
            } catch (t: Throwable) {
                _state.value = if (manual) UpdateState.Failed("检查更新失败：${t.message ?: t.javaClass.simpleName}", null) else UpdateState.Idle
            }
        }
    }

    fun skip(ctx: Context, rel: ReleaseInfo) {
        ctx.getSharedPreferences("updater", Context.MODE_PRIVATE).edit().putString("skip", rel.version).apply()
        dismiss()
    }

    fun dismiss() { if (_state.value !is UpdateState.Downloading) _state.value = UpdateState.Idle }

    fun cancel() { job?.cancel(); _state.value = UpdateState.Idle }

    fun download(ctx: Context, rel: ReleaseInfo) {
        val app = ctx.applicationContext
        job?.cancel()
        job = scope.launch {
            val dir = File(app.cacheDir, "updates").apply { mkdirs() }
            dir.listFiles()?.forEach { it.delete() }
            val out = File(dir, "DSH-Remote-${rel.version}.apk")
            var lastErr = ""
            for ((prefix, label) in MIRRORS) {
                if (!isActive) return@launch
                try {
                    _state.value = UpdateState.Downloading(rel, 0f, label)
                    val req = Request.Builder().url(prefix + rel.apkUrl).build()
                    http.newCall(req).execute().use { r ->
                        if (!r.isSuccessful) throw RuntimeException("HTTP ${r.code}")
                        val b = r.body ?: throw RuntimeException("空响应")
                        val total = b.contentLength().takeIf { it > 0 } ?: rel.size
                        var done = 0L; var lastEmit = 0L
                        b.byteStream().use { inp -> out.outputStream().use { os ->
                            val buf = ByteArray(64 * 1024)
                            while (true) {
                                if (!isActive) return@launch
                                val n = inp.read(buf); if (n < 0) break
                                os.write(buf, 0, n); done += n
                                val t = System.currentTimeMillis()
                                if (t - lastEmit > 150) { lastEmit = t; _state.value = UpdateState.Downloading(rel, if (total > 0) done.toFloat() / total else -1f, label) }
                            }
                        } }
                        if (rel.size > 0 && done != rel.size) throw RuntimeException("文件不完整")
                    }
                    // Sanity check: must be a zip (APK)
                    val magic = out.inputStream().use { val m = ByteArray(2); it.read(m); m }
                    if (magic[0] != 'P'.code.toByte() || magic[1] != 'K'.code.toByte()) throw RuntimeException("下载内容不是 APK")
                    _state.value = UpdateState.Ready(rel, out)
                    install(app, rel, out)
                    return@launch
                } catch (t: Throwable) {
                    if (!isActive) return@launch
                    lastErr = "$label: ${t.message ?: t.javaClass.simpleName}"
                    out.delete()
                }
            }
            _state.value = UpdateState.Failed("下载失败（$lastErr）", rel)
        }
    }

    fun canInstall(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O || ctx.packageManager.canRequestPackageInstalls()

    fun install(ctx: Context, rel: ReleaseInfo, file: File) {
        if (!canInstall(ctx)) { _state.value = UpdateState.NeedPermission(rel, file); return }
        try {
            val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.updates", file)
            val i = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(i)
            _state.value = UpdateState.Ready(rel, file)
        } catch (t: Throwable) {
            _state.value = UpdateState.Failed("无法打开安装器：${t.message}", rel)
        }
    }

    fun openPermissionSettings(ctx: Context) {
        val i = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${ctx.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { ctx.startActivity(i) } catch (_: Throwable) {
            runCatching { ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }
    }

    /** Called on resume: if we were waiting for the "install unknown apps" grant, continue. */
    fun onResume(ctx: Context) {
        val s = _state.value
        if (s is UpdateState.NeedPermission && canInstall(ctx)) install(ctx, s.rel, s.file)
    }
}
