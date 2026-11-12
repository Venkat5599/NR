package app.lunar.keyboard.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class PayParserTest {

    private fun p(s: String?) = PayParser.parse(s)

    @Test fun reads_name_then_amount() {
        val r = p("pay bob.near 20")!!
        assertEquals("bob.near", r.payee)
        assertEquals(BigDecimal("20"), r.amount)
        assertEquals("USDC", r.token)
        assertNull(r.memo)
    }

    @Test fun reads_memo_and_token() {
        val r = p("ok pay bob.near 12.50 usdt for dinner")!!
        assertEquals("bob.near", r.payee)
        assertEquals(BigDecimal("12.5"), r.amount)
        assertEquals("USDT", r.token)
        assertEquals("dinner", r.memo)
    }

    @Test fun reads_amount_then_name() {
        val r = p("send \$5 to alice.testnet")!!
        assertEquals("alice.testnet", r.payee)
        assertEquals(BigDecimal("5"), r.amount)
        assertEquals("USDC", r.token)
    }

    @Test fun reads_near_token_and_comma_decimal() {
        val r = p("pay carol.near 1,5 near")!!
        assertEquals(BigDecimal("1.5"), r.amount)
        assertEquals("NEAR", r.token)
    }

    @Test fun is_case_insensitive_and_lowercases_the_name() {
        assertEquals("bob.near", p("Pay Bob.Near 20")!!.payee)
    }

    @Test fun strips_a_leading_at_sign() {
        assertEquals("bob.near", p("pay @bob.near 3")!!.payee)
    }

    @Test fun only_reads_the_end_of_the_text() {
        assertNull(p("pay bob.near 20 and then something else"))
    }

    @Test fun span_covers_only_the_sentence() {
        val text = "thanks! pay bob.near 20"
        assertEquals("pay bob.near 20".length, p(text)!!.span)
    }

    @Test fun refuses_zero_and_bad_names() {
        assertNull(p("pay bob.near 0"))
        assertNull(p("pay Bob..near 5"))
        assertNull(p("pay b 5"))
        assertNull(p("pay bob.near"))
        assertNull(p(""))
        assertNull(p(null))
    }

    @Test fun accepts_an_eth_implicit_address_as_payee() {
        val addr = "0x" + "a".repeat(40)
        assertEquals(addr, p("pay $addr 2")!!.payee)
    }
}

class NearNameTest {
    @Test fun valid_names() {
        listOf("bob.near", "alice.testnet", "a-b_c.near", "near", "x.y.z.near", "0".repeat(64), "0x" + "f".repeat(40))
            .forEach { assertTrue(it, NearName.isValid(it)) }
    }

    @Test fun invalid_names() {
        listOf("b", "Bob.near", "bob..near", ".near", "bob.", "bob-.near", "a".repeat(65), "bob near")
            .forEach { assertFalse(it, NearName.isValid(it)) }
    }

    @Test fun network_comes_from_the_suffix() {
        assertEquals(NearName.Network.TESTNET, NearName.network("bob.testnet"))
        assertEquals(NearName.Network.MAINNET, NearName.network("bob.near"))
    }
}

class PasteCheckTest {
    private val bob = Payee("bob.near", "0x9f3a58aa2f90c1d2e3f4a5b6c7d8e9f0a1b2b21c")
    private val payees = listOf(bob)

    @Test fun no_address_on_the_clipboard() {
        assertEquals(PasteVerdict.NotAnAddress, PasteCheck.check("hello there", payees))
        assertEquals(PasteVerdict.NotAnAddress, PasteCheck.check(null, payees))
    }

    @Test fun exact_match_is_known_even_with_different_case_and_whitespace() {
        val v = PasteCheck.check("  " + bob.address.uppercase().replace("0X", "0x") + "\n", payees)
        assertTrue(v is PasteVerdict.Known)
    }

