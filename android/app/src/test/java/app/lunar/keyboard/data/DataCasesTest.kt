package app.lunar.keyboard.data

import app.lunar.keyboard.near.Action
import app.lunar.keyboard.near.LunarPay
import app.lunar.keyboard.near.NearClient
import app.lunar.keyboard.near.TestnetSwap
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import java.math.BigDecimal
import java.math.BigInteger

/** What the server's model answer becomes on the phone. Every answer is validated before it can be a card. */
@RunWith(Parameterized::class)
class AiDecodeCasesTest(private val label: String, private val raw: String, private val sentence: String, private val want: String) {
    @Test fun validates_the_model_answer() {
        val got = when (val r = AiParser.decode(raw, sentence)) {
            is AiParser.Result.Parsed -> "parsed ${r.intent.payee} ${r.intent.amount.toPlainString()} ${r.intent.token} ${r.intent.memo} ${r.model}"
            is AiParser.Result.NotAPayment -> "no"
            is AiParser.Result.Unavailable -> "unavailable ${r.reason}"
        }
        assertEquals(want, got)
        if (got.startsWith("parsed")) assertEquals(sentence.length, (AiParser.decode(raw, sentence) as AiParser.Result.Parsed).intent.span)
    }

    companion object {
        private fun pay(payee: String, amount: String = "5", token: String? = "NEAR", memo: String? = null) = JSONObject()
            .put("isPayment", true).put("payee", payee).put("amount", amount).put("model", "m1")
            .also { o -> token?.let { o.put("token", it) }; memo?.let { o.put("memo", it) } }.toString()

        private val hex64 = "ab".repeat(32)
        private val eth = "0x" + "cd".repeat(20)

        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> = listOf(
            arrayOf<Any>("plain", pay("bob.near"), "send bob.near 5", "parsed bob.near 5 NEAR null m1"),
            arrayOf<Any>("at and case", pay("@Bob.Near"), "send @bob.near a fiver", "parsed bob.near 5 NEAR null m1"),
            arrayOf<Any>("typed in caps", pay("bob.near"), "Send BOB.NEAR five", "parsed bob.near 5 NEAR null m1"),
            arrayOf<Any>("bare first name", pay("bob"), "send bob a fiver", "no"),
            arrayOf<Any>("completed name", pay("bob.near"), "send bob a fiver", "no"),
            arrayOf<Any>("name inside a longer word", pay("bob.near"), "send bob.nearby 5", "no"),
            arrayOf<Any>("suffix of a typed name", pay("ob.near"), "send bob.near 5", "no"),
            arrayOf<Any>("invalid name", pay("bob..near"), "send bob..near 5", "no"),
            arrayOf<Any>("implicit account", pay(hex64), "pay $hex64 5", "parsed $hex64 5 NEAR null m1"),
            arrayOf<Any>("eth implicit", pay(eth), "pay $eth 5", "parsed $eth 5 NEAR null m1"),
            arrayOf<Any>("name at sentence end", pay("carol.testnet", "2.50"), "two fifty to carol.testnet", "parsed carol.testnet 2.5 NEAR null m1"),
            arrayOf<Any>("name followed by punctuation", pay("carol.testnet"), "send 5 to carol.testnet!", "parsed carol.testnet 5 NEAR null m1"),
            arrayOf<Any>("zero", pay("bob.near", "0"), "send bob.near nothing", "no"),
            arrayOf<Any>("negative", pay("bob.near", "-5"), "send bob.near -5", "no"),
            arrayOf<Any>("not a number", pay("bob.near", "five"), "send bob.near five", "no"),
            arrayOf<Any>("a million", pay("bob.near", "1000000"), "send bob.near a million", "no"),
            arrayOf<Any>("just under a million", pay("bob.near", "999999.99"), "send bob.near lots", "parsed bob.near 999999.99 NEAR null m1"),
            arrayOf<Any>("trailing zeros", pay("bob.near", "20.000"), "bob.near 20", "parsed bob.near 20 NEAR null m1"),
            arrayOf<Any>("usd means usdc", pay("bob.near", token = "usd"), "bob.near 5 bucks", "parsed bob.near 5 USDC null m1"),
            arrayOf<Any>("usdc", pay("bob.near", token = "USDC"), "bob.near 5 usdc", "parsed bob.near 5 USDC null m1"),
            arrayOf<Any>("usdt", pay("bob.near", token = "usdt"), "bob.near 5 tether", "parsed bob.near 5 USDT null m1"),
            arrayOf<Any>("unknown token", pay("bob.near", token = "ETH"), "bob.near 5 eth", "no"),
            arrayOf<Any>("no token means near", pay("bob.near", token = null), "bob.near 5", "parsed bob.near 5 NEAR null m1"),
            arrayOf<Any>("memo", pay("bob.near", memo = "cab"), "bob.near 5 for the cab", "parsed bob.near 5 NEAR cab m1"),
            arrayOf<Any>("memo null string", pay("bob.near", memo = "null"), "bob.near 5", "parsed bob.near 5 NEAR null m1"),
            arrayOf<Any>("blank memo", pay("bob.near", memo = "   "), "bob.near 5", "parsed bob.near 5 NEAR null m1"),
            arrayOf<Any>("long memo cut to 80", pay("bob.near", memo = "m".repeat(100)), "bob.near 5", "parsed bob.near 5 NEAR ${"m".repeat(80)} m1"),
            arrayOf<Any>("model says no", """{"isPayment":false,"reason":"just chatting"}""", "lol", "no"),
            arrayOf<Any>("missing flag", """{"payee":"bob.near","amount":"5"}""", "bob.near 5", "no"),
            arrayOf<Any>("server error", """{"error":{"message":"rate limited"}}""", "bob.near 5", "unavailable rate limited"),
            arrayOf<Any>("server error without message", """{"error":{}}""", "bob.near 5", "unavailable server error"),
            arrayOf<Any>("not json", "<html>502</html>", "bob.near 5", "unavailable bad response"),
            arrayOf<Any>("empty body", "", "bob.near 5", "unavailable bad response"),
        )
    }
}

