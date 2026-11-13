package app.lunar.keyboard.setup

import android.app.Activity
import android.content.Intent
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import app.lunar.keyboard.BuildConfig
import app.lunar.keyboard.core.NearName
import app.lunar.keyboard.data.AccountStore
import app.lunar.keyboard.near.KeyPair
import app.lunar.keyboard.near.LunarPay
import app.lunar.keyboard.near.NearClient
import app.lunar.keyboard.near.TestnetSwap
import app.lunar.keyboard.data.Prices
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import java.util.concurrent.Executors

/**
 * The wallet part of the app. On testnet this screen plays the wallet: it holds the account's
 * full-access key and is the only place that can top up, change the cap, set where money sent to
 * your receive address goes, or approve a payment over the cap. The keyboard never can.
 */
class WalletSection(private val activity: Activity, private val kit: Kit) {

    private val accounts = AccountStore(activity)
    private val pay = LunarPay(NearClient(), BuildConfig.PAY_CONTRACT)
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private lateinit var box: LinearLayout
    private lateinit var status: TextView

    private var swapRequest: SwapRequest? = null
    private var receive: ReceiveSection? = null

    /** The card a request from the keyboard opened (an over-cap payment or a swap); the screen scrolls to it. */
    var waiting: android.view.View? = null
        private set

    fun build(root: LinearLayout, request: PaymentRequest?, swap: SwapRequest? = null) {
        box = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        root.addView(box)
        swapRequest = swap
        render(request)
    }

    data class SwapRequest(val amount: BigDecimal, val symbol: String)

    fun close() {
        io.shutdownNow()
        receive?.close()
    }

    data class PaymentRequest(val payee: String, val amount: BigDecimal, val memo: String?)

    private fun render(request: PaymentRequest?) {
        box.removeAllViews()
        waiting = null
        status = kit.text("", 13.5f, muted = true).apply { setPadding(0, kit.px(10), 0, 0); visibility = android.view.View.GONE }
        val account = accounts.accountId
        if (account == null || !accounts.isReady) renderCreate() else renderAccount(account, request)
    }

    // ---------------------------------------------------------------- create

