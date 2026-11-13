package app.lunar.keyboard.ui

import android.content.Context
import android.content.res.Configuration

/** Every colour the keyboard and the app draw with, for one appearance. */
data class Palette(
    val dark: Boolean,
    val board: Int,
    val key: Int,
    val keyMod: Int,
    val keyPressed: Int,
    val keyShadow: Int,
    val text: Int,
    val textMuted: Int,
    val textFaint: Int,
    val accent: Int,
    val onAccent: Int,
    val popup: Int,
    val popupSelected: Int,
    val page: Int,
    val card: Int,
    val field: Int,
    val line: Int,
    val ok: Int,
    val warn: Int,
    val danger: Int,
) {
    companion object {
        val LIGHT = Palette(
            dark = false,
            board = 0xFFEDEEF2.toInt(),
            key = 0xFFFFFFFF.toInt(),
            keyMod = 0xFFD5D8DF.toInt(),
            keyPressed = 0xFFC3C7D0.toInt(),
            keyShadow = 0x1F000000,
            text = 0xFF0E0F12.toInt(),
            textMuted = 0x990E0F12.toInt(),
            textFaint = 0x590E0F12,
            accent = 0xFF0A0A0B.toInt(),
            onAccent = 0xFFFFFFFF.toInt(),
            popup = 0xFFFFFFFF.toInt(),
            popupSelected = 0xFF0A0A0B.toInt(),
            page = 0xFFF7F7F8.toInt(),
            card = 0xFFFFFFFF.toInt(),
            field = 0xFFF0F1F4.toInt(),
            line = 0x140E0F12,
            ok = 0xFF16A06A.toInt(),
            warn = 0xFFD99A00.toInt(),
            danger = 0xFFC2362F.toInt(),
        )

        val DARK = Palette(
            dark = true,
            board = 0xFF111215.toInt(),
            key = 0xFF2A2C31.toInt(),
            keyMod = 0xFF1D1F23.toInt(),
            keyPressed = 0xFF3D4047.toInt(),
            keyShadow = 0x66000000,
            text = 0xFFF3F4F6.toInt(),
            textMuted = 0xA6F3F4F6.toInt(),
            textFaint = 0x66F3F4F6,
            accent = 0xFFF3F4F6.toInt(),
            onAccent = 0xFF0A0A0B.toInt(),
            popup = 0xFF35373D.toInt(),
            popupSelected = 0xFFF3F4F6.toInt(),
            page = 0xFF0B0C0E.toInt(),
            card = 0xFF17181C.toInt(),
            field = 0xFF222429.toInt(),
            line = 0x1FFFFFFF,
            ok = 0xFF34D399.toInt(),
            warn = 0xFFF5B83D.toInt(),
            danger = 0xFFF87171.toInt(),
        )

        /** The user's choice in the app (system, light or dark); "system" follows the phone. */
        fun of(context: Context): Palette = when (Appearance.get(context)) {
            Appearance.LIGHT -> LIGHT
            Appearance.DARK -> DARK
            Appearance.SYSTEM -> {
                val night = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
                if (night == Configuration.UI_MODE_NIGHT_YES) DARK else LIGHT
            }
        }
    }
}

enum class Appearance {
    SYSTEM, LIGHT, DARK;

    companion object {
        private const val PREFS = "appearance"

        fun get(context: Context): Appearance =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("mode", null)
                ?.let { runCatching { valueOf(it) }.getOrNull() } ?: SYSTEM

        fun set(context: Context, mode: Appearance) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("mode", mode.name).apply()
        }
    }
}
