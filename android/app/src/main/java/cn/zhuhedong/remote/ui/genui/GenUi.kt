package cn.zhuhedong.remote.ui.genui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.zhuhedong.remote.ui.home.inlineMd
import cn.zhuhedong.remote.ui.theme.Dsh
import org.json.JSONArray
import org.json.JSONObject

/**
 * Native renderer for DSH Desktop GenUI (`dsh-ui` fences / `render_ui` cards).
 * Schema: @changfenhuang/dsh-genui SKILL.md. Every accessor is defensive — bad specs fall back to
 * collapsed source, unknown node types to a "view on desktop" stub; nothing here may throw.
 */

/** (actionName, payload) -> sends `[genui-action] …` back to the session. Null = read-only. */
val LocalGenUiAction = staticCompositionLocalOf<((String, JSONObject) -> Unit)?> { null }

fun genUiActionMessage(action: String, payload: JSONObject): String {
    val data = if (payload.length() == 0) "" else " 组件数据: $payload"
    return "[genui-action] $action。用户刚刚在界面中触发了动作 \"$action\"，请根据组件数据执行相应操作，并用 dsh-ui 输出更新后的界面。$data"
}

/** Strict parse, then the same punctuation-level repairs the desktop does (trailing commas / junk after the last brace). */
fun parseGenUiSpec(src: String): JSONObject? {
    val t = src.trim()
    fun tryParse(s: String): JSONObject? = runCatching {
        val v = org.json.JSONTokener(s).nextValue()
        when (v) {
            is JSONObject -> v
            is JSONArray -> JSONObject().put("items", v)
            else -> null
        }
    }.getOrNull()
    tryParse(t)?.let { return it }
    val cut = t.substring(0, (t.lastIndexOf('}') + 1).coerceAtLeast(0))
    val noTrail = cut.replace(Regex(",\\s*([}\\]])"), "$1")
    return tryParse(noTrail)
}

private fun JSONObject.s(k: String): String? = optString(k, "").takeIf { has(k) && !isNull(k) && it.isNotEmpty() }
private fun JSONObject.arr(k: String): JSONArray = optJSONArray(k) ?: JSONArray()
private fun JSONArray.objs(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
private fun JSONArray.strs(): List<String> = (0 until length()).map { i ->
    when (val v = opt(i)) {
        null, JSONObject.NULL -> ""
        is JSONObject -> v.s("label") ?: v.s("title") ?: v.s("name") ?: v.toString()
        else -> v.toString()
    }
}
private fun anyText(v: Any?): String = when (v) {
    null, JSONObject.NULL -> ""
    is JSONObject -> v.s("label") ?: v.s("title") ?: v.s("text") ?: v.s("value") ?: v.toString()
    else -> v.toString()
}
private fun parseColor(s: String?): Color? = runCatching {
    if (s == null || !s.startsWith("#")) return null
    val h = s.drop(1)
    val full = when (h.length) { 3 -> h.map { "$it$it" }.joinToString(""); 6 -> h; 8 -> h.substring(6) + h.substring(0, 6); else -> return null }
    Color(("FF" + full).takeLast(8).toLong(16))
}.getOrNull()

private class GenState(val key: String) {
    val fields: SnapshotStateMap<String, String> = mutableStateMapOf()
    val groups: SnapshotStateMap<String, String> = mutableStateMapOf() // radio group -> option / checkbox group -> \n-joined
    val graded = mutableStateOf(false)
}

private const val MAX_NODES = 300

@Composable
fun GenUiBlock(json: String, closed: Boolean = true) {
    val c = Dsh.c
    if (!closed) {
        Surface(shape = RoundedCornerShape(12.dp), color = c.card, modifier = Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(12.dp))) {
            Text("正在生成界面…", color = c.muted, fontSize = 14.sp, modifier = Modifier.padding(14.dp))
        }
        return
    }
    val spec = remember(json) { parseGenUiSpec(json) }
    if (spec == null) {
        SourceFallback("界面数据解析失败，显示源码", json)
        return
    }
    val state = remember(json) { GenState(json.hashCode().toString()) }
    val budget = remember(json) { intArrayOf(0) }
    budget[0] = 0
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy((spec.optInt("gap", 12)).coerceIn(4, 24).dp)) {
        spec.s("title")?.let { Text(inlineMd(it, c.code, c.accent), color = c.ink, fontSize = 18.sp, fontWeight = FontWeight.SemiBold) }
        if (spec.has("type") && !spec.has("items")) Node(spec, state, budget, 0)
        else spec.arr("items").objs().forEach { Node(it, state, budget, 0) }
    }
}

@Composable
private fun SourceFallback(label: String, src: String) {
    val c = Dsh.c
    var open by remember { mutableStateOf(false) }
    Surface(shape = RoundedCornerShape(10.dp), color = c.code, modifier = Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(10.dp))) {
        Column {
            Text((if (open) "▾ " else "▸ ") + label, color = c.muted, fontSize = 13.sp,
                modifier = Modifier.fillMaxWidth().clickable { open = !open }.padding(horizontal = 12.dp, vertical = 10.dp))
            if (open) {
                Text(src, fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = c.ink, softWrap = false,
                    modifier = Modifier.heightIn(max = 280.dp).horizontalScroll(rememberScrollState()).verticalScroll(rememberScrollState())
                        .padding(start = 12.dp, end = 12.dp, bottom = 10.dp))
            }
        }
    }
}

