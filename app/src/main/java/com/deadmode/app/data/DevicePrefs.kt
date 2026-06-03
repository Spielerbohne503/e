package com.deadmode.app.data

import android.content.Context

/** Plain prefs in device-protected storage — readable before credential unlock after reboot. */
object DevicePrefs {
    private const val FILE = "dp_deadmode"
    private const val KEY_ACTIVE = "active"
    private const val KEY_END_MS = "end_ms"

    private fun prefs(ctx: Context) =
        ctx.createDeviceProtectedStorageContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun mirror(ctx: Context, active: Boolean, endMs: Long) =
        prefs(ctx).edit()
            .putBoolean(KEY_ACTIVE, active)
            .putLong(KEY_END_MS, endMs)
            .apply()

    fun isActive(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_ACTIVE, false)
    fun endEpochMs(ctx: Context): Long = prefs(ctx).getLong(KEY_END_MS, 0L)
    fun isExpired(ctx: Context): Boolean = System.currentTimeMillis() >= endEpochMs(ctx)
}
