package app.lunar.keyboard.setup

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import app.lunar.keyboard.BuildConfig
import app.lunar.keyboard.core.NearName
import app.lunar.keyboard.data.AccountStore
import app.lunar.keyboard.near.KeyPair
import app.lunar.keyboard.near.LunarPay
import app.lunar.keyboard.near.NearClient
import java.math.BigDecimal
import java.util.concurrent.Executors

/**
 * The testnet account part of the setup screen. On testnet this screen plays the wallet:
 * it holds the account's full-access key and is the only place that can top up, change the
 * cap, set where you get paid, or approve a payment over the cap. The keyboard never can.
 */
class WalletSection(private val activity: Activity, private val ui: Ui) {

    /** View helpers shared with the setup screen. */
    interface Ui {
        fun text(s: String, size: Float, bold: Boolean = false, muted: Boolean = false): TextView
        fun section(s: String): TextView
        fun button(label: String, onClick: () -> Unit): android.view.View
        fun card(body: LinearLayout.() -> Unit): LinearLayout
        fun px(v: Int): Int
    }

    private val accounts = AccountStore(activity)
    private val pay = LunarPay(NearClient(), BuildConfig.PAY_CONTRACT)
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private lateinit var box: LinearLayout
    private lateinit var status: TextView

    fun build(root: LinearLayout, request: PaymentRequest?) {
        box = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        root.addView(box)
        render(request)
    }

    fun close() = io.shutdownNow()

    data class PaymentRequest(val payee: String, val amount: BigDecimal, val memo: String?)

    private fun render(request: PaymentRequest?) {
        box.removeAllViews()
        status = ui.text("", 13f, muted = true)
        val account = accounts.accountId
        if (account == null || !accounts.isReady) renderCreate() else renderAccount(account, request)
        box.addView(status)
    }

    private fun renderCreate() {
        box.addView(ui.section("4 · Your testnet account"))
        box.addView(ui.text("Lunar creates a free NEAR testnet account, puts 3 test NEAR in your pocket and sets " +
            "a daily cap of 1 NEAR. The keyboard gets its own key that can only pay from that pocket.", 14f, muted = true))
        val name = EditText(activity).apply {
            hint = "pick a name"; tag = "account_name"; isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        }
        box.addView(name)
        box.addView(ui.button("Create account") {
            val id = name.text.toString().trim().lowercase().removeSuffix(".testnet") + ".testnet"
            if (!NearName.isValid(id) || id.count { it == '.' } != 1) {
                status.text = "Use lowercase letters, digits, - or _ only."
                return@button
            }
            create(id)
        })
    }

    private fun create(id: String) {
        status.text = "Creating $id…"
        val wallet = KeyPair.random()
        val keyboard = KeyPair.random()
        accounts.saveNew(id, wallet, keyboard)
        io.execute {
            val r = runCatching {
                createAccount(id, wallet.publicKeyString)
                waitForKey(id, wallet)
                pay.setUp(id, wallet, keyboard, topUp = BigDecimal("3"), cap = BigDecimal("1"))
            }
            main.post {
                r.onSuccess { accounts.markReady(); render(null) }
                    .onFailure { e -> accounts.forget(); status.text = "Couldn't create $id: ${e.message?.take(160)}" }
            }
        }
    }

    /**
     * Asks the testnet faucet directly; when it refuses this phone (it rate-limits per IP),
     * asks the Lunar web app to pass the same request on. Only the name and public key leave the phone.
     */
    private fun createAccount(id: String, publicKey: String) {
        try {
            NearClient.createTestnetAccount(id, publicKey)
        } catch (e: NearClient.RpcException) {
            if (BuildConfig.API_BASE.isBlank() || e.message?.contains("busy") != true) throw e
            val body = org.json.JSONObject().put("accountId", id).put("publicKey", publicKey).toString()
            val res = org.json.JSONObject(NearClient.post("${BuildConfig.API_BASE.trimEnd('/')}/api/testnet-account", body))
            if (!res.optBoolean("created")) {
                throw NearClient.RpcException(res.optJSONObject("error")?.optString("message") ?: "couldn't create the account")
            }
        }
    }