@Composable
private fun RichText(s: String, size: Int = 15, color: Color? = null, weight: FontWeight? = null, align: TextAlign? = null, modifier: Modifier = Modifier) {
    val c = Dsh.c
    Text(inlineMd(s, c.code, c.accent), color = color ?: c.ink, fontSize = size.sp, lineHeight = (size * 1.55f).sp,
        fontWeight = weight, textAlign = align, modifier = modifier)
}

private fun toneColors(tone: String?, c: cn.zhuhedong.remote.ui.theme.DshPalette): Pair<Color, Color> = when (tone) {
    "success" -> c.online to c.online.copy(alpha = 0.10f)
    "warning", "warn" -> c.warn to c.warnBg
    "danger", "error" -> c.danger to c.dangerBg
    "info", "accent", "primary" -> c.accent to c.accentBg
    else -> c.muted to c.code
}

@Composable
private fun Node(n: JSONObject, st: GenState, budget: IntArray, depth: Int, modifier: Modifier = Modifier) {
    if (depth > 10 || budget[0]++ > MAX_NODES) return
    val c = Dsh.c
    val act = LocalGenUiAction.current
    fun fire(name: String?, payload: JSONObject) { if (name != null) act?.invoke(name, payload) }
    val children = { key: String -> n.arr(key).objs() }
    when (n.optString("type")) {
        "text" -> {
            val size = when (n.optString("size")) { "display" -> 24; "h1" -> 21; "h2" -> 19; "h3" -> 17; "muted", "caption" -> 13; else -> 15 }
            val muted = n.optString("size") in setOf("muted", "caption")
            val bold = n.optString("size") in setOf("display", "h1", "h2", "h3")
            val align = when (n.optString("align", if (n.optBoolean("center")) "center" else "")) { "center" -> TextAlign.Center; "right" -> TextAlign.End; else -> null }
            RichText(n.optString("content", n.optString("text")), size, if (muted) c.muted else null, if (bold) FontWeight.SemiBold else null, align, modifier.fillMaxWidth())
        }
        "row" -> Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            // phones are narrow: rows become wrapping flows of children; only small leaf items share a line
            val items = children("items")
            val compact = items.all { it.optString("type") in setOf("badge", "button", "submit", "copy", "link", "avatar", "stat") }
            if (compact) {
                @OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
                androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items.forEach { Node(it, st, budget, depth + 1) }
                }
            } else items.forEach { Node(it, st, budget, depth + 1) }
        }
        "col" -> Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(n.optInt("gap", 8).coerceIn(2, 24).dp)) {
            children("items").forEach { Node(it, st, budget, depth + 1) }
        }
        "grid" -> {
            val items = children("items")
            val cols = n.optInt("cols", 2).coerceIn(1, 4).let { if (items.all { it.optString("type") == "stat" }) it.coerceAtMost(2) else it.coerceAtMost(1) }
            Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items.chunked(cols).forEach { rowItems ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        rowItems.forEach { Box(Modifier.weight(1f)) { Node(it, st, budget, depth + 1) } }
                        repeat(cols - rowItems.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        "card" -> {
            val accent = parseColor(n.s("accent"))
            val (fg, bg) = toneColors(n.s("tone"), c)
            val bgc = when { accent != null -> accent.copy(alpha = 0.08f); n.s("tone") != null -> bg; else -> c.card }
            val bc = accent ?: if (n.s("tone") != null) fg.copy(alpha = 0.35f) else c.border
            Surface(shape = RoundedCornerShape(14.dp), color = bgc, modifier = modifier.fillMaxWidth().border(1.dp, bc, RoundedCornerShape(14.dp))) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    n.s("eyebrow")?.let { Text(it, color = c.muted, fontSize = 12.sp) }
                    n.s("title")?.let { RichText(it, 16, accent ?: c.ink, FontWeight.SemiBold) }
                    children("items").forEach { Node(it, st, budget, depth + 1) }
                }
            }
        }
        "divider" -> {
            val label = n.s("label")
            if (label == null) HorizontalDivider(color = c.border, modifier = modifier.padding(vertical = 4.dp))
            else Row(modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                HorizontalDivider(Modifier.weight(1f), color = c.border)
                Text(label, color = c.muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 8.dp))
                HorizontalDivider(Modifier.weight(1f), color = c.border)
            }
        }
        "spacer" -> Spacer(modifier.height(8.dp))
        "hero" -> {
            val (fg, bg) = toneColors(n.s("tone") ?: "accent", c)
            Surface(shape = RoundedCornerShape(16.dp), color = bg, modifier = modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    n.s("label")?.let { Text(it, color = c.muted, fontSize = 12.sp) }
                    Row(verticalAlignment = Alignment.Bottom) {
                        n.s("value")?.let { Text(it, color = fg, fontSize = 36.sp, fontWeight = FontWeight.Bold) }
                        n.s("delta")?.let { Text("  $it", color = deltaColor(it, c), fontSize = 14.sp, modifier = Modifier.padding(bottom = 6.dp)) }
                    }
                    n.s("title")?.let { RichText(it, 17, weight = FontWeight.SemiBold) }
                    n.s("subtitle")?.let { RichText(it, 14, c.muted) }
                    Spark(n.arr("spark"), fg)
                }
            }
        }
        "stat" -> Surface(shape = RoundedCornerShape(12.dp), color = c.card, modifier = modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(12.dp))) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(n.optString("label"), color = c.muted, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(anyText(n.opt("value")), color = c.ink, fontSize = if (n.optString("size") == "hero") 30.sp else 22.sp, fontWeight = FontWeight.SemiBold)
                n.s("delta")?.let { Text(it, color = deltaColor(it, c), fontSize = 12.sp) }
                Spark(n.arr("spark"), c.accent)
            }
        }
        "badge" -> Badge((n.s("icon")?.plus(" ") ?: "") + n.optString("label", n.optString("text")), n.s("tone"), modifier)
        "progress" -> {
            val v = n.optDouble("value", 0.0).toFloat().coerceIn(0f, 100f)
            Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(Modifier.fillMaxWidth()) {
                    Text(n.optString("label"), color = c.ink, fontSize = 13.sp, modifier = Modifier.weight(1f))
                    Text(n.s("valueLabel") ?: "${v.toInt()}%", color = c.muted, fontSize = 13.sp)
                }
                LinearProgressIndicator(progress = { v / 100f }, modifier = Modifier.fillMaxWidth().height(6.dp), color = c.accent, trackColor = c.code)
            }
        }
        "avatar" -> Row(modifier, verticalAlignment = Alignment.CenterVertically) {
            val name = n.optString("name", "?")
            Box(Modifier.size(28.dp).background(parseColor(n.s("color")) ?: c.accent, CircleShape), contentAlignment = Alignment.Center) {
                Text(name.take(1), color = Color.White, fontSize = 13.sp)
            }
            Spacer(Modifier.width(6.dp)); Text(name, color = c.ink, fontSize = 14.sp)
        }
        "image", "audio", "video" -> {
            val uri = LocalUriHandler.current
            val src = n.optString("src")
            val label = when (n.optString("type")) { "image" -> "🖼"; "audio" -> "🔊"; else -> "🎬" } + " " + (n.s("alt") ?: n.s("caption") ?: src)
            Text(label, color = c.accent, fontSize = 14.sp, modifier = modifier.clickable(enabled = src.startsWith("http")) { runCatching { uri.openUri(src) } })
        }
        "list" -> Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            val items = n.arr("items")
            for (i in 0 until items.length()) {
                val it = items.opt(i)
                Row(Modifier.fillMaxWidth()) {
                    Text("•", color = c.muted, fontSize = 15.sp, modifier = Modifier.width(16.dp))
                    Column(Modifier.weight(1f)) {
                        if (it is JSONObject && it.has("type")) Node(it, st, budget, depth + 1)
                        else if (it is JSONObject) {
                            val title = it.s("title") ?: it.s("label") ?: it.s("name")
                            val desc = it.s("desc") ?: it.s("description") ?: it.s("content") ?: it.s("text") ?: it.s("body") ?: it.s("detail")
                            if (title != null) RichText(title, 15, weight = FontWeight.Medium)
                            if (desc != null) RichText(desc, 14, if (title != null) c.muted else null)
                        } else RichText(anyText(it), 15)
                    }
                }
            }
        }
        "keyvalue" -> Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            n.arr("pairs").objs().forEach { p ->
                Row(Modifier.fillMaxWidth()) {
                    Text(p.optString("key"), color = c.muted, fontSize = 14.sp, modifier = Modifier.weight(0.38f))
                    RichText(anyText(p.opt("value")), 14, modifier = Modifier.weight(0.62f))
                }
            }
        }
        "table" -> GenTable(n, st, budget, depth)
        "timeline", "steps" -> {
            val isSteps = n.optString("type") == "steps"
            val items = if (isSteps) n.arr("steps").objs().ifEmpty { n.arr("items").objs() } else n.arr("items").objs()
            val cur = n.optInt("current", -1)
            Column(modifier.fillMaxWidth()) {
                items.forEachIndexed { i, s ->
                    Row(Modifier.fillMaxWidth()) {
                        val done = isSteps && cur >= 0 && i < cur
                        val active = isSteps && i == cur
                        Box(Modifier.padding(top = 4.dp).size(18.dp).background(if (done || active) c.accent else c.code, CircleShape), contentAlignment = Alignment.Center) {
                            Text(if (done) "✓" else if (isSteps) "${i + 1}" else "", color = if (done || active) Color.White else c.muted, fontSize = 10.sp)
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f).padding(bottom = 10.dp)) {
                            Row {
                                RichText(s.optString("title"), 15, weight = FontWeight.Medium, modifier = Modifier.weight(1f))
                                s.s("time")?.let { Text(it, color = c.muted, fontSize = 12.sp) }
                            }
                            s.s("desc")?.let { RichText(it, 13, c.muted) }
                        }
                    }
                }
            }
        }
        "file-tree" -> Column(modifier.fillMaxWidth()) { FileTree(n.arr("items"), 0) }
        "breadcrumb" -> Text(n.arr("items").strs().joinToString("  ›  "), color = c.muted, fontSize = 13.sp, modifier = modifier)
        "diff" -> Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            n.arr("diffs").objs().forEach { d ->
                val sb = StringBuilder()
                d.s("oldText")?.lines()?.forEach { sb.append("- ").append(it).append('\n') }
                d.s("newText")?.lines()?.forEach { sb.append("+ ").append(it).append('\n') }
                CodeBox(d.optString("path", "diff"), sb.toString().trimEnd(), diff = true)
            }
        }
        "json" -> CodeBox("json", runCatching { when (val v = n.opt("value")) { is JSONObject -> v.toString(2); is JSONArray -> v.toString(2); else -> v.toString() } }.getOrDefault(""))
        "code" -> CodeBox(n.optString("lang", "code"), n.optString("code"))
        "callout" -> {
            val (fg, bg) = toneColors(n.s("tone") ?: "info", c)
            Row(modifier.fillMaxWidth().background(bg, RoundedCornerShape(10.dp)).padding(12.dp)) {
                Box(Modifier.width(3.dp).height(18.dp).background(fg, RoundedCornerShape(2.dp)))
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    n.s("title")?.let { RichText(it, 15, fg, FontWeight.SemiBold) }
                    (n.s("content") ?: n.s("text") ?: n.s("body"))?.let { RichText(it, 14) }
                }
            }
        }
        "chart" -> MiniChart(n, modifier)
        "button", "submit" -> {
            val isSubmit = n.optString("type") == "submit"
            val action = n.s("action")
            val enabled = act != null && (action != null || isSubmit) && !st.graded.value
            val (fg, _) = toneColors(when (n.optString("tone")) { "danger" -> "danger"; "success" -> "success"; else -> "info" }, c)
            val primary = n.optString("tone", if (isSubmit) "primary" else "") == "primary"
            var fired by remember { mutableStateOf(false) }
            Surface(
                onClick = {
                    if (isSubmit) {
                        val graded = gradeLocally(n, st)
                        if (!graded) fire(action ?: "submit", submitPayload(n, st))
                    } else fire(action, JSONObject().put("label", n.optString("label")))
                    fired = true
                },
                enabled = enabled,
                shape = RoundedCornerShape(10.dp),
                color = if (primary) fg else Color.Transparent,
                modifier = (if (n.optBoolean("full")) modifier.fillMaxWidth() else modifier).border(1.dp, if (primary) fg else c.border, RoundedCornerShape(10.dp)),
            ) {
                Text((n.s("icon")?.plus(" ") ?: "") + n.optString("label", "确定") + if (fired && !isSubmit) "  ✓" else "",
                    color = if (primary) Color.White else if (enabled) c.ink else c.muted, fontSize = 14.sp, textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = if (n.optBoolean("small")) 6.dp else 9.dp))
            }
        }
        "link" -> {
            val uri = LocalUriHandler.current
            val href = n.optString("href")
            val ok = href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")
            Text(n.optString("label", href), color = if (ok) c.accent else c.ink, fontSize = 14.sp, modifier = modifier.clickable(enabled = ok) { runCatching { uri.openUri(href) } })
        }
        "copy" -> {
            val cb = LocalClipboardManager.current
            var done by remember { mutableStateOf(false) }
            Surface(onClick = { cb.setText(AnnotatedString(n.optString("text"))); done = true }, shape = RoundedCornerShape(10.dp), color = c.code, modifier = modifier) {
                Text((if (done) "已复制 ✓  " else "📋 ") + n.optString("label", "复制"), color = c.ink, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
            }
        }
        "input", "textarea" -> {
            val id = n.s("id") ?: ("_" + n.optString("label"))
            val init = n.optString("value")
            val v = st.fields[id] ?: init
            val multi = n.optString("type") == "textarea"
            var last by remember { mutableStateOf(init) }
            Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                n.s("label")?.let { Text(it, color = c.muted, fontSize = 13.sp) }
                BasicTextField(
                    value = v, onValueChange = { st.fields[id] = it }, singleLine = !multi, minLines = if (multi) n.optInt("rows", 3).coerceIn(2, 8) else 1,
                    textStyle = androidx.compose.ui.text.TextStyle(color = c.ink, fontSize = 14.sp),
                    keyboardOptions = KeyboardOptions(imeAction = if (multi) ImeAction.Default else ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = {
                        if (n.s("action") != null && v != last) { last = v; fire(n.s("action"), JSONObject().put("id", id).put("value", v).put("submit", true)) }
                    }),
                    modifier = Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp, vertical = 10.dp),
                    decorationBox = { inner -> Box { if (v.isEmpty()) Text(n.optString("placeholder"), color = c.muted, fontSize = 14.sp); inner() } },
                )
                if (multi && n.s("action") != null && act != null) {
                    Text("发送", color = c.accent, fontSize = 13.sp, modifier = Modifier.align(Alignment.End).clickable {
                        last = v; fire(n.s("action"), JSONObject().put("id", id).put("value", v).put("submit", true))
                    })
                }
            }
        }
        "select" -> {
            val opts = n.arr("options").strs()
            val id = n.s("id") ?: ("_" + n.optString("label"))
            val pre = n.optInt("selected", -1).takeIf { it in opts.indices }?.let { opts[it] }
            val cur = st.fields[id] ?: pre
            var open by remember { mutableStateOf(false) }
            Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                n.s("label")?.let { Text(it, color = c.muted, fontSize = 13.sp) }
                Box {
                    Text((cur ?: "请选择…") + "  ▾", color = if (cur == null) c.muted else c.ink, fontSize = 14.sp,
                        modifier = Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(10.dp)).clickable { open = true }.padding(horizontal = 12.dp, vertical = 10.dp))
                    DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                        opts.forEachIndexed { i, o ->
                            DropdownMenuItem(text = { Text(o) }, onClick = {
                                open = false; st.fields[id] = o
                                fire(n.s("action"), JSONObject().put("id", id).put("value", o).put("index", i))
                            })
                        }
                    }
                }
            }
        }
        "radio" -> {
            val opts = n.arr("options").strs()
            val group = n.s("group")
            val key = group ?: ("_r" + n.optString("label"))
            val pre = n.optInt("selected", -1).takeIf { it in opts.indices }?.let { opts[it] }
            val cur = st.groups[key] ?: pre
            val answer = n.opt("answer").let { a -> when (a) { is Number -> opts.getOrNull(a.toInt()); is String -> a; else -> null } }
            val graded = st.graded.value || (group == null && answer != null && cur != null)
            Column(modifier.fillMaxWidth()) {
                n.s("label")?.let { RichText(it, 15, weight = FontWeight.Medium) }
                opts.forEachIndexed { i, o ->
                    val mark = if (graded && answer != null) when { o == answer -> " ✓"; o == cur -> " ✗"; else -> "" } else ""
                    Row(Modifier.fillMaxWidth().clickable(enabled = !graded) {
                        st.groups[key] = o
                        if (group == null && answer == null) fire(n.s("action"), JSONObject().put("value", o).put("index", i))
                    }, verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = cur == o, onClick = null, enabled = !graded, colors = RadioButtonDefaults.colors(selectedColor = c.accent))
                        Text(o + mark, color = if (mark == " ✓") c.online else if (mark == " ✗") c.danger else c.ink, fontSize = 14.sp)
                    }
                }
                if (graded && answer != null) n.s("explanation")?.let { RichText(it, 13, c.muted) }
            }
        }
        "checkbox", "switch" -> {
            val label = n.optString("label")
            val group = n.s("group")
            val key = group?.let { "$it\u0000$label" } ?: ("_c$label")
            val on = st.fields[key]?.let { it == "1" } ?: n.optBoolean("checked")
            val toggle = { v: Boolean ->
                st.fields[key] = if (v) "1" else "0"
                if (group == null) fire(n.s("action"), JSONObject().put("label", label).put("checked", v))
            }
            Row(modifier.fillMaxWidth().clickable { toggle(!on) }, verticalAlignment = Alignment.CenterVertically) {
                if (n.optString("type") == "switch") {
                    Text(label, color = c.ink, fontSize = 14.sp, modifier = Modifier.weight(1f))
                    Switch(checked = on, onCheckedChange = { toggle(it) })
                } else {
                    Checkbox(checked = on, onCheckedChange = { toggle(it) }, colors = CheckboxDefaults.colors(checkedColor = c.accent))
                    RichText(label, 14)
                }
            }
        }
        "slider" -> {
            val id = n.s("id") ?: ("_s" + n.optString("label"))
            val min = n.optDouble("min", 0.0).toFloat(); val max = n.optDouble("max", 100.0).toFloat().let { if (it > min) it else min + 1 }
            val v = st.fields[id]?.toFloatOrNull() ?: n.optDouble("value", min.toDouble()).toFloat()
            Column(modifier.fillMaxWidth()) {
                Row { Text(n.optString("label"), color = c.ink, fontSize = 13.sp, modifier = Modifier.weight(1f)); Text(fmtNum(v), color = c.muted, fontSize = 13.sp) }
                Slider(value = v.coerceIn(min, max), valueRange = min..max, onValueChange = { st.fields[id] = it.toString() },
                    onValueChangeFinished = { fire(n.s("action"), JSONObject().put("id", id).put("value", st.fields[id]?.toDoubleOrNull() ?: 0.0)) })
            }
        }
        "tabs" -> {
            val tabs = n.arr("tabs").objs().take(12)
            var sel by remember { mutableIntStateOf(0) }
            Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    tabs.forEachIndexed { i, t ->
                        Surface(onClick = { sel = i }, shape = RoundedCornerShape(16.dp), color = if (i == sel) c.selected else Color.Transparent,
                            modifier = Modifier.border(1.dp, if (i == sel) c.ink.copy(alpha = 0.3f) else c.border, RoundedCornerShape(16.dp))) {
                            Text(t.optString("label", "${i + 1}"), color = c.ink, fontSize = 13.sp, fontWeight = if (i == sel) FontWeight.SemiBold else null,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp))
                        }
                    }
                }
                tabs.getOrNull(sel)?.arr("items")?.objs()?.forEach { Node(it, st, budget, depth + 1) }
            }
        }
        "accordion" -> Column(modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(12.dp))) {
            n.arr("items").objs().take(24).forEachIndexed { i, sec ->
                var open by remember { mutableStateOf(false) }
                if (i > 0) HorizontalDivider(color = c.border)
                Text((if (open) "▾ " else "▸ ") + sec.optString("title"), color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.Medium,
                    modifier = Modifier.fillMaxWidth().clickable { open = !open }.padding(12.dp))
                if (open) Column(Modifier.padding(start = 12.dp, end = 12.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    sec.arr("items").objs().forEach { Node(it, st, budget, depth + 1) }
                    (sec.s("content") ?: sec.s("desc"))?.let { RichText(it, 14) }
                }
            }
        }
        "quiz" -> {
            val opts = n.arr("options").objs()
            var picked by remember { mutableIntStateOf(-1) }
            Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                RichText(n.optString("question"), 15, weight = FontWeight.Medium)
                opts.forEachIndexed { i, o ->
                    val ok = o.optBoolean("correct")
                    val shown = picked >= 0
                    val col = when { shown && ok -> c.online; shown && i == picked -> c.danger; else -> c.border }
                    Text(o.optString("label") + if (shown && ok) " ✓" else if (shown && i == picked) " ✗" else "", color = c.ink, fontSize = 14.sp,
                        modifier = Modifier.fillMaxWidth().border(1.dp, col, RoundedCornerShape(10.dp)).clickable {
                            picked = i
                            fire(n.s("action"), JSONObject().put("type", "quiz").put("question", n.optString("question")).put("answer", o.optString("label")).put("correct", ok))
                        }.padding(10.dp))
                }
                if (picked >= 0) {
                    opts.getOrNull(picked)?.s("feedback")?.let { RichText(it, 13, c.muted) }
                    n.s("explanation")?.let { RichText(it, 13, c.muted) }
                    Text("重试", color = c.accent, fontSize = 13.sp, modifier = Modifier.clickable { picked = -1 })
                }
            }
        }
        else -> {
            // echart / plot / mermaid / diagram / svg / scene3d …: no native engine on the phone.
            val t = n.optString("type", "?")
            Column(modifier.fillMaxWidth()) {
                n.s("title")?.let { RichText(it, 14, weight = FontWeight.Medium) }
                SourceFallback("「$t」组件请在电脑上查看 · 点开看源码", runCatching { n.toString(2) }.getOrDefault(""))
            }
        }
    }
}

