package cn.zhuhedong.remote.ui.workbench

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.zhuhedong.remote.data.InvokeResult
import cn.zhuhedong.remote.viewmodel.WorkbenchViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkbenchScreen(
    title: String,
    vm: WorkbenchViewModel,
    onBack: () -> Unit,
) {
    val ui by vm.ui.collectAsState()
    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
                actions = {
                    IconButton(onClick = { vm.load() }, enabled = !ui.loading) {
                        Icon(Icons.Default.Refresh, contentDescription = "刷新")
                    }
                },
            )
        },
    ) { pad ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(pad)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            if (ui.loading) {
                CircularProgressIndicator(Modifier.padding(bottom = 12.dp))
            }

            if (ui.offline) {
                Card(Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
                    Column(Modifier.padding(16.dp)) {
                        Text("实例离线", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.height(8.dp))
                        Text(ui.error ?: "设备未连接 Hub")
                        Spacer(Modifier.height(12.dp))
                        Button(onClick = { vm.load() }) { Text("重试") }
                    }
                }
                return@Column
            }

            ui.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(bottom = 12.dp))
            }

            SectionTitle("概览 · instance.status")
            ResultCard(ui.status) { d ->
                KV("plugin", d["plugin"])
                KV("dshReady", d["dshReady"])
                KV("platform", "${d["platform"]} / ${d["arch"]}")
                KV("uptime / rss", "${d["uptime"]}s / ${d["rss"]}MB")
            }

            SectionTitle("指标 · instance.metrics")
            ResultCard(ui.metrics) { d ->
                KV("CPU", "${d["cpu"]}%")
                KV("内存", "${d["memUsed"]}%")
                KV("负载", "${d["load"]}")
                KV("RTT", "${d["rtt"]}")
            }

            SectionTitle("健康 · services.health")
            ResultCard(ui.health) { d ->
                @Suppress("UNCHECKED_CAST")
                val services = d["services"] as? List<*>
                if (services.isNullOrEmpty()) {
                    Text("无探测结果")
                } else {
                    services.forEach { item ->
                        val m = item as? Map<*, *> ?: return@forEach
                        val ok = m["ok"] == true
                        Text(
                            "${m["id"]}: ${if (ok) "OK" else "FAIL"}" +
                                (m["latencyMs"]?.let { " · ${it}ms" } ?: "") +
                                (m["detail"]?.let { " · $it" } ?: "") +
                                (m["error"]?.let { " · $it" } ?: ""),
                            color = if (ok) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.error,
                        )
                    }
                }
            }

            SectionTitle("日志尾 · instance.logs.tail")
            ResultCard(ui.logs) { d ->
                @Suppress("UNCHECKED_CAST")
                val entries = d["entries"] as? List<*>
                if (entries.isNullOrEmpty()) {
                    Text("暂无日志（插件启动后操作会写入环形缓冲）")
                } else {
                    entries.takeLast(40).forEach { item ->
                        val m = item as? Map<*, *> ?: return@forEach
                        Text(
                            "${m["source"]}: ${m["text"]}",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(bottom = 2.dp),
                        )
                    }
                }
            }

            SectionTitle("敏感操作（A0 stub）")
            Text(
                "真实重启/重载/升级未接线。默认 dry-run；勾选执行仍返回 STUB。策略关闭时返回 DISABLED。",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))
            SensitiveButtons(enabled = !ui.opBusy && !ui.loading) { id, title, execute ->
                vm.requestSensitive(id, title, execute)
            }
            if (ui.opBusy) {
                Spacer(Modifier.height(8.dp))
                CircularProgressIndicator()
            }
            ui.opResult?.let { r ->
                Spacer(Modifier.height(8.dp))
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp)) {
                        if (r.ok) {
                            Text("成功", color = MaterialTheme.colorScheme.primary)
                            r.data?.forEach { (k, v) -> Text("$k: $v") }
                        } else {
                            Text("${r.code}: ${r.message}", color = MaterialTheme.colorScheme.error)
                            if (r.code == "REAUTH_REQUIRED") {
                                Text("请完成重验证后自动重试。", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            SectionTitle("能力目录")
            val caps = ui.caps?.capabilities.orEmpty()
            if (caps.isEmpty() && !ui.loading) {
                Text("无能力返回。可能插件过旧，请升级 dsh-remote-agent。")
            }
            caps.forEach { c ->
                Card(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                    Column(Modifier.padding(12.dp)) {
                        Text(c.title, style = MaterialTheme.typography.titleSmall)
                        Text(c.id, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        c.description?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                        if (c.sensitive) {
                            Text("敏感 · 需 10 分钟内重验证", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
    }

    ui.confirmSensitive?.let { pending ->
        AlertDialog(
            onDismissRequest = { vm.dismissConfirm() },
            title = { Text(pending.title) },
            text = {
                Text(
                    if (pending.execute) {
                        "将以 execute=true 调用 ${pending.capabilityId}。A0 仍为 stub，不会真正重启桌面 DSH。"
                    } else {
                        "将以 dry-run 调用 ${pending.capabilityId}（不执行真实动作）。"
                    },
                )
            },
            confirmButton = {
                TextButton(onClick = { vm.confirmSensitive() }) { Text("确认") }
            },
            dismissButton = {
                TextButton(onClick = { vm.dismissConfirm() }) { Text("取消") }
            },
        )
    }

    if (ui.showReauth) {
        AlertDialog(
            onDismissRequest = { if (!ui.reauthBusy) vm.dismissReauth() },
            title = { Text("敏感操作需重验证") },
            text = {
                Column {
                    Text("请输入密码或 TOTP（至少一项），验证后将自动重试。")
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = ui.reauthPassword,
                        onValueChange = { v -> vm.updateReauth { it.copy(reauthPassword = v) } },
                        label = { Text("密码（可选）") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        enabled = !ui.reauthBusy,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = ui.reauthCode,
                        onValueChange = { v ->
                            vm.updateReauth { it.copy(reauthCode = v.filter { ch -> ch.isDigit() }.take(6)) }
                        },
                        label = { Text("TOTP（可选）") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        enabled = !ui.reauthBusy,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    ui.reauthError?.let {
                        Spacer(Modifier.height(8.dp))
                        Text(it, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { vm.submitReauth() },
                    enabled = !ui.reauthBusy && (ui.reauthPassword.isNotBlank() || ui.reauthCode.length == 6),
                ) { Text(if (ui.reauthBusy) "验证中…" else "验证并重试") }
            },
            dismissButton = {
                TextButton(onClick = { vm.dismissReauth() }, enabled = !ui.reauthBusy) { Text("取消") }
            },
        )
    }
}

@Composable
private fun SectionTitle(t: String) {
    Spacer(Modifier.height(16.dp))
    Text(t, style = MaterialTheme.typography.titleMedium)
    Spacer(Modifier.height(8.dp))
}

@Composable
private fun ResultCard(result: InvokeResult?, content: @Composable (Map<String, Any?>) -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            when {
                result == null -> Text("尚未加载")
                !result.ok -> Text("失败 ${result.code}: ${result.message}", color = MaterialTheme.colorScheme.error)
                else -> content(result.data.orEmpty())
            }
        }
    }
}

@Composable
private fun KV(k: String, v: Any?) {
    Text("$k: ${v ?: "—"}")
}

@Composable
private fun SensitiveButtons(enabled: Boolean, onClick: (id: String, title: String, execute: Boolean) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(
            Triple("dsh.restart", "重启 DSH", true),
            Triple("plugin.reload", "重载插件", true),
            Triple("plugin.update", "升级插件", true),
        ).forEach { (id, title, _) ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = { onClick(id, "$title（演练）", false) },
                    enabled = enabled,
                    modifier = Modifier.weight(1f),
                ) { Text("$title·演练") }
                Button(
                    onClick = { onClick(id, "$title（执行 stub）", true) },
                    enabled = enabled,
                    modifier = Modifier.weight(1f),
                ) { Text("$title·执行") }
            }
        }
    }
}
