package app.lunar.keyboard.near

import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import java.io.ByteArrayOutputStream
import java.io.File
import java.math.BigDecimal
import java.math.BigInteger
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.util.Random

private fun unhex(s: String): ByteArray = ByteArray(s.length / 2) { s.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
private fun sha256(b: ByteArray) = MessageDigest.getInstance("SHA-256").digest(b)

private fun verify(pub: ByteArray, msg: ByteArray, sig: ByteArray): Boolean {
    val v = Ed25519Signer()
    v.init(false, Ed25519PublicKeyParameters(pub, 0))
    v.update(msg, 0, msg.size)
    return v.verifySignature(sig)
}

/** RFC 8032 section 7.1 vectors, read from a copy of the RFC text in the test resources. */
@RunWith(Parameterized::class)
class Ed25519Rfc8032CasesTest(private val name: String, private val check: String, private val v: List<String>) {
    private val seed get() = unhex(v[0])
    private val pub get() = unhex(v[1])
    private val msg get() = if (v[2] == "-") ByteArray(0) else unhex(v[2])
    private val sig get() = unhex(v[3])

    @Test fun vector() {
        val key = KeyPair(seed)
        when (check) {
            "public key" -> {
                assertArrayEquals(pub, key.publicKey)
                assertEquals("ed25519:" + Base58.encode(pub), key.publicKeyString)
            }
            "signature" -> assertArrayEquals(sig, key.sign(msg))
            "verifies" -> {
                assertTrue(verify(pub, msg, sig))
                val bad = sig.copyOf().also { it[0] = (it[0].toInt() xor 1).toByte() }
                assertFalse(verify(pub, msg, bad))
            }
            "secret round trip" -> {
                val back = KeyPair.fromSecret(key.secretKeyString)
                assertArrayEquals(pub, back.publicKey)
                assertEquals(64, Base58.decode(key.secretKeyString.removePrefix("ed25519:")).size)
                assertArrayEquals(pub, KeyPair.fromSecret("ed25519:" + Base58.encode(seed)).publicKey)
            }
        }
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0} {1}")
        fun data(): List<Array<Any>> = File("src/test/resources/rfc8032_ed25519.txt").readLines()
            .filter { it.isNotBlank() && !it.startsWith("#") }
            .map { it.split(" ") }
            .flatMap { p -> listOf("public key", "signature", "verifies", "secret round trip").map { arrayOf<Any>(p[0], it, p.drop(1)) } }
    }
}

/** Sign/verify over many keys and messages: each signature verifies, is deterministic and binds the exact message. */
@RunWith(Parameterized::class)
class Ed25519SignVerifyCasesTest(private val i: Int) {
    @Test fun signs_and_verifies() {
        val rnd = Random(i.toLong())
        val key = KeyPair(sha256("lunar-key-$i".toByteArray()))
        val msg = ByteArray((i * 37) % 300).also { rnd.nextBytes(it) }
        val sig = key.sign(msg)
        assertEquals(64, sig.size)
        assertTrue(verify(key.publicKey, msg, sig))
        assertArrayEquals("deterministic", sig, key.sign(msg))
        val tampered = if (msg.isEmpty()) byteArrayOf(0) else msg.copyOf().also { val k = rnd.nextInt(it.size); it[k] = (it[k].toInt() xor 1).toByte() }
        assertFalse(verify(key.publicKey, tampered, sig))
        val other = KeyPair(sha256("other-$i".toByteArray()))
        assertFalse("another key's public key rejects it", verify(other.publicKey, msg, sig))
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "message {0}")
        fun data(): List<Array<Any>> = (0 until 200).map { arrayOf<Any>(it) }
    }
}

class KeyPairRulesTest {
    @Test fun rejects_wrong_seed_and_secret_lengths() {
        assertThrows(IllegalArgumentException::class.java) { KeyPair(ByteArray(31)) }
        assertThrows(IllegalArgumentException::class.java) { KeyPair(ByteArray(33)) }
        assertThrows(IllegalArgumentException::class.java) { KeyPair.fromSecret("ed25519:" + Base58.encode(ByteArray(48) { 1 })) }
    }
}

/**
 * Transactions laid out by hand from nearcore's Borsh schema, compared byte for byte with
 * [Transaction.serialize], then signed and checked.
 */