private fun fmtNum(v: Float): String = if (v == v.toLong().toFloat()) v.toLong().toString() else "%.2f".format(v)

private fun deltaColor(d: String, c: cn.zhuhedong.remote.ui.theme.DshPalette): Color = when {
    d.trim().startsWith("-") || d.trim().startsWith("−") -> c.danger
    d.trim().startsWith("+") -> c.online
    else -> c.muted
}

@Composable
private fun Badge(text: String, tone: String?, modifier: Modifier = Modifier) {
    val c = Dsh.c
    val (fg, bg) = toneColors(tone, c)
    Text(text, color = if (tone == null) c.ink else fg, fontSize = 12.sp, maxLines = 1,
        modifier = modifier.background(bg, RoundedCornerShape(50)).padding(horizontal = 8.dp, vertical = 3.dp))
}

@Composable
private fun Spark(a: JSONArray, color: Color) {
    val v = (0 until a.length()).mapNotNull { a.optDouble(it).takeIf { d -> !d.isNaN() }?.toFloat() }
    if (v.size < 2) return
    Canvas(Modifier.fillMaxWidth().height(24.dp).padding(top = 4.dp)) {
        val mn = v.min(); val mx = v.max(); val r = (mx - mn).takeIf { it > 0 } ?: 1f
        val p = Path()
        v.forEachIndexed { i, y ->
            val x = size.width * i / (v.size - 1); val yy = size.height * (1 - (y - mn) / r)
            if (i == 0) p.moveTo(x, yy) else p.lineTo(x, yy)
        }
        drawPath(p, color, style = Stroke(width = 2.dp.toPx()))
    }
}

