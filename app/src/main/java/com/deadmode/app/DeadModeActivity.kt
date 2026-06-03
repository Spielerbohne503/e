package com.deadmode.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import com.deadmode.app.data.Prefs
import com.deadmode.app.databinding.ActivityDeadModeBinding
import java.util.concurrent.TimeUnit

class DeadModeActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDeadModeBinding
    private val unlockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            finish()
        }
    }
    private val tickRunnable = object : Runnable {
        override fun run() {
            updateCountdown()
            binding.root.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )

        if (!Prefs.isActive(this) || Prefs.isExpired(this)) {
            finish()
            return
        }

        binding = ActivityDeadModeBinding.inflate(layoutInflater)
        setContentView(binding.root)

        registerReceiver(unlockReceiver, IntentFilter("com.deadmode.app.UNLOCK"),
            RECEIVER_NOT_EXPORTED)
        binding.root.post(tickRunnable)
    }

    override fun onDestroy() {
        super.onDestroy()
        binding.root.removeCallbacks(tickRunnable)
        runCatching { unregisterReceiver(unlockReceiver) }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { /* locked */ }

    private fun updateCountdown() {
        val remaining = Prefs.endEpochMs(this) - System.currentTimeMillis()
        if (remaining <= 0) {
            finish()
            return
        }
        val hours = TimeUnit.MILLISECONDS.toHours(remaining)
        val minutes = TimeUnit.MILLISECONDS.toMinutes(remaining) % 60
        val seconds = TimeUnit.MILLISECONDS.toSeconds(remaining) % 60
        binding.tvCountdown.text = String.format("%02d:%02d:%02d", hours, minutes, seconds)
    }
}