    private fun waitForKey(id: String, key: KeyPair) {
        val near = NearClient()
        repeat(20) {
            if (near.accessKeyNonce(id, key.publicKeyString) != null) return
            Thread.sleep(1000)
        }
        throw NearClient.RpcException("the new account didn't appear on testnet")
    }

    private fun renderAccount(account: String, request: PaymentRequest?) {
        if (request != null) renderRequest(account, request)

        box.addView(ui.section("4 · Your testnet account"))
        box.addView(ui.text(account, 16f, bold = true))
        val pocketLine = ui.text("Reading your pocket…", 14f, muted = true)
        box.addView(pocketLine)
        loadPocket(account, pocketLine)

        box.addView(ui.button("Top up 1 NEAR") {
            walletAction("Topping up") { pay.topUp(account, accounts.walletKey()!!, BigDecimal.ONE) }
        })

        val cap = EditText(activity).apply { hint = "daily cap in NEAR"; tag = "cap"; isSingleLine = true
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL }
        box.addView(cap)
        box.addView(ui.button("Set daily cap") {
            val v = cap.text.toString().toBigDecimalOrNull()
            if (v == null || v.signum() < 0) { status.text = "Type a number."; return@button }
            walletAction("Setting the cap") { pay.setCap(account, accounts.walletKey()!!, v) }
        })

        box.addView(ui.section("Where you get paid"))
        box.addView(ui.text("People paying you see a live price for this chain and token.", 14f, muted = true))
        val chain = EditText(activity).apply { hint = "chain: base, arb, sol or near"; tag = "recv_chain"; isSingleLine = true }
        val addr = EditText(activity).apply { hint = "your address on that chain"; tag = "recv_address"; isSingleLine = true }
        box.addView(chain); box.addView(addr)
        box.addView(ui.button("Save where I get paid") {
            val c = chain.text.toString().trim().lowercase()
            val a = addr.text.toString().trim()
            if (c !in setOf("base", "arb", "sol", "near") || a.length < 8) { status.text = "Pick base, arb, sol or near and paste your address."; return@button }
            walletAction("Saving") { pay.setReceive(account, accounts.walletKey()!!, LunarPay.ReceivePref(c, "USDC", a)) }
        })

        box.addView(ui.button("Forget this account on this phone") { accounts.forget(); render(null) })
    }

    private fun renderRequest(account: String, r: PaymentRequest) {
        box.addView(ui.card {
            addView(ui.text("Pay ${r.payee} · ${r.amount.toPlainString()} NEAR", 16f, bold = true))
            addView(ui.text("This is over the keyboard's daily cap, so it comes from $account directly. " +
                "Only this screen can approve it.", 14f, muted = true))
            addView(ui.button("Approve from wallet") {
                walletAction("Paying ${r.payee}") { pay.walletTransfer(account, accounts.walletKey()!!, r.payee, r.amount) }
            })
        })
    }

    private fun loadPocket(account: String, line: TextView) {
        io.execute {
            val r = runCatching { pay.pocket(account) }
            main.post {
                r.onSuccess { p ->
                    line.text = "Pocket ${fmt(p.balance)} NEAR · cap ${fmt(p.dailyCap)} NEAR a day · ${fmt(p.leftToday)} NEAR left today"
                }.onFailure { e -> line.text = "Couldn't read the pocket: ${e.message?.take(100)}" }
            }
        }
    }

    private fun walletAction(label: String, action: () -> String) {
        status.text = "$label…"
        io.execute {
            val r = runCatching(action)
            main.post {
                r.onSuccess { hash ->
                    render(null)
                    status.text = "Done · tap to see it on NEAR"
                    status.tag = "receipt"
                    status.setOnClickListener {
                        activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(LunarPay.txUrl(hash))))
                    }
                }.onFailure { e -> status.text = "$label failed: ${e.message?.take(160)}" }
            }
        }
    }

    private fun fmt(yocto: java.math.BigInteger) =
        NearClient.toNear(yocto).setScale(2, java.math.RoundingMode.DOWN).stripTrailingZeros().toPlainString()
}
