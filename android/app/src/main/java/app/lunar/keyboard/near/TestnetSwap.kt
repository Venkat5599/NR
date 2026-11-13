package app.lunar.keyboard.near

import org.json.JSONArray
import org.json.JSONObject
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode

/**
 * A real swap on NEAR testnet through Ref Finance: NEAR is wrapped and sold into a pool for
 * the testnet USDC or USDT token, and the output lands in the user's account. Only the wallet
 * key signs it (in the app); the keyboard's key can only call `pay`, so it can quote a swap
 * but never run one.
 *
 * Testnet pools hold test tokens, so their rate is not the market rate; the market price is
 * shown next to it from [app.lunar.keyboard.data.Prices].
 */
class TestnetSwap(private val near: NearClient) {

    data class Route(val symbol: String, val token: String, val pool: Int, val decimals: Int)
    data class Quote(val route: Route, val amountIn: BigDecimal, val out: BigDecimal, val minOut: BigInteger)
    data class Swapped(val txHashes: List<String>, val received: BigDecimal?)

    fun quote(amountNear: BigDecimal, symbol: String): Quote {
        val route = route(symbol)
        val args = JSONObject().put("pool_id", route.pool).put("token_in", WRAP)
            .put("amount_in", NearClient.toYocto(amountNear).toString()).put("token_out", route.token)
        val raw = parseU128(near.view(REF, "get_return", args))
        return Quote(route, amountNear, fromUnits(raw, route.decimals), minOut(raw))
    }

    /** Registers the account where needed, wraps, swaps; returns every transaction sent. */
    fun swap(account: String, walletKey: KeyPair, q: Quote): Swapped {
        val hashes = ArrayList<String>()
        if (!registered(q.route.token, account)) {
            hashes += near.send(account, walletKey, q.route.token, listOf(storageDeposit(account))).also { it.ensureOk() }.hash
        }
        val before = balance(q.route.token, account, q.route.decimals)
        val actions = buildList {
            if (!registered(WRAP, account)) add(storageDeposit(account))
            addAll(wrapAndSwap(q))
        }
        hashes += near.send(account, walletKey, WRAP, actions).also { it.ensureOk() }.hash
        val after = runCatching { balance(q.route.token, account, q.route.decimals) }.getOrNull()
        return Swapped(hashes, if (after != null && before != null) after.subtract(before) else null)
    }

    fun balance(token: String, account: String, decimals: Int): BigDecimal? = runCatching {
        fromUnits(parseU128(near.view(token, "ft_balance_of", JSONObject().put("account_id", account))), decimals)
    }.getOrNull()

    private fun registered(token: String, account: String): Boolean =
        near.view(token, "storage_balance_of", JSONObject().put("account_id", account)).trim() != "null"

    private fun NearClient.TxOutcome.ensureOk() {
        if (failure != null) throw NearClient.RpcException("swap failed: $failure")
    }

    companion object {
        const val REF = "ref-finance-101.testnet"
        const val WRAP = "wrap.testnet"
        val ROUTES = listOf(
            Route("USDC", "usdc.itachicara.testnet", 1103, 24),
            Route("USDT", "usdt.itachicara.testnet", 1084, 24),
        )
        /** 1% below the quote: the swap fails rather than fill at a worse price. */
        private val SLIPPAGE_BPS = 100L
        private val STORAGE = BigInteger("12500000000000000000000") // 0.0125 NEAR

        fun route(symbol: String) = ROUTES.firstOrNull { it.symbol == symbol.uppercase() }
            ?: throw NearClient.RpcException("no testnet pool for $symbol")

        fun parseU128(viewResult: String): BigInteger = BigInteger(viewResult.trim().trim('"'))

        fun fromUnits(v: BigInteger, decimals: Int): BigDecimal =
            BigDecimal(v).movePointLeft(decimals).setScale(4, RoundingMode.DOWN).stripTrailingZeros()

        fun minOut(quoted: BigInteger): BigInteger = quoted * BigInteger.valueOf(10_000 - SLIPPAGE_BPS) / BigInteger.valueOf(10_000)

        fun storageDeposit(account: String) = NearClient.functionCall(
            "storage_deposit", JSONObject().put("account_id", account).put("registration_only", true), 30, STORAGE)

        /** Pure: wrap the NEAR, then hand it to Ref with one swap action and a minimum out. */
        fun wrapAndSwap(q: Quote): List<Action> {
            val amount = NearClient.toYocto(q.amountIn).toString()
            val swap = JSONObject().put("force", 0).put("actions", JSONArray().put(JSONObject()
                .put("pool_id", q.route.pool).put("token_in", WRAP).put("token_out", q.route.token)
                .put("amount_in", amount).put("min_amount_out", q.minOut.toString())))
            return listOf(
                NearClient.functionCall("near_deposit", JSONObject(), 10, NearClient.toYocto(q.amountIn)),
                NearClient.functionCall("ft_transfer_call", JSONObject().put("receiver_id", REF).put("amount", amount)
                    .put("msg", swap.toString()), 180, BigInteger.ONE),
            )
        }
    }
}