@RunWith(Parameterized::class)
class TransactionLayoutCasesTest(private val i: Int, private val kind: String) {
    private class W {
        val out = ByteArrayOutputStream()
        fun le(v: Long, n: Int) = apply { val b = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).putLong(v).array(); out.write(b, 0, n) }
        fun u128(v: BigInteger) = apply { val be = v.toByteArray().dropWhile { it.toInt() == 0 }; out.write(ByteArray(16) { if (it < be.size) be[be.size - 1 - it] else 0 }) }
        fun str(s: String) = apply { val b = s.toByteArray(); le(b.size.toLong(), 4); out.write(b) }
        fun raw(b: ByteArray) = apply { out.write(b) }
    }

    @Test fun serializes_and_signs() {
        val key = KeyPair(sha256("tx-$i".toByteArray()))
        val signer = listOf("bob.testnet", "lunar-69787.testnet", "a".repeat(64), "alice.near")[i % 4]
        val receiver = listOf("lunarpay-0111.testnet", "wrap.testnet", "carol.near")[i % 3]
        val nonce = 1_000_000L * i + 7
        val block = sha256("block-$i".toByteArray())
        val deposit = BigInteger.TEN.pow(i % 25).multiply(BigInteger.valueOf(i + 1L))
        val action: Action
        val actionBytes = W()
        when (kind) {
            "transfer" -> {
                action = Action.Transfer(deposit)
                actionBytes.raw(byteArrayOf(3)).u128(deposit)
            }
            "call" -> {
                val args = """{"to":"carol.near","amount":"$deposit"}""".toByteArray()
                action = Action.FunctionCall("pay", args, 30 * NearClient.TGAS, BigInteger.ONE)
                actionBytes.raw(byteArrayOf(2)).str("pay").le(args.size.toLong(), 4).raw(args).le(30 * NearClient.TGAS, 8).u128(BigInteger.ONE)
            }
            else -> {
                val pk = KeyPair(sha256("kb-$i".toByteArray())).publicKey
                val allowance = if (i % 2 == 0) null else BigInteger("250000000000000000000000")
                action = Action.AddFunctionCallKey(pk, allowance, receiver, listOf("pay"))
                actionBytes.raw(byteArrayOf(5, 0)).raw(pk).le(0, 8).raw(byteArrayOf(0))
                if (allowance == null) actionBytes.raw(byteArrayOf(0)) else actionBytes.raw(byteArrayOf(1)).u128(allowance)
                actionBytes.str(receiver).le(1, 4).str("pay")
            }
        }
        val want = W().str(signer).raw(byteArrayOf(0)).raw(key.publicKey).le(nonce, 8).str(receiver).raw(block).le(1, 4)
            .raw(actionBytes.out.toByteArray()).out.toByteArray()
        val tx = Transaction(signer, key.publicKey, nonce, receiver, block, listOf(action))
        assertArrayEquals(want, tx.serialize())

        val (signed, hash) = tx.sign(key)
        assertArrayEquals(sha256(want), hash)
        assertEquals(want.size + 1 + 64, signed.size)
        assertArrayEquals(want, signed.copyOfRange(0, want.size))
        assertEquals(0, signed[want.size].toInt())
        assertTrue(verify(key.publicKey, hash, signed.copyOfRange(want.size + 1, signed.size)))
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{1} {0}")
        fun data(): List<Array<Any>> = (0 until 20).flatMap { i -> listOf("transfer", "call", "key").map { arrayOf<Any>(i, it) } }
    }
}

/** NEAR to yocto (10^24) and back, from hand-written values. */
@RunWith(Parameterized::class)
class YoctoCasesTest(private val near: String, private val yocto: String, private val plain: String) {
    @Test fun converts_both_ways() {
        assertEquals(BigInteger(yocto), NearClient.toYocto(BigDecimal(near)))
        assertEquals(plain, NearClient.toNear(BigInteger(yocto)).toPlainString())
        assertEquals(0, BigDecimal(near).compareTo(NearClient.toNear(BigInteger(yocto))))
    }

    companion object {
        private const val Z = "000000000000000000000000"

        @JvmStatic @Parameterized.Parameters(name = "{0} NEAR")
        fun data(): List<Array<Any>> {
            val fixed = listOf(
                Triple("0", "0", "0"), Triple("1", "1$Z", "1"), Triple("2", "2$Z", "2"), Triple("10", "10$Z", "10"),
                Triple("0.1", "1" + Z.drop(1), "0.1"), Triple("0.5", "5" + Z.drop(1), "0.5"), Triple("0.25", "25" + Z.drop(2), "0.25"),
                Triple("0.0125", "125" + Z.drop(4), "0.0125"), Triple("1.5", "15" + Z.drop(1), "1.5"), Triple("12.50", "125" + Z.drop(1), "12.5"),
                Triple("3", "3$Z", "3"), Triple("0.000000000000000000000001", "1", "0.000000000000000000000001"),
                Triple("0.000000000000000000000010", "10", "0.00000000000000000000001"), Triple("1000000", "1000000$Z", "1000000"),
                Triple("999999999.999999999999999999999999", "999999999" + "9".repeat(24), "999999999.999999999999999999999999"),
                Triple("0.000001", "1" + Z.drop(6), "0.000001"), Triple("3.39", "339" + Z.drop(2), "3.39"), Triple("100", "100$Z", "100"),
                Triple("007", "7$Z", "7"), Triple("1.000000000000000000000001", "1" + "0".repeat(23) + "1", "1.000000000000000000000001"),
            )
            val rnd = Random(24)
            val generated = (0 until 60).map {
                val whole = rnd.nextInt(1_000_000)
                val fracDigits = rnd.nextInt(25)
                val frac = (1..fracDigits).joinToString("") { rnd.nextInt(10).toString() }
                val near = if (fracDigits == 0) "$whole" else "$whole.$frac"
                val y = (whole.toString() + frac.padEnd(24, '0')).trimStart('0').ifEmpty { "0" }
                val f = frac.trimEnd('0')
                Triple(near, y, if (f.isEmpty()) "$whole" else "$whole.$f")
            }
            return (fixed + generated).distinctBy { it.first }.map { arrayOf<Any>(it.first, it.second, it.third) }
        }
    }
}

@RunWith(Parameterized::class)
class YoctoRejectCasesTest(private val near: String) {
    @Test fun refuses_amounts_finer_than_one_yocto() {
        assertThrows(ArithmeticException::class.java) { NearClient.toYocto(BigDecimal(near)) }
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> = listOf(
            "0.0000000000000000000000001", "1.0000000000000000000000001", "0.00000000000000000000000015",
            "123.4567890123456789012345678", "0.1234567890123456789012345", "1e-25", "5.5e-30",
        ).map { arrayOf<Any>(it) }
    }
}
