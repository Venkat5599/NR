package app.lunar.keyboard.data

import app.lunar.keyboard.core.NearName
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

/** Parses responses recorded from rpc.mainnet.near.org (test/resources). */
class NearRpcTest {
    private fun res(name: String) = javaClass.classLoader!!.getResource(name)!!.readText()

    @Test fun an_existing_account_is_found_with_its_balance() {
        val a = NearRpc.parseViewAccount(NearName.Network.MAINNET, res("view_account_found.json"))
        assertTrue(a is NearRpc.Account.Found)
        assertTrue((a as NearRpc.Account.Found).balanceNear > BigDecimal.ZERO)
    }

    @Test fun an_unknown_account_is_missing() {
        val a = NearRpc.parseViewAccount(NearName.Network.MAINNET, res("view_account_missing.json"))
        assertEquals(NearRpc.Account.Missing(NearName.Network.MAINNET), a)
    }

    @Test fun any_other_error_is_a_failure_not_a_missing_account() {
        val a = NearRpc.parseViewAccount(NearName.Network.MAINNET,
            """{"jsonrpc":"2.0","error":{"name":"HANDLER_ERROR","cause":{"name":"TIMEOUT_ERROR"},"message":"Server error"},"id":"x"}""")
        assertTrue(a is NearRpc.Account.Failed)
    }
}

class AiParserTest {
    @Test fun a_valid_answer_becomes_a_card_intent() {
        val r = AiParser.decode("""{"isPayment":true,"payee":"Bob.testnet","amount":"5","token":"near","memo":"cab","model":"m"}""", "send Bob.testnet five near for the cab")
        assertTrue(r is AiParser.Result.Parsed)
        val i = (r as AiParser.Result.Parsed).intent
        assertEquals("bob.testnet", i.payee); assertEquals(BigDecimal("5"), i.amount); assertEquals("NEAR", i.token); assertEquals("cab", i.memo)
    }

    @Test fun a_made_up_name_or_amount_is_refused() {
        val s = "send bob.testnet a fiver"
        assertTrue(AiParser.decode("""{"isPayment":true,"payee":"bob.testnet","amount":"-5"}""", s) is AiParser.Result.NotAPayment)
        assertTrue(AiParser.decode("""{"isPayment":true,"payee":"bob.testnet","amount":"5","token":"DOGE"}""", s) is AiParser.Result.NotAPayment)
    }

    @Test fun the_model_cannot_pick_a_name_the_user_did_not_type() {
        // "bob" alone is a valid top-level NEAR name, but in a chat it's a first name: never a payee
        assertTrue(AiParser.decode("""{"isPayment":true,"payee":"bob","amount":"5"}""", "send bob a fiver") is AiParser.Result.NotAPayment)
        assertTrue(AiParser.decode("""{"isPayment":true,"payee":"attacker.near","amount":"5"}""", "send bob a fiver") is AiParser.Result.NotAPayment)
        assertTrue(AiParser.decode("""{"isPayment":true,"payee":"bob.near","amount":"5"}""", "send bob a fiver") is AiParser.Result.NotAPayment)
    }

    @Test fun not_a_payment_and_server_errors_are_told_apart() {
        assertTrue(AiParser.decode("""{"isPayment":false,"reason":"a greeting"}""", "x") is AiParser.Result.NotAPayment)
        assertTrue(AiParser.decode("""{"error":{"code":"upstream","message":"model down"}}""", "x") is AiParser.Result.Unavailable)
        assertTrue(AiParser.decode("<html>", "x") is AiParser.Result.Unavailable)
    }

    @Test fun no_server_configured_means_disabled() {
        assertTrue(AiParser("").parse("send bob a fiver") is AiParser.Result.Unavailable)
    }
}