class AiParserDisabledTest {
    @Test fun no_server_means_unavailable_without_any_request() {
        val p = AiParser("  ")
        assertEquals(false, p.enabled)
        assertTrue(p.parse("send bob.near 5") is AiParser.Result.Unavailable)
    }
}

@RunWith(Parameterized::class)
class PriceFormatCasesTest(private val amount: String, private val symbol: String, private val want: String?) {
    @Test fun shows_dollars() {
        val prices = mapOf("NEAR" to BigDecimal("3.39"), "USDC" to BigDecimal("1.0001"), "BTC" to BigDecimal("97000.5"), "ETH" to BigDecimal("1.999"))
        assertEquals(want, Prices.usd(BigDecimal(amount), symbol, prices))
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0} {1}")
        fun data(): List<Array<Any?>> = listOf(
            arrayOf<Any?>("1", "NEAR", "$3.39"), arrayOf<Any?>("2", "near", "$6.78"), arrayOf<Any?>("0.1", "NEAR", "$0.339"),
            arrayOf<Any?>("0.0001", "NEAR", "$0.000"), arrayOf<Any?>("1000", "NEAR", "$3390.00"), arrayOf<Any?>("10", "USDC", "$10.00"),
            arrayOf<Any?>("0.5", "ETH", "$1.000"), arrayOf<Any?>("0.4", "ETH", "$0.800"), arrayOf<Any?>("0.001", "BTC", "$97.00"),
            arrayOf<Any?>("1", "SOL", null), arrayOf<Any?>("1", "usdt", null), arrayOf<Any?>("0", "NEAR", "$0.000"),
        )
    }
}

@RunWith(Parameterized::class)
class PriceShowCasesTest(private val price: String, private val want: String) {
    @Test fun rounds_for_display() = assertEquals(want, Prices.show(BigDecimal(price)))

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> = listOf(
            "3.385" to "3.39", "3.384" to "3.38", "97000.5" to "97001", "999.999" to "1000.00", "1000" to "1000", "0.999" to "1.00",
            "0.0012" to "0.00", "1.0001" to "1.00", "65432.1" to "65432", "12" to "12.00",
        ).map { arrayOf<Any>(it.first, it.second) }
    }
}

