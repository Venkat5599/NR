package app.lunar.keyboard.setup

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.widget.LinearLayout
import android.widget.TextView
import app.lunar.keyboard.data.AccountStore
import app.lunar.keyboard.near.Evm
import app.lunar.keyboard.near.LunarPay
import app.lunar.keyboard.near.NearClient
import app.lunar.keyboard.near.ReceiveContract
import app.lunar.keyboard.near.Stage
import java.math.BigInteger
import java.util.concurrent.Executors

/**
 * "Get paid from any wallet": the account's receive address on Base. NEAR's Chain Signatures
 * controls it, so no private key for it exists; money that lands there can only be forwarded to
 * the address the owner set, after NEAR's signer has verified the transfer on Base.
 */
class ReceiveSection(
    private val activity: Activity,
    private val kit: Kit,
    private val account: String,
    private val pay: LunarPay,
) {
    private val accounts = AccountStore(activity)
    private val near = NearClient()
    private val recv = ReceiveContract(near)
    private val evm = Evm()
    private val io = Executors.newFixedThreadPool(2)
    private val main = Handler(Looper.getMainLooper())

    private lateinit var body: LinearLayout
    private lateinit var note: TextView

    fun build(parent: LinearLayout) {
        parent.addView(kit.card {
            addView(kit.label("Get paid from any wallet"))
            addView(kit.text("Your own address on Base for USDC. Anyone can pay it from any wallet or exchange. " +
                "NEAR controls it: no private key for it exists, and money that lands there can only go on to the address you choose.",
                14.5f, muted = true).apply { setPadding(0, kit.px(8), 0, 0) })
            body = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
            addView(body)
            note = kit.text("", 13.5f, muted = true).apply { setPadding(0, kit.px(10), 0, 0); tag = "recv_note"; visibility = android.view.View.GONE }
            addView(note)
        })
        load()
    }

    fun close() = io.shutdownNow()

    private fun say(s: String, color: Int = kit.palette.textMuted, link: String? = null) {
        note.text = s
        note.setTextColor(color)
        note.visibility = if (s.isEmpty()) android.view.View.GONE else android.view.View.VISIBLE
        if (link != null) note.setOnClickListener { open(link) } else note.setOnClickListener(null)
    }

    private fun open(url: String) = activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))

    private fun load() {
        body.removeAllViews()
        body.addView(kit.text("Reading your receive address…", 13.5f, faint = true).apply { setPadding(0, kit.px(10), 0, 0) })
        io.execute {
            val r = runCatching { recv.receiver(account) }
            main.post {
                body.removeAllViews()
                r.onSuccess { rec -> if (rec == null) renderSetup(null) else renderAddress(rec) }
                    .onFailure { e -> say("Couldn't read the receive contract: ${e.message?.take(120)}", kit.palette.danger) }
            }
        }
    }

    // ---------------------------------------------------------------- set up / change

    private fun renderSetup(existing: ReceiveContract.Receiver?) {
        body.removeAllViews()
        val forward = kit.field("your address on Base (0x…)", "recv_forward").apply { existing?.forwardTo?.let { setText(it) } }
        body.addView(forward)
        body.addView(kit.text("Money sent to your receive address is forwarded here, on Base.", 12.5f, faint = true)
            .apply { setPadding(kit.px(4), kit.px(6), 0, 0) })
        body.addView(kit.primary(if (existing == null) "Get my receive address" else "Save") {
            val to = forward.text.toString().trim()
            if (!Evm.isAddress(to)) { say("That isn't a Base address: it starts with 0x and has 40 more letters and digits.", kit.palette.danger); return@primary }
            val key = accounts.walletKey() ?: return@primary
            say(if (existing == null) "Asking NEAR's signer for your address…" else "Saving…")
            io.execute {
                val r = runCatching {
                    val hash = recv.register(account, key, to, firstTime = existing == null)
                    // payers' cards show what you'd get on Base on mainnet; best effort, the address above is what matters
                    runCatching { pay.setReceive(account, key, LunarPay.ReceivePref("base", "USDC", to.lowercase())) }
                    hash
                }
                main.post {
                    r.onSuccess { hash -> say("Done · tap to see it on NEAR", kit.palette.ok, LunarPay.txUrl(hash)); load() }
                        .onFailure { e -> say("Couldn't save: ${e.message?.take(160)}", kit.palette.danger) }
                }
            }
        })
        if (existing != null) body.addView(kit.secondary("Cancel") { renderAddress(existing) })
    }

    // ---------------------------------------------------------------- the address and what arrived

    private fun renderAddress(rec: ReceiveContract.Receiver) {
        body.removeAllViews()
        body.addView(kit.text(rec.address, 15f, bold = true).apply {
            typeface = Typeface.MONOSPACE
            tag = "recv_address"
            setPadding(0, kit.px(12), 0, 0)
        })
        body.addView(kit.row {
            addView(kit.secondary("Copy") {
                (activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
                    .setPrimaryClip(ClipData.newPlainText("Lunar receive address", rec.address))
                say("Copied. Send USDC on Base Sepolia to it.")
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = kit.px(8) })
            addView(kit.secondary("Share") {
                activity.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain")
                    .putExtra(Intent.EXTRA_TEXT, "Pay me USDC on Base: ${rec.address}"), "Share your receive address"))
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        })
        body.addView(kit.text("Forwards to ${short(rec.forwardTo ?: "the sender (no address set)")} · Change", 13.5f, muted = true).apply {
            setPadding(0, kit.px(12), 0, 0)
            setOnClickListener { renderSetup(rec) }
        })
        val holdings = kit.text("…", 13.5f, muted = true).apply { setPadding(0, kit.px(6), 0, 0); tag = "recv_holdings" }
        body.addView(holdings)
        val list = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL; tag = "recv_list" }
        body.addView(list)
        body.addView(kit.secondary("Check for payments") { refresh(rec, holdings, list) })
        body.addView(kit.text("Base Sepolia (testnet), USDC. Base only counts a payment as final about 3 hours after it lands; " +
            "NEAR's signer checks it after that, then the forward takes a minute.", 12.5f, faint = true).apply { setPadding(kit.px(2), kit.px(10), 0, 0) })
        refresh(rec, holdings, list)
    }

    private data class Row(val incoming: Evm.Incoming, val stage: Stage)

    private fun refresh(rec: ReceiveContract.Receiver, holdings: TextView, list: LinearLayout) {
        holdings.text = "Checking Base…"
        io.execute {
            val r = runCatching {
                val usdc = evm.tokenBalance(Evm.USDC, rec.address)
                val eth = evm.ethBalance(rec.address)
                val fees = evm.fees(ReceiveContract.MAX_FEE_CAP)
                val finalized = evm.finalizedBlock()
                val rows = evm.incoming(Evm.USDC, rec.address).take(5).map { inc ->
                    val record = recv.record(inc.txHash, inc.logIndex)
                    val receipt = record?.evmTxHash?.let { evm.receipt(it) }
                    Row(inc, Stage.of(inc.block, finalized, record, receipt))
                }
                Triple(usdc to eth, fees, rows)
            }
            main.post {
                r.onSuccess { (bal, fees, rows) ->
                    val (usdc, eth) = bal
                    val need = Stage.gasNeeded(fees.first)
                    val gasOk = eth >= need
                    // the gas warning matters only when something is waiting to be forwarded
                    val waiting = rows.any { it.stage !is Stage.Done }
                    holdings.text = "Holds ${Evm.usdc(usdc)} USDC · ${Evm.eth(eth)} ETH for gas" + when {
                        gasOk -> ""
                        waiting -> "\nForwarding needs ${Evm.eth(need)} ETH here for Base's gas. Send a little Base Sepolia ETH to this address."
                        else -> "\nA forward costs about ${Evm.eth(need)} ETH of Base gas, paid from this address."
                    }
                    holdings.setTextColor(if (gasOk || !waiting) kit.palette.textMuted else kit.palette.danger)
                    list.removeAllViews()
                    if (rows.isEmpty()) list.addView(kit.text("Nothing has arrived yet.", 13.5f, faint = true).apply { setPadding(0, kit.px(10), 0, 0) })
                    rows.forEach { list.addView(row(rec, it, gasOk) { refresh(rec, holdings, list) }) }
                }.onFailure { e -> holdings.text = "Couldn't read Base: ${e.message?.take(100)}" }
            }
        }
    }

    private fun row(rec: ReceiveContract.Receiver, row: Row, gasOk: Boolean, again: () -> Unit) = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        tag = "recv_row"
        setPadding(0, kit.px(12), 0, 0)
        val inc = row.incoming
        addView(kit.text("${Evm.usdc(inc.amount)} USDC from ${short(inc.from)}", 15f, bold = true))
        val (line, color) = when (val s = row.stage) {
            is Stage.Finalizing -> "Arrived. Recoverable when Base finalizes it, in ${Stage.wait(s.secondsLeft)}." to kit.palette.textMuted
            Stage.Ready -> "Final on Base. Ready to forward." to kit.palette.text
            Stage.Verifying -> "NEAR's signer is checking it on Base…" to kit.palette.textMuted
            Stage.Signing -> "Verified. NEAR's signer is signing the forward…" to kit.palette.textMuted
            is Stage.Signed -> "Signed by NEAR's signer. Sending it to Base…" to kit.palette.textMuted
            is Stage.Done -> (if (s.ok) "Forwarded to ${short(s.destination ?: "")} · tap to see it on Base" else "The forward reverted on Base · tap to see why") to
                (if (s.ok) kit.palette.ok else kit.palette.danger)
        }
        addView(kit.text(line, 13.5f).apply {
            setTextColor(color)
            tag = "recv_stage"
            (row.stage as? Stage.Done)?.let { d -> setOnClickListener { open(Evm.txUrl(d.evmTxHash)) } }
        })
        when (val s = row.stage) {
            Stage.Ready -> if (gasOk) addView(kit.primary("Forward it") { recover(inc, again) })
            is Stage.Signed -> addView(kit.primary("Send it to Base") { broadcast(s, again) })
            Stage.Verifying, Stage.Signing -> addView(kit.secondary("Check again") { again() })
            else -> Unit
        }
    }

    /** Verify through NEAR's signer, have the forward signed, then send it: one tap, followed to the end. */
    private fun recover(inc: Evm.Incoming, again: () -> Unit) {
        val key = accounts.walletKey() ?: return
        say("Asking NEAR's signer to verify the transfer on Base…")
        io.execute {
            val r = runCatching {
                val log = evm.transferLog(inc.txHash, inc.logIndex)
                val nearTx = recv.recover(account, key, log, evm.fees(ReceiveContract.MAX_FEE_CAP))
                var record: ReceiveContract.Record? = null
                repeat(90) {
                    record = recv.record(inc.txHash, inc.logIndex)
                    if (record?.status == "Signed") return@runCatching nearTx to record
                    Thread.sleep(2000)
                }
                nearTx to record
            }
            main.post {
                r.onSuccess { (nearTx, record) ->
                    val tx = record?.signedTx
                    val hash = record?.evmTxHash
                    if (record?.status == "Signed" && tx != null && hash != null) broadcast(Stage.Signed(tx, hash), again)
                    else { say("Still with NEAR's signer · tap to see the NEAR transaction", link = LunarPay.txUrl(nearTx)); again() }
                }.onFailure { e -> say("Couldn't forward it: ${e.message?.take(160)}", kit.palette.danger); again() }
            }
        }
    }

    private fun broadcast(s: Stage.Signed, again: () -> Unit) {
        say("Sending the signed forward to Base…")
        io.execute {
            val r = runCatching {
                evm.sendRaw(s.signedTx)
                repeat(30) {
                    if (evm.receipt(s.evmTxHash) != "missing") return@runCatching
                    Thread.sleep(2000)
                }
            }
            main.post {
                r.onSuccess { say("Sent · tap to see it on Base", kit.palette.ok, Evm.txUrl(s.evmTxHash)) }
                    .onFailure { e -> say("Couldn't send it: ${e.message?.take(160)}", kit.palette.danger) }
                again()
            }
        }
    }

    private fun short(a: String) = if (a.length > 14 && a.startsWith("0x")) "${a.take(6)}…${a.takeLast(4)}" else a
}
