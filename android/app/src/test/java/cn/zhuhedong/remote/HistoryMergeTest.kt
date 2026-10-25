package cn.zhuhedong.remote

import cn.zhuhedong.remote.data.ChatMsg
import cn.zhuhedong.remote.viewmodel.ChatViewModel
import org.junit.Assert.assertEquals
import org.junit.Test

class HistoryMergeTest {
    private fun m(seq: Long, role: String = "user") = ChatMsg(seq, role, "t$seq")

    @Test fun olderPrependedAndDeduped() {
        val older = listOf(m(1), m(3, "assistant"), m(5))
        val live = listOf(m(5), m(7, "assistant"))
        assertEquals(listOf(1L, 3L, 5L, 7L), ChatViewModel.mergeHistory(older, live).map { it.seq })
    }

    @Test fun emptyOlderKeepsLive() {
        val live = listOf(m(5), m(7))
        assertEquals(live, ChatViewModel.mergeHistory(emptyList(), live))
    }
}
