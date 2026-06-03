package com.deadmode.app.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.deadmode.app.data.DevicePrefs
import com.deadmode.app.service.TimerService

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != "android.intent.action.LOCKED_BOOT_COMPLETED") return

        if (!DevicePrefs.isActive(context)) return

        if (DevicePrefs.isExpired(context)) {
            TimerService.unlock(context)
            return
        }

        val remainingMs = DevicePrefs.endEpochMs(context) - System.currentTimeMillis()
        TimerService.start(context, remainingMs)
    }
}
