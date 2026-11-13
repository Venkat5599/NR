package app.lunar.keyboard.near

import org.json.JSONObject
import java.math.BigInteger
import java.net.HttpURLConnection
import java.net.URL
import java.util.Base64

/** Blocking NEAR JSON-RPC client. Call from a background thread. */
class NearClient(val rpcUrl: String = TESTNET_RPC) {

    class RpcException(message: String) : Exception(message)

    data class TxOutcome(
        val hash: String,
        /** Decoded `SuccessValue` of the transaction's result, or null if it failed. */
        val successValue: String?,
        /** Failure description when the transaction failed. */
        val failure: String?,
        /** Every log line from every receipt, in order. */
        val logs: List<String>,
    ) {
        val ok get() = failure == null
    }

    fun call(method: String, params: Any): JSONObject {
        val body = JSONObject().put("jsonrpc", "2.0").put("id", "lunar").put("method", method).put("params", params)
        val res = JSONObject(post(rpcUrl, body.toString()))
        res.optJSONObject("error")?.let { e ->
            val cause = e.optJSONObject("cause")
            val name = cause?.optString("name") ?: e.optString("name")
            throw RpcException("$name: ${e.opt("data") ?: e.optString("message")}")
        }
        return res.getJSONObject("result")
    }

    /** Calls a view method and returns its raw JSON result text. */
    fun view(contract: String, method: String, args: JSONObject = JSONObject()): String {
        val r = call("query", JSONObject()
            .put("request_type", "call_function").put("finality", "optimistic")
            .put("account_id", contract).put("method_name", method)
            .put("args_base64", Base64.getEncoder().encodeToString(args.toString().toByteArray())))
        val arr = r.getJSONArray("result")
        return String(ByteArray(arr.length()) { arr.getInt(it).toByte() })
    }

    /** Current nonce of an access key, or null if the key isn't on the account. */
    fun accessKeyNonce(account: String, publicKey: String): Long? = try {
        parseAccessKeyNonce(call("query", JSONObject()
            .put("request_type", "view_access_key").put("finality", "optimistic")
            .put("account_id", account).put("public_key", publicKey)))
    } catch (e: RpcException) {
        if (e.message?.contains("UNKNOWN_ACCESS_KEY") == true || e.message?.contains("does not exist") == true) null else throw e
    }

    fun latestBlockHash(): ByteArray =
        Base58.decode(call("block", JSONObject().put("finality", "final")).getJSONObject("header").getString("hash"))

    fun balance(account: String): BigInteger? = try {
        BigInteger(call("query", JSONObject().put("request_type", "view_account").put("finality", "final")
            .put("account_id", account)).getString("amount"))
    } catch (e: RpcException) {
        if (e.message?.contains("UNKNOWN_ACCOUNT") == true) null else throw e
    }

    private fun nextNonce(publicKey: String, onChain: Long): Long = synchronized(lastNonce) {
        val next = maxOf(onChain, lastNonce[publicKey] ?: 0L) + 1
        lastNonce[publicKey] = next
        next
    }

    /** Builds, signs and sends a transaction, waiting until it is executed. */
    fun send(signer: String, key: KeyPair, receiver: String, actions: List<Action>): TxOutcome {
        val onChain = accessKeyNonce(signer, key.publicKeyString) ?: throw RpcException("this key is not on $signer")
        // two transactions in a row from one key: the RPC can still show the older nonce, so never reuse one
        val nonce = nextNonce(key.publicKeyString, onChain)
        val tx = Transaction(signer, key.publicKey, nonce, receiver, latestBlockHash(), actions)
        val (signed, hash) = tx.sign(key)
        val result = call("send_tx", JSONObject()
            .put("signed_tx_base64", Base64.getEncoder().encodeToString(signed))
            .put("wait_until", "EXECUTED_OPTIMISTIC"))
        return parseOutcome(Base58.encode(hash), result)
    }