@Composable
private fun CodeBox(lang: String, code: String, diff: Boolean = false) {
    val c = Dsh.c
    Surface(shape = RoundedCornerShape(10.dp), color = c.code, modifier = Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(10.dp))) {
        Column {
            Text(lang, color = c.muted, fontSize = 11.sp, modifier = Modifier.padding(start = 12.dp, top = 8.dp, end = 12.dp))
            val text = if (!diff) AnnotatedString(code) else androidx.compose.ui.text.buildAnnotatedString {
                code.lines().forEachIndexed { i, l ->
                    if (i > 0) append('\n')
                    val col = when { l.startsWith("+ ") -> c.online; l.startsWith("- ") -> c.danger; else -> c.ink }
                    pushStyle(androidx.compose.ui.text.SpanStyle(color = col)); append(l); pop()
                }
            }
            Text(text.ifEmpty { AnnotatedString(" ") }, fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = c.ink, softWrap = false,
                modifier = Modifier.heightIn(max = 280.dp).horizontalScroll(rememberScrollState()).verticalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 10.dp))
        }
    }
}

private fun AnnotatedString.ifEmpty(f: () -> AnnotatedString) = if (isEmpty()) f() else this

@Composable
private fun FileTree(items: JSONArray, level: Int) {
    val c = Dsh.c
    items.objs().forEach { f ->
        val dir = f.optString("type") == "dir" || f.has("children")
        var open by remember { mutableStateOf(level < 1) }
        Text((if (dir) (if (open) "▾ 📁 " else "▸ 📁 ") else "    📄 ") + f.optString("name"), color = c.ink, fontSize = 13.sp, fontFamily = FontFamily.Monospace,
            modifier = Modifier.fillMaxWidth().padding(start = (level * 14).dp, top = 2.dp, bottom = 2.dp).clickable(enabled = dir) { open = !open })
        if (dir && open && level < 8) FileTree(f.arr("children"), level + 1)
    }
}

