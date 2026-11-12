package app.lunar.keyboard.near

import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import java.security.SecureRandom

/** An ed25519 key. [seed] is the 32-byte private seed. */
class KeyPair(private val seed: ByteArray) {
    init {
        require(seed.size == 32) { "seed must be 32 bytes" }
    }

    private val priv = Ed25519PrivateKeyParameters(seed, 0)
    val publicKey: ByteArray = priv.generatePublicKey().encoded

    /** "ed25519:<base58 public key>" */
    val publicKeyString: String get() = "ed25519:" + Base58.encode(publicKey)

    /** NEAR's secret key format: "ed25519:<base58 of seed + public key>". */
    val secretKeyString: String get() = "ed25519:" + Base58.encode(seed + publicKey)

    fun sign(message: ByteArray): ByteArray {
        val s = Ed25519Signer()
        s.init(true, priv)
        s.update(message, 0, message.size)
        return s.generateSignature()
    }

    companion object {
        fun random(): KeyPair = KeyPair(ByteArray(32).also { SecureRandom().nextBytes(it) })

        /** Accepts "ed25519:<base58>" with 64 bytes (seed + public) or 32 bytes (seed). */
        fun fromSecret(secret: String): KeyPair {
            val raw = Base58.decode(secret.removePrefix("ed25519:"))
            require(raw.size == 64 || raw.size == 32) { "bad secret key length ${raw.size}" }
            return KeyPair(raw.copyOfRange(0, 32))
        }
    }
}
