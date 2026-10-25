package cn.zhuhedong.remote.update

import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
@org.robolectric.annotation.Config(sdk = [34])
class UpdaterTest {
    @Test fun compare() {
        assertTrue(Updater.isNewer("0.3.11", "0.3.10"))
        assertFalse(Updater.isNewer("0.3.9", "0.3.10"))
        assertFalse(Updater.isNewer("0.2.5-agent", "0.3.10"))
    }
    @Test fun pick() {
        val j = """[{"tag_name":"v0.2.7-agent","assets":[{"name":"a.apk","browser_download_url":"x","size":1}]},
          {"tag_name":"v0.3.11","body":"n","assets":[{"name":"DSH.apk","browser_download_url":"u","size":5}]},
          {"tag_name":"v0.3.12","draft":true,"assets":[{"name":"b.apk","browser_download_url":"y","size":1}]}]"""
        val r = Updater.pickLatest(j)!!
        assertEquals("0.3.11", r.version); assertEquals("u", r.apkUrl)
    }
}
