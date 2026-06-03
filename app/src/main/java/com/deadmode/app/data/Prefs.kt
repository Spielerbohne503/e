package com.deadmode.app.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object Prefs {
    private const val FILE_NAME = "deadmode_prefs"
    private const val KEY_ACTIVE = "is_active"
    private const val KEY_END_MS = "end_epoch_ms"
    private const val KEY_WIFI_WAS_ON = "wifi_was_on"

    private fun prefs(ctx: Context) = EncryptedSharedPreferences.create(
        ctx.applicationContext,
        FILE_NAME,
        MasterKey.Builder(ctx.applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun setActive(ctx: Context, endEpochMs: Long, wifiWasOn: Boolean) {
        prefs(ctx).edit()
            .putBoolean(KEY_ACTIVE, true)
            .putLong(KEY_END_MS, endEpochMs)
            .putBoolean(KEY_WIFI_WAS_ON, wifiWasOn)
            .apply()
        DevicePrefs.mirror(ctx, active = true, endMs = endEpochMs)
    }

    fun clearActive(ctx: Context) {
        prefs(ctx).edit()
            .putBoolean(KEY_ACTIVE, false)
            .remove(KEY_END_MS)
            .apply()
        DevicePrefs.mirror(ctx, active = false, endMs = 0L)
    }

    fun isActive(ctx: Context): Boolean =
        prefs(ctx).getBoolean(KEY_ACTIVE, false)

    fun endEpochMs(ctx: Context): Long =
        prefs(ctx).getLong(KEY_END_MS, 0L)

    fun wifiWasOn(ctx: Context): Boolean =
        prefs(ctx).getBoolean(KEY_WIFI_WAS_ON, false)

    fun isExpired(ctx: Context): Boolean =
        System.currentTimeMillis() >= endEpochMs(ctx)
}
