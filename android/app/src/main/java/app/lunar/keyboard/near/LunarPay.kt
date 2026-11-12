package app.lunar.keyboard.near

import org.json.JSONObject
import java.math.BigDecimal
import java.math.BigInteger

/** Calls to the Lunar payments contract. Blocking; call from a background thread. */
class LunarPay(private val near: NearClient, val contract: String) {

    data class Pocket(val balance: BigInteger, val dailyCap: BigInteger, val spentToday: BigInteger, val leftToday: BigInteger)

    data class ReceivePref(val chain: String, val token: String, val address: String)

    enum class PayResult { SENT, REFUSED_OVER_CAP, REFUSED_LOW_BALANCE }

    data class Paid(val result: PayResult, val txHash: String)

    fun pocket(account: String): Pocket {
        val o = JSONObject(near.view(contract, "get_pocket", JSONObject().put("account", account)))
        return Pocket(
            BigInteger(o.getString("balance")), BigInteger(o.getString("daily_cap")),
            BigInteger(o.getString("spent_today")), BigInteger(o.getString("left_today")),
        )
    }

    fun receivePref(account: String): ReceivePref? {
        val raw = near.view(contract, "get_receive", JSONObject().put("account", account))
        if (raw == "null") return null
        val o = JSONObject(raw)
        return ReceivePref(o.getString("chain"), o.getString("token"), o.getString("address"))
    }

    /** The keyboard's payment, signed with the keyboard's function-call key. */
    fun pay(account: String, keyboardKey: KeyPair, to: String, near: BigDecimal, memo: String?): Paid {
        val args = JSONObject().put("to", to).put("amount", NearClient.toYocto(near).toString())
        if (memo != null) args.put("memo", memo)
        val out = this.near.send(account, keyboardKey, contract, listOf(NearClient.functionCall("pay", args)))
        if (!out.ok) throw NearClient.RpcException(out.failure ?: "payment failed")
        return Paid(parseResult(out.successValue), out.hash)
    }

    /** Wallet-key setup: scope the keyboard key to `pay`, top up the pocket, set the cap. */
    fun setUp(account: String, walletKey: KeyPair, keyboardKey: KeyPair, topUp: BigDecimal, cap: BigDecimal): List<String> {
        val add = near.send(account, walletKey, account, listOf(
            Action.AddFunctionCallKey(keyboardKey.publicKey, NearClient.toYocto(BigDecimal("0.25")), contract, listOf("pay"))))
        if (!add.ok) throw NearClient.RpcException("adding the keyboard key failed: ${add.failure}")
        val fund = near.send(account, walletKey, contract, listOf(
            NearClient.functionCall("deposit", JSONObject(), deposit = NearClient.toYocto(topUp)),
            NearClient.functionCall("set_daily_cap", JSONObject().put("cap", NearClient.toYocto(cap).toString()), deposit = BigInteger.ONE)))
        if (!fund.ok) throw NearClient.RpcException("top-up failed: ${fund.failure}")
        return listOf(add.hash, fund.hash)
    }

    fun topUp(account: String, walletKey: KeyPair, amount: BigDecimal): String =
        walletCall(account, walletKey, "deposit", JSONObject(), NearClient.toYocto(amount))

    fun setCap(account: String, walletKey: KeyPair, cap: BigDecimal): String =
        walletCall(account, walletKey, "set_daily_cap", JSONObject().put("cap", NearClient.toYocto(cap).toString()), BigInteger.ONE)

    fun setReceive(account: String, walletKey: KeyPair, pref: ReceivePref): String =
        walletCall(account, walletKey, "set_receive",
            JSONObject().put("pref", JSONObject().put("chain", pref.chain).put("token", pref.token).put("address", pref.address)),
            BigInteger.ONE)

    /** Over the cap, the wallet key pays directly: a plain NEAR transfer the user approves in the app. */
    fun walletTransfer(account: String, walletKey: KeyPair, to: String, amount: BigDecimal): String {
        val out = near.send(account, walletKey, to, listOf(Action.Transfer(NearClient.toYocto(amount))))
        if (!out.ok) throw NearClient.RpcException(out.failure ?: "transfer failed")
        return out.hash
    }

    private fun walletCall(account: String, walletKey: KeyPair, method: String, args: JSONObject, deposit: BigInteger): String {
        val out = near.send(account, walletKey, contract, listOf(NearClient.functionCall(method, args, deposit = deposit)))
        if (!out.ok) throw NearClient.RpcException("$method failed: ${out.failure}")
        return out.hash
    }

    companion object {
        fun parseResult(value: String?): PayResult = when (value?.trim('"')) {
            "Sent" -> PayResult.SENT
            "RefusedOverCap" -> PayResult.REFUSED_OVER_CAP
            "RefusedLowBalance" -> PayResult.REFUSED_LOW_BALANCE
            else -> throw NearClient.RpcException("unexpected result from the contract: $value")
        }

        fun txUrl(hash: String) = "https://testnet.nearblocks.io/txns/$hash"
    }
}
