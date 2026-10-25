package cn.zhuhedong.remote.update

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.zhuhedong.remote.BuildConfig

@Composable
fun UpdateHost() {
    val ctx = LocalContext.current
    val s by Updater.state.collectAsState()
    when (val st = s) {
        is UpdateState.Available -> AlertDialog(
            onDismissRequest = { Updater.dismiss() },
            title = { Text("发现新版本 ${st.rel.version}") },
            text = {
                Column(Modifier.heightIn(max = 360.dp).verticalScroll(rememberScrollState())) {
                    Text("当前 ${BuildConfig.VERSION_NAME}" + if (st.rel.size > 0) " · 安装包 ${"%.1f".format(st.rel.size / 1048576.0)} MB" else "", fontSize = 13.sp)
                    Spacer(Modifier.height(8.dp))
                    Text(st.rel.notes.ifBlank { "（无更新说明）" }, fontSize = 13.sp)
                }
            },
            confirmButton = { TextButton(onClick = { Updater.download(ctx, st.rel) }) { Text("立即更新") } },
            dismissButton = {
                Column {
                    TextButton(onClick = { Updater.dismiss() }) { Text("稍后") }
                    TextButton(onClick = { Updater.skip(ctx, st.rel) }) { Text("跳过此版本") }
                }
            },
        )
        is UpdateState.Downloading -> AlertDialog(
            onDismissRequest = {},
            title = { Text("正在下载 ${st.rel.version}") },
            text = {
                Column {
                    if (st.progress >= 0f) LinearProgressIndicator(progress = { st.progress }, modifier = Modifier.fillMaxWidth())
                    else LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(8.dp))
                    Text((if (st.progress >= 0f) "${(st.progress * 100).toInt()}%  · " else "") + "来源：${st.source}", fontSize = 13.sp)
                }
            },
            confirmButton = { TextButton(onClick = { Updater.cancel() }) { Text("取消") } },
        )
        is UpdateState.NeedPermission -> AlertDialog(
            onDismissRequest = { Updater.cancel() },
            title = { Text("需要安装权限") },
            text = { Text("请在系统设置里允许 DSH Remote「安装未知应用」，返回后会自动继续安装。\n小米/HyperOS 若弹出安全提示，选择「继续安装」即可。") },
            confirmButton = { TextButton(onClick = { Updater.openPermissionSettings(ctx) }) { Text("去设置") } },
            dismissButton = { TextButton(onClick = { Updater.cancel() }) { Text("取消") } },
        )
        is UpdateState.Ready -> AlertDialog(
            onDismissRequest = { Updater.cancel() },
            title = { Text("下载完成") },
            text = { Text("如果安装界面没弹出，点「安装」。") },
            confirmButton = { TextButton(onClick = { Updater.install(ctx, st.rel, st.file) }) { Text("安装") } },
            dismissButton = { TextButton(onClick = { Updater.cancel() }) { Text("关闭") } },
        )
        is UpdateState.UpToDate -> AlertDialog(
            onDismissRequest = { Updater.cancel() },
            title = { Text("已是最新版本") },
            text = { Text("当前 ${BuildConfig.VERSION_NAME}") },
            confirmButton = { TextButton(onClick = { Updater.cancel() }) { Text("好") } },
        )
        is UpdateState.Failed -> AlertDialog(
            onDismissRequest = { Updater.cancel() },
            title = { Text("更新失败") },
            text = { Text(st.msg) },
            confirmButton = {
                if (st.rel != null) TextButton(onClick = { Updater.download(ctx, st.rel) }) { Text("重试") }
                else TextButton(onClick = { Updater.check(ctx, true) }) { Text("重试") }
            },
            dismissButton = { TextButton(onClick = { Updater.cancel() }) { Text("关闭") } },
        )
        else -> Unit
    }
}
