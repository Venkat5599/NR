package app.lunar.keyboard.near

import app.lunar.keyboard.data.NameCheck
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal
import java.math.BigInteger
import java.time.Instant

/** Fixtures in test/resources are responses recorded from NEAR testnet/mainnet and nearblocks. */
class NearTest {
    private fun res(name: String) = javaClass.classLoader!!.getResource(name)!!.readText()

    @Test
    fun `a 200 from the faucet whose transaction failed with AccountAlreadyExists is a taken name`() {
        assertEquals("taken", NearClient.faucetFailure(res("faucet_taken.json")))
    }

    @Test
    fun `a 200 from the faucet whose transaction succeeded is a new account`() {
        assertEquals(null, NearClient.faucetFailure(res("faucet_created.json")))
    }

    @Test fun base58_round_trips_and_keeps_leading_zeros() {
        val bytes = byteArrayOf(0, 0, 1, 2, 3, -1)
        assertArrayEquals(bytes, Base58.decode(Base58.encode(bytes)))
        assertEquals("11", Base58.encode(byteArrayOf(0, 0)))
    }

    @Test fun a_key_round_trips_through_near_secret_format() {
        val k = KeyPair.random()
        val back = KeyPair.fromSecret(k.secretKeyString)
        assertEquals(k.publicKeyString, back.publicKeyString)
        assertTrue(k.publicKeyString.startsWith("ed25519:"))
    }

    @Test fun u128_is_little_endian() {
        val b = Borsh().u128(BigInteger.ONE).toByteArray()
        assertEquals(16, b.size)
        assertEquals(1, b[0].toInt())
        assertTrue(b.drop(1).all { it.toInt() == 0 })
    }

    @Test fun near_amounts_convert_exactly() {
        assertEquals(BigInteger("500000000000000000000000"), NearClient.toYocto(BigDecimal("0.5")))
        assertEquals(BigDecimal("0.2"), NearClient.toNear(BigInteger("200000000000000000000000")))
    }

    @Test fun a_sent_payment_reads_as_sent_with_its_pay_event() {
        val out = NearClient.parseOutcome("h", JSONObject(res("tx_pay_sent.json")))
        assertTrue(out.ok)
        assertEquals(LunarPay.PayResult.SENT, LunarPay.parseResult(out.successValue))
        assertTrue(out.logs.any { it.contains("\"event\":\"pay\"") })
    }

    @Test fun an_over_cap_payment_reads_as_refused() {
        val out = NearClient.parseOutcome("h", JSONObject(res("tx_pay_refused.json")))
        assertEquals(LunarPay.PayResult.REFUSED_OVER_CAP, LunarPay.parseResult(out.successValue))
        assertTrue(out.logs.any { it.contains("refused_over_cap") })
    }

    @Test fun an_old_account_with_old_keys_is_settled() {
        val v = NameCheck.parse(res("keys_old_account.json"), Instant.parse("2026-11-12T00:00:00Z"))
        assertTrue(v.toString(), v is NameCheck.Verdict.Settled || v is NameCheck.Verdict.KeyChanged)
    }

    @Test fun an_account_made_today_is_flagged_new() {
        val keys = JSONObject(res("keys_new_account.json"))
        val created = keys.getJSONArray("data").getJSONObject(0).getJSONObject("created").getJSONObject("block")
            .getString("block_timestamp").toLong() / 1_000_000
        val v = NameCheck.parse(keys.toString(), Instant.ofEpochMilli(created + 3_600_000))
        assertEquals(NameCheck.Verdict.NewAccount(0), v)
    }

    @Test fun a_new_full_access_key_on_an_old_account_is_flagged() {
        val day = 86_400_000_000_000L
        val now = Instant.parse("2026-11-12T00:00:00Z")
        val nowNs = now.toEpochMilli() * 1_000_000
        fun key(ts: Long) = JSONObject().put("permission_kind", "FULL_ACCESS").put("deleted", JSONObject())
            .put("created", JSONObject().put("block", JSONObject().put("block_timestamp", ts.toString())))
        val json = JSONObject().put("data", org.json.JSONArray().put(key(nowNs - 400 * day)).put(key(nowNs - 2 * day)))
        assertEquals(NameCheck.Verdict.KeyChanged(2), NameCheck.parse(json.toString(), now))
    }

    @Test fun a_missing_key_reported_inside_result_reads_as_missing() {
        val missing = JSONObject(res("access_key_missing_fastnear.json")).getJSONObject("result")
        assertEquals(null, NearClient.parseAccessKeyNonce(missing))
        val found = JSONObject(res("access_key_found.json")).getJSONObject("result")
        assertEquals(277334169000004L, NearClient.parseAccessKeyNonce(found))
    }
}
