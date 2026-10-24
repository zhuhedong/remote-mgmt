package cn.zhuhedong.remote.ui.login

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cn.zhuhedong.remote.ui.common.PrimaryButton
import cn.zhuhedong.remote.ui.theme.Dsh
import cn.zhuhedong.remote.viewmodel.LoginViewModel

@Composable
fun LoginScreen(vm: LoginViewModel, onLoggedIn: () -> Unit) {
    val ui by vm.ui.collectAsState()
    var editHub by remember { mutableStateOf(false) }
    val field = RoundedCornerShape(14.dp)
    Column(Modifier.fillMaxSize().background(Dsh.c.bg).statusBarsPadding().imePadding().padding(horizontal = 24.dp)) {
        Box(Modifier.height(56.dp)) {
            if (ui.step == 2) IconButton(onClick = { vm.update { it.copy(step = 1, error = null, totp = "") } }, modifier = Modifier.align(Alignment.CenterStart)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = Dsh.c.ink)
            }
        }
        Spacer(Modifier.height(32.dp))
        Box(Modifier.size(56.dp).clip(RoundedCornerShape(16.dp)).background(Dsh.c.ink), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Computer, null, tint = Dsh.c.bg, modifier = Modifier.size(28.dp))
        }
        Spacer(Modifier.height(20.dp))
        Text(if (ui.step == 1) "登录 DSH 远程" else "两步验证", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Dsh.c.ink)
        Spacer(Modifier.height(6.dp))
        Text(if (ui.step == 1) "在手机上使用你电脑里的 DSH" else "打开验证器 App，输入 ${ui.username.ifBlank { "账号" }} 的 6 位验证码", color = Dsh.c.muted, fontSize = 15.sp)
        Spacer(Modifier.height(32.dp))
        if (ui.step == 1) {
            OutlinedTextField(ui.username, { v -> vm.update { it.copy(username = v) } }, label = { Text("用户名") }, singleLine = true, shape = field, enabled = !ui.loading, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(ui.password, { v -> vm.update { it.copy(password = v) } }, label = { Text("密码") }, singleLine = true, shape = field, enabled = !ui.loading,
                visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(24.dp))
            PrimaryButton(if (ui.loading) "登录中…" else "下一步", { vm.submitPassword {} }, Modifier.fillMaxWidth(), enabled = !ui.loading && ui.username.isNotBlank() && ui.password.isNotBlank())
        } else {
            OtpBoxes(ui.totp, enabled = !ui.loading) { v ->
                vm.update { it.copy(totp = v.filter(Char::isDigit).take(6)) }
                if (v.length == 6) vm.submitTotp(onLoggedIn)
            }
            Spacer(Modifier.height(24.dp))
            PrimaryButton(if (ui.loading) "验证中…" else "登录", { vm.submitTotp(onLoggedIn) }, Modifier.fillMaxWidth(), enabled = !ui.loading && ui.totp.length == 6)
        }
        ui.error?.let {
            Spacer(Modifier.height(14.dp))
            Text(it, color = Dsh.c.danger, fontSize = 14.sp, modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Dsh.c.dangerBg).padding(12.dp))
        }
        Spacer(Modifier.weight(1f))
        if (ui.step == 1) {
            if (editHub) OutlinedTextField(ui.hubBase, { v -> vm.update { it.copy(hubBase = v) } }, label = { Text("Hub 服务器地址") }, singleLine = true, shape = field, modifier = Modifier.fillMaxWidth())
            else Text("服务器：${ui.hubBase.removePrefix("https://")}  ·  修改", color = Dsh.c.muted, fontSize = 13.sp, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().clickable { editHub = true }.padding(12.dp))
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun OtpBoxes(value: String, enabled: Boolean, onChange: (String) -> Unit) {
    BasicTextField(
        value = value, onValueChange = onChange, enabled = enabled,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        textStyle = TextStyle(color = Color.Transparent),
        decorationBox = { inner ->
            Box {
                Box(Modifier.size(1.dp)) { inner() }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    repeat(6) { i ->
                        val ch = value.getOrNull(i)?.toString() ?: ""
                        val focus = i == value.length
                        Box(Modifier.weight(1f).height(56.dp).clip(RoundedCornerShape(12.dp)).background(Dsh.c.card)
                            .border(if (focus) 2.dp else 1.dp, if (focus) Dsh.c.ink else Dsh.c.border, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                            Text(ch, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, color = Dsh.c.ink)
                        }
                    }
                }
            }
        },
        modifier = Modifier.fillMaxWidth(),
    )
    if (!enabled) { Spacer(Modifier.height(12.dp)); CircularProgressIndicator(Modifier.size(18.dp).width(18.dp), strokeWidth = 2.dp, color = Dsh.c.muted) }
}
