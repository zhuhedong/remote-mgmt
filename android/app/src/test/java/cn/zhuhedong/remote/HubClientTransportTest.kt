package cn.zhuhedong.remote

import cn.zhuhedong.remote.data.HubClient
import cn.zhuhedong.remote.data.HubException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.io.InterruptedIOException
import java.net.SocketTimeoutException

class HubClientTransportTest {
    @Test fun mapsTimeout() {
        val e = HubClient.mapTransport(SocketTimeoutException("read timed out"))
        assertEquals("TIMEOUT", e.code)
    }

    @Test fun mapsInterruptedAsTimeout() {
        val e = HubClient.mapTransport(InterruptedIOException("timeout"))
        assertEquals("TIMEOUT", e.code)
    }

    @Test fun mapsIoAsNetwork() {
        val e = HubClient.mapTransport(IOException("failed to connect"))
        assertEquals("NETWORK", e.code)
        assertTrue(e.message!!.contains("failed to connect"))
    }

    @Test fun passesThroughHubException() {
        val orig = HubException("OFFLINE", "gone", 503)
        val e = HubClient.mapTransport(orig)
        assertEquals("OFFLINE", e.code)
        assertEquals(503, e.httpStatus)
    }
}
