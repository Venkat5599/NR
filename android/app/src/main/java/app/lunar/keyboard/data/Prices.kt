package app.lunar.keyboard.data

import app.lunar.keyboard.near.NearClient
import org.json.JSONArray
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Live USD prices from NEAR Intents' public token list (the same service that quotes the
 * cross-chain leg). Cached for a minute; a failed read keeps the last good prices.
 */
object Prices {
    private const val URL = "https://1click.chaindefuser.com/v0/tokens"
    private const val TTL_MS = 60_000L

    @Volatile private var cache: Map<String, BigDecimal> = emptyMap()
    @Volatile private var readAt = 0L

    /** Symbol to USD: NEAR, USDC, USDT, ETH, BTC, SOL. Empty if never reached. */
    fun all(): Map<String, BigDecimal> {
        if (System.currentTimeMillis() - readAt > TTL_MS) refresh()
        return cache
    }

    /** What's cached, without touching the network (for the UI thread). */
    fun cached(): Map<String, BigDecimal> = cache

    fun refresh() {
        runCatching { parse(NearClient.get(URL)) }.getOrNull()?.takeIf { it.isNotEmpty() }?.let {
            cache = it
            readAt = System.currentTimeMillis()
        }
    }

    /** Pure: the token list to one price per symbol, preferring the NEAR-native listing. */
    fun parse(json: String): Map<String, BigDecimal> {
        val arr = JSONArray(json)
        val out = HashMap<String, BigDecimal>()
        val wanted = mapOf("wNEAR" to "NEAR", "USDC" to "USDC", "USDT" to "USDT", "ETH" to "ETH", "BTC" to "BTC", "SOL" to "SOL")
        for (pass in 0..1) for (i in 0 until arr.length()) {
            val t = arr.getJSONObject(i)
            val sym = wanted[t.optString("symbol")] ?: continue
            if (pass == 0 && t.optString("blockchain") != "near") continue
            if (out.containsKey(sym) || !t.has("price")) continue
            out[sym] = BigDecimal(t.get("price").toString())
        }
        return out
    }

    /** "$6.78" for an amount of [symbol], or null without a price. */
    fun usd(amount: BigDecimal, symbol: String, prices: Map<String, BigDecimal> = cache): String? {
        val p = prices[symbol.uppercase()] ?: return null
        val v = amount.multiply(p)
        return "$" + (if (v < BigDecimal.ONE) v.setScale(3, RoundingMode.HALF_UP) else v.setScale(2, RoundingMode.HALF_UP)).toPlainString()
    }

    /** "$3.39" for a price. */
    fun show(price: BigDecimal): String =
        (if (price >= BigDecimal(1000)) price.setScale(0, RoundingMode.HALF_UP) else price.setScale(2, RoundingMode.HALF_UP)).toPlainString()
}
