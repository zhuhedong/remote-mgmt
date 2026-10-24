package cn.zhuhedong.remote

import android.app.Application
import android.util.Log
import cn.zhuhedong.remote.data.HubRepository
import cn.zhuhedong.remote.data.SessionStore

class DshRemoteApp : Application() {
    lateinit var sessionStore: SessionStore
        private set
    lateinit var hub: HubRepository
        private set

    override fun onCreate() {
        super.onCreate()
        // Defensive: never let an uncaught background coroutine kill the process silently
        // without a chance to recover on next launch. Still log for diagnosis.
        val prev = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { t, e ->
            Log.e("DshRemote", "Uncaught in ${t.name}: ${e.javaClass.simpleName}: ${e.message}", e)
            // Network / JSON blips from leftover jobs after Activity death — swallow.
            val soft = e is java.io.IOException ||
                e is org.json.JSONException ||
                (e.message?.contains("standalone coroutine was cancelled", true) == true)
            if (!soft) prev?.uncaughtException(t, e)
        }
        sessionStore = SessionStore(this)
        hub = HubRepository(sessionStore)
    }
}