private fun numOf(s: String): Double? {
    var t = s.trim().replace(",", "").replace("%", "").replace(Regex("^[+¥$€£]|^[-−]"), { if (it.value == "-" || it.value == "−") "-" else "" })
    var mul = 1.0
    when {
        t.endsWith("亿") -> { mul = 1e8; t = t.dropLast(1) }
        t.endsWith("万") -> { mul = 1e4; t = t.dropLast(1) }
        t.endsWith("k", true) -> { mul = 1e3; t = t.dropLast(1) }
        t.endsWith("m", true) -> { mul = 1e6; t = t.dropLast(1) }
        t.endsWith("b", true) -> { mul = 1e9; t = t.dropLast(1) }
    }
    return t.toDoubleOrNull()?.times(mul)
}

@Composable
private fun GenTable(n: JSONObject, st: GenState, budget: IntArray, depth: Int) {
    val c = Dsh.c
    var cols = n.arr("columns").strs()
    var rows = n.arr("rows").let { r -> (0 until r.length()).map { i -> (r.optJSONArray(i) ?: JSONArray()).strs() } }
    if (cols.isEmpty() && rows.isNotEmpty()) { cols = rows.first(); rows = rows.drop(1) }
    val types = n.arr("types").strs()
    val details = n.optJSONArray("details")
    val filterId = n.s("filter")
    val q = filterId?.let { st.fields[it] }?.trim().orEmpty()
    var sortCol by remember { mutableIntStateOf(-1) }
    var asc by remember { mutableStateOf(true) }
    val expanded = remember { mutableStateMapOf<Int, Boolean>() }
    var view = rows.withIndex().toList()
    if (q.isNotEmpty()) view = view.filter { (_, r) -> r.any { it.contains(q, ignoreCase = true) } }
    if (sortCol >= 0) {
        val cmp = Comparator<IndexedValue<List<String>>> { a, b ->
            val x = a.value.getOrNull(sortCol).orEmpty(); val y = b.value.getOrNull(sortCol).orEmpty()
            val nx = numOf(x); val ny = numOf(y)
            if (nx != null && ny != null) nx.compareTo(ny) else x.compareTo(y)
        }
        view = view.sortedWith(if (asc) cmp else cmp.reversed())
    }
    val colW = 120.dp
    Column(Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(10.dp)).horizontalScroll(rememberScrollState())) {
        Row(Modifier.background(c.code)) {
            cols.forEachIndexed { i, h ->
                Text(h + if (sortCol == i) (if (asc) " ↑" else " ↓") else "", color = c.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.widthIn(min = 72.dp, max = 220.dp).width(colW).clickable {
                        if (sortCol != i) { sortCol = i; asc = true } else if (asc) asc = false else sortCol = -1
                    }.padding(8.dp))
            }
        }
        view.forEach { (ri, r) ->
            HorizontalDivider(color = c.border, modifier = Modifier.width(colW * cols.size.coerceAtLeast(1)))
            val det = details?.optJSONArray(ri)
            Row(Modifier.clickable(enabled = det != null) { expanded[ri] = !(expanded[ri] ?: false) }) {
                cols.indices.forEach { ci ->
                    val v = r.getOrNull(ci).orEmpty()
                    val t = types.getOrNull(ci)
                    Box(Modifier.width(colW).padding(8.dp)) {
                        when (t) {
                            "badge" -> Badge(v, null)
                            "bar", "ring" -> {
                                val p = (numOf(v) ?: 0.0).toFloat().coerceIn(0f, 100f)
                                Column { Text(v, color = c.ink, fontSize = 12.sp); LinearProgressIndicator(progress = { p / 100f }, modifier = Modifier.fillMaxWidth().height(4.dp), color = c.accent, trackColor = c.code) }
                            }
                            else -> {
                                val signed = v.trim().startsWith("+") || (v.trim().startsWith("-") && numOf(v) != null)
                                val prefix = if (ci == 0 && det != null) (if (expanded[ri] == true) "▾ " else "▸ ") else ""
                                RichText(prefix + v, 13, if (signed || t == "delta") deltaColor(v, c) else null)
                            }
                        }
                    }
                }
            }
            if (det != null && expanded[ri] == true) Column(Modifier.width(colW * cols.size.coerceAtLeast(2)).padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                det.objs().forEach { Node(it, st, budget, depth + 1) }
            }
        }
        if (n.optBoolean("total") && rows.isNotEmpty()) {
            HorizontalDivider(color = c.border, modifier = Modifier.width(colW * cols.size.coerceAtLeast(1)))
            Row(Modifier.background(c.code)) {
                cols.indices.forEach { ci ->
                    val nums = rows.mapNotNull { numOf(it.getOrNull(ci).orEmpty()) }
                    val txt = if (ci == 0) "合计" else if (nums.size == rows.size) fmtNum(nums.sum().toFloat()) else ""
                    Text(txt, color = c.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(colW).padding(8.dp))
                }
            }
        }
    }
}

