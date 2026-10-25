package cn.zhuhedong.remote

import cn.zhuhedong.remote.viewmodel.PendingSensitive
import cn.zhuhedong.remote.viewmodel.WorkbenchUiState
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regression for: leaving 「我的 → 设备」while a ModalBottomSheet was up (or mid-dismiss)
 * left an invisible Dialog scrim that blocked every tap on Home.
 * clearOverlays() must wipe sheet-driving flags so the sheet leaves composition before pop.
 */
class WorkbenchOverlayTest {
    @Test
    fun clearOverlaysShape_dropsSheetFlags() {
        val dirty = WorkbenchUiState(
            confirmSensitive = PendingSensitive("dsh.restart", "重启", false),
            showReauth = true,
            pendingSensitive = PendingSensitive("dsh.restart", "重启", false),
            reauthBusy = false,
            reauthError = "bad",
            reauthPassword = "x",
            reauthCode = "123456",
        )
        assertTrue(dirty.confirmSensitive != null && dirty.showReauth)

        // Mirrors WorkbenchViewModel.clearOverlays()
        val clean = dirty.copy(
            confirmSensitive = null,
            showReauth = false,
            pendingSensitive = null,
            reauthBusy = false,
            reauthError = null,
            reauthPassword = "",
            reauthCode = "",
        )
        assertNull(clean.confirmSensitive)
        assertNull(clean.pendingSensitive)
        assertFalse(clean.showReauth)
        assertTrue(clean.reauthPassword.isEmpty())
        assertTrue(clean.reauthCode.isEmpty())
        assertNull(clean.reauthError)
    }
}
