package app.lunar.keyboard.data

import app.lunar.keyboard.near.NearClient
import org.json.JSONObject
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant

/** Checks done before paying a name. Blocking; call from a background thread. */
object NameCheck {

    sealed class Verdict {
        /** Nothing recent: the account and its keys are older than [RECENT_DAYS]. */
        data class Settled(val ageDays: Long) : Verdict()
        /** A full-access key was added recently: whoever holds the name may have changed. */
        data class KeyChanged(val daysAgo: Long) : Verdict()
        /** The account itself is new. */
        data class NewAccount(val ageDays: Long) : Verdict()
        data class Unknown(val reason: String) : Verdict()
    }

    const val RECENT_DAYS = 7L

    fun check(account: String, now: Instant = Instant.now()): Verdict = try {
        val net = if (account.endsWith(".testnet")) "api-testnet" else "api"
        parse(NearClient.get("https://$net.nearblocks.io/v3/accounts/$account/keys"), now)
    } catch (e: Exception) {
        Verdict.Unknown(e.message ?: e.javaClass.simpleName)
    }

    /** Pure, tested against a recorded response. */
    fun parse(json: String, now: Instant): Verdict {
        val data = JSONObject(json).optJSONArray("data") ?: return Verdict.Unknown("no key data")
        if (data.length() == 0) return Verdict.Unknown("no keys listed")
        var oldest = Long.MAX_VALUE
        var newestFull = Long.MIN_VALUE
        for (i in 0 until data.length()) {
            val k = data.getJSONObject(i)
            val ts = k.optJSONObject("created")?.optJSONObject("block")?.optString("block_timestamp")?.toLongOrNull() ?: continue
            val ms = ts / 1_000_000
            if (ms < oldest) oldest = ms
            val deleted = k.optJSONObject("deleted")?.length() ?: 0
            if (k.optString("permission_kind") == "FULL_ACCESS" && deleted == 0 && ms > newestFull) newestFull = ms
        }
        if (oldest == Long.MAX_VALUE) return Verdict.Unknown("no key timestamps")
        val day = 86_400_000L
        val age = (now.toEpochMilli() - oldest) / day
        if (age < RECENT_DAYS) return Verdict.NewAccount(age)
        if (newestFull != Long.MIN_VALUE && newestFull > oldest + day) {
            val ago = (now.toEpochMilli() - newestFull) / day
            if (ago < RECENT_DAYS) return Verdict.KeyChanged(ago)
        }
        return Verdict.Settled(age)
    }
}

/** A live NEAR Intents price for paying [nearAmount] NEAR into the payee's chosen chain and token. */
object IntentsQuote {
    private const val API = "https://1click.chaindefuser.com/v0"
    private const val WNEAR = "nep141:wrap.near"

    data class Quote(val amountOut: String, val token: String, val chain: String, val seconds: Int)

    fun quote(nearAmount: BigDecimal, chain: String, token: String, recipient: String): Quote? {
        val tokens = org.json.JSONArray(NearClient.get("$API/tokens"))
        var asset: String? = null
        for (i in 0 until tokens.length()) {
            val t = tokens.getJSONObject(i)
            if (t.optString("blockchain").equals(chain, true) && t.optString("symbol").equals(token, true)) {
                asset = t.getString("assetId"); break
            }
        }
        if (asset == null) return null
        val body = JSONObject()
            .put("dry", true).put("swapType", "EXACT_INPUT").put("slippageTolerance", 100)
            .put("originAsset", WNEAR).put("depositType", "ORIGIN_CHAIN")
            .put("destinationAsset", asset).put("amount", NearClient.toYocto(nearAmount).toString())
            .put("refundTo", "lunar.near").put("refundType", "ORIGIN_CHAIN")
            .put("recipient", recipient).put("recipientType", "DESTINATION_CHAIN")
            .put("deadline", Instant.now().plusSeconds(600).toString())
        val res = JSONObject(NearClient.post("$API/quote", body.toString()))
        val q = res.optJSONObject("quote") ?: return null
        val out = BigDecimal(q.getString("amountOutFormatted")).setScale(2, RoundingMode.DOWN).toPlainString()
        return Quote(out, token.uppercase(), chain, q.optInt("timeEstimate", 0))
    }
}
