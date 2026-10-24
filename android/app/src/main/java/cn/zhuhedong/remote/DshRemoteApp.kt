package cn.zhuhedong.remote

import android.app.Application
import cn.zhuhedong.remote.data.HubRepository
import cn.zhuhedong.remote.data.SessionStore

class DshRemoteApp : Application() {
    lateinit var sessionStore: SessionStore
        private set
    lateinit var hub: HubRepository
        private set

    override fun onCreate() {
        super.onCreate()
        sessionStore = SessionStore(this)
        hub = HubRepository(sessionStore)
    }
}
