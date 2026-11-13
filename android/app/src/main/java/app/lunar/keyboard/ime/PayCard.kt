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
import app.lunar.keyboard.data.RecentStore
import app.lunar.keyboard.data.Prices
import app.lunar.keyboard.near.TestnetSwap
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
    /** Types text into the chat the keyboard is serving (used to share a receipt). */
    private val insert: (String) -> Unit,
) {
    private val main = Handler(Looper.getMainLooper())
    private val accounts = AccountStore(context)
    private val recent = RecentStore(context)
    private val pay = LunarPay(NearClient(), BuildConfig.PAY_CONTRACT)
    private var generation = 0
    private val lookups = Executors.newFixedThreadPool(4)

    /** True while a payment is being signed and sent; the card must stay until it settles. */
    var busy = false
        private set

    fun cancel() {
        generation++
    }

    /** Lookups about one payee, started early and shared by the card that follows. */
    private class Lookups(
        val at: Long,
        val account: CompletableFuture<NearRpc.Account>,
        val name: CompletableFuture<NameCheck.Verdict>,
        val pref: CompletableFuture<LunarPay.ReceivePref?>,
    )

    private val early = HashMap<String, Lookups>()

    /**
     * Starts the checks on [payee] before the card is asked for (the user is still typing the
     * amount), so the card usually opens already filled in.
     */
    fun prefetch(payee: String) {
        if (!app.lunar.keyboard.core.NearName.isValid(payee) || '.' !in payee) return
        lookupsFor(payee)
    }

    private fun lookupsFor(payee: String): Lookups {
        val now = System.currentTimeMillis()
        early[payee]?.takeIf { now - it.at < 30_000 }?.let { return it }
        return Lookups(
            now,
            CompletableFuture.supplyAsync({ NearRpc.viewAccount(payee) }, lookups),
            CompletableFuture.supplyAsync({ NameCheck.check(payee) }, lookups),
            CompletableFuture.supplyAsync({ runCatching { pay.receivePref(payee) }.getOrNull() }, lookups),
        ).also { early[payee] = it }
    }

    fun close() = lookups.shutdownNow()

    fun show(p: PayIntent) {
        val gen = ++generation
        val amount = p.amount.toPlainString()
        val memoLine = p.memo?.let { "For $it" }
        if (p.token != "NEAR") {
            strip.show("This test build pays in NEAR", "${p.token} payments need mainnet. Switch the currency to NEAR to try it on testnet.",
                StripView.Tone.WARN, onClose = onDone)
            return
        }
        if (!accounts.isReady) {
            strip.show("Pay ${p.payee} · $amount NEAR", "Set up Lunar first: it takes one tap in the app",
                StripView.Tone.NEUTRAL, action = "Set up", onAction = { openApp(null) }, onClose = onDone)
            return
        }
        val me = accounts.accountId!!
        // the dollar value sits next to every amount: "200" typed for "20" shows up as a 10x bigger number
        val usd = Prices.usd(p.amount, "NEAR")?.let { "≈ $it at today's price" }
        strip.show("Pay ${p.payee} · $amount NEAR", listOfNotNull("Checking ${p.payee}…", usd, memoLine).joinToString("\n"), StripView.Tone.NEUTRAL, onClose = onDone)

        val queued = System.currentTimeMillis()
        io.execute {
            val started = System.currentTimeMillis()
            trace("card ${p.payee}: started after ${started - queued} ms in the queue")
            val lines = ArrayList<String>()
            var tone = StripView.Tone.OK
            var canPay = true
            var overCap = false

            // independent reads run together: the card should settle in about one round trip
            val early = lookupsFor(p.payee)
            val account = early.account
            val name = early.name
            val pref = early.pref
            val pocket = CompletableFuture.supplyAsync({ runCatching { pay.pocket(me) } }, lookups)

            when (val acc = within(account, 6, NearRpc.Account.Failed("timed out"))) {
                is NearRpc.Account.Missing -> { lines += "No account called ${p.payee}"; tone = StripView.Tone.WARN; canPay = false }
                is NearRpc.Account.Failed -> { lines += "Couldn't reach NEAR"; tone = StripView.Tone.WARN; canPay = false }
                // the key history is a nice-to-have: never let it hold the card up
                is NearRpc.Account.Found -> when (val v = within(name, 3, NameCheck.Verdict.Unknown("timed out"))) {
                    is NameCheck.Verdict.KeyChanged -> { lines += "${p.payee} got a new owner key ${days(v.daysAgo)}"; tone = StripView.Tone.WARN }
                    is NameCheck.Verdict.NewAccount -> { lines += "${p.payee} was created ${days(v.ageDays)}"; tone = StripView.Tone.WARN }
                    is NameCheck.Verdict.Settled -> lines += "${p.payee} · ${v.ageDays} days old"
                    is NameCheck.Verdict.Unknown -> lines += "${p.payee} · exists"
                }
            }
            if (p.payee == me) { lines.add(0, "That's you"); canPay = false; tone = StripView.Tone.WARN }

            if (canPay) {
                within(pocket, 6, Result.failure(NearClient.RpcException("timed out"))).onSuccess { pk ->
                    val left = NearClient.toNear(pk.leftToday)
                    if (p.amount > left) {
                        overCap = true
                        lines += "Over today's cap (${left.toPlainString()} left) · opens the app"
                        tone = StripView.Tone.WARN
                    } else {
                        lines += "${left.subtract(p.amount).stripTrailingZeros().toPlainString()} NEAR left today after this"
                    }
                }.onFailure { lines += "Couldn't read your pocket" }

                within(pref, 3, null)?.takeIf { it.chain != "near" }?.let { rp ->
                    runCatching { IntentsQuote.quote(p.amount, rp.chain, rp.token, rp.address) }.getOrNull()?.let { q ->
                        lines += "On mainnet: ≈ ${q.amountOut} ${q.token} on ${chainName(q.chain)} (live Intents quote)"
                    }
                }
            }

            trace("card ${p.payee}: settled in ${System.currentTimeMillis() - started} ms, gen $gen/$generation")
            main.post {
                if (gen != generation) return@post
                val detail = (lines + listOfNotNull(usd, memoLine)).joinToString("\n")
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
        busy = true
        io.execute {
            val r = runCatching { pay.pay(me, key, p.payee, p.amount, p.memo) }
            main.post {
                busy = false
                if (gen != generation) return@post
                r.onSuccess { paid ->
                    val url = LunarPay.txUrl(paid.txHash)
                    when (paid.result) {
                        LunarPay.PayResult.SENT -> {
                            recent.add(p.payee)
                            strip.show("Sent ${p.amount.toPlainString()} NEAR to ${p.payee}",
                                "Settled on NEAR testnet", StripView.Tone.OK,
                                action = "Share", onAction = { insert("Sent you ${p.amount.toPlainString()} NEAR · $url"); onDone() },
                                secondaryAction = "Receipt", onSecondary = { open(url) }, onClose = onDone)
                        }
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

    /** The future's value, or [fallback] if it isn't ready in [seconds] or failed. */
    private fun <T> within(f: CompletableFuture<T>, seconds: Long, fallback: T): T =
        try { f.get(seconds, java.util.concurrent.TimeUnit.SECONDS) } catch (e: java.util.concurrent.TimeoutException) { fallback }
        catch (e: java.util.concurrent.ExecutionException) { fallback }

    /**
     * A swap card: the live market price and the testnet pool's quote. The keyboard's key can
     * only call `pay`, so the swap itself is approved in the app with the wallet key.
     */
    fun showSwap(amount: java.math.BigDecimal, symbol: String) {
        val gen = ++generation
        val amt = amount.stripTrailingZeros().toPlainString()
        strip.show("Swap $amt NEAR to $symbol", "Getting a quote…", StripView.Tone.NEUTRAL, onClose = onDone)
        io.execute {
            val market = Prices.all().let { prices -> Prices.usd(amount, "NEAR", prices) }
            val q = runCatching { TestnetSwap(NearClient()).quote(amount, symbol) }
            main.post {
                if (gen != generation) return@post
                val lines = listOfNotNull(
                    market?.let { "Market: $amt NEAR ≈ $it (NEAR Intents)" },
                    q.getOrNull()?.let { "Testnet pool: ≈ ${it.out.toPlainString()} test-$symbol (Ref Finance)" }
                        ?: "Testnet pool unavailable: ${q.exceptionOrNull()?.message?.take(60)}",
                    "Swaps are approved in the app; the keyboard can only pay",
                )
                strip.show("Swap $amt NEAR to $symbol", lines.joinToString("\n"), StripView.Tone.NEUTRAL,
                    action = if (q.isSuccess) "Review" else null, onAction = { openSwap(amount, symbol) }, onClose = onDone)
            }
        }
    }

    private fun openSwap(amount: java.math.BigDecimal, symbol: String) {
        context.startActivity(Intent(context, SetupActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra(SetupActivity.EXTRA_SWAP_AMOUNT, amount.toPlainString())
            putExtra(SetupActivity.EXTRA_SWAP_TO, symbol)
        })
    }

    /** Debug builds only: card timings (tag LunarCard). */
    private fun trace(s: String) {
        if (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0) android.util.Log.d("LunarCard", s)
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
