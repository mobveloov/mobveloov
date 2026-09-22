package com.veloov.totem

import android.content.Context
import java.util.UUID

object DeviceId {

    private const val PREFS_NAME = "veloov_totem"
    private const val KEY_DEVICE_UUID = "device_uuid"
    private const val KEY_SLUG = "company_slug"
    private const val KEY_CONFIGURED = "is_configured"

    fun getDeviceId(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existing = prefs.getString(KEY_DEVICE_UUID, null)
        if (existing != null) return existing

        val uuid = "native-" + UUID.randomUUID().toString().replace("-", "")
        prefs.edit().putString(KEY_DEVICE_UUID, uuid).apply()
        return uuid
    }

    fun getSlug(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_SLUG, null)
    }

    fun saveSlug(context: Context, slug: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SLUG, slug)
            .putBoolean(KEY_CONFIGURED, true)
            .apply()
    }

    fun isConfigured(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_CONFIGURED, false) && !prefs.getString(KEY_SLUG, null).isNullOrBlank()
    }

    fun clearConfig(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_SLUG)
            .putBoolean(KEY_CONFIGURED, false)
            .apply()
    }
}