    @Test fun same_start_and_end_different_middle_is_a_lookalike() {
        val fake = "0x9f3a" + "e71c0d4b" + "0".repeat(24) + "b21c"
        assertEquals(42, fake.length)
        val v = PasteCheck.check(fake, payees)
        assertTrue(v is PasteVerdict.Lookalike)
        assertEquals(bob, (v as PasteVerdict.Lookalike).payee)
    }

    @Test fun unrelated_address_is_new() {
        val other = "0x1111" + "2".repeat(32) + "3333"
        assertTrue(PasteCheck.check(other, payees) is PasteVerdict.New)
    }

    @Test fun two_addresses_in_one_clip_are_not_read() {
        assertNull(PasteCheck.extract(bob.address + " " + bob.address.replace("9f3a", "1234")))
    }

    @Test fun short_form() {
        assertEquals("0x9f3a…b21c", PasteCheck.short(bob.address))
    }
}

class ShiftStateTest {
    @Test fun single_tap_is_one_capital() {
        val s = ShiftState()
        s.tap(1000)
        assertEquals(ShiftState.Mode.ONCE, s.mode)
        s.afterChar()
        assertEquals(ShiftState.Mode.OFF, s.mode)
    }

    @Test fun double_tap_locks_and_survives_typing() {
        val s = ShiftState()
        s.tap(1000); s.tap(1200)
        assertEquals(ShiftState.Mode.LOCKED, s.mode)
        s.afterChar()
        assertEquals(ShiftState.Mode.LOCKED, s.mode)
        s.setAuto(false)
        assertEquals(ShiftState.Mode.LOCKED, s.mode)
        s.tap(5000)
        assertEquals(ShiftState.Mode.OFF, s.mode)
    }

    @Test fun auto_capital_does_not_undo_a_hand_choice_until_a_letter_is_typed() {
        val s = ShiftState()
        s.setAuto(true)                       // start of a sentence
        s.tap(1000)                           // user turns it off
        s.setAuto(true)                       // a late cursor update must not turn it back on
        assertEquals(ShiftState.Mode.OFF, s.mode)
        s.afterChar()
        s.setAuto(true)                       // next sentence: auto works again
        assertEquals(ShiftState.Mode.ONCE, s.mode)
    }

    @Test fun slow_second_tap_turns_it_off() {
        val s = ShiftState()
        s.tap(1000); s.tap(2000)
        assertEquals(ShiftState.Mode.OFF, s.mode)
    }
}

class GeometryTest {
    @Test fun every_row_fills_the_width() {
        for (page in Page.values()) for (row in Layouts.page(page)) {
            assertEquals("$page row", Layouts.ROW_UNITS, row.sumOf { it.weight.toDouble() }.toFloat(), 0.001f)
        }
    }

    @Test fun hits_the_key_under_the_finger() {
        val boxes = Geometry.layout(Layouts.letters, 1000f, 400f, 0f)
        val q = Geometry.hit(boxes, 50f, 50f)!!
        assertEquals("q", q.key.label)
        val pay = Geometry.hit(boxes, 200f, 350f)!!
        assertEquals(KeyType.PAY, pay.key.type)
    }

    @Test fun a_spacer_touch_goes_to_the_nearest_real_key() {
        val boxes = Geometry.layout(Layouts.letters, 1000f, 400f, 0f)
        val k = Geometry.hit(boxes, 10f, 150f)!!   // left half-key spacer on the a-row
        assertEquals("a", k.key.label)
        val l = Geometry.hit(boxes, 995f, 150f)!!
        assertEquals("l", l.key.label)
    }

    @Test fun every_letter_row_key_has_a_box() {
        val boxes = Geometry.layout(Layouts.letters, 1080f, 900f, 10f)
        assertNotNull(boxes.firstOrNull { it.key.label == "m" })
        assertEquals(26, boxes.count { it.key.type == KeyType.CHAR && it.key.label[0].isLetter() })
    }
}
