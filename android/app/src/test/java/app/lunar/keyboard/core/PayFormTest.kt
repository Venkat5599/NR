package app.lunar.keyboard.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class PayFormTest {
    private fun typeAll(f: PayForm, s: String) = s.forEach { f.type(it.toString()) }

    @Test fun a_name_an_amount_and_a_memo_make_a_payment() {
        val f = PayForm()
        typeAll(f, "Bob.Testnet 0.5 dinner out")
        val ok = f.check() as PayForm.Check.Ok
        assertEquals("bob.testnet", ok.intent.payee)
        assertEquals(BigDecimal("0.5"), ok.intent.amount)
        assertEquals("NEAR", ok.intent.token)
        assertEquals("dinner out", ok.intent.memo)
    }

    @Test fun each_field_keeps_only_what_fits_it() {
        val f = PayForm()
        typeAll(f, "@al!ce.test#net")
        assertEquals("alce.testnet", f.to)
        f.next()
        typeAll(f, "1a,2,5")
        assertEquals("1.25", f.amount)
    }

    @Test fun a_comma_or_dot_first_reads_as_zero_point() {
        val f = PayForm()
        f.active = PayForm.Field.AMOUNT
        typeAll(f, ".5")
        assertEquals("0.5", f.amount)
    }

    @Test fun picking_a_currency_on_the_amount_sets_the_token() {
        val f = PayForm()
        f.active = PayForm.Field.AMOUNT
        f.type("5"); f.type("USDC")
        assertEquals("USDC", f.token)
        f.type("$")
        assertEquals("USDC", f.token)
        f.type("NEAR")
        assertEquals("NEAR", f.token)
        assertEquals("5", f.amount)
    }

    @Test fun delete_on_an_empty_field_steps_back() {
        val f = PayForm()
        typeAll(f, "bob.testnet ")
        assertEquals(PayForm.Field.AMOUNT, f.active)
        f.delete()
        assertEquals(PayForm.Field.TO, f.active)
        f.delete()
        assertEquals("bob.testne", f.to)
    }

    @Test fun enter_walks_the_fields_then_asks_to_review() {
        val f = PayForm()
        assertTrue(!f.next()); assertTrue(!f.next()); assertTrue(f.next())
    }

    @Test fun a_bare_first_name_or_no_amount_is_refused_with_the_field_to_fix() {
        val f = PayForm()
        typeAll(f, "bob 5")
        assertEquals(PayForm.Check.Problem(PayForm.Field.TO, "Type the full name, e.g. bob.testnet"), f.check())
        f.reset()
        typeAll(f, "bob.testnet ")
        assertEquals(PayForm.Field.AMOUNT, (f.check() as PayForm.Check.Problem).field)
        f.reset()
        assertEquals(PayForm.Check.Problem(PayForm.Field.TO, "Who are you paying?"), f.check())
    }

    @Test fun a_saved_payee_fills_the_name_and_moves_to_the_amount() {
        val f = PayForm()
        f.choosePayee("lunar-69787.testnet")
        assertEquals(PayForm.Field.AMOUNT, f.active)
        f.type("2")
        assertEquals("lunar-69787.testnet", (f.check() as PayForm.Check.Ok).intent.payee)
    }

    @Test fun the_token_chip_cycles() {
        val f = PayForm()
        f.cycleToken(); assertEquals("USDC", f.token)
        f.cycleToken(); f.cycleToken(); assertEquals("NEAR", f.token)
    }
}
