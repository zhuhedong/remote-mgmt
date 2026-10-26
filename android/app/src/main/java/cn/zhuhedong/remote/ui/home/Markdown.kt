package cn.zhuhedong.remote.ui.home

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import cn.zhuhedong.remote.data.AskPayload
import cn.zhuhedong.remote.data.ChatMsg

/** Chat markdown blocks used by the Android bubble renderer. */
sealed class MdBlock {
    data class Heading(val level: Int, val text: String) : MdBlock()
    data class Bullet(val text: String, val marker: String, val indent: Int = 0) : MdBlock()
    data class Code(val code: String, val lang: String? = null) : MdBlock()
    data class Para(val text: String) : MdBlock()
    data class Quote(val text: String) : MdBlock()
    data class Table(val headers: List<String>, val rows: List<List<String>>) : MdBlock()
    data object Hr : MdBlock()
    /** ```dsh-ui fence (GenUI spec JSON). [closed]=false while still streaming. */
    data class GenUi(val json: String, val closed: Boolean) : MdBlock()
}

private val ORDERED = Regex("^(\\d+)[.)]\\s+(.*)$")
private val UNORDERED = Regex("^([-*+])\\s+(.*)$")
private val HR = Regex("^(-{3,}|\\*{3,}|_{3,})\\s*$")
private val FENCE = Regex("^```\\s*([^`]*?)\\s*$")
private val TABLE_ROW = Regex("^\\|(.+)\\|\\s*$")
private val TABLE_SEP = Regex("^\\|?\\s*:?-{3,}:?\\s*(\\|\\s*:?-{3,}:?\\s*)+\\|?\\s*$")

/**
 * True when the whole message is a single JSON object/array — show as a code block
 * instead of letting `-` / `#` inside strings look like markdown.
 */
fun looksLikeRawJson(src: String): Boolean {
    val t = src.trim()
    if (t.length < 2) return false
    val open = t.first()
    val close = t.last()
    if (!((open == '{' && close == '}') || (open == '[' && close == ']'))) return false
    // Cheap structure check: balanced braces/brackets and at least one `:` or `,` for objects/arrays.
    var depth = 0
    var inStr = false
    var esc = false
    for (ch in t) {
        if (inStr) {
            when {
                esc -> esc = false
                ch == '\\' -> esc = true
                ch == '"' -> inStr = false
            }
            continue
        }
        when (ch) {
            '"' -> inStr = true
            '{', '[' -> depth++
            '}', ']' -> {
                depth--
                if (depth < 0) return false
            }
        }
    }
    return depth == 0 && (t.contains(':') || t.contains(','))
}

fun parseMarkdown(src: String): List<MdBlock> {
    if (src.isBlank()) return emptyList()
    if (looksLikeRawJson(src)) return listOf(MdBlock.Code(src.trim(), "json"))

    val out = ArrayList<MdBlock>()
    val lines = src.replace("\r\n", "\n").replace('\r', '\n').split('\n')
    var i = 0
    val para = StringBuilder()

    fun flushPara() {
        if (para.isNotBlank()) out.add(MdBlock.Para(para.toString().trimEnd()))
        para.clear()
    }

    fun indentOf(raw: String): Int {
        var n = 0
        for (ch in raw) {
            when (ch) {
                ' ' -> n++
                '\t' -> n += 2
                else -> break
            }
        }
        return n / 2
    }

    fun splitTableCells(line: String): List<String> {
        val body = line.trim().removePrefix("|").removeSuffix("|")
        return body.split('|').map { it.trim() }
    }

    while (i < lines.size) {
        val raw = lines[i]
        val t = raw.trimStart()
        val fence = FENCE.matchEntire(t)

        when {
            fence != null -> {
                flushPara()
                val info = fence.groupValues[1].trim().split(Regex("\\s+"))
                val lang = info.firstOrNull()?.ifBlank { null }
                val isUi = info.any { it == "dsh-ui" }
                val sb = StringBuilder()
                i++
                while (i < lines.size && !lines[i].trimStart().startsWith("```")) {
                    if (sb.isNotEmpty()) sb.append('\n')
                    sb.append(lines[i])
                    i++
                }
                // consume closing fence if present
                val closed = i < lines.size && lines[i].trimStart().startsWith("```")
                if (closed) i++
                if (isUi) out.add(MdBlock.GenUi(sb.toString(), closed))
                else out.add(MdBlock.Code(sb.toString(), lang))
                continue
            }

            HR.matches(t) && t.length >= 3 -> {
                flushPara()
                out.add(MdBlock.Hr)
            }

            t.startsWith("#") && t.takeWhile { it == '#' }.length in 1..6 -> {
                flushPara()
                val lv = t.takeWhile { it == '#' }.length
                val body = t.drop(lv).trim().trimEnd('#', ' ')
                if (body.isEmpty() && lv == t.length) out.add(MdBlock.Para(t))
                else out.add(MdBlock.Heading(lv, body.ifBlank { t }))
            }

            t.startsWith(">") -> {
                flushPara()
                val sb = StringBuilder()
                while (i < lines.size && lines[i].trimStart().startsWith(">")) {
                    val q = lines[i].trimStart().removePrefix(">").let { if (it.startsWith(" ")) it.drop(1) else it }
                    if (sb.isNotEmpty()) sb.append('\n')
                    sb.append(q)
                    i++
                }
                out.add(MdBlock.Quote(sb.toString().trimEnd()))
                continue
            }

            TABLE_ROW.matches(t) && i + 1 < lines.size && TABLE_SEP.matches(lines[i + 1].trim()) -> {
                flushPara()
                val headers = splitTableCells(t)
                i += 2
                val rows = ArrayList<List<String>>()
                while (i < lines.size && TABLE_ROW.matches(lines[i].trim())) {
                    rows.add(splitTableCells(lines[i].trim()))
                    i++
                }
                out.add(MdBlock.Table(headers, rows))
                continue
            }

            UNORDERED.matchEntire(t) != null -> {
                flushPara()
                val m = UNORDERED.matchEntire(t)!!
                out.add(MdBlock.Bullet(m.groupValues[2], "•", indentOf(raw)))
            }

            ORDERED.matchEntire(t) != null -> {
                flushPara()
                val m = ORDERED.matchEntire(t)!!
                out.add(MdBlock.Bullet(m.groupValues[2], m.groupValues[1] + ".", indentOf(raw)))
            }

            t.isEmpty() -> flushPara()

            else -> {
                if (para.isNotEmpty()) para.append('\n')
                para.append(raw.trimEnd())
            }
        }
        i++
    }
    flushPara()
    return out
}

