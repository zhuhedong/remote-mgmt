package cn.zhuhedong.remote

import cn.zhuhedong.remote.data.ChatMsg
import cn.zhuhedong.remote.data.ChatParse
import cn.zhuhedong.remote.ui.home.ChatItem
import cn.zhuhedong.remote.ui.home.MdBlock
import cn.zhuhedong.remote.ui.home.groupChat
import cn.zhuhedong.remote.ui.home.parseMarkdown
import cn.zhuhedong.remote.viewmodel.ChatViewModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatLogicTest {
    @Test fun markdownBlocks() {
        val b = parseMarkdown("# 标题\n正文\n- 一\n1. 二\n```\ncode\n```")
        assertEquals(MdBlock.Heading(1, "标题"), b[0])
        assertEquals(MdBlock.Para("正文"), b[1])
        assertEquals(MdBlock.Bullet("一", "•"), b[2])
        assertEquals(MdBlock.Bullet("二", "1."), b[3])
        assertEquals(MdBlock.Code("code"), b[4])
    }

    @Test fun markdownTableQuoteLinkAndJson() {
        val table = parseMarkdown("| A | B |\n|---|---|\n| 1 | 2 |")
        assertTrue(table[0] is MdBlock.Table)
        val t = table[0] as MdBlock.Table
        assertEquals(listOf("A", "B"), t.headers)
        assertEquals(listOf("1", "2"), t.rows[0])

        val q = parseMarkdown("> 引用一行\n> 第二行")
        assertEquals(MdBlock.Quote("引用一行\n第二行"), q[0])

        val fence = parseMarkdown("```kotlin\nval x = 1\n```")
        assertEquals(MdBlock.Code("val x = 1", "kotlin"), fence[0])

        val json = parseMarkdown("""{"a":1,"b":[2,3]}""")
        assertEquals(1, json.size)
        assertTrue(json[0] is MdBlock.Code)
        assertEquals("json", (json[0] as MdBlock.Code).lang)

        val inline = cn.zhuhedong.remote.ui.home.inlineMd("见 [文档](https://example.com) 与 **粗体** 和 `code`")
        assertTrue(inline.text.contains("文档"))
        assertTrue(inline.text.contains("粗体"))
        assertTrue(inline.text.contains("code"))
        assertTrue(!inline.text.contains("**"))
        assertTrue(!inline.text.contains("`"))
    }

    @Test fun softBreakDoesNotSplitMarkers() {
        val s = "abcdefghijabcdefghijabcdefghij**粗**"
        val broken = cn.zhuhedong.remote.ui.home.softBreakAscii(s, every = 10)
        // ASCII soft-break inserts ZWSP but never inside ** markers themselves for CJK after
        assertTrue(broken.contains("**粗**") || broken.contains("**"))
        val annotated = cn.zhuhedong.remote.ui.home.inlineMd("前缀文字很多很多很多很多很多很多很多很多**加粗**后缀")
        assertTrue(annotated.text.contains("加粗"))
        assertTrue(!annotated.text.contains("**"))
    }

    @Test fun groupsStepsAndLive() {
        val items = groupChat(listOf(
            ChatMsg(1, "user", "hi"),
            ChatMsg(2, "step", "bash", "done"),
            ChatMsg(3, "step", "read", "running"),
            ChatMsg(4, "assistant", "ok"),
        ), "流式")
        assertEquals(4, items.size)
        assertTrue((items[1] as ChatItem.Steps).running)
        assertEquals(ChatItem.Assistant("流式", live = true), items[3])
    }

    @Test fun parsesModelsAndSessions() {
        val (models, cur) = ChatParse.models(mapOf(
            "current" to mapOf("provider" to "p", "model" to "m2"),
            "groups" to listOf(mapOf("id" to "p", "name" to "P", "models" to listOf(mapOf("id" to "m1"), mapOf("id" to "m2")))),
        ))
        assertEquals(2, models.size)
        assertEquals("m2", cur?.model)
        val (s, sp) = ChatParse.sessions(mapOf(
            "sessions" to listOf(mapOf("sessionId" to "abc", "cwd" to "/a/x", "space" to "x", "running" to true)),
            "spaces" to listOf(mapOf("name" to "x", "cwd" to "/a/x", "count" to 1)),
        ))
        assertTrue(s[0].running)
        assertEquals("x", sp[0].name)
    }

    @Test fun cwdMatchesPendingProject() {
        assertTrue(ChatViewModel.cwdMatches(null, "/a"))
        assertTrue(ChatViewModel.cwdMatches("/Users/code/app", "/Users/code/app"))
        assertTrue(ChatViewModel.cwdMatches("/Users/code/app/", "/Users/code/app"))
        assertTrue(ChatViewModel.cwdMatches("~/code/app", "/Users/code/code/app"))
        assertTrue(ChatViewModel.cwdMatches("~/code/app", "/Users/me/code/app"))
        assertTrue(!ChatViewModel.cwdMatches("/Users/code/a", "/Users/code/b"))
        assertTrue(ChatViewModel.cwdMatches("~/x", null)) // old agent
    }

    @Test fun sessionDisplayTitle() {
        val blank = cn.zhuhedong.remote.data.ChatSession("abcdef012345", null, null, null, 0, false, true)
        assertEquals("新任务", blank.displayTitle())
        val titled = blank.copy(title = "日报", blank = false)
        assertEquals("日报", titled.displayTitle())
        val untitled = blank.copy(blank = false, title = null)
        assertEquals("会话 abcdef01", untitled.displayTitle())
    }

    @Test fun followUnchangedAndEmpty() {
        val u = ChatParse.follow(mapOf("unchanged" to true, "version" to 3))
        assertTrue(u.unchanged)
        assertEquals(3, u.version)
        val empty = ChatParse.follow(null)
        assertEquals(0, empty.messages.size)
        assertEquals("", empty.live)
    }

    @Test fun groupChatSkipsBlankAssistant() {
        val items = groupChat(listOf(
            ChatMsg(1, "assistant", ""),
            ChatMsg(2, "user", "hi"),
        ), "")
        assertEquals(1, items.size)
        assertTrue(items[0] is ChatItem.User)
    }

    @Test fun askPayloadAndGroup() {
        val ask = cn.zhuhedong.remote.data.AskPayload(
            "c1",
            listOf(cn.zhuhedong.remote.data.AskQuestion("q1", "选一个", options = listOf(cn.zhuhedong.remote.data.AskOption("A"), cn.zhuhedong.remote.data.AskOption("B")))),
        )
        val items = groupChat(listOf(
            ChatMsg(1, "assistant", "请选择"),
            ChatMsg(2, "step", "选一个", "running", name = "ask_user_question", callId = "c1", ask = ask),
        ), "", null)
        assertEquals(2, items.size)
        assertTrue(items[1] is ChatItem.Ask)
        assertEquals(false, (items[1] as ChatItem.Ask).answered)

        val parsed = ChatParse.follow(mapOf(
            "version" to 1,
            "pendingAsk" to mapOf(
                "callId" to "c9",
                "questions" to listOf(mapOf(
                    "id" to "q",
                    "question" to "OK?",
                    "options" to listOf(mapOf("label" to "是"), mapOf("label" to "否")),
                )),
            ),
            "messages" to emptyList<Any>(),
        ))
        assertEquals("c9", parsed.pendingAsk?.callId)
        assertEquals(2, parsed.pendingAsk?.questions?.get(0)?.options?.size)
        val fromPending = groupChat(emptyList(), "", parsed.pendingAsk)
        assertTrue(fromPending[0] is ChatItem.Ask)
    }

    @Test fun pendingAskKeepsDoneStepInteractive() {
        val ask = cn.zhuhedong.remote.data.AskPayload(
            "c1",
            listOf(cn.zhuhedong.remote.data.AskQuestion("q1", "选一个", options = listOf(cn.zhuhedong.remote.data.AskOption("A")))),
        )
        val items = groupChat(
            listOf(ChatMsg(1, "step", "选一个", "done", name = "ask_user_question", callId = "c1", ask = ask)),
            "",
            ask,
        )
        assertEquals(1, items.size)
        assertTrue(items[0] is ChatItem.Ask)
        assertEquals(false, (items[0] as ChatItem.Ask).answered)
    }

}
