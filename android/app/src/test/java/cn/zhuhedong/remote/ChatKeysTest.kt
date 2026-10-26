package cn.zhuhedong.remote

import cn.zhuhedong.remote.data.ChatMsg
import cn.zhuhedong.remote.ui.home.chatItemKeys
import cn.zhuhedong.remote.ui.home.groupChat
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatKeysTest {
    private fun page(from: Long, to: Long) = (from..to).map { ChatMsg(it, if (it % 2L == 0L) "user" else "assistant", "m$it") }

    @Test fun prependKeepsKeysOfExistingRows() {
        val live = groupChat(page(51, 80), "")
        val merged = groupChat(page(1, 50) + page(51, 80), "")
        val a = chatItemKeys(live); val b = chatItemKeys(merged)
        assertEquals(a, b.takeLast(a.size))
        assertEquals(b.size, b.toSet().size)
    }

    @Test fun keysUniqueWithMissingSeq() {
        val k = chatItemKeys(groupChat(listOf(ChatMsg(0, "assistant", "a"), ChatMsg(0, "assistant", "b")), "x"))
        assertEquals(k.size, k.toSet().size)
        assertTrue("live" in k)
    }
}