/**
 * Insert ZWSP only inside long ASCII/token runs (URLs, paths, base64) so CJK still wraps
 * naturally and markdown markers are never split.
 */
fun softBreakAscii(text: String, every: Int = 40): String {
    if (text.length < every) return text
    val out = StringBuilder(text.length + text.length / every)
    var run = 0
    for (ch in text) {
        out.append(ch)
        val asciiToken = ch.code in 33..126 && ch != '`' && ch != '*' && ch != '_' && ch != '[' && ch != ']' && ch != '(' && ch != ')'
        if (!asciiToken) run = 0
        else {
            run++
            if (run >= every) {
                out.append('\u200B')
                run = 0
            }
        }
    }
    return out.toString()
}

/** Inline markdown: code spans, bold, italic, strike, and http(s) links. */
fun inlineMd(
    s: String,
    codeBg: Color = Color(0xFFF1F2F4),
    linkColor: Color = Color(0xFF2563EB),
): AnnotatedString = buildAnnotatedString {
    var i = 0
    fun appendPlain(chunk: String) {
        if (chunk.isEmpty()) return
        append(softBreakAscii(chunk))
    }

    while (i < s.length) {
        // inline code
        if (s[i] == '`') {
            val end = s.indexOf('`', i + 1)
            if (end > i + 1) {
                withStyle(SpanStyle(fontFamily = FontFamily.Monospace, background = codeBg)) {
                    append(s.substring(i + 1, end))
                }
                i = end + 1
                continue
            }
        }
        // link [text](url) — http(s)/mailto stay tappable; relative/file paths still
        // render as the label (never leave raw [label](path) in the bubble).
        if (s[i] == '[') {
            val close = s.indexOf(']', i + 1)
            if (close > i + 1 && close + 1 < s.length && s[close + 1] == '(') {
                val urlEnd = s.indexOf(')', close + 2)
                if (urlEnd > close + 2) {
                    val label = s.substring(i + 1, close)
                    val url = s.substring(close + 2, urlEnd).trim()
                    if (url.isNotEmpty()) {
                        val style = SpanStyle(color = linkColor, textDecoration = TextDecoration.Underline)
                        val web = url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:")
                        if (web) {
                            withLink(LinkAnnotation.Url(url)) {
                                withStyle(style) { append(label) }
                            }
                        } else {
                            // Relative / repo path: show label only, accent + underline (not clickable).
                            withStyle(style) { append(label) }
                        }
                        i = urlEnd + 1
                        continue
                    }
                }
            }
        }
        // bold ** or __
        if (s.startsWith("**", i) || s.startsWith("__", i)) {
            val mark = s.substring(i, i + 2)
            val end = s.indexOf(mark, i + 2)
            if (end > i + 2) {
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) {
                    append(s.substring(i + 2, end))
                }
                i = end + 2
                continue
            }
        }
        // highlight ==x== (dsh-ui inline rich text)
        if (s.startsWith("==", i)) {
            val end = s.indexOf("==", i + 2)
            if (end > i + 2) {
                withStyle(SpanStyle(background = Color(0x33F5B700))) { append(s.substring(i + 2, end)) }
                i = end + 2
                continue
            }
        }
        // strike ~~
        if (s.startsWith("~~", i)) {
            val end = s.indexOf("~~", i + 2)
            if (end > i + 2) {
                withStyle(SpanStyle(textDecoration = TextDecoration.LineThrough)) {
                    append(s.substring(i + 2, end))
                }
                i = end + 2
                continue
            }
        }
        // italic * or _ (single, not list leftover)
        if ((s[i] == '*' || s[i] == '_') && i + 1 < s.length && s[i + 1] != ' ' && s[i + 1] != s[i]) {
            val mark = s[i]
            val end = s.indexOf(mark, i + 1)
            if (end > i + 1 && (end + 1 >= s.length || s[end + 1] != mark)) {
                withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                    append(s.substring(i + 1, end))
                }
                i = end + 1
                continue
            }
        }
        // consume a run of plain text until next special
        val next = nextSpecial(s, i)
        appendPlain(s.substring(i, next))
        i = next
    }
}