    private fun renderCreate() {
        box.addView(kit.card {
            addView(kit.label("Your testnet wallet"))
            addView(kit.displayText("Make a free account", 24f).apply { setPadding(0, kit.px(10), 0, 0) })
            addView(kit.text("Lunar creates a NEAR testnet account, puts 3 test NEAR in your pocket and sets a daily cap of 1 NEAR. " +
                "The keyboard gets its own key that can only pay from that pocket.", 14.5f, muted = true).apply { setPadding(0, kit.px(8), 0, 0) })
            val name = kit.field("pick a name", "account_name").apply { imeOptions = android.view.inputmethod.EditorInfo.IME_ACTION_DONE }
            addView(name)
            val hint = kit.text(".testnet is added for you", 12.5f, faint = true).apply { setPadding(kit.px(4), kit.px(6), 0, 0) }
            addView(hint)
            // checks the name against testnet as you type, so a taken name is caught before Create
            var checking: Runnable? = null
            name.addTextChangedListener(object : android.text.TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) = Unit
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) = Unit
                override fun afterTextChanged(s: android.text.Editable?) {
                    checking?.let { main.removeCallbacks(it) }
                    val id = idFrom(s.toString())
                    if (id == null) { hint.text = ".testnet is added for you"; hint.setTextColor(kit.palette.textFaint); return }
                    val run = Runnable {
                        io.execute {
                            val taken = runCatching { NearClient().exists(id) }.getOrNull()
                            main.post {
                                if (idFrom(name.text.toString()) != id) return@post
                                when (taken) {
                                    false -> { hint.text = "$id is free"; hint.setTextColor(kit.palette.ok) }
                                    true -> { hint.text = "$id is taken, pick another"; hint.setTextColor(kit.palette.danger) }
                                    null -> { hint.text = ".testnet is added for you"; hint.setTextColor(kit.palette.textFaint) }
                                }
                            }
                        }
                    }
                    checking = run
                    main.postDelayed(run, 350)
                }
            })
            addView(kit.primary("Create account") {
                val id = idFrom(name.text.toString())
                if (id == null) {
                    say("Use lowercase letters, digits, - or _ only.")
                    return@primary
                }
                create(id, name)
            })
            addView(status)
        })
    }

    /** "Solar" or "solar.testnet" → "solar.testnet"; null when it can't be a top-level testnet name. */
    private fun idFrom(typed: String): String? {
        val base = typed.trim().lowercase().removeSuffix(".testnet")
        if (base.length < 2) return null
        val id = "$base.testnet"
        return if (NearName.isValid(id) && id.count { it == '.' } == 1) id else null
    }

    private fun create(id: String, name: android.widget.EditText) {
        val started = System.currentTimeMillis()
        say("Checking $id…")
        val wallet = KeyPair.random()
        val keyboard = KeyPair.random()
        io.execute {
            val near = NearClient()
            val r = runCatching {
                fun lap(step: String) = debugLog("  $step at ${System.currentTimeMillis() - started} ms")
                if (near.exists(id)) throw Taken(id, freeNameLike(near, id).also { lap("taken, suggestion") })
                lap("name free")
                main.post { say("Creating $id… (1 of 2)") }
                accounts.saveNew(id, wallet, keyboard)
                createAccount(id, wallet.publicKeyString)
                lap("faucet answered")
                waitForKey(near, id, wallet)
                lap("key visible")
                main.post { say("Adding the keyboard key and filling your pocket… (2 of 2)") }
                pay.setUp(id, wallet, keyboard, topUp = BigDecimal("3"), cap = BigDecimal("1"), lap = ::lap)
                lap("set up")
            }
            val took = (System.currentTimeMillis() - started) / 100 / 10.0
            debugLog("create $id: ${if (r.isSuccess) "ok" else r.exceptionOrNull()?.message} in $took s")
            main.post {
                r.onSuccess { accounts.markReady(); render(null) }
                    .onFailure { e ->
                        if (e is Taken) {
                            say("$id is taken. ${e.suggestion?.let { "$it is free, it's filled in for you." } ?: "Pick another name."}")
                            e.suggestion?.let { name.setText(it.removeSuffix(".testnet")); name.setSelection(name.text.length) }
                            return@onFailure
                        }
                        accounts.forget()
                        say("Couldn't create $id: ${e.message?.take(160)}")
                    }
            }
        }
    }

    private class Taken(id: String, val suggestion: String?) : Exception("$id is taken")

    /** A free name close to the one asked for: name-1234.testnet. */
    private fun freeNameLike(near: NearClient, id: String): String? {
        val base = id.removeSuffix(".testnet").take(50)
        repeat(4) {
            val candidate = "$base-${(1000..9999).random()}.testnet"
            if (runCatching { near.exists(candidate) }.getOrDefault(true).not()) return candidate
        }
        return null
    }

    private fun debugLog(s: String) {
        if (activity.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0) android.util.Log.d("LunarCreate", s)
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

    /** The faucet waits for its own transaction, so the key is normally there on the first read. */
    private fun waitForKey(near: NearClient, id: String, key: KeyPair) {
        repeat(60) {
            if (near.accessKeyNonce(id, key.publicKeyString) != null) return
            Thread.sleep(250)
        }
        throw NearClient.RpcException("the new account didn't appear on testnet")
    }

    // ---------------------------------------------------------------- account

    private fun renderAccount(account: String, request: PaymentRequest?) {
        if (request != null) renderRequest(account, request)

        val balance = kit.displayText("…", 40f)
        val capLine = kit.text("Reading your pocket…", 13.5f, muted = true)
        val meterSlot = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        val capField = kit.field("new daily cap in NEAR", "cap", number = true).apply { visibility = android.view.View.GONE }
        val capSave = kit.primary("Set daily cap") {
            val v = NearClient.parseNear(capField.text.toString().trim())
            if (v == null || v.signum() < 0) { say("Type a number."); return@primary }
            walletAction("Setting the cap") { pay.setCap(account, accounts.walletKey()!!, v) }
        }.apply { visibility = android.view.View.GONE }

        box.addView(kit.card {
            addView(kit.label("Pocket"))
            addView(balance.apply { setPadding(0, kit.px(6), 0, 0); tag = "balance" })
            addView(kit.text(account, 14f, muted = true))
            addView(meterSlot)
            addView(capLine.apply { setPadding(0, kit.px(8), 0, 0) })
            addView(kit.row {
                addView(kit.secondary("Top up 1 NEAR") {
                    walletAction("Topping up") { pay.topUp(account, accounts.walletKey()!!, BigDecimal.ONE) }
                }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = kit.px(8) })
                addView(kit.secondary("Change cap") {
                    capField.visibility = android.view.View.VISIBLE
                    capSave.visibility = android.view.View.VISIBLE
                    capField.requestFocus()
                }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            }.apply { layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = kit.px(4) } })
            addView(capField)
            addView(capSave)
            addView(status)
        })
        loadPocket(account, balance, capLine, meterSlot)

        renderSwap(account, swapRequest)
        swapRequest = null
        receive?.close()
        receive = ReceiveSection(activity, kit, account, pay).also { it.build(box) }

        box.addView(kit.text("Forget this account on this phone", 13.5f, muted = true).apply {
            setPadding(0, kit.px(16), 0, 0)
            setOnClickListener { accounts.forget(); render(null) }
        })
    }

    private fun renderRequest(account: String, r: PaymentRequest) {
        waiting = kit.card {
            background = GradientDrawable().apply {
                cornerRadius = kit.pxf(22f); setColor(kit.palette.card); setStroke(kit.px(2), kit.palette.accent)
            }
            addView(kit.label("Waiting for you"))
            addView(kit.text("Pay ${r.payee} · ${r.amount.toPlainString()} NEAR", 18f, bold = true).apply { setPadding(0, kit.px(8), 0, 0) })
            r.memo?.let { addView(kit.text("For $it", 14f, muted = true)) }
            addView(kit.text("This is over the keyboard's daily cap, so it comes from $account directly. Only this screen can approve it.",
                14f, muted = true).apply { setPadding(0, kit.px(6), 0, 0) })
            addView(kit.primary("Approve from wallet") {
                walletAction("Paying ${r.payee}") { pay.walletTransfer(account, accounts.walletKey()!!, r.payee, r.amount) }
            })
        }
        box.addView(waiting)
    }

    /**
     * Swaps NEAR from the wallet into testnet USDC or USDT on Ref Finance, for real. The quote
     * comes from the pool; the market price from NEAR Intents is shown beside it, because test
     * pools don't trade at market rates.
     */
    private fun renderSwap(account: String, request: SwapRequest?) {
        val symbols = listOf("USDC", "USDT")
        var symbol = request?.symbol?.uppercase()?.takeIf { it in symbols } ?: "USDC"
        val holdings = kit.text("Reading balances…", 13.5f, muted = true).apply { setPadding(0, kit.px(8), 0, 0) }
        val quote = kit.text("", 14.5f).apply { setPadding(0, kit.px(10), 0, 0); visibility = android.view.View.GONE }
        val amount = kit.field("amount of NEAR", "swap_amount", number = true).apply { request?.let { setText(it.amount.toPlainString()) } }
        val swapper = TestnetSwap(NearClient())
        val result = kit.text("", 13.5f).apply { setPadding(0, kit.px(10), 0, 0); visibility = android.view.View.GONE }

        fun refreshHoldings() = io.execute {
            val nearBal = runCatching { NearClient().balance(account) }.getOrNull()
            val toks = TestnetSwap.ROUTES.map { r -> r.symbol to swapper.balance(r.token, account, r.decimals) }
            main.post {
                holdings.text = "In this wallet: " + listOfNotNull(
                    nearBal?.let { "${fmt(it)} NEAR" },
                    *toks.map { (sym, b) -> b?.let { "${it.toPlainString()} test-$sym" } }.toTypedArray(),
                ).joinToString(" · ")
            }
        }

        fun requote() {
            val a = NearClient.parseNear(amount.text.toString().trim())
            if (a == null || a.signum() <= 0) { quote.visibility = android.view.View.GONE; return }
            val s = symbol
            quote.visibility = android.view.View.VISIBLE
            quote.text = "Quoting…"
            io.execute {
                val q = runCatching { swapper.quote(a, s) }
                val market = Prices.usd(a, "NEAR", Prices.all())
                main.post {
                    if (NearClient.parseNear(amount.text.toString().trim()) != a || symbol != s) return@post
                    quote.text = q.fold(
                        { "You get ≈ ${it.out.toPlainString()} test-$s from the testnet pool" + (market?.let { m -> "\nMarket value of ${a.toPlainString()} NEAR: $m" } ?: "") },
                        { "No quote: ${it.message?.take(80)}" })
                }
            }
        }

        val swapCard = kit.card {
            if (request != null) background = GradientDrawable().apply {
                cornerRadius = kit.pxf(22f); setColor(kit.palette.card); setStroke(kit.px(2), kit.palette.accent)
            }
            addView(kit.label(if (request != null) "Swap from the keyboard" else "Swap"))
            addView(kit.text("Turn NEAR into a stablecoin on NEAR testnet (Ref Finance). Signed by this wallet, never by the keyboard.",
                14.5f, muted = true).apply { setPadding(0, kit.px(8), 0, 0) })
            addView(holdings)
            addView(kit.segmented(symbols, symbols.indexOf(symbol)) { i -> symbol = symbols[i]; requote() })
            addView(amount)
            addView(quote)
            addView(kit.primary("Swap now") {
                val a = NearClient.parseNear(amount.text.toString().trim())
                if (a == null || a.signum() <= 0) { result.show("Type how much NEAR to swap.", kit.palette.textMuted); return@primary }
                val s = symbol
                result.show("Swapping ${a.toPlainString()} NEAR to $s…", kit.palette.textMuted)
                io.execute {
                    val r = runCatching { swapper.swap(account, accounts.walletKey()!!, swapper.quote(a, s)) }
                    main.post {
                        r.onSuccess { done ->
                            // the result stays in this card, where the button was tapped
                            result.show("Swapped: got ${done.received?.toPlainString() ?: "?"} test-$s · tap to see it on NEAR", kit.palette.ok)
                            result.setOnClickListener {
                                activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(LunarPay.txUrl(done.txHashes.last()))))
                            }
                            amount.setText("")
                            refreshHoldings()
                        }.onFailure { e -> result.show("Swap failed: ${e.message?.take(160)}", kit.palette.danger) }
                    }
                }
            })
            addView(result)
        }
        box.addView(swapCard)
        if (request != null) waiting = swapCard
        amount.addTextChangedListener(object : android.text.TextWatcher {
            override fun afterTextChanged(e: android.text.Editable?) = requote()
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) = Unit
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) = Unit
        })
        if (request != null) requote()
        refreshHoldings()
    }

    private fun TextView.show(text: String, color: Int) {
        this.text = text
        setTextColor(color)
        visibility = android.view.View.VISIBLE
    }

    private fun loadPocket(account: String, balance: TextView, capLine: TextView, meterSlot: LinearLayout) {
        io.execute {
            val r = runCatching { pay.pocket(account) }
            main.post {
                r.onSuccess { p ->
                    balance.text = "${fmt(p.balance)} NEAR"
                    capLine.text = "${fmt(p.leftToday)} NEAR left today · cap ${fmt(p.dailyCap)} NEAR a day"
                    val fraction = if (p.dailyCap.signum() == 0) 0f else p.leftToday.toBigDecimal().divide(p.dailyCap.toBigDecimal(), 4, RoundingMode.DOWN).toFloat()
                    meterSlot.removeAllViews()
                    meterSlot.addView(kit.meter(fraction))
                }.onFailure { e -> capLine.text = "Couldn't read the pocket: ${e.message?.take(100)}" }
            }
        }
    }

    private fun walletAction(label: String, action: () -> String) {
        say("$label…")
        io.execute {
            val r = runCatching(action)
            main.post {
                r.onSuccess { hash ->
                    render(null)
                    say("Done · tap to see it on NEAR")
                    status.tag = "receipt"
                    status.setTextColor(kit.palette.ok)
                    status.setOnClickListener {
                        activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(LunarPay.txUrl(hash))))
                    }
                }.onFailure { e -> say("$label failed: ${e.message?.take(160)}") }
            }
        }
    }

    private fun say(s: String) {
        status.text = s
        status.visibility = android.view.View.VISIBLE
    }

    private fun fmt(yocto: BigInteger) = NearClient.toNear(yocto).setScale(2, RoundingMode.DOWN).stripTrailingZeros().toPlainString()
}
