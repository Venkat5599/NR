package app.lunar.keyboard.ime

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import app.lunar.keyboard.BuildConfig
import app.lunar.keyboard.core.PayIntent
import app.lunar.keyboard.data.AccountStore
import app.lunar.keyboard.data.IntentsQuote
import app.lunar.keyboard.data.NameCheck
import app.lunar.keyboard.data.NearRpc
import app.lunar.keyboard.near.LunarPay
import app.lunar.keyboard.near.NearClient
import app.lunar.keyboard.setup.SetupActivity
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * The payment card in the strip: checks the name, the cap and the payee's chosen chain,
 * then pays with the keyboard key when the user taps Pay.
 */
class PayCard(
    private val context: Context,
    private val strip: StripView,
    private val io: ExecutorService,
    private val onDone: () -> Unit,
) {
    private val main = Handler(Looper.getMainLooper())
    private val accounts = AccountStore(context)
    private val pay = LunarPay(NearClient(), BuildConfig.PAY_CONTRACT)
    private var generation = 0
    private val lookups = Executors.newFixedThreadPool(4)

    fun cancel() {
        generation++
    }

    fun close() = lookups.shutdownNow()

    fun show(p: PayIntent) {
        val gen = ++generation
        val amount = p.amount.toPlainString()
        val memo = p.memo?.let { " · for $it" } ?: ""
        if (p.token != "NEAR") {
            strip.show("This test build pays in NEAR", "Type  pay ${p.payee} $amount  without \"${p.token.lowercase()}\"",
                StripView.Tone.WARN, onClose = onDone)
            return
        }
        if (!accounts.isReady) {
            strip.show("Pay ${p.payee} · $amount NEAR", "Set up Lunar first: it takes one tap in the app",
                StripView.Tone.NEUTRAL, action = "Set up", onAction = { openApp(null) }, onClose = onDone)
            return
        }
        val me = accounts.accountId!!
        strip.show("Pay ${p.payee} · $amount NEAR", "Checking ${p.payee}…$memo", StripView.Tone.NEUTRAL, onClose = onDone)

        io.execute {
            val lines = ArrayList<String>()
            var tone = StripView.Tone.OK
            var canPay = true
            var overCap = false

            // independent reads run together: the card should settle in about one round trip
            val account = CompletableFuture.supplyAsync({ NearRpc.viewAccount(p.payee) }, lookups)
            val name = CompletableFuture.supplyAsync({ NameCheck.check(p.payee) }, lookups)
            val pocket = CompletableFuture.supplyAsync({ runCatching { pay.pocket(me) } }, lookups)
            val pref = CompletableFuture.supplyAsync({ runCatching { pay.receivePref(p.payee) }.getOrNull() }, lookups)

            when (val acc = account.get()) {
                is NearRpc.Account.Missing -> { lines += "No account called ${p.payee}"; tone = StripView.Tone.WARN; canPay = false }
                is NearRpc.Account.Failed -> { lines += "Couldn't reach NEAR"; tone = StripView.Tone.WARN; canPay = false }
                is NearRpc.Account.Found -> when (val v = name.get()) {
                    is NameCheck.Verdict.KeyChanged -> { lines += "${p.payee} got a new owner key ${days(v.daysAgo)}"; tone = StripView.Tone.WARN }
                    is NameCheck.Verdict.NewAccount -> { lines += "${p.payee} was created ${days(v.ageDays)}"; tone = StripView.Tone.WARN }
                    is NameCheck.Verdict.Settled -> lines += "${p.payee} ✓ ${v.ageDays} days old"
                    is NameCheck.Verdict.Unknown -> lines += "${p.payee} ✓ exists"
                }
            }
            if (p.payee == me) { lines.add(0, "That's you"); canPay = false; tone = StripView.Tone.WARN }

            if (canPay) {
                pocket.get().onSuccess { pk ->
                    val left = NearClient.toNear(pk.leftToday)
                    if (p.amount > left) {
                        overCap = true
                        lines += "Over today's cap (${left.toPlainString()} left) · opens the app"
                        tone = StripView.Tone.WARN
                    } else {
                        lines += "${left.subtract(p.amount).stripTrailingZeros().toPlainString()} NEAR left today after this"
                    }
                }.onFailure { lines += "Couldn't read your pocket" }

                pref.get()?.takeIf { it.chain != "near" }?.let { rp ->
                    runCatching { IntentsQuote.quote(p.amount, rp.chain, rp.token, rp.address) }.getOrNull()?.let { q ->
                        lines += "On mainnet: ≈ ${q.amountOut} ${q.token} on ${chainName(q.chain)} (live Intents quote)"
                    }
                }
            }

            main.post {
                if (gen != generation) return@post
                val detail = lines.joinToString("\n") + memo
                when {
                    !canPay -> strip.show("Pay ${p.payee} · $amount NEAR", detail, tone, onClose = onDone)
                    overCap -> strip.show("Pay ${p.payee} · $amount NEAR", detail, tone,
                        action = "Wallet", onAction = { openApp(p) }, onClose = onDone)
                    else -> strip.show("Pay ${p.payee} · $amount NEAR", detail, tone,
                        action = "Pay", onAction = { send(p, me) }, onClose = onDone)
                }
            }
        }
    }

    private fun send(p: PayIntent, me: String) {
        val gen = ++generation
        val key = accounts.keyboardKey() ?: return
        strip.show("Paying ${p.payee} · ${p.amount.toPlainString()} NEAR", "Signing with the keyboard key…", StripView.Tone.NEUTRAL)
        io.execute {
            val r = runCatching { pay.pay(me, key, p.payee, p.amount, p.memo) }
            main.post {
                if (gen != generation) return@post
                r.onSuccess { paid ->
                    val url = LunarPay.txUrl(paid.txHash)
                    when (paid.result) {
                        LunarPay.PayResult.SENT -> strip.show("Sent ${p.amount.toPlainString()} NEAR to ${p.payee}",
                            "Tap Receipt to see it on NEAR", StripView.Tone.OK, action = "Receipt", onAction = { open(url) }, onClose = onDone)
                        LunarPay.PayResult.REFUSED_OVER_CAP -> strip.show("The contract refused: over today's cap",
                            "Nothing left your pocket", StripView.Tone.WARN, action = "Receipt", onAction = { open(url) }, onClose = onDone)
                        LunarPay.PayResult.REFUSED_LOW_BALANCE -> strip.show("Not enough in your pocket",
                            "Top up in the Lunar app", StripView.Tone.WARN, action = "Open", onAction = { openApp(null) }, onClose = onDone)
                    }
                }.onFailure { e ->
                    strip.show("Payment didn't go through", e.message?.take(90) ?: "unknown error", StripView.Tone.WARN, onClose = onDone)
                }
            }
        }
    }

    private fun days(n: Long) = when (n) { 0L -> "today"; 1L -> "yesterday"; else -> "$n days ago" }

    private fun chainName(c: String) = when (c.lowercase()) {
        "base" -> "Base"; "arb" -> "Arbitrum"; "sol" -> "Solana"; "eth" -> "Ethereum"; "pol" -> "Polygon"; "bsc" -> "BNB Chain"
        else -> c
    }

    private fun open(url: String) {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun openApp(p: PayIntent?) {
        context.startActivity(Intent(context, SetupActivity::class.java).apply {
            // reuse the open screen but hand it this request (onNewIntent)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            if (p != null) {
                putExtra(SetupActivity.EXTRA_PAYEE, p.payee)
                putExtra(SetupActivity.EXTRA_AMOUNT, p.amount.toPlainString())
                putExtra(SetupActivity.EXTRA_MEMO, p.memo)
            }
        })
    }
}
