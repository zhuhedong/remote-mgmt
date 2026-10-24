package cn.zhuhedong.remote.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** WorkBuddy-like neutral palette; every screen reads colours from here so dark mode stays consistent. */
@Immutable
data class DshPalette(
    val bg: Color, val card: Color, val border: Color, val ink: Color, val muted: Color,
    val online: Color, val userBubble: Color, val selected: Color, val code: Color,
    val danger: Color, val dangerBg: Color, val warn: Color, val warnBg: Color, val accent: Color, val accentBg: Color,
    val skeleton: Color, val drawer: Color,
)

val LightPalette = DshPalette(
    bg = Color(0xFFF7F7F8), card = Color.White, border = Color(0xFFE6E7EA), ink = Color(0xFF1F2328), muted = Color(0xFF8A8F98),
    online = Color(0xFF10B981), userBubble = Color(0xFFEDEEF0), selected = Color(0xFFEDEDEF), code = Color(0xFFF1F2F4),
    danger = Color(0xFFD92D20), dangerBg = Color(0xFFFEF3F2), warn = Color(0xFFB54708), warnBg = Color(0xFFFFFAEB),
    accent = Color(0xFF2563EB), accentBg = Color(0xFFEFF4FF), skeleton = Color(0xFFECEDEF), drawer = Color(0xFFFAFAFA),
)

val DarkPalette = DshPalette(
    bg = Color(0xFF111214), card = Color(0xFF1C1D20), border = Color(0xFF2C2E33), ink = Color(0xFFECEDEE), muted = Color(0xFF8B9098),
    online = Color(0xFF34D399), userBubble = Color(0xFF2A2C30), selected = Color(0xFF26282C), code = Color(0xFF232529),
    danger = Color(0xFFF97066), dangerBg = Color(0xFF3A1D1B), warn = Color(0xFFFDB022), warnBg = Color(0xFF33270F),
    accent = Color(0xFF6B9BFF), accentBg = Color(0xFF1B2540), skeleton = Color(0xFF26282C), drawer = Color(0xFF16171A),
)

val LocalPalette = staticCompositionLocalOf { LightPalette }

object Dsh {
    val c: DshPalette @Composable get() = LocalPalette.current
}

@Composable
fun DshRemoteTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val p = if (dark) DarkPalette else LightPalette
    val scheme = if (dark) darkColorScheme(primary = p.accent, background = p.bg, surface = p.card, onSurface = p.ink, error = p.danger)
    else lightColorScheme(primary = p.ink, background = p.bg, surface = p.card, onSurface = p.ink, error = p.danger)
    CompositionLocalProvider(LocalPalette provides p) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
}
