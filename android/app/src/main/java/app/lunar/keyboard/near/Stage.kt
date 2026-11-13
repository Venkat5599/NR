package app.lunar.keyboard.near

import java.math.BigInteger

/** Where one incoming transfer is on its way to the owner's address. Pure, so it is tested on recorded data. */
sealed class Stage {
    /** Base hasn't finalized the block yet; NEAR's signer won't verify it before then. */
    data class Finalizing(val secondsLeft: Long) : Stage()
    /** Final on Base and not yet submitted: Recover can go. */
    object Ready : Stage()
    /** The contract asked NEAR's signer to check the transfer on Base. */
    object Verifying : Stage()
    /** Verified; the forward transaction is being signed. */
    object Signing : Stage()
    /** Signed by NEAR's signer; the signed transaction still has to reach Base. */
    data class Signed(val signedTx: String, val evmTxHash: String) : Stage()
    /** On Base: forwarded (or refunded) or reverted. */
    data class Done(val evmTxHash: String, val ok: Boolean, val destination: String?, val refund: Boolean) : Stage()

    companion object {
        fun of(block: Long, finalized: Long, record: ReceiveContract.Record?, receipt: String?): Stage {
            if (record == null) return if (block > finalized) Finalizing((block - finalized) * Evm.BLOCK_SECONDS) else Ready
            return when (record.status) {
                "Verifying" -> Verifying
                "Verified" -> Signing
                "Signed" -> {
                    val tx = record.signedTx ?: return Signing
                    val hash = record.evmTxHash ?: return Signing
                    if (receipt == null || receipt == "missing") Signed(tx, hash)
                    else Done(hash, receipt == "success", record.destination, record.refund)
                }
                else -> Verifying
            }
        }

        /** ETH the receive address needs to pay for one forward at [maxFee]. */
        fun gasNeeded(maxFee: BigInteger): BigInteger = ReceiveContract.GAS_LIMIT.multiply(maxFee)

        /** "about 3 h 15 min" / "about 4 min" / "under a minute". */
        fun wait(seconds: Long): String = when {
            seconds < 60 -> "under a minute"
            seconds < 3600 -> "about ${seconds / 60} min"
            else -> "about ${seconds / 3600} h ${(seconds % 3600) / 60} min"
        }
    }
}