private fun nextSpecial(s: String, from: Int): Int {
    var j = from
    while (j < s.length) {
        val c = s[j]
        if (c == '`' || c == '[' || c == '*' || c == '_' || c == '~' || c == '=') return if (j == from) from + 1 else j
        j++
    }
    return s.length
}

/** Chat render items: consecutive tool steps collapse into one card; asks become native cards. */
sealed class ChatItem {
    data class User(val msg: ChatMsg) : ChatItem()
    data class Assistant(val text: String, val live: Boolean = false, val seq: Long = 0) : ChatItem()
    data class Steps(val steps: List<ChatMsg>) : ChatItem() {
        val running: Boolean get() = steps.any { it.status == "running" }
    }
    data class Ask(val ask: AskPayload, val answered: Boolean) : ChatItem()
    /** render_ui tool card (spec JSON from agent >= 0.2.7). */
    data class Ui(val json: String, val seq: Long = 0) : ChatItem()
}

fun groupChat(msgs: List<ChatMsg>, live: String, pendingAsk: AskPayload? = null): List<ChatItem> {
    val out = ArrayList<ChatItem>()
    val buf = ArrayList<ChatMsg>()
    val seenAsk = HashSet<String>()
    fun flush() { if (buf.isNotEmpty()) { out.add(ChatItem.Steps(buf.toList())); buf.clear() } }
    for (m in msgs) {
        when (m.role) {
            "step" -> {
                val ask = m.ask
                if (ask != null) {
                    flush()
                    seenAsk.add(ask.callId)
                    val liveAsk = pendingAsk?.takeIf { it.callId == ask.callId }
                    val interactive = liveAsk != null || m.status == "running"
                    out.add(ChatItem.Ask(liveAsk ?: ask, answered = !interactive))
                } else if (!m.ui.isNullOrBlank()) {
                    flush()
                    out.add(ChatItem.Ui(m.ui, m.seq))
                } else {
                    buf.add(m)
                }
            }
            "user" -> { flush(); out.add(ChatItem.User(m)) }
            else -> { flush(); if (m.text.isNotBlank()) out.add(ChatItem.Assistant(m.text, seq = m.seq)) }
        }
    }
    flush()
    if (pendingAsk != null && pendingAsk.callId !in seenAsk) {
        out.add(ChatItem.Ask(pendingAsk, answered = false))
    }
    if (live.isNotBlank()) out.add(ChatItem.Assistant(live, live = true))
    return out
}

/** Base identity of a chat row, independent of position (so prepending pages keeps keys). */
fun chatItemBaseKey(item: ChatItem): String = when (item) {
    is ChatItem.User -> "u${item.msg.seq}"
    is ChatItem.Assistant -> if (item.live) "live" else "m${item.seq}"
    is ChatItem.Steps -> item.steps.firstOrNull().let { "s${it?.seq}:${it?.callId}" }
    is ChatItem.Ask -> "a${item.ask.callId}"
    is ChatItem.Ui -> "g${item.seq}"
}

/** Stable, unique LazyColumn keys; collisions get an occurrence suffix. */
fun chatItemKeys(items: List<ChatItem>): List<String> {
    val seen = HashMap<String, Int>()
    return items.map { val b = chatItemBaseKey(it); val n = seen.merge(b, 1, Int::plus)!!; if (n == 1) b else "$b#$n" }
}
