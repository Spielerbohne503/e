package com.deadmode.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager

class DeadModeApp : Application() {
    companion object {
        const val CHANNEL_TIMER = "deadmode_timer"
    }

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_TIMER,
                "DeadMode Timer",
                NotificationManager.IMPORTANCE_LOW
            ).apply { setShowBadge(false) }
        )
    }
}
