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
}