@RunWith(Parameterized::class)
class PriceListCasesTest(private val label: String, private val json: String, private val want: Map<String, String>) {
    @Test fun one_price_per_symbol() {
        assertEquals(want, Prices.parse(json).mapValues { it.value.toPlainString() })
    }

    companion object {
        private fun t(sym: String, chain: String, price: Any?) =
            JSONObject().put("symbol", sym).put("blockchain", chain).also { o -> price?.let { o.put("price", it) } }.toString()

        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> = listOf(
            arrayOf<Any>("empty", "[]", emptyMap<String, String>()),
            arrayOf<Any>("wNEAR is NEAR", "[${t("wNEAR", "near", "3.39")}]", mapOf("NEAR" to "3.39")),
            arrayOf<Any>("NEAR listing wins over another chain", "[${t("USDC", "eth", "0.9998")},${t("USDC", "near", "1.0001")}]", mapOf("USDC" to "1.0001")),
            arrayOf<Any>("falls back to another chain", "[${t("ETH", "eth", "3500.12")},${t("ETH", "arb", "3499")}]", mapOf("ETH" to "3500.12")),
            arrayOf<Any>("first NEAR listing wins", "[${t("USDT", "near", "1")},${t("USDT", "near", "0.5")}]", mapOf("USDT" to "1")),
            arrayOf<Any>("no price is skipped", "[${t("BTC", "near", null)},${t("BTC", "btc", "97000")}]", mapOf("BTC" to "97000")),
            arrayOf<Any>("unknown symbols ignored", "[${t("DOGE", "near", "0.1")},${t("NEAR", "near", "9")}]", emptyMap<String, String>()),
            arrayOf<Any>("all six", "[" + listOf("wNEAR", "USDC", "USDT", "ETH", "BTC", "SOL").joinToString(",") { t(it, "near", "2") } + "]",
                mapOf("NEAR" to "2", "USDC" to "2", "USDT" to "2", "ETH" to "2", "BTC" to "2", "SOL" to "2")),
            arrayOf<Any>("numeric price", "[{\"symbol\":\"SOL\",\"blockchain\":\"sol\",\"price\":150.25}]", mapOf("SOL" to "150.25")),
        )
    }
}

@RunWith(Parameterized::class)
class SwapUnitsCasesTest(private val raw: String, private val decimals: Int, private val want: String) {
    @Test fun shows_four_decimals_rounded_down() = assertEquals(want, TestnetSwap.fromUnits(BigInteger(raw), decimals).toPlainString())

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0} / 10^{1}")
        fun data(): List<Array<Any>> = listOf(
            Triple("1000000000000000000000000", 24, "1"), Triple("1234567000000000000000000", 24, "1.2345"), Triple("5", 6, "0"),
            Triple("123456789", 6, "123.4567"), Triple("1000000000000000000000000000000", 24, "1000000"), Triple("0", 24, "0"),
            Triple("99999", 4, "9.9999"), Triple("999999", 6, "0.9999"), Triple("100", 2, "1"), Triple("1", 0, "1"),
            Triple("12345", 0, "12345"), Triple("50000000000000000000000", 24, "0.05"),
        ).map { arrayOf<Any>(it.first, it.second, it.third) }
    }
}

@RunWith(Parameterized::class)
class SwapMinOutCasesTest(private val quoted: String, private val want: String) {
    @Test fun allows_one_percent_slippage() = assertEquals(BigInteger(want), TestnetSwap.minOut(BigInteger(quoted)))

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> = listOf(
            "10000" to "9900", "1" to "0", "101" to "99", "0" to "0", "100" to "99",
            "1000000000000000000000000" to "990000000000000000000000", "123456789" to "122222221",
        ).map { arrayOf<Any>(it.first, it.second) }
    }
}