@Composable
private fun MiniChart(n: JSONObject, modifier: Modifier) {
    val c = Dsh.c
    val palette = listOf(c.accent, c.online, c.warn, c.danger, Color(0xFF8B5CF6), Color(0xFF06B6D4))
    val data = n.arr("data").objs()
    val series = n.arr("series").objs()
    val labels: List<String>; val sets: List<Pair<String, List<Float>>>
    if (series.isNotEmpty()) {
        val first = series.first().arr("data")
        labels = (0 until first.length()).map { i -> first.optJSONObject(i)?.optString("label") ?: "${i + 1}" }
        sets = series.map { s -> s.optString("label") to s.arr("data").let { d -> (0 until d.length()).map { i -> (d.optJSONObject(i)?.optDouble("value") ?: d.optDouble(i)).let { v -> if (v.isNaN()) 0f else v.toFloat() } } } }
    } else {
        labels = data.map { it.optString("label") }
        sets = listOf("" to data.map { it.optDouble("value", 0.0).toFloat() })
    }
    if (labels.isEmpty()) return
    val kind = n.optString("kind", "bars")
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        n.s("title")?.let { Text(it, color = c.ink, fontSize = 14.sp, fontWeight = FontWeight.Medium) }
        if (kind == "donut") {
            val vals = sets.first().second; val total = vals.sum().takeIf { it > 0 } ?: 1f
            Row(verticalAlignment = Alignment.CenterVertically) {
                Canvas(Modifier.size(110.dp)) {
                    var start = -90f
                    vals.forEachIndexed { i, v ->
                        val sw = 360f * v / total
                        drawArc(palette[i % palette.size], start, sw, false, style = Stroke(width = 22.dp.toPx()), topLeft = Offset(11.dp.toPx(), 11.dp.toPx()), size = Size(size.width - 22.dp.toPx(), size.height - 22.dp.toPx()))
                        start += sw
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column { labels.forEachIndexed { i, l -> Legend(palette[i % palette.size], "$l  ${fmtNum(vals.getOrElse(i) { 0f })} (${(100 * vals.getOrElse(i) { 0f } / total).toInt()}%)") } }
            }
        } else if (kind == "line") {
            val all = sets.flatMap { it.second }; val mn = minOf(0f, all.minOrNull() ?: 0f); val mx = (all.maxOrNull() ?: 1f).let { if (it > mn) it else mn + 1 }
            Canvas(Modifier.fillMaxWidth().height(140.dp)) {
                sets.forEachIndexed { si, (_, vs) ->
                    if (vs.size < 2) return@forEachIndexed
                    val p = Path()
                    vs.forEachIndexed { i, v -> val x = size.width * i / (vs.size - 1); val y = size.height * (1 - (v - mn) / (mx - mn)); if (i == 0) p.moveTo(x, y) else p.lineTo(x, y) }
                    drawPath(p, palette[si % palette.size], style = Stroke(width = 2.5.dp.toPx()))
                }
            }
            Text(labels.first() + " … " + labels.last(), color = c.muted, fontSize = 11.sp)
            if (sets.size > 1) sets.forEachIndexed { i, s -> Legend(palette[i % palette.size], s.first) }
        } else {
            // bars → always horizontal on phone (long labels fit)
            val mx = sets.flatMap { it.second }.maxOfOrNull { kotlin.math.abs(it) }?.takeIf { it > 0 } ?: 1f
            labels.forEachIndexed { li, l ->
                Column {
                    Text(l, color = c.ink, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    sets.forEachIndexed { si, (_, vs) ->
                        val v = vs.getOrElse(li) { 0f }
                        val col = parseColor(data.getOrNull(li)?.s("color")).takeIf { sets.size == 1 } ?: palette[si % palette.size]
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.weight(1f)) { Box(Modifier.fillMaxWidth((kotlin.math.abs(v) / mx).coerceIn(0.01f, 1f)).height(10.dp).background(if (v < 0) c.danger else col, RoundedCornerShape(3.dp))) }
                            Text(" " + fmtNum(v), color = c.muted, fontSize = 11.sp, modifier = Modifier.widthIn(min = 36.dp))
                        }
                    }
                }
            }
            if (sets.size > 1) sets.forEachIndexed { i, s -> Legend(palette[i % palette.size], s.first) }
        }
    }
}

