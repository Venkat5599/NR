package app.lunar.keyboard.data

import android.content.Context
import app.lunar.keyboard.core.Payee
import org.json.JSONArray
import org.json.JSONObject

/** The people this user has paid, kept on the phone only. */
class PayeeStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("payees", Context.MODE_PRIVATE)

    fun all(): List<Payee> {
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).map { arr.getJSONObject(it) }.map { Payee(it.getString("name"), it.getString("address")) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun add(p: Payee) {
        val list = all().filterNot { it.name == p.name } + p
        save(list)
    }

    fun remove(name: String) = save(all().filterNot { it.name == name })

    private fun save(list: List<Payee>) {
        val arr = JSONArray()
        list.forEach { arr.put(JSONObject().put("name", it.name).put("address", it.address)) }
        prefs.edit().putString(KEY, arr.toString()).apply()
    }

    private companion object {
        const val KEY = "list"
    }
}
