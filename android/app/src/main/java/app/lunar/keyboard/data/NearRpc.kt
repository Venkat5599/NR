package app.lunar.keyboard.data

import app.lunar.keyboard.core.NearName
import org.json.JSONObject
import java.math.BigDecimal
import java.net.HttpURLConnection
import java.net.URL

/** Reads public NEAR state over JSON-RPC. Sends only the account name it is asked about. */
object NearRpc {
    sealed class Account {
        data class Found(val network: NearName.Network, val balanceNear: BigDecimal) : Account()
        data class Missing(val network: NearName.Network) : Account()
        data class Failed(val reason: String) : Account()
    }

    private val YOCTO = BigDecimal.TEN.pow(24)

    /** Blocking. Call from a background thread. */
    fun viewAccount(id: String): Account {
        val net = NearName.network(id)
        val body = JSONObject()
            .put("jsonrpc", "2.0").put("id", "lunar").put("method", "query")
            .put("params", JSONObject()
                .put("request_type", "view_account")
                .put("finality", "final")
                .put("account_id", id))
        return try {
            val res = post(net.rpc, body.toString())
            parseViewAccount(net, res)
        } catch (e: Exception) {
            Account.Failed(e.message ?: e.javaClass.simpleName)
        }
    }

    /** Pure, so it can be tested against real RPC responses. */
    fun parseViewAccount(net: NearName.Network, json: String): Account {
        val o = JSONObject(json)
        o.optJSONObject("result")?.let { r ->
            val amount = r.optString("amount", "0").toBigDecimalOrNull() ?: BigDecimal.ZERO
            return Account.Found(net, amount.divide(YOCTO))
        }
        val err = o.optJSONObject("error") ?: return Account.Failed("empty response")
        val cause = err.optJSONObject("cause")?.optString("name") ?: ""
        val data = err.optString("data", "")
        return if (cause == "UNKNOWN_ACCOUNT" || data.contains("does not exist")) Account.Missing(net)
        else Account.Failed(cause.ifEmpty { err.optString("message", "error") })
    }

    private fun post(url: String, body: String): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.requestMethod = "POST"
        c.connectTimeout = 8000
        c.readTimeout = 8000
        c.doOutput = true
        c.setRequestProperty("Content-Type", "application/json")
        c.outputStream.use { it.write(body.toByteArray()) }
        val stream = if (c.responseCode in 200..299) c.inputStream else c.errorStream
        return stream.bufferedReader().use { it.readText() }.also { c.disconnect() }
    }
}
