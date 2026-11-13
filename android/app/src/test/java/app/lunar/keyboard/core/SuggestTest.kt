package app.lunar.keyboard.core

import app.lunar.keyboard.data.Prices
import app.lunar.keyboard.near.NearClient
import app.lunar.keyboard.near.TestnetSwap
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.math.BigDecimal
import java.math.BigInteger

private fun fixture(name: String) = File("src/test/resources/$name").readText()

class SuggestTest {
    private val words = File("src/main/assets/words_en.txt").readLines().filter { it.isNotBlank() }
    private val s = Suggest(words)

    @Test fun completes_by_frequency() {
        val the = s.words("the")
        assertEquals("the", the[0])                              // the word itself first
        assertTrue(the.drop(1).all { it.startsWith("the") })      // then the commonest longer words
        assertTrue(s.words("tom").first().startsWith("tom"))
    }

    @Test fun a_real_word_stays_first_so_a_tap_never_changes_it() {
        assertEquals("near", s.words("near").first())
    }

    @Test fun fixes_one_slip_when_nothing_starts_with_it() {
        assertTrue(s.words("tommorow").isEmpty() || s.words("tommorow").first() == "tomorrow")
        assertTrue("because" in s.words("becuase"))
        assertTrue("dinner" in s.words("dinnr"))
    }

    @Test fun keeps_the_case_it_was_typed_in() {
        assertEquals("Dinner", s.words("Dinn").first())
        assertEquals("I", s.words("i").first())
        assertEquals("I'm", s.words("i'm").first())
        assertEquals("I'm", s.words("im").first())          // the missing apostrophe comes back
        assertEquals("Don't", s.words("Dont").first())
    }

    @Test fun reads_the_word_before_the_cursor() {
        assertEquals("dinn", Suggest.currentWord("pay bob for dinn"))
        assertEquals("", Suggest.currentWord("pay bob "))
        assertEquals("don't", Suggest.currentWord("I don't"))
    }

    @Test fun the_list_is_clean_and_big_enough() {
        assertEquals(20000, words.size)
        assertTrue(words.none { it.contains(' ') || it.any(Char::isUpperCase) })
    }
}

class SmartChipsTest {
    private val near = BigDecimal("3.39")
    private val prices = mapOf("NEAR" to near, "BTC" to BigDecimal("71866"))

    @Test fun a_typed_name_offers_to_pay_it_with_the_amount() {
        val chips = SmartChips.read("sure, sending to alice.testnet 2.5 now", near)
        assertEquals(SmartChips.Chip.PayName("alice.testnet", BigDecimal("2.5")), chips.first())
    }

    @Test fun money_talk_offers_pay() {
        assertEquals(listOf(SmartChips.Chip.PayIntent(null)), SmartChips.read("i owe you for lunch", near))
        assertEquals(listOf(SmartChips.Chip.PayIntent(BigDecimal("3"))), SmartChips.read("ill send 3 near tonight", near))
    }

    @Test fun dollars_convert_at_the_live_price() {
        val c = SmartChips.read("it was \$20 each", near).single() as SmartChips.Chip.Convert
        assertEquals(BigDecimal("5.9"), c.near)
        assertEquals("\$20 ≈ 5.9 NEAR", c.label)
        assertTrue(SmartChips.read("it was \$20 each", null).isEmpty())   // no price, no made-up number
    }

    @Test fun swap_talk_offers_a_swap() {
        assertEquals(SmartChips.Chip.Swap(BigDecimal("2"), "USDT"), SmartChips.read("can you swap 2 near to usdt", near).single())
    }

    @Test fun asking_the_price_offers_it() {
        assertEquals(SmartChips.Chip.Price("BTC", BigDecimal("71866")), SmartChips.read("what's the btc price today", near, prices).single())
    }

    @Test fun ordinary_chat_offers_nothing() {
        assertTrue(SmartChips.read("see you at 8, near the station", near).isEmpty())
        assertTrue(SmartChips.read("", near).isEmpty())
    }
}

class PricesTest {
    @Test fun reads_one_price_per_symbol_from_the_intents_token_list() {
        val p = Prices.parse(fixture("oneclick_tokens.json"))
        assertTrue(p.keys.containsAll(listOf("NEAR", "USDC", "USDT", "ETH", "BTC", "SOL")))
        assertTrue(p.getValue("NEAR") > BigDecimal.ZERO)
        assertTrue(p.getValue("USDC") > BigDecimal("0.9") && p.getValue("USDC") < BigDecimal("1.1"))
    }

    @Test fun formats_dollars() {
        val p = mapOf("NEAR" to BigDecimal("3.39"))
        assertEquals("\$6.78", Prices.usd(BigDecimal("2"), "NEAR", p))
        assertEquals("\$0.339", Prices.usd(BigDecimal("0.1"), "near", p))
        assertNull(Prices.usd(BigDecimal("2"), "XYZ", p))
        assertEquals("71866", Prices.show(BigDecimal("71866.4")))
    }
}

class TestnetSwapTest {
    @Test fun reads_the_pool_quote_recorded_from_ref_finance() {
        val r = JSONObject(fixture("ref_get_return.json")).getJSONObject("result").getJSONArray("result")
        val text = String(ByteArray(r.length()) { r.getInt(it).toByte() })
        val raw = TestnetSwap.parseU128(text)
        assertTrue(TestnetSwap.fromUnits(raw, 24) > BigDecimal.ZERO)
        assertEquals(raw * BigInteger.valueOf(99) / BigInteger.valueOf(100), TestnetSwap.minOut(raw))
    }

    @Test fun builds_wrap_then_swap_with_a_minimum_out() {
        val q = TestnetSwap.Quote(TestnetSwap.route("usdc"), BigDecimal("0.2"), BigDecimal("0.42"), BigInteger("415000000000000000000000"))
        val a = TestnetSwap.wrapAndSwap(q)
        val wrap = a[0] as app.lunar.keyboard.near.Action.FunctionCall
        val swap = a[1] as app.lunar.keyboard.near.Action.FunctionCall
        assertEquals("near_deposit", wrap.method)
        assertEquals(NearClient.toYocto(BigDecimal("0.2")), wrap.deposit)
        assertEquals("ft_transfer_call", swap.method)
        assertEquals(BigInteger.ONE, swap.deposit)
        val msg = JSONObject(JSONObject(String(swap.args)).getString("msg")).getJSONArray("actions").getJSONObject(0)
        assertEquals(1103, msg.getInt("pool_id"))
        assertEquals("415000000000000000000000", msg.getString("min_amount_out"))
        assertEquals("usdc.itachicara.testnet", msg.getString("token_out"))
    }

    @Test fun the_recorded_swap_succeeded_on_testnet() {
        val res = JSONObject(fixture("tx_swap.json")).getJSONObject("result")
        val out = NearClient.parseOutcome("49eTFCGiPsmZyywqvjYVHGdeYBuJ8eCNoQHE9EMZVTxV", res)
        assertTrue(out.ok)
    }
}
