package app.lunar.keyboard.data

import android.content.Context
import org.json.JSONArray

/** Names this phone paid recently, newest first. Shown as one-tap chips in the keyboard. */
class RecentStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("recent", Context.MODE_PRIVATE)

    fun all(): List<String> {
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        return runCatching { JSONArray(raw).let { a -> (0 until a.length()).map { a.getString(it) } } }.getOrDefault(emptyList())
    }

    fun add(name: String) {
        val list = (listOf(name) + all().filterNot { it == name }).take(MAX)
        prefs.edit().putString(KEY, JSONArray(list).toString()).apply()
    }

    private companion object {
        const val KEY = "names"
        const val MAX = 6
    }
}