    companion object {
        /** Last nonce this process used per key, shared by every client in the app. */
        private val lastNonce = HashMap<String, Long>()

        const val TESTNET_RPC = "https://rpc.testnet.fastnear.com"
        const val FAUCET = "https://helper.nearprotocol.com/account"
        val TGAS: Long = 1_000_000_000_000L
        val YOCTO_PER_NEAR: BigInteger = BigInteger.TEN.pow(24)

        fun functionCall(method: String, args: JSONObject, tgas: Long = 30, deposit: BigInteger = BigInteger.ZERO) =
            Action.FunctionCall(method, args.toString().toByteArray(), tgas * TGAS, deposit)

        /**
         * Pure: some RPC providers report a missing key inside `result` (`{"error": "... does not exist ..."}`)
         * instead of as a JSON-RPC error. Both mean "not on the account yet".
         */
        fun parseAccessKeyNonce(result: JSONObject): Long? {
            if (result.has("nonce")) return result.getLong("nonce")
            val err = result.optString("error")
            if (err.contains("does not exist")) return null
            throw RpcException("unexpected access key response: ${result.toString().take(160)}")
        }

        /** Pure: turns a `send_tx` / `tx` result into an outcome. Tested against recorded responses. */
        fun parseOutcome(hash: String, result: JSONObject): TxOutcome {
            val logs = ArrayList<String>()
            fun collect(o: JSONObject?) {
                val l = o?.optJSONObject("outcome")?.optJSONArray("logs") ?: return
                for (i in 0 until l.length()) logs += l.getString(i)
            }
            collect(result.optJSONObject("transaction_outcome"))
            result.optJSONArray("receipts_outcome")?.let { arr -> for (i in 0 until arr.length()) collect(arr.getJSONObject(i)) }

            val status = result.optJSONObject("status") ?: return TxOutcome(hash, null, "no status", logs)
            if (status.has("Failure")) return TxOutcome(hash, null, describeFailure(status.get("Failure")), logs)
            val b64 = status.optString("SuccessValue", "")
            val value = if (b64.isEmpty()) "" else String(Base64.getDecoder().decode(b64))
            // A receipt further down can fail even when the transaction-level status is a success value.
            val receiptFailure = result.optJSONArray("receipts_outcome")?.let { arr ->
                (0 until arr.length()).map { arr.getJSONObject(it).optJSONObject("outcome")?.optJSONObject("status") }
                    .firstOrNull { it?.has("Failure") == true }?.get("Failure")
            }
            return TxOutcome(hash, value, null, logs).let {
                if (receiptFailure != null && value.isEmpty()) it.copy(failure = describeFailure(receiptFailure)) else it
            }
        }

        private fun describeFailure(f: Any): String {
            val s = f.toString()
            Regex("\"ExecutionError\":\"([^\"]+)\"").find(s)?.let { return it.groupValues[1] }
            return s.take(300)
        }

        /** Asks the testnet faucet to create [accountId] with [publicKey] as its full-access key. */
        fun createTestnetAccount(accountId: String, publicKey: String): Boolean {
            val body = JSONObject().put("newAccountId", accountId).put("newAccountPublicKey", publicKey)
            val c = URL(FAUCET).openConnection() as HttpURLConnection
            c.requestMethod = "POST"; c.connectTimeout = 15000; c.readTimeout = 30000; c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json")
            c.outputStream.use { it.write(body.toString().toByteArray()) }
            val code = c.responseCode
            val text = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            c.disconnect()
            if (code == 429) throw RpcException("the NEAR testnet faucet is busy (too many new accounts). Try again in a few minutes.")
            if (code == 400 && text.contains("exist", true)) throw RpcException("that name is taken, pick another")
            if (code !in 200..299) throw RpcException("faucet said $code: ${text.take(200)}")
            return true
        }

        fun post(url: String, body: String, headers: Map<String, String> = emptyMap()): String {
            val c = URL(url).openConnection() as HttpURLConnection
            c.requestMethod = "POST"; c.connectTimeout = 10000; c.readTimeout = 30000; c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json")
            headers.forEach { (k, v) -> c.setRequestProperty(k, v) }
            c.outputStream.use { it.write(body.toByteArray()) }
            val stream = if (c.responseCode in 200..299) c.inputStream else c.errorStream
            return (stream?.bufferedReader()?.use { it.readText() } ?: "").also { c.disconnect() }
        }

        fun get(url: String): String {
            val c = URL(url).openConnection() as HttpURLConnection
            c.connectTimeout = 10000; c.readTimeout = 20000
            c.setRequestProperty("Accept", "application/json")
            val stream = if (c.responseCode in 200..299) c.inputStream else c.errorStream
            return (stream?.bufferedReader()?.use { it.readText() } ?: "").also { c.disconnect() }
        }

        private val NEAR_AMOUNT = Regex("^[0-9]{1,9}(\\.[0-9]{1,24})?$")

        /** Pure: a typed NEAR amount, strictly 1-9 whole digits and optionally "." with 1-24 decimals (one yocto); null otherwise. */
        fun parseNear(text: String): java.math.BigDecimal? = if (NEAR_AMOUNT.matches(text)) java.math.BigDecimal(text) else null

        fun toYocto(near: java.math.BigDecimal): BigInteger = near.movePointRight(24).toBigIntegerExact()
        fun toNear(yocto: BigInteger): java.math.BigDecimal = java.math.BigDecimal(yocto).movePointLeft(24).stripTrailingZeros()
    }
}
