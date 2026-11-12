package app.lunar.keyboard.near

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.math.BigInteger

/**
 * Runs against the real testnet contract with the same signing code the keyboard uses.
 * Skipped unless LUNAR_LIVE=1. Needs LUNAR_CONTRACT and LUNAR_WALLET (a testnet account whose
 * full-access key is in ~/.near-credentials/testnet/<account>.json, outside the repo).
 *
 *   LUNAR_LIVE=1 LUNAR_CONTRACT=lunarpay-0111.testnet LUNAR_WALLET=lunar-69787.testnet \
 *     ./gradlew testDebugUnitTest --tests '*LiveTestnetTest*'
 */
class LiveTestnetTest {
    private val live = System.getenv("LUNAR_LIVE") == "1"
    private val contract = System.getenv("LUNAR_CONTRACT") ?: ""
    private val walletId = System.getenv("LUNAR_WALLET") ?: ""
    private val near = NearClient()
    private val oneNear = NearClient.YOCTO_PER_NEAR

    private fun walletKey(): KeyPair {
        val f = File(System.getProperty("user.home"), ".near-credentials/testnet/$walletId.json")
        return KeyPair.fromSecret(JSONObject(f.readText()).getString("private_key"))
    }

    @Test
    fun keyboard_key_pays_within_the_cap_and_the_contract_refuses_the_rest() {
        assumeTrue(live && contract.isNotEmpty() && walletId.isNotEmpty())
        val wallet = walletKey()
        val keyboard = KeyPair.random()
        val payee = "lunar-payee-${System.currentTimeMillis() % 1_000_000}.testnet"
        assertTrue(NearClient.createTestnetAccount(payee, KeyPair.random().publicKeyString))
        Thread.sleep(3000)

        // wallet: add the keyboard key, scoped to `pay` on the contract
        val add = near.send(walletId, wallet, walletId, listOf(
            Action.AddFunctionCallKey(keyboard.publicKey, oneNear.divide(BigInteger.valueOf(4)), contract, listOf("pay"))))
        assertTrue("add key: ${add.failure}", add.ok)
        println("add keyboard key: https://testnet.nearblocks.io/txns/${add.hash}")

        // wallet: top up 1 NEAR and set the cap to 0.5 NEAR
        val setup = near.send(walletId, wallet, contract, listOf(
            NearClient.functionCall("deposit", JSONObject(), deposit = oneNear),
            NearClient.functionCall("set_daily_cap", JSONObject().put("cap", oneNear.divide(BigInteger.TWO).toString()), deposit = BigInteger.ONE)))
        assertTrue("setup: ${setup.failure}", setup.ok)
        println("deposit + cap: https://testnet.nearblocks.io/txns/${setup.hash}")

        val before = JSONObject(near.view(contract, "get_pocket", JSONObject().put("account", walletId)))
        val leftBefore = BigInteger(before.getString("left_today"))
        val amount = leftBefore.min(oneNear.divide(BigInteger.valueOf(5)))
        assertTrue("nothing left today to test with", amount.signum() > 0)

        val payeeBefore = near.balance(payee)!!

        // keyboard: pay within the cap
        val paid = near.send(walletId, keyboard, contract, listOf(NearClient.functionCall("pay",
            JSONObject().put("to", payee).put("amount", amount.toString()).put("memo", "live test"))))
        assertEquals("\"Sent\"", paid.successValue)
        assertTrue(paid.logs.any { it.contains("\"event\":\"pay\"") })
        println("keyboard pays ${NearClient.toNear(amount)} NEAR: https://testnet.nearblocks.io/txns/${paid.hash}")
        Thread.sleep(2000)
        assertEquals(amount, near.balance(payee)!!.subtract(payeeBefore))

        // keyboard: a payment that crosses the cap is refused by the contract
        val over = near.send(walletId, keyboard, contract, listOf(NearClient.functionCall("pay",
            JSONObject().put("to", payee).put("amount", oneNear.toString()))))
        assertEquals("\"RefusedOverCap\"", over.successValue)
        println("over the cap, refused: https://testnet.nearblocks.io/txns/${over.hash}")

        // keyboard key can't raise the cap: NEAR rejects a deposit from a function-call key
        val raise = runCatching { near.send(walletId, keyboard, contract, listOf(NearClient.functionCall("set_daily_cap",
            JSONObject().put("cap", oneNear.multiply(BigInteger.valueOf(100)).toString()), deposit = BigInteger.ONE))) }
        assertTrue("raising the cap must fail", raise.isFailure || raise.getOrNull()?.ok == false)
        println("keyboard key raising the cap: ${raise.exceptionOrNull()?.message ?: raise.getOrNull()?.failure}")

        // keyboard key can't call any other method or contract
        val other = runCatching { near.send(walletId, keyboard, payee, listOf(NearClient.functionCall("anything", JSONObject()))) }
        assertTrue("calling another contract must fail", other.isFailure || other.getOrNull()?.ok == false)
        println("keyboard key calling another account: ${other.exceptionOrNull()?.message ?: other.getOrNull()?.failure}")
        val withdraw = runCatching { near.send(walletId, keyboard, contract, listOf(NearClient.functionCall("withdraw",
            JSONObject().put("amount", "1")))) }
        assertTrue("withdraw with the keyboard key must fail", withdraw.isFailure || withdraw.getOrNull()?.ok == false)
        println("keyboard key calling withdraw: ${withdraw.exceptionOrNull()?.message ?: withdraw.getOrNull()?.failure}")
        assertFalse(paid.hash.isEmpty())
    }
}
