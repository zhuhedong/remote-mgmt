package cn.zhuhedong.remote

import cn.zhuhedong.remote.data.ErrKind
import cn.zhuhedong.remote.data.Friendly
import org.junit.Assert.assertEquals
import org.junit.Test

class FriendlyErrorTest {
    @Test fun mapsRawCodes() {
        assertEquals(ErrKind.UPGRADE_PLUGIN, Friendly.of("HTTP_502", "agent: unsupported", 502).kind)
        assertEquals(ErrKind.UPGRADE_HUB, Friendly.of("HTTP_404", "not found", 404).kind)
        assertEquals(ErrKind.OFFLINE, Friendly.of("OFFLINE", "instance offline", 503).kind)
        assertEquals(ErrKind.AUTH, Friendly.of("HTTP_401", "", 401).kind)
        assertEquals(ErrKind.UPGRADE_PLUGIN, Friendly.of("NOT_FOUND", "unknown capability: chat.prompt").kind)
        assertEquals(ErrKind.NETWORK, Friendly.of(java.net.SocketTimeoutException("timeout")).kind)
        assertEquals("HTTP_502: agent: unsupported", Friendly.of("HTTP_502", "agent: unsupported", 502).raw)
    }
}
