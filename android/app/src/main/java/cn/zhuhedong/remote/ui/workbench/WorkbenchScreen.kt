package cn.zhuhedong.remote.ui.workbench

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.zhuhedong.remote.data.Friendly
import cn.zhuhedong.remote.data.InvokeResult
import cn.zhuhedong.remote.ui.common.DshCard
import cn.zhuhedong.remote.ui.common.ErrorState
import cn.zhuhedong.remote.ui.common.GhostButton
import cn.zhuhedong.remote.ui.common.Pill
import cn.zhuhedong.remote.ui.common.PrimaryButton
import cn.zhuhedong.remote.ui.common.SectionHeader
import cn.zhuhedong.remote.ui.common.Skeleton
import cn.zhuhedong.remote.ui.common.SkeletonCard
import cn.zhuhedong.remote.ui.common.StatusDot
import cn.zhuhedong.remote.ui.theme.Dsh
import cn.zhuhedong.remote.viewmodel.WorkbenchViewModel

/** 「我的 → 设备详情」: A0 monitoring redesigned as cards, gauges and sparklines. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkbenchScreen(title: String, vm: WorkbenchViewModel, onBack: () -> Unit, autoLoad: Boolean = true) {
    val ui by vm.ui.collectAsState()
    LaunchedEffect(Unit) { if (autoLoad) { vm.load(); vm.pollMetrics() } }
    Column(Modifier.fillMaxSize().background(Dsh.c.bg).statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = Dsh.c.ink) }
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = Dsh.c.ink, maxLines = 1)
                val ok = ui.fatal == null && !ui.offline && ui.status?.ok == true
                Row(verticalAlignment = Alignment.CenterVertically) {
                    StatusDot(ok, 6.dp); Spacer(Modifier.width(4.dp))
                    Text(if (ui.loading && ui.status == null) "连接中…" else if (ok) "在线 · 每 5 秒刷新" else "不可用", fontSize = 12.sp, color = Dsh.c.muted)
                }
            }
            IconButton(onClick = vm::load, enabled = !ui.loading) { Icon(Icons.Filled.Refresh, "刷新", tint = Dsh.c.ink) }
        }
        val fatal = ui.fatal
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).navigationBarsPadding()) {
            when {
                fatal != null -> Box(Modifier.fillMaxWidth().padding(top = 60.dp)) { ErrorState(fatal, vm::load) }
                ui.loading && ui.status == null -> { Spacer(Modifier.height(8.dp)); repeat(4) { SkeletonCard(); Spacer(Modifier.height(12.dp)) } }
                else -> DeviceBody(ui, vm)
            }
            Spacer(Modifier.height(32.dp))
        }
    }

    ui.confirmSensitive?.let { p ->
        ModalBottomSheet(onDismissRequest = vm::dismissConfirm, containerColor = Dsh.c.card) {
            Column(Modifier.padding(horizontal = 24.dp).padding(bottom = 24.dp)) {
                Text(p.title, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = Dsh.c.ink)
                Spacer(Modifier.height(8.dp))
                Text(
                    if (p.execute) "将真正执行 ${p.capabilityId}。当前版本此操作仍是 stub，不会重启电脑上的 DSH，但会被审计记录。"
                    else "演练模式：只检查权限与前置条件，不做任何改动。",
                    color = Dsh.c.muted, fontSize = 14.sp, lineHeight = 21.sp,
                )
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Shield, null, tint = Dsh.c.warn, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(6.dp))
                    Text("敏感操作需 10 分钟内重验证", fontSize = 12.sp, color = Dsh.c.warn)
                }
                Spacer(Modifier.height(20.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    GhostButton("取消", vm::dismissConfirm, Modifier.weight(1f))
                    PrimaryButton(if (p.execute) "确认执行" else "开始演练", vm::confirmSensitive, Modifier.weight(1f), color = if (p.execute) Dsh.c.danger else Dsh.c.ink)
                }
            }
        }
    }

    if (ui.showReauth) {
        ModalBottomSheet(onDismissRequest = { if (!ui.reauthBusy) vm.dismissReauth() }, containerColor = Dsh.c.card) {
            Column(Modifier.padding(horizontal = 24.dp).padding(bottom = 24.dp)) {
                Text("验证身份", fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = Dsh.c.ink)
                Spacer(Modifier.height(6.dp))
                Text("输入验证器 App 里的 6 位验证码（或密码），通过后自动继续刚才的操作。", color = Dsh.c.muted, fontSize = 14.sp)
                Spacer(Modifier.height(16.dp))
                OutlinedTextField(ui.reauthCode, { v -> vm.updateReauth { it.copy(reauthCode = v.filter(Char::isDigit).take(6)) } },
                    label = { Text("TOTP 验证码") }, singleLine = true, enabled = !ui.reauthBusy, shape = RoundedCornerShape(14.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword), modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(ui.reauthPassword, { v -> vm.updateReauth { it.copy(reauthPassword = v) } },
                    label = { Text("或输入密码") }, singleLine = true, enabled = !ui.reauthBusy, shape = RoundedCornerShape(14.dp),
                    visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
                ui.reauthError?.let { Spacer(Modifier.height(8.dp)); Text(it, color = Dsh.c.danger, fontSize = 13.sp) }
                Spacer(Modifier.height(20.dp))
                PrimaryButton(if (ui.reauthBusy) "验证中…" else "验证并继续", vm::submitReauth, Modifier.fillMaxWidth(),
                    enabled = !ui.reauthBusy && (ui.reauthPassword.isNotBlank() || ui.reauthCode.length == 6))
            }
        }
    }
}

private fun Map<String, Any?>.f(k: String): Float? = when (val v = this[k]) { is Number -> v.toFloat(); is String -> v.toFloatOrNull(); else -> null }

private fun uptime(sec: Float?): String {
    val s = sec?.toLong() ?: return "—"
    val d = s / 86400; val h = s % 86400 / 3600; val m = s % 3600 / 60
    return when { d > 0 -> "${d}天${h}小时"; h > 0 -> "${h}小时${m}分"; else -> "${m}分钟" }
}

@Composable
private fun DeviceBody(ui: cn.zhuhedong.remote.viewmodel.WorkbenchUiState, vm: WorkbenchViewModel) {
    val st = ui.status?.data.orEmpty()
    // Hero card
    DshCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Dsh.c.accentBg), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Computer, null, tint = Dsh.c.accent)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text("${st["platform"] ?: "—"} · ${st["arch"] ?: ""}", fontSize = 15.sp, fontWeight = FontWeight.Medium, color = Dsh.c.ink)
                Text("插件 ${st["plugin"] ?: "—"} · 已运行 ${uptime(st.f("uptime"))}", fontSize = 12.sp, color = Dsh.c.muted)
            }
            val ready = st["dshReady"] == true
            Pill(if (ready) "DSH 就绪" else "DSH 未就绪", if (ready) Dsh.c.online else Dsh.c.warn, if (ready) Dsh.c.online.copy(alpha = 0.12f) else Dsh.c.warnBg)
        }
    }

    SectionHeader("性能")
    val md = ui.metrics?.data.orEmpty()
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        MetricTile("CPU", md.f("cpu"), ui.cpuHist, Dsh.c.accent, Modifier.weight(1f))
        MetricTile("内存", md.f("memUsed"), ui.memHist, Dsh.c.online, Modifier.weight(1f))
    }
    Spacer(Modifier.height(12.dp))
    DshCard {
        Row {
            KV("系统负载", md["load"]?.toString()?.take(18) ?: "—", Modifier.weight(1f))
            KV("Hub 延迟", md["rtt"]?.let { "${it}ms" } ?: "—", Modifier.weight(1f))
            KV("插件内存", st["rss"]?.let { "${it}MB" } ?: "—", Modifier.weight(1f))
        }
    }
    if (ui.metrics?.ok == false) InlineFail(ui.metrics)

    SectionHeader("服务健康")
    DshCard {
        val h = ui.health
        @Suppress("UNCHECKED_CAST")
        val services = (h?.data?.get("services") as? List<*>).orEmpty().mapNotNull { it as? Map<*, *> }
        when {
            h == null -> Skeleton(Modifier.fillMaxWidth())
            !h.ok -> FailText(h)
            services.isEmpty() -> Text("暂无探测项", color = Dsh.c.muted, fontSize = 14.sp)
            else -> services.forEachIndexed { i, m ->
                if (i > 0) Spacer(Modifier.height(12.dp))
                val ok = m["ok"] == true
                Row(verticalAlignment = Alignment.CenterVertically) {
                    StatusDot(ok); Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(m["id"].toString(), fontSize = 15.sp, color = Dsh.c.ink)
                        (m["detail"] ?: m["error"])?.let { Text(it.toString(), fontSize = 12.sp, color = if (ok) Dsh.c.muted else Dsh.c.danger, maxLines = 1) }
                    }
                    Text(m["latencyMs"]?.let { "${it}ms" } ?: if (ok) "正常" else "异常", fontSize = 13.sp, color = if (ok) Dsh.c.muted else Dsh.c.danger)
                }
            }
        }
    }

    SectionHeader("最近日志")
    DshCard {
        val l = ui.logs
        @Suppress("UNCHECKED_CAST")
        val entries = (l?.data?.get("entries") as? List<*>).orEmpty().mapNotNull { it as? Map<*, *> }
        when {
            l == null -> Skeleton(Modifier.fillMaxWidth())
            !l.ok -> FailText(l)
            entries.isEmpty() -> Text("还没有日志。插件处理请求后会出现在这里。", color = Dsh.c.muted, fontSize = 14.sp)
            else -> Column(Modifier.clip(RoundedCornerShape(10.dp)).background(Dsh.c.code).padding(10.dp).horizontalScroll(rememberScrollState())) {
                entries.takeLast(30).forEach { m ->
                    Text("${m["source"]}  ${m["text"]}", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = Dsh.c.ink, maxLines = 1)
                }
            }
        }
    }

    SectionHeader("维护操作")
    var execute by remember { mutableStateOf(false) }
    DshCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("真实执行", fontSize = 15.sp, color = Dsh.c.ink)
                Text(if (execute) "将调用 execute（当前仍为 stub）" else "关闭时只做演练（dry-run）", fontSize = 12.sp, color = Dsh.c.muted)
            }
            Switch(execute, { execute = it })
        }
    }
    Spacer(Modifier.height(10.dp))
    val ops = listOf(
        Triple("dsh.restart", "重启 DSH", Icons.Filled.RestartAlt),
        Triple("plugin.reload", "重载插件", Icons.Filled.Extension),
        Triple("plugin.update", "升级插件", Icons.Filled.SystemUpdate),
    )
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        ops.forEach { (id, t, icon) -> OpRow(icon, t, id, enabled = !ui.opBusy) { vm.requestSensitive(id, t + if (execute) "" else "（演练）", execute) } }
    }
    ui.opResult?.let { r ->
        Spacer(Modifier.height(10.dp))
        DshCard {
            if (r.ok) {
                Text("完成", color = Dsh.c.online, fontWeight = FontWeight.SemiBold)
                r.data?.entries?.take(6)?.forEach { (k, v) -> Text("$k：$v", fontSize = 13.sp, color = Dsh.c.muted) }
            } else if (r.code != "REAUTH_REQUIRED") {
                val e = Friendly.of(r)
                Text(if (r.code == "DISABLED") "该操作已被策略关闭" else e.title, color = Dsh.c.danger, fontWeight = FontWeight.SemiBold)
                Text(if (r.code == "DISABLED") "在电脑上的插件配置里开启后再试。" else e.hint, fontSize = 13.sp, color = Dsh.c.muted)
            } else Text("等待身份验证…", color = Dsh.c.muted)
        }
    }

    val caps = ui.caps?.capabilities.orEmpty()
    if (caps.isNotEmpty()) {
        SectionHeader("能力 (${caps.size})")
        DshCard {
            caps.forEachIndexed { i, c ->
                if (i > 0) Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(c.title, fontSize = 14.sp, color = Dsh.c.ink)
                        Text(c.id, fontSize = 11.sp, color = Dsh.c.muted, fontFamily = FontFamily.Monospace)
                    }
                    if (c.sensitive) Pill("敏感", Dsh.c.warn, Dsh.c.warnBg)
                }
            }
        }
    }
}

@Composable
private fun OpRow(icon: ImageVector, title: String, id: String, enabled: Boolean, onClick: () -> Unit) {
    DshCard(onClick = if (enabled) onClick else null) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(36.dp).clip(CircleShape).background(Dsh.c.code), contentAlignment = Alignment.Center) { Icon(icon, null, tint = Dsh.c.ink, modifier = Modifier.size(18.dp)) }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 15.sp, color = Dsh.c.ink)
                Text(id, fontSize = 11.sp, color = Dsh.c.muted, fontFamily = FontFamily.Monospace)
            }
            Pill("需验证", Dsh.c.warn, Dsh.c.warnBg)
        }
    }
}

@Composable
private fun MetricTile(label: String, value: Float?, hist: List<Float>, color: Color, modifier: Modifier) {
    Surface(shape = RoundedCornerShape(16.dp), color = Dsh.c.card, modifier = modifier) {
        Column(Modifier.padding(14.dp)) {
            Text(label, fontSize = 13.sp, color = Dsh.c.muted)
            Text(value?.let { "%.0f%%".format(it) } ?: "—", fontSize = 26.sp, fontWeight = FontWeight.SemiBold, color = Dsh.c.ink)
            Spacer(Modifier.height(6.dp))
            Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(Dsh.c.skeleton)) {
                Box(Modifier.fillMaxWidth(((value ?: 0f) / 100f).coerceIn(0f, 1f)).height(6.dp).clip(RoundedCornerShape(3.dp)).background(color))
            }
            Spacer(Modifier.height(10.dp))
            Sparkline(hist, color, Modifier.fillMaxWidth().height(36.dp))
        }
    }
}

@Composable
private fun Sparkline(points: List<Float>, color: Color, modifier: Modifier) {
    Canvas(modifier) {
        if (points.size < 2) return@Canvas
        val dx = size.width / (points.size - 1)
        val p = Path()
        points.forEachIndexed { i, v ->
            val o = Offset(i * dx, size.height * (1f - (v / 100f).coerceIn(0f, 1f)))
            if (i == 0) p.moveTo(o.x, o.y) else p.lineTo(o.x, o.y)
        }
        drawPath(p, color, style = Stroke(width = 2.dp.toPx()))
    }
}

@Composable
private fun KV(k: String, v: String, modifier: Modifier) {
    Column(modifier) {
        Text(k, fontSize = 12.sp, color = Dsh.c.muted)
        Text(v, fontSize = 15.sp, color = Dsh.c.ink, fontWeight = FontWeight.Medium, maxLines = 1)
    }
}

@Composable
private fun FailText(r: InvokeResult) {
    val e = Friendly.of(r)
    Text(e.title, color = Dsh.c.danger, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    Text(e.hint, color = Dsh.c.muted, fontSize = 12.sp)
}

@Composable
private fun InlineFail(r: InvokeResult) { Spacer(Modifier.height(6.dp)); FailText(r) }
