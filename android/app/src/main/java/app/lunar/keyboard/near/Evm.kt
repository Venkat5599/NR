package app.lunar.keyboard.near

import org.json.JSONArray
import org.json.JSONObject
import java.math.BigDecimal
import java.math.BigInteger

/**
 * Base Sepolia, read over JSON-RPC and Blockscout. The phone never signs anything here: the only
 * write is broadcasting a transaction the receive contract already had NEAR's signer sign, which
 * anyone may do.
 */
class Evm(private val rpc: String = RPC, private val explorerApi: String = EXPLORER_API) {

    /** A token transfer that arrived at a receive address. */
    data class Incoming(val txHash: String, val logIndex: Long, val block: Long, val from: String, val amount: BigInteger)

    fun latestBlock(): Long = quantity(call("eth_blockNumber", JSONArray()) as String)

    /** NEAR's signer verifies a transfer only once its block is final on Base. */
    fun finalizedBlock(): Long = quantity((call("eth_getBlockByNumber", JSONArray().put("finalized").put(false)) as JSONObject).getString("number"))

    fun ethBalance(address: String): BigInteger = bigQuantity(call("eth_getBalance", JSONArray().put(address).put("latest")) as String)

    fun tokenBalance(token: String, address: String): BigInteger = bigQuantity(call("eth_call", JSONArray()
        .put(JSONObject().put("to", token).put("data", "0x70a08231" + addressWord(address))).put("latest")) as String)

    /** Transfers of [token] into [address], newest first. */
    fun incoming(token: String, address: String): List<Incoming> =
        parseIncoming(NearClient.get("$explorerApi/addresses/$address/token-transfers?type=ERC-20"), token, address)

    /** The Transfer log exactly as the chain returns it, trimmed to the fields the receive contract reads. */
    fun transferLog(txHash: String, logIndex: Long): JSONObject =
        pickLog(call("eth_getTransactionReceipt", JSONArray().put(txHash)) as? JSONObject
            ?: throw NearClient.RpcException("Base has no receipt for $txHash yet"), logIndex)

    /** Fees for the forward transaction, as the watcher computes them: twice the base fee plus the tip, under the cap. */
    fun fees(cap: BigInteger): Pair<BigInteger, BigInteger> {
        val base = bigQuantity((call("eth_getBlockByNumber", JSONArray().put("latest").put(false)) as JSONObject).getString("baseFeePerGas"))
        val tip = bigQuantity(call("eth_maxPriorityFeePerGas", JSONArray()) as String)
        return fees(base, tip, cap)
    }

    /** "missing" until the transaction is in a block, then "success" or "reverted". */
    fun receipt(txHash: String): String {
        val r = call("eth_getTransactionReceipt", JSONArray().put(txHash)) as? JSONObject ?: return "missing"
        return if (r.optString("status") == "0x1") "success" else "reverted"
    }

    fun sendRaw(signedTx: String): String = try {
        call("eth_sendRawTransaction", JSONArray().put(signedTx)) as String
    } catch (e: NearClient.RpcException) {
        // already sent (by the watcher, or an earlier tap): the transaction is the same either way
        if (e.message?.contains("already known", true) == true || e.message?.contains("nonce too low", true) == true) "" else throw e
    }

    private fun call(method: String, params: JSONArray): Any? {
        val body = JSONObject().put("jsonrpc", "2.0").put("id", 1).put("method", method).put("params", params)
        val res = JSONObject(NearClient.post(rpc, body.toString()))
        res.optJSONObject("error")?.let { throw NearClient.RpcException("$method: ${it.optString("message")}") }
        return if (res.isNull("result")) null else res.get("result")
    }

    companion object {
        const val RPC = "https://sepolia.base.org"
        const val EXPLORER_API = "https://base-sepolia.blockscout.com/api/v2"
        const val EXPLORER = "https://base-sepolia.blockscout.com"
        const val USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
        /** Base Sepolia makes a block every 2 s. */
        const val BLOCK_SECONDS = 2L

        private val ADDRESS = Regex("^0x[0-9a-fA-F]{40}$")
        private val LOG_FIELDS = listOf("removed", "logIndex", "transactionIndex", "transactionHash", "blockHash", "blockNumber", "address", "data", "topics")

        fun isAddress(s: String) = ADDRESS.matches(s)

        fun txUrl(hash: String) = "$EXPLORER/tx/$hash"
        fun addressUrl(address: String) = "$EXPLORER/address/$address"

        fun quantity(hex: String): Long = java.lang.Long.parseLong(hex.removePrefix("0x"), 16)
        fun bigQuantity(hex: String): BigInteger = if (hex == "0x") BigInteger.ZERO else BigInteger(hex.removePrefix("0x"), 16)

        fun addressWord(address: String) = address.removePrefix("0x").lowercase().padStart(64, '0')

        /** Pure: Blockscout's token-transfer list → transfers of [token] that arrived at [address]. */
        fun parseIncoming(json: String, token: String, address: String): List<Incoming> {
            val items = JSONObject(json).optJSONArray("items") ?: return emptyList()
            return (0 until items.length()).map { items.getJSONObject(it) }.filter { t ->
                t.optJSONObject("to")?.optString("hash").equals(address, true) &&
                    tokenOf(t).equals(token, true)
            }.map { t ->
                Incoming(
                    txHash = t.getString("transaction_hash").lowercase(),
                    logIndex = t.getLong("log_index"),
                    block = t.getLong("block_number"),
                    from = t.getJSONObject("from").getString("hash").lowercase(),
                    amount = BigInteger(t.getJSONObject("total").getString("value")),
                )
            }
        }

        private fun tokenOf(t: JSONObject): String {
            val token = t.optJSONObject("token") ?: return ""
            return token.optString("address_hash").ifEmpty { token.optString("address") }
        }

        /** Pure: picks log [logIndex] out of an `eth_getTransactionReceipt` result. */
        fun pickLog(receipt: JSONObject, logIndex: Long): JSONObject {
            val logs = receipt.getJSONArray("logs")
            val log = (0 until logs.length()).map { logs.getJSONObject(it) }
                .firstOrNull { quantity(it.getString("logIndex")) == logIndex }
                ?: throw NearClient.RpcException("the transaction has no log $logIndex")
            return JSONObject().apply { LOG_FIELDS.forEach { put(it, log.get(it)) } }
        }

        fun fees(base: BigInteger, tip: BigInteger, cap: BigInteger): Pair<BigInteger, BigInteger> {
            val t = tip.min(cap)
            return (base.multiply(BigInteger.TWO).add(t)).min(cap) to t
        }

        /** 6-decimal USDC → "1.5". */
        fun usdc(amount: BigInteger): String = BigDecimal(amount).movePointLeft(6).stripTrailingZeros().toPlainString()

        /** wei → ETH, to 6 places. */
        fun eth(wei: BigInteger): String = BigDecimal(wei).movePointLeft(18).setScale(6, java.math.RoundingMode.DOWN).stripTrailingZeros().toPlainString()
    }
}
