package cn.zhuhedong.remote.ui.login

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import cn.zhuhedong.remote.viewmodel.LoginViewModel

@Composable
fun LoginScreen(vm: LoginViewModel, onLoggedIn: () -> Unit) {
    val ui by vm.ui.collectAsState()
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("DSH 远程", style = MaterialTheme.typography.headlineMedium)
        Text("登录 Hub 后管理桌面实例", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = ui.hubBase,
            onValueChange = { v -> vm.update { it.copy(hubBase = v) } },
            label = { Text("Hub 地址") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            enabled = ui.step == 1 && !ui.loading,
        )
        Spacer(Modifier.height(12.dp))
        if (ui.step == 1) {
            OutlinedTextField(
                value = ui.username,
                onValueChange = { v -> vm.update { it.copy(username = v) } },
                label = { Text("用户名") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                enabled = !ui.loading,
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = ui.password,
                onValueChange = { v -> vm.update { it.copy(password = v) } },
                label = { Text("密码") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                enabled = !ui.loading,
            )
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { vm.submitPassword {} },
                enabled = !ui.loading && ui.username.isNotBlank() && ui.password.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) { Text("下一步") }
        } else {
            OutlinedTextField(
                value = ui.totp,
                onValueChange = { v -> vm.update { it.copy(totp = v.filter { ch -> ch.isDigit() }.take(6)) } },
                label = { Text("TOTP 验证码") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                enabled = !ui.loading,
            )
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { vm.submitTotp(onLoggedIn) },
                enabled = !ui.loading && ui.totp.length == 6,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("登录") }
            Button(
                onClick = { vm.update { it.copy(step = 1, error = null, totp = "") } },
                enabled = !ui.loading,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            ) { Text("返回") }
        }
        if (ui.loading) {
            Spacer(Modifier.height(16.dp))
            CircularProgressIndicator()
        }
        ui.error?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MaterialTheme.colorScheme.error)
        }
    }
}
