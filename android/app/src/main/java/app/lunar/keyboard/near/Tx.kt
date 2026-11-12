package app.lunar.keyboard.near

import java.io.ByteArrayOutputStream
import java.math.BigInteger

/** Base58 (Bitcoin alphabet), as NEAR uses for keys, hashes and signatures. */
object Base58 {
    private const val ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    private val INDEX = IntArray(128) { -1 }.also { a -> ALPHABET.forEachIndexed { i, c -> a[c.code] = i } }

    fun encode(input: ByteArray): String {
        if (input.isEmpty()) return ""
        var zeros = 0
        while (zeros < input.size && input[zeros].toInt() == 0) zeros++
        var n = BigInteger(1, input)
        val sb = StringBuilder()
        val b58 = BigInteger.valueOf(58)
        while (n > BigInteger.ZERO) {
            val qr = n.divideAndRemainder(b58)
            sb.append(ALPHABET[qr[1].toInt()])
            n = qr[0]
        }
        repeat(zeros) { sb.append('1') }
        return sb.reverse().toString()
    }

    fun decode(input: String): ByteArray {
        if (input.isEmpty()) return ByteArray(0)
        var n = BigInteger.ZERO
        for (c in input) {
            val d = if (c.code < 128) INDEX[c.code] else -1
            require(d >= 0) { "not base58: $c" }
            n = n.multiply(BigInteger.valueOf(58)).add(BigInteger.valueOf(d.toLong()))
        }
        var bytes = n.toByteArray()
        if (bytes.size > 1 && bytes[0].toInt() == 0) bytes = bytes.copyOfRange(1, bytes.size)
        if (n == BigInteger.ZERO) bytes = ByteArray(0)
        val zeros = input.takeWhile { it == '1' }.length
        return ByteArray(zeros) + bytes
    }
}

/** Little-endian Borsh writer, just the parts a NEAR transaction needs. */
class Borsh {
    private val out = ByteArrayOutputStream()

    fun u8(v: Int) = apply { out.write(v and 0xff) }
    fun u32(v: Long) = apply { for (i in 0 until 4) out.write(((v shr (8 * i)) and 0xff).toInt()) }
    fun u64(v: Long) = apply { for (i in 0 until 8) out.write(((v ushr (8 * i)) and 0xff).toInt()) }
    fun u128(v: BigInteger) = apply {
        require(v.signum() >= 0 && v.bitLength() <= 128) { "u128 out of range" }
        val be = v.toByteArray().let { if (it.size > 16) it.copyOfRange(it.size - 16, it.size) else it }
        val le = ByteArray(16)
        for (i in be.indices) le[i] = be[be.size - 1 - i]
        out.write(le)
    }
    fun fixed(b: ByteArray) = apply { out.write(b) }
    fun bytes(b: ByteArray) = apply { u32(b.size.toLong()); out.write(b) }
    fun string(s: String) = bytes(s.toByteArray(Charsets.UTF_8))
    fun toByteArray(): ByteArray = out.toByteArray()
}

/** The NEAR actions Lunar sends. Tags follow nearcore's `Action` enum order. */
sealed class Action {
    abstract fun write(w: Borsh)

    data class FunctionCall(val method: String, val args: ByteArray, val gas: Long, val deposit: BigInteger) : Action() {
        override fun write(w: Borsh) {
            w.u8(2).string(method).bytes(args).u64(gas).u128(deposit)
        }
    }

    data class Transfer(val deposit: BigInteger) : Action() {
        override fun write(w: Borsh) {
            w.u8(3).u128(deposit)
        }
    }

    /** Adds a key that can only call [receiver] (and only [methods], if not empty). */
    data class AddFunctionCallKey(
        val publicKey: ByteArray,
        val allowance: BigInteger?,
        val receiver: String,
        val methods: List<String>,
    ) : Action() {
        override fun write(w: Borsh) {
            w.u8(5)
            w.u8(0).fixed(publicKey)                 // PublicKey::ED25519
            w.u64(0)                                 // AccessKey.nonce
            w.u8(0)                                  // AccessKeyPermission::FunctionCall
            if (allowance == null) w.u8(0) else w.u8(1).u128(allowance)
            w.string(receiver)
            w.u32(methods.size.toLong())
            methods.forEach { w.string(it) }
        }
    }
}

data class Transaction(
    val signerId: String,
    val publicKey: ByteArray,
    val nonce: Long,
    val receiverId: String,
    val blockHash: ByteArray,
    val actions: List<Action>,
) {
    fun serialize(): ByteArray {
        require(publicKey.size == 32 && blockHash.size == 32)
        val w = Borsh()
        w.string(signerId)
        w.u8(0).fixed(publicKey)
        w.u64(nonce)
        w.string(receiverId)
        w.fixed(blockHash)
        w.u32(actions.size.toLong())
        actions.forEach { it.write(w) }
        return w.toByteArray()
    }

    /** Signs and returns (borsh SignedTransaction, transaction hash). */
    fun sign(key: KeyPair): Pair<ByteArray, ByteArray> {
        val body = serialize()
        val hash = java.security.MessageDigest.getInstance("SHA-256").digest(body)
        val sig = key.sign(hash)
        val signed = Borsh().fixed(body).u8(0).fixed(sig).toByteArray()
        return signed to hash
    }
}
