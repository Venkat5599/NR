package app.lunar.keyboard.data

import app.lunar.keyboard.core.NearName
import app.lunar.keyboard.core.PayIntent
import app.lunar.keyboard.near.NearClient
import org.json.JSONObject
import java.math.BigDecimal

/**
 * Free-form sentences the on-phone parser can't read ("send bob a fiver for the cab").
 * Only the one sentence is sent, and only when the user taps Pay. The server route
 * asks a model on NEAR AI Cloud for {payee, amount, token, memo}; the card still shows
 * the result for the user to confirm, and the contract still enforces the cap.
 */
class AiParser(private val apiBase: String) {

    sealed class Result {
        data class Parsed(val intent: PayIntent, val model: String) : Result()
        data class NotAPayment(val reason: String) : Result()
        data class Unavailable(val reason: String) : Result()
    }

    val enabled: Boolean get() = apiBase.isNotBlank()

    fun parse(sentence: String): Result {
        if (!enabled) return Result.Unavailable("AI parsing is not set up in this build")
        val raw = try {
            NearClient.post("${apiBase.trimEnd('/')}/api/parse", JSONObject().put("sentence", sentence.take(300)).toString())
        } catch (e: Exception) {
            return Result.Unavailable(e.message ?: "network error")
        }
        return decode(raw, sentence)
    }

    companion object {
        /** Pure; validates everything the model returned before it can become a card. */
        fun decode(raw: String, sentence: String): Result {
            val o = try { JSONObject(raw) } catch (e: Exception) { return Result.Unavailable("bad response") }
            o.optJSONObject("error")?.let { return Result.Unavailable(it.optString("message", "server error")) }
            if (!o.optBoolean("isPayment", false)) return Result.NotAPayment(o.optString("reason", "not a payment"))
            val payee = o.optString("payee").lowercase().removePrefix("@")
            if (!NearName.isValid(payee)) return Result.NotAPayment("no valid NEAR name in the sentence")
            // a bare word like "bob" is a valid top-level name but in a chat it's a first name: only full accounts
            val fullAccount = payee.contains('.') || Regex("^[0-9a-f]{64}$").matches(payee) || Regex("^0x[0-9a-f]{40}$").matches(payee)
            if (!fullAccount) return Result.NotAPayment("type the full NEAR name, e.g. bob.testnet")
            // the model may only pick a name the user actually typed; it never invents or completes one
            if (!Regex("(^|[^a-z0-9._-])@?${Regex.escape(payee)}($|[^a-z0-9._-])").containsMatchIn(sentence.lowercase()))
                return Result.NotAPayment("type the full NEAR name, e.g. bob.testnet")
            val amount = o.optString("amount").toBigDecimalOrNull()?.takeIf { it.signum() > 0 && it < BigDecimal("1000000") }
                ?: return Result.NotAPayment("no amount in the sentence")
            val token = when (o.optString("token", "NEAR").uppercase()) {
                "NEAR" -> "NEAR"; "USDC", "USD" -> "USDC"; "USDT" -> "USDT"
                else -> return Result.NotAPayment("unknown token")
            }
            val memo = o.optString("memo").takeIf { it.isNotBlank() && it != "null" }?.take(80)
            return Result.Parsed(PayIntent(payee, amount.stripTrailingZeros(), token, memo, sentence.length), o.optString("model"))
        }
    }
}