@Composable
private fun Legend(color: Color, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).background(color, CircleShape)); Spacer(Modifier.width(6.dp))
        Text(text, color = Dsh.c.muted, fontSize = 12.sp)
    }
}

/** Pure-radio scope with answers: grade on the phone, no round-trip. Returns true when graded locally. */
private fun gradeLocally(submit: JSONObject, st: GenState): Boolean {
    // Answers aren't indexed here; the radios mark themselves once [graded] flips. Only grade locally
    // when there are radio groups and no free-form fields to send.
    val groups = submit.arr("groups").strs()
    val radioKeys = st.groups.keys
    val onlyRadios = groups.isNotEmpty() && groups.all { it in radioKeys } && st.fields.keys.none { !it.startsWith("_") && it in groups }
    if (!onlyRadios || submit.s("action") != null && submit.optString("action") != "grade") return false
    st.graded.value = true
    return true
}

private fun submitPayload(submit: JSONObject, st: GenState): JSONObject {
    val answers = JSONObject(); val fields = JSONObject()
    st.groups.forEach { (k, v) -> if (!k.startsWith("_r")) answers.put(k, v) }
    val checks = HashMap<String, JSONArray>()
    st.fields.forEach { (k, v) ->
        val sep = k.indexOf('\u0000')
        when {
            sep > 0 -> if (v == "1") checks.getOrPut(k.substring(0, sep)) { JSONArray() }.put(k.substring(sep + 1))
            !k.startsWith("_") -> fields.put(k, v)
        }
    }
    checks.forEach { (g, a) -> answers.put(g, a) }
    val groups = submit.arr("groups").strs()
    return JSONObject().put("answers", answers).put("fields", fields)
        .put("total", if (groups.isEmpty()) answers.length() + fields.length() else groups.size)
        .put("answered", answers.length() + fields.length())
}

@Suppress("unused")
@Composable
fun ProvideGenUiAction(onAction: ((String, JSONObject) -> Unit)?, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalGenUiAction provides onAction, content = content)
