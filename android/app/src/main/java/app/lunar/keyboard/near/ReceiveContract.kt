package app.lunar.keyboard.near

import org.json.JSONObject
import java.math.BigDecimal
import java.math.BigInteger

/**
 * The receive contract. Each NEAR account gets a Base address derived by NEAR's Chain Signatures:
 * no private key for it exists. Tokens that land there can only be forwarded to the address the
 * owner set (or refunded to the sender), and only after NEAR's signer has verified the transfer.
 */
class ReceiveContract(private val near: NearClient, val contract: String = CONTRACT) {

    data class Receiver(val address: String, val forwardTo: String?)

    data class Record(val status: String, val destination: String?, val refund: Boolean, val signedTx: String?, val evmTxHash: String?)

    fun receiver(account: String): Receiver? =
        parseReceiver(near.view(contract, "get_receiver", JSONObject().put("account_id", account)))

    /**
     * Registers the account (first time: 0.01 NEAR for storage, and the contract asks NEAR's signer
     * for the derived key) or changes where it forwards to. Signed by the wallet key.
     */
    fun register(account: String, walletKey: KeyPair, forwardTo: String, firstTime: Boolean): String {
        val out = near.send(account, walletKey, contract, listOf(NearClient.functionCall("register",
            JSONObject().put("forward_to", forwardTo.lowercase()), tgas = 100,
            deposit = if (firstTime) NearClient.toYocto(BigDecimal("0.01")) else BigInteger.ZERO)))
        if (!out.ok) throw NearClient.RpcException("register failed: ${out.failure}")
        return out.hash
    }

    fun record(txHash: String, logIndex: Long): Record? = parseRecord(near.view(contract, "get_transfer",
        JSONObject().put("chain", CHAIN).put("tx_id", txHash).put("log_index", logIndex)))

    /**
     * Asks the contract to verify [log] through NEAR's signer and have the forward signed (0.02 NEAR).
     * Returns once the transaction is in a block; the signer answers over the next blocks, so follow
     * it with [record].
     */
    fun recover(account: String, walletKey: KeyPair, log: JSONObject, fees: Pair<BigInteger, BigInteger>): String =
        near.sendIncluded(account, walletKey, contract, listOf(NearClient.functionCall("recover",
            JSONObject().put("chain", CHAIN).put("log", log).put("fees", JSONObject()
                .put("max_fee_per_gas", fees.first.toString()).put("max_priority_fee_per_gas", fees.second.toString())),
            tgas = 300, deposit = NearClient.toYocto(BigDecimal("0.02")))))

    companion object {
        const val CONTRACT = "lunar-recv-80366.testnet"
        const val CHAIN = "Base"
        /** The contract signs forwards with this gas limit; the receive address pays it in ETH. */
        val GAS_LIMIT: BigInteger = BigInteger.valueOf(100_000)
        val MAX_FEE_CAP: BigInteger = BigInteger("100000000000")

        fun parseReceiver(raw: String): Receiver? {
            if (raw.trim() == "null") return null
            val o = JSONObject(raw)
            return Receiver(o.getString("receive_address"), if (o.isNull("forward_to")) null else o.getString("forward_to"))
        }

        fun parseRecord(raw: String): Record? {
            if (raw.trim() == "null") return null
            val o = JSONObject(raw)
            fun opt(k: String) = if (o.isNull(k)) null else o.getString(k)
            return Record(o.getString("status"), opt("destination"), o.optBoolean("refund"), opt("signed_tx"), opt("evm_tx_hash"))
        }
    }
}
