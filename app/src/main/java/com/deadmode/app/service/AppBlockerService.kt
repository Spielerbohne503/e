package com.deadmode.app.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import com.deadmode.app.DeadModeActivity
import com.deadmode.app.data.Prefs

class AppBlockerService : AccessibilityService() {

    companion object {
        private val WHITELIST = setOf(
            "com.android.phone",
            "com.android.dialer",
            "com.android.contacts",
            "com.google.android.dialer",
            "com.google.android.contacts",
            "com.samsung.android.dialer",
            "com.samsung.android.contacts",
            "com.deadmode.app"
        )
    }

    override fun onServiceConnected() {
        serviceInfo = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            notificationTimeout = 100
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        if (!Prefs.isActive(this)) return
        if (Prefs.isExpired(this)) return

        val pkg = event.packageName?.toString() ?: return
        if (pkg in WHITELIST) return

        startActivity(
            Intent(this, DeadModeActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_NO_ANIMATION
                )
            }
        )
    }

    override fun onInterrupt() {}
}
