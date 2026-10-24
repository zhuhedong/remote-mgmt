package cn.zhuhedong.remote

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import cn.zhuhedong.remote.ui.instances.InstanceListScreen
import cn.zhuhedong.remote.ui.login.LoginScreen
import cn.zhuhedong.remote.ui.theme.DshRemoteTheme
import cn.zhuhedong.remote.ui.workbench.WorkbenchScreen
import cn.zhuhedong.remote.viewmodel.VmFactory

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as DshRemoteApp
        setContent {
            DshRemoteTheme {
                AppNav(app)
            }
        }
    }
}

@Composable
private fun AppNav(app: DshRemoteApp) {
    val nav = rememberNavController()
    val start = remember {
        if (app.hub.isLoggedIn()) "home" else "login"
    }
    NavHost(navController = nav, startDestination = start) {
        composable("login") {
            val vm = viewModel<cn.zhuhedong.remote.viewmodel.LoginViewModel>(factory = VmFactory(app.hub))
            LoginScreen(vm) {
                nav.navigate("home") {
                    popUpTo("login") { inclusive = true }
                }
            }
        }
        composable("home") {
            val vm = viewModel<cn.zhuhedong.remote.viewmodel.ChatViewModel>(factory = VmFactory(app.hub))
            cn.zhuhedong.remote.ui.home.HomeScreen(
                vm = vm,
                username = app.hub.username(),
                onOpenWorkbench = { d -> nav.navigate("workbench/${d.id}?name=${android.net.Uri.encode(d.name)}") },
                onLogout = {
                    Thread { runCatching { app.hub.logout() } }.start()
                    nav.navigate("login") { popUpTo(0) { inclusive = true } }
                },
            )
        }
        composable("instances") {
            val vm = viewModel<cn.zhuhedong.remote.viewmodel.InstancesViewModel>(factory = VmFactory(app.hub))
            InstanceListScreen(
                vm = vm,
                onOpen = { d -> nav.navigate("workbench/${d.id}?name=${android.net.Uri.encode(d.name)}") },
                onLogout = {
                    nav.navigate("login") {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
        composable(
            route = "workbench/{id}?name={name}",
            arguments = listOf(
                navArgument("id") { type = NavType.StringType },
                navArgument("name") { type = NavType.StringType; defaultValue = "工作台" },
            ),
        ) { entry ->
            val id = entry.arguments?.getString("id")!!
            val name = entry.arguments?.getString("name") ?: "工作台"
            val vm = viewModel<cn.zhuhedong.remote.viewmodel.WorkbenchViewModel>(
                factory = VmFactory(app.hub, id),
                key = id,
            )
            WorkbenchScreen(title = name, vm = vm, onBack = { nav.popBackStack() })
        }
    }
}
