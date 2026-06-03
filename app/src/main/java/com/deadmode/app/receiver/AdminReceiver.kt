package com.deadmode.app.receiver

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import com.deadmode.app.R
import com.deadmode.app.service.TimerService

class AdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {}

    override fun onDisabled(context: Context, intent: Intent) {
        TimerService.unlock(context)
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence =
        context.getString(R.string.admin_disable_warning)
}
