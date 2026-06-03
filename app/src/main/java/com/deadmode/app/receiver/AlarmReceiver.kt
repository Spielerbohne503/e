package com.deadmode.app.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.deadmode.app.service.TimerService

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        TimerService.unlock(context)
    }
}
