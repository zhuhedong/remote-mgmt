package cn.zhuhedong.remote.ui.instances

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import cn.zhuhedong.remote.data.DeviceInstance
import cn.zhuhedong.remote.viewmodel.InstancesViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InstanceListScreen(
    vm: InstancesViewModel,
    onOpen: (DeviceInstance) -> Unit,
    onLogout: () -> Unit,
) {
    val ui by vm.ui.collectAsState()
    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("实例") },
                actions = {
                    IconButton(onClick = { vm.refresh() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "刷新")
                    }
                    IconButton(onClick = { vm.logout(onLogout) }) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "退出")
                    }
                },
            )
        },
    ) { pad ->
        Column(Modifier.fillMaxSize().padding(pad)) {
            when {
                ui.loading && ui.items.isEmpty() -> CircularProgressIndicator(Modifier.padding(24.dp))
                ui.error != null -> Text(ui.error!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp))
                ui.items.isEmpty() -> Text("暂无实例。请在 Hub 控制台登记设备。", Modifier.padding(16.dp))
                else -> LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(ui.items, key = { it.id }) { d ->
                        Card(Modifier.fillMaxWidth().clickable { onOpen(d) }) {
                            Column(Modifier.padding(16.dp)) {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text(d.name, style = MaterialTheme.typography.titleMedium)
                                    Text(if (d.online) "在线" else "离线", color = if (d.online) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                                }
                                Text("${d.slug} · ${d.status}", style = MaterialTheme.typography.bodySmall)
                                d.fingerprint?.let {
                                    Text("指纹 $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
