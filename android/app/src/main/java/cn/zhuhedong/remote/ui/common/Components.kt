package cn.zhuhedong.remote.ui.common

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.zhuhedong.remote.data.ErrKind
import cn.zhuhedong.remote.data.FriendlyError
import cn.zhuhedong.remote.ui.theme.Dsh

@Composable
fun DshCard(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    val m = modifier.fillMaxWidth().border(1.dp, Dsh.c.border, shape)
    if (onClick != null) Surface(onClick = onClick, shape = shape, color = Dsh.c.card, modifier = m) { Column(Modifier.padding(16.dp), content = content) }
    else Surface(shape = shape, color = Dsh.c.card, modifier = m) { Column(Modifier.padding(16.dp), content = content) }
}

@Composable
fun PrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, color: Color = Dsh.c.ink) {
    Surface(onClick = onClick, enabled = enabled, shape = RoundedCornerShape(14.dp), color = if (enabled) color else Dsh.c.skeleton, modifier = modifier.height(48.dp)) {
        Box(contentAlignment = Alignment.Center) { Text(text, color = if (enabled) Dsh.c.bg else Dsh.c.muted, fontWeight = FontWeight.SemiBold, fontSize = 16.sp) }
    }
}

@Composable
fun GhostButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, color: Color = Dsh.c.ink) {
    Surface(onClick = onClick, enabled = enabled, shape = RoundedCornerShape(14.dp), color = Dsh.c.card, modifier = modifier.height(48.dp).border(1.dp, Dsh.c.border, RoundedCornerShape(14.dp))) {
        Box(contentAlignment = Alignment.Center) { Text(text, color = if (enabled) color else Dsh.c.muted, fontWeight = FontWeight.Medium, fontSize = 15.sp) }
    }
}

fun iconFor(kind: ErrKind): ImageVector = when (kind) {
    ErrKind.OFFLINE -> Icons.Filled.CloudOff
    ErrKind.UPGRADE_PLUGIN, ErrKind.UPGRADE_HUB -> Icons.Filled.SystemUpdate
    ErrKind.AUTH -> Icons.Filled.Lock
    ErrKind.NETWORK -> Icons.Filled.WifiOff
    else -> Icons.Filled.ErrorOutline
}

/** Full empty/error state: icon bubble, title, explanation, optional action, collapsible raw code. */
@Composable
fun StateView(icon: ImageVector, title: String, body: String, modifier: Modifier = Modifier, action: String? = null, onAction: (() -> Unit)? = null, raw: String? = null, tint: Color = Dsh.c.ink) {
    Column(modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(64.dp).clip(CircleShape).background(Dsh.c.card).border(1.dp, Dsh.c.border, CircleShape), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = tint, modifier = Modifier.size(28.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text(title, fontSize = 19.sp, fontWeight = FontWeight.SemiBold, color = Dsh.c.ink, textAlign = TextAlign.Center)
        Spacer(Modifier.height(6.dp))
        Text(body, fontSize = 14.sp, color = Dsh.c.muted, textAlign = TextAlign.Center, lineHeight = 21.sp)
        if (action != null && onAction != null) {
            Spacer(Modifier.height(18.dp))
            PrimaryButton(action, onAction, Modifier.width(160.dp))
        }
        if (raw != null) {
            Spacer(Modifier.height(12.dp))
            Text("错误码 $raw", fontSize = 11.sp, color = Dsh.c.muted, fontFamily = FontFamily.Monospace, textAlign = TextAlign.Center)
        }
    }
}

@Composable
fun ErrorState(e: FriendlyError, onAction: (() -> Unit)?, modifier: Modifier = Modifier) =
    StateView(iconFor(e.kind), e.title, e.hint, modifier, e.action, onAction, e.raw, tint = if (e.kind == ErrKind.OFFLINE) Dsh.c.muted else Dsh.c.ink)

/** Thin inline banner used above the chat for non-fatal errors. */
@Composable
fun ErrorBanner(e: FriendlyError, onDismiss: () -> Unit, onAction: (() -> Unit)? = null) {
    val warn = e.kind == ErrKind.UPGRADE_PLUGIN || e.kind == ErrKind.UPGRADE_HUB || e.kind == ErrKind.OFFLINE
    Surface(onClick = onDismiss, color = if (warn) Dsh.c.warnBg else Dsh.c.dangerBg, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(iconFor(e.kind), null, tint = if (warn) Dsh.c.warn else Dsh.c.danger, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(e.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Dsh.c.ink)
                Text(e.hint, fontSize = 12.sp, color = Dsh.c.muted, maxLines = 2)
            }
            if (onAction != null) Surface(onClick = onAction, shape = RoundedCornerShape(10.dp), color = Dsh.c.card) {
                Text(e.action, fontSize = 13.sp, color = Dsh.c.ink, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
            }
        }
    }
}

@Composable
fun Skeleton(modifier: Modifier = Modifier, height: Dp = 14.dp, radius: Dp = 8.dp) {
    val t = rememberInfiniteTransition(label = "sk")
    val a by t.animateFloat(0.45f, 1f, infiniteRepeatable(tween(800), RepeatMode.Reverse), label = "a")
    Box(modifier.height(height).alpha(a).clip(RoundedCornerShape(radius)).background(Dsh.c.skeleton))
}

@Composable
fun SkeletonCard(lines: Int = 3) {
    DshCard {
        Skeleton(Modifier.width(120.dp), 16.dp)
        repeat(lines) { Spacer(Modifier.height(12.dp)); Skeleton(Modifier.fillMaxWidth(if (it % 2 == 0) 1f else 0.7f)) }
    }
}

@Composable
fun SectionHeader(text: String, modifier: Modifier = Modifier, trailing: @Composable (() -> Unit)? = null) {
    Row(modifier.fillMaxWidth().padding(top = 20.dp, bottom = 8.dp, start = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, fontSize = 13.sp, color = Dsh.c.muted, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
        trailing?.invoke()
    }
}

@Composable
fun StatusDot(on: Boolean, size: Dp = 8.dp) = Box(Modifier.size(size).clip(CircleShape).background(if (on) Dsh.c.online else Dsh.c.muted))

@Composable
fun Pill(text: String, fg: Color, bg: Color) {
    Text(text, fontSize = 11.sp, color = fg, fontWeight = FontWeight.Medium, modifier = Modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 8.dp, vertical = 2.dp))
}

@Composable
fun SettingRow(icon: ImageVector, title: String, value: String? = null, danger: Boolean = false, onClick: (() -> Unit)? = null) {
    val content: @Composable () -> Unit = {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(icon, null, tint = if (danger) Dsh.c.danger else Dsh.c.ink, modifier = Modifier.size(20.dp))
            Text(title, color = if (danger) Dsh.c.danger else Dsh.c.ink, fontSize = 15.sp, modifier = Modifier.weight(1f))
            if (value != null) Text(value, color = Dsh.c.muted, fontSize = 13.sp, maxLines = 1)
        }
    }
    if (onClick != null) Surface(onClick = onClick, color = Color.Transparent) { content() } else content()
}
