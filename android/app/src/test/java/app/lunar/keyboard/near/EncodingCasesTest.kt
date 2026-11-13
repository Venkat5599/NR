package app.lunar.keyboard.near

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import java.util.Random

private fun hex(s: String): ByteArray = ByteArray(s.length / 2) { s.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
private fun ByteArray.hex() = joinToString("") { "%02x".format(it) }

/** Known Base58 vectors (Bitcoin Core's base58_encode_decode.json and NEAR's own key format). */
@RunWith(Parameterized::class)
class Base58VectorCasesTest(private val hexIn: String, private val b58: String) {
    @Test fun encodes_to_the_published_string() = assertEquals(b58, Base58.encode(hex(hexIn)))
    @Test fun decodes_to_the_published_bytes() = assertEquals(hexIn, Base58.decode(b58).hex())

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0} <-> {1}")
        fun data(): List<Array<Any>> = listOf(
            "" to "",
            "61" to "2g",
            "626262" to "a3gV",
            "636363" to "aPEr",
            "73696d706c792061206c6f6e6720737472696e67" to "2cFupjhnEsSn59qHXstmK2ffpLv2",
            "00eb15231dfceb60925886b67d065299925915aeb172c06647" to "1NS17iag9jJgTHD1VXjvLCEnZuQ3rJDE9L",
            "516b6fcd0f" to "ABnLTmg",
            "bf4f89001e670274dd" to "3SEo3LWLoPntC",
            "572e4794" to "3EFU7m",
            "ecac89cad93923c02321" to "EJDM8drfXA6uyA",
            "10c8511e" to "Rt5zm",
            "00000000000000000000" to "1111111111",
            "00" to "1",
            "0000" to "11",
            "01" to "2",
            "39" to "z",
            "3a" to "21",
            "ff" to "5Q",
            "0100" to "5R",
            "000000287fb4cd" to "111233QC4",
            // NEAR: the all-zero 32-byte key and hash
            "00".repeat(32) to "1".repeat(32),
        ).map { arrayOf<Any>(it.first, it.second) }
    }
}

/**
 * Round trips over many byte arrays (leading zeros, all-zero, all-0xff, 1..80 bytes), checked
 * against a reference encoder that does schoolbook base-256 to base-58 long division on the
 * byte array instead of BigInteger.
 */
@RunWith(Parameterized::class)
class Base58RoundTripCasesTest(private val label: String, private val bytes: ByteArray) {
    @Test fun matches_reference_and_round_trips() {
        val s = Base58.encode(bytes)
        assertEquals(reference(bytes), s)
        assertArrayEquals(bytes, Base58.decode(s))
        val zeros = bytes.takeWhile { it.toInt() == 0 }.size
        assertEquals("one '1' per leading zero byte", zeros, s.takeWhile { it == '1' }.length)
        assertTrue(s.none { it in "0OIl" })
    }

    companion object {
        private const val ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

        fun reference(input: ByteArray): String {
            val zeros = input.takeWhile { it.toInt() == 0 }.size
            val digits = ArrayList<Int>() // little-endian base-58 digits
            for (b in input) {
                var carry = b.toInt() and 0xff
                for (i in digits.indices) {
                    carry += digits[i] * 256
                    digits[i] = carry % 58
                    carry /= 58
                }
                while (carry > 0) { digits += carry % 58; carry /= 58 }
            }
            return "1".repeat(zeros) + digits.reversed().joinToString("") { ALPHABET[it].toString() }
        }

        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> {
            val rnd = Random(58)
            val out = ArrayList<Array<Any>>()
            for (n in 1..40) out += arrayOf<Any>("zeros-$n", ByteArray(n))
            for (n in 1..20) out += arrayOf<Any>("ff-$n", ByteArray(n) { -1 })
            for (i in 0 until 140) {
                val len = 1 + rnd.nextInt(80)
                val b = ByteArray(len).also { rnd.nextBytes(it) }
                val lead = if (i % 3 == 0) rnd.nextInt(minOf(5, len) + 1) else 0
                for (k in 0 until lead) b[k] = 0
                out += arrayOf<Any>("random-$i-len$len-lead$lead", b)
            }
            return out
        }
    }
}

@RunWith(Parameterized::class)
class Base58RejectCasesTest(private val input: String) {
    @Test fun rejects_characters_outside_the_alphabet() {
        assertThrows(IllegalArgumentException::class.java) { Base58.decode(input) }
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> = listOf(
            "0", "O", "I", "l", "abc0", "1O1", "Il", "+", "/", "=", " ", "abc def", "é", "ñ", "ed25519:abc", "-", "_", "\n", "z\u0000",
        ).map { arrayOf<Any>(it) }
    }
}

