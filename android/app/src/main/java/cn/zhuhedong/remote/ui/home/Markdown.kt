package cn.zhuhedong.remote.ui.home

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import cn.zhuhedong.remote.data.ChatMsg

/** Minimal markdown blocks: headings, bullets, numbered, code fences, paragraphs. */
sealed class MdBlock {
    data class Heading(val level: Int, val text: String) : MdBlock()
    data class Bullet(val text: String, val marker: String) : MdBlock()
    data class Code(val code: String) : MdBlock()
    data class Para(val text: String) : MdBlock()
}

fun parseMarkdown(src: String): List<MdBlock> {
    val out = ArrayList<MdBlock>()
    val lines = src.replace("\r\n", "\n").split("\n")
    var i = 0
    val para = StringBuilder()
    fun flush() { if (para.isNotBlank()) out.add(MdBlock.Para(para.toString().trim())); para.clear() }
    while (i < lines.size) {
        val l = lines[i]
        val t = l.trimStart()
        when {
            t.startsWith("```") -> {
                flush()
                val sb = StringBuilder(); i++
                while (i < lines.size && !lines[i].trimStart().startsWith("```")) { if (sb.isNotEmpty()) sb.append('\n'); sb.append(lines[i]); i++ }
                out.add(MdBlock.Code(sb.toString()))
            }
            Regex("^#{1,6} ").containsMatchIn(t) -> { flush(); val lv = t.takeWhile { it == '#' }.length; out.add(MdBlock.Heading(lv, t.drop(lv).trim())) }
            t.startsWith("- ") || t.startsWith("* ") -> { flush(); out.add(MdBlock.Bullet(t.drop(2), "•")) }
            Regex("^\\d+[.)] ").containsMatchIn(t) -> { flush(); val n = t.takeWhile { it.isDigit() }; out.add(MdBlock.Bullet(t.substringAfter(' '), "$n.")) }
            t.isEmpty() -> flush()
            else -> { if (para.isNotEmpty()) para.append('\n'); para.append(l) }
        }
        i++
    }
    flush()
    return out
}

/** Inline: **bold**, `code`. */
fun inlineMd(s: String, codeBg: Color = Color(0xFFF1F2F4)): AnnotatedString = buildAnnotatedString {
    var i = 0
    while (i < s.length) {
        if (s.startsWith("**", i)) {
            val end = s.indexOf("**", i + 2)
            if (end > i + 2) { withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(s.substring(i + 2, end)) }; i = end + 2; continue }
        }
        if (s[i] == '`') {
            val end = s.indexOf('`', i + 1)
            if (end > i + 1) { withStyle(SpanStyle(fontFamily = FontFamily.Monospace, background = codeBg)) { append(s.substring(i + 1, end)) }; i = end + 1; continue }
        }
        append(s[i]); i++
    }
}

/** Chat render items: consecutive tool steps collapse into one card. */
sealed class ChatItem {
    data class User(val msg: ChatMsg) : ChatItem()
    data class Assistant(val text: String, val live: Boolean = false) : ChatItem()
    data class Steps(val steps: List<ChatMsg>) : ChatItem() {
        val running: Boolean get() = steps.any { it.status == "running" }
    }
}

fun groupChat(msgs: List<ChatMsg>, live: String): List<ChatItem> {
    val out = ArrayList<ChatItem>()
    val buf = ArrayList<ChatMsg>()
    fun flush() { if (buf.isNotEmpty()) { out.add(ChatItem.Steps(buf.toList())); buf.clear() } }
    for (m in msgs) {
        when (m.role) {
            "step" -> buf.add(m)
            "user" -> { flush(); out.add(ChatItem.User(m)) }
            else -> { flush(); if (m.text.isNotBlank()) out.add(ChatItem.Assistant(m.text)) }
        }
    }
    flush()
    if (live.isNotBlank()) out.add(ChatItem.Assistant(live, live = true))
    return out
}