/** The two actions of a swap carry the amount, the pool and the minimum out exactly. */
@RunWith(Parameterized::class)
class SwapActionsCasesTest(private val amount: String, private val symbol: String) {
    @Test fun wraps_then_swaps() {
        val route = TestnetSwap.route(symbol)
        val q = TestnetSwap.Quote(route, BigDecimal(amount), BigDecimal.ONE, BigInteger("777"))
        val actions = TestnetSwap.wrapAndSwap(q)
        assertEquals(2, actions.size)
        val wrap = actions[0] as Action.FunctionCall
        val swap = actions[1] as Action.FunctionCall
        val yocto = NearClient.toYocto(BigDecimal(amount))
        assertEquals("near_deposit", wrap.method)
        assertEquals(yocto, wrap.deposit)
        assertEquals(10 * NearClient.TGAS, wrap.gas)
        assertEquals("ft_transfer_call", swap.method)
        assertEquals(BigInteger.ONE, swap.deposit)
        assertEquals(180 * NearClient.TGAS, swap.gas)
        val args = JSONObject(String(swap.args))
        assertEquals(TestnetSwap.REF, args.getString("receiver_id"))
        assertEquals(yocto.toString(), args.getString("amount"))
        val step = JSONObject(args.getString("msg")).getJSONArray("actions").getJSONObject(0)
        assertEquals(route.pool, step.getInt("pool_id"))
        assertEquals(TestnetSwap.WRAP, step.getString("token_in"))
        assertEquals(route.token, step.getString("token_out"))
        assertEquals(yocto.toString(), step.getString("amount_in"))
        assertEquals("777", step.getString("min_amount_out"))
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0} NEAR to {1}")
        fun data(): List<Array<Any>> = listOf("0.1", "1", "2.5", "10", "0.000000000000000000000001").flatMap { a ->
            listOf("USDC", "usdt").map { arrayOf<Any>(a, it) }
        }
    }
}

class SwapRouteTest {
    @Test fun routes_and_view_results() {
        assertEquals(1103, TestnetSwap.route("usdc").pool)
        assertEquals(1084, TestnetSwap.route("USDT").pool)
        assertThrows(NearClient.RpcException::class.java) { TestnetSwap.route("ETH") }
        assertEquals(BigInteger("123"), TestnetSwap.parseU128("\"123\""))
        assertEquals(BigInteger("5"), TestnetSwap.parseU128(" \"5\" \n"))
    }
}

@RunWith(Parameterized::class)
class PayResultCasesTest(private val value: String?, private val want: LunarPay.PayResult?) {
    @Test fun reads_the_contract_answer() {
        if (want == null) assertThrows(NearClient.RpcException::class.java) { LunarPay.parseResult(value) }
        else assertEquals(want, LunarPay.parseResult(value))
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any?>> = listOf(
            arrayOf<Any?>("\"Sent\"", LunarPay.PayResult.SENT), arrayOf<Any?>("Sent", LunarPay.PayResult.SENT),
            arrayOf<Any?>("\"RefusedOverCap\"", LunarPay.PayResult.REFUSED_OVER_CAP),
            arrayOf<Any?>("\"RefusedLowBalance\"", LunarPay.PayResult.REFUSED_LOW_BALANCE),
            arrayOf<Any?>("\"sent\"", null), arrayOf<Any?>("", null), arrayOf<Any?>(null, null), arrayOf<Any?>("{\"Sent\":1}", null),
        )
    }
}

@RunWith(Parameterized::class)
class AccessKeyNonceCasesTest(private val json: String, private val want: Long?, private val fails: Boolean) {
    @Test fun reads_the_nonce() {
        if (fails) assertThrows(NearClient.RpcException::class.java) { NearClient.parseAccessKeyNonce(JSONObject(json)) }
        else assertEquals(want, NearClient.parseAccessKeyNonce(JSONObject(json)))
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any?>> = listOf(
            arrayOf<Any?>("""{"nonce":5,"permission":"FullAccess"}""", 5L, false),
            arrayOf<Any?>("""{"nonce":190000000000001}""", 190000000000001L, false),
            arrayOf<Any?>("""{"nonce":0}""", 0L, false),
            arrayOf<Any?>("""{"error":"access key ed25519:abc does not exist while viewing"}""", null, false),
            arrayOf<Any?>("""{"error":"something else"}""", null, true),
            arrayOf<Any?>("""{}""", null, true),
        )
    }
}