/** Little-endian Borsh integers, checked against hand-written byte strings. */
@RunWith(Parameterized::class)
class BorshIntegerCasesTest(private val kind: String, private val value: String, private val expectHex: String) {
    @Test fun writes_little_endian() {
        val w = Borsh()
        when (kind) {
            "u8" -> w.u8(value.toInt())
            "u32" -> w.u32(value.toLong())
            "u64" -> w.u64(java.lang.Long.parseUnsignedLong(value))
            "u128" -> w.u128(value.toBigInteger())
        }
        assertEquals(expectHex, w.toByteArray().hex())
    }

    companion object {
        private fun le(v: java.math.BigInteger, n: Int): String {
            val sb = StringBuilder()
            var x = v
            repeat(n) { sb.append("%02x".format(x.and(0xff.toBigInteger()).toInt())); x = x.shiftRight(8) }
            return sb.toString()
        }

        @JvmStatic @Parameterized.Parameters(name = "{0} {1}")
        fun data(): List<Array<Any>> {
            val out = ArrayList<Array<Any>>()
            listOf("0" to "00", "1" to "01", "127" to "7f", "128" to "80", "255" to "ff").forEach { out += arrayOf<Any>("u8", it.first, it.second) }
            listOf(
                "0" to "00000000", "1" to "01000000", "255" to "ff000000", "256" to "00010000", "65535" to "ffff0000",
                "65536" to "00000100", "16777216" to "00000001", "305419896" to "78563412", "2147483647" to "ffffff7f",
                "2147483648" to "00000080", "4294967295" to "ffffffff",
            ).forEach { out += arrayOf<Any>("u32", it.first, it.second) }
            listOf(
                "0" to "0000000000000000", "1" to "0100000000000000", "1000000000000" to "0010a5d4e8000000",
                "30000000000000" to "00e057eb481b0000", "300000000000000" to "00c06e31d9100100",
                "81985529216486895" to "efcdab8967452301", "9223372036854775807" to "ffffffffffffff7f",
                "9223372036854775808" to "0000000000000080", "18446744073709551615" to "ffffffffffffffff",
            ).forEach { out += arrayOf<Any>("u64", it.first, it.second) }
            val two = java.math.BigInteger.TWO
            listOf(
                "0", "1", "255", "256", "1000000000000000000000000", "12500000000000000000000", "250000000000000000000000",
                "3000000000000000000000000", "340282366920938463463374607431768211455", two.pow(64).toString(), two.pow(64).subtract(java.math.BigInteger.ONE).toString(),
                two.pow(127).toString(), "18446744073709551616000", "999999999999999999999999999999999999",
            ).forEach { v -> out += arrayOf<Any>("u128", v, le(v.toBigInteger(), 16)) }
            return out
        }
    }
}

class BorshRulesTest {
    @Test fun u128_rejects_negative_and_too_large() {
        assertThrows(IllegalArgumentException::class.java) { Borsh().u128(java.math.BigInteger.ONE.negate()) }
        assertThrows(IllegalArgumentException::class.java) { Borsh().u128(java.math.BigInteger.TWO.pow(128)) }
    }

    @Test fun one_near_is_the_published_u128() {
        // 10^24 = 0xd3c21bcecceda1000000
        assertEquals("000000a1edccce1bc2d3000000000000", Borsh().u128(NearClient.YOCTO_PER_NEAR).toByteArray().hex())
    }
}

/** Borsh strings: u32 length (in UTF-8 bytes) then the bytes. */
@RunWith(Parameterized::class)
class BorshStringCasesTest(private val s: String) {
    @Test fun length_prefixed_utf8() {
        val out = Borsh().string(s).toByteArray()
        val utf8 = s.toByteArray(Charsets.UTF_8)
        assertEquals(4 + utf8.size, out.size)
        val len = (out[0].toInt() and 0xff) or ((out[1].toInt() and 0xff) shl 8) or ((out[2].toInt() and 0xff) shl 16) or ((out[3].toInt() and 0xff) shl 24)
        assertEquals(utf8.size, len)
        assertArrayEquals(utf8, out.copyOfRange(4, out.size))
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> = listOf(
            "", "a", "bob.near", "alice.testnet", "pay", "ft_transfer_call", "storage_deposit", "near_deposit",
            "lunarpay-0111.testnet", "ref-finance-101.testnet", "é", "€", "dinner 🍕", "x".repeat(300), "0x" + "a".repeat(40),
        ).map { arrayOf<Any>(it) }
    }
}
