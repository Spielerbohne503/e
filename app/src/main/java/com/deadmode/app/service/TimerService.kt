package com.deadmode.app.service

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import com.deadmode.app.DeadModeActivity
import com.deadmode.app.DeadModeApp
import com.deadmode.app.R
import com.deadmode.app.data.Prefs
import com.deadmode.app.receiver.AdminReceiver
import com.deadmode.app.receiver.AlarmReceiver

class TimerService : LifecycleService() {

    companion object {
        private const val EXTRA_DURATION_MS = "duration_ms"
        private const val EXTRA_ACTION = "action"
        private const val ACTION_UNLOCK = "UNLOCK"
        private const val ALARM_REQUEST_CODE = 7777
        private const val NOTIF_ID = 1

        fun start(context: Context, durationMs: Long) {
            val intent = Intent(context, TimerService::class.java)
                .putExtra(EXTRA_DURATION_MS, durationMs)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun unlock(context: Context) {
            val intent = Intent(context, TimerService::class.java)
                .putExtra(EXTRA_ACTION, ACTION_UNLOCK)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)

        if (intent?.getStringExtra(EXTRA_ACTION) == ACTION_UNLOCK) {
            startForeground(NOTIF_ID, buildNotification())
            performUnlock()
            return START_NOT_STICKY
        }

        val durationMs = intent?.getLongExtra(EXTRA_DURATION_MS, 0L) ?: 0L
        if (durationMs > 0) activateDeadMode(durationMs)
        return START_STICKY
    }

    private fun activateDeadMode(durationMs: Long) {
        val endMs = System.currentTimeMillis() + durationMs

        val wm = applicationContext.getSystemService(WifiManager::class.java)
        val wifiWasOn = wm.isWifiEnabled
        Prefs.setActive(applicationContext, endMs, wifiWasOn)

        startForeground(NOTIF_ID, buildNotification())

        @Suppress("DEPRECATION")
        wm.isWifiEnabled = false

        BlockingVpnService.start(applicationContext)
        enableDnD()

        startActivity(
            Intent(applicationContext, DeadModeActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            }
        )

        scheduleUnlockAlarm(endMs)
    }

    private fun scheduleUnlockAlarm(endEpochMs: Long) {
        val am = getSystemService(AlarmManager::class.java)
        val pi = PendingIntent.getBroadcast(
            applicationContext,
            ALARM_REQUEST_CODE,
            Intent(applicationContext, AlarmReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endEpochMs, pi)
    }

    private fun enableDnD() {
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.isNotificationPolicyAccessGranted)
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE)
    }

    private fun disableDnD() {
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.isNotificationPolicyAccessGranted)
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
    }

    private fun performUnlock() {
        val wm = applicationContext.getSystemService(WifiManager::class.java)
        if (Prefs.wifiWasOn(applicationContext)) {
            @Suppress("DEPRECATION")
            wm.isWifiEnabled = true
        }
        BlockingVpnService.stop(applicationContext)
        disableDnD()
        Prefs.clearActive(applicationContext)
        revokeDeviceAdmin()
        sendBroadcast(Intent("com.deadmode.app.UNLOCK"))
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun revokeDeviceAdmin() {
        val dpm = getSystemService(DevicePolicyManager::class.java)
        val admin = ComponentName(this, AdminReceiver::class.java)
        if (dpm.isAdminActive(admin)) dpm.removeActiveAdmin(admin)
    }

    private fun buildNotification() =
        NotificationCompat.Builder(this, DeadModeApp.CHANNEL_TIMER)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .build()
}
