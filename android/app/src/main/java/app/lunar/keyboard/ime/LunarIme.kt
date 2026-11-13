package app.lunar.keyboard.ime

import android.content.ClipboardManager
import android.content.Context
import android.inputmethodservice.InputMethodService
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import app.lunar.keyboard.BuildConfig
import app.lunar.keyboard.core.Key
import app.lunar.keyboard.core.KeyType
import app.lunar.keyboard.core.Page
import app.lunar.keyboard.core.PasteCheck
import app.lunar.keyboard.core.PasteVerdict
import app.lunar.keyboard.core.PayForm
import app.lunar.keyboard.core.PayParser
import app.lunar.keyboard.core.ShiftState
import app.lunar.keyboard.core.SmartChips
import app.lunar.keyboard.core.Suggest
import app.lunar.keyboard.data.Prices
import java.math.BigDecimal
import app.lunar.keyboard.data.AccountStore
import app.lunar.keyboard.data.AiParser
import app.lunar.keyboard.data.PayeeStore
import app.lunar.keyboard.data.RecentStore
import app.lunar.keyboard.near.LunarPay
import app.lunar.keyboard.near.NearClient
import app.lunar.keyboard.ui.Palette
import java.util.concurrent.Executors

class LunarIme : InputMethodService(), KeyboardView.Listener, ClipboardManager.OnPrimaryClipChangedListener, PayPanel.Actions {

    private lateinit var keyboard: KeyboardView
    private lateinit var strip: StripView
    private lateinit var panel: PayPanel
    private lateinit var payees: PayeeStore
    private lateinit var recent: RecentStore
    private lateinit var accounts: AccountStore
    private lateinit var payCard: PayCard
    private var palette: Palette? = null
    private val ai = AiParser(BuildConfig.API_BASE)
    private val shift = ShiftState()
    private val form = PayForm()
    private val io = Executors.newSingleThreadExecutor()
    private val warm = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var clipboard: ClipboardManager? = null
    private var lastSpaceAt = 0L
    private var formOpen = false
    private var pocketSummary = ""
    private var pocketReadAt = 0L
    private var lastEditor: String? = null
    @Volatile private var suggest: Suggest? = null
    private var suggestionsOn = true

    override fun onCreate() {
        super.onCreate()
        payees = PayeeStore(this)
        recent = RecentStore(this)
        accounts = AccountStore(this)
        clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard?.addPrimaryClipChangedListener(this)
    }

    override fun onDestroy() {
        clipboard?.removePrimaryClipChangedListener(this)
        io.shutdownNow()
        warm.shutdownNow()
        if (::payCard.isInitialized) payCard.close()
        super.onDestroy()
    }

    override fun onCreateInputView(): View {
        val p = Palette.of(this)
        palette = p
        val overlay = KeyOverlay(this)
        strip = StripView(this)
        panel = PayPanel(this, form, this)
        keyboard = KeyboardView(this, this, overlay)
        if (::payCard.isInitialized) payCard.close()
        payCard = PayCard(this, strip, io, onDone = { showIdle() }, insert = { t -> currentInputConnection?.commitText(t, 1) })
        strip.setPalette(p)
        panel.setPalette(p)
        keyboard.palette = p
        panel.visibility = View.GONE

        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(p.board)
            addView(strip, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            addView(panel, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            addView(keyboard)
            // Android 15 draws apps edge to edge: keep the bottom row above the gesture bar
            setOnApplyWindowInsetsListener { v, insets ->
                val bottom = if (android.os.Build.VERSION.SDK_INT >= 30)
                    insets.getInsets(android.view.WindowInsets.Type.navigationBars()).bottom
                else @Suppress("DEPRECATION") insets.systemWindowInsetBottom
                v.setPadding(0, 0, 0, bottom)
                insets
            }
        }
        return FrameLayout(this).apply {
            addView(column, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            // the overlay covers the column, so a key's bubble can rise above the top row
            addView(overlay, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
    }

    override fun onEvaluateFullscreenMode() = false

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        // the appearance (or the phone's dark mode) may have changed since the view was built
        val rebuilt = palette != Palette.of(this)
        if (rebuilt) setInputView(onCreateInputView())
        // the same box restarting (the window resized for the pay form, the app re-bound) keeps the form open
        val field = "${info?.packageName}:${info?.fieldId}:${info?.inputType}"
        val sameField = field == lastEditor && !rebuilt
        lastEditor = field
        // a restart of the same box (the window resized for a card or the form): keep what's on screen
        if (sameField) { keyboard.relogKeys(); return }
        closeForm(clear = true)
        keyboard.page = when (info?.inputType?.and(InputType.TYPE_MASK_CLASS)) {
            InputType.TYPE_CLASS_NUMBER, InputType.TYPE_CLASS_PHONE -> Page.SYMBOLS
            else -> Page.LETTERS
        }
        keyboard.enter = enterFor(info)
        suggestionsOn = wantsSuggestions(info)
        keyboard.relogKeys()
        shift.reset()
        updateAutoCaps()
        showIdle()
        warmUp()
        // a fresh address on the clipboard is worth a look as soon as the keyboard opens
        checkClipboard()
    }

    // Nothing is torn down when the input view finishes: Android also finishes and restarts it
    // when the keyboard window changes height (a card opening), and a lookup cancelled there left
    // the card stuck on "Checking…". A different text box resets everything in onStartInputView.

    /** The cursor moved or the app changed the text (tap elsewhere, cleared box): recheck the auto-capital. */
    override fun onUpdateSelection(oldSelStart: Int, oldSelEnd: Int, newSelStart: Int, newSelEnd: Int, candidatesStart: Int, candidatesEnd: Int) {
        super.onUpdateSelection(oldSelStart, oldSelEnd, newSelStart, newSelEnd, candidatesStart, candidatesEnd)
        if (::keyboard.isInitialized && !formOpen && shift.mode != ShiftState.Mode.LOCKED) updateAutoCaps()
        if (::keyboard.isInitialized && !formOpen) refreshBar()
    }

    // ---------------------------------------------------------------- keys

    override fun onKey(key: Key) {
        if (formOpen && formKey(key)) return
        // typing again means the card has been read: clear it so suggestions come back (never mid-payment)
        if (key.type in TYPING && ::strip.isInitialized && strip.showingCard && !payCard.busy) showIdle()
        val ic = currentInputConnection ?: return
        when (key.type) {
            KeyType.CHAR -> {
                val t = if (keyboard.page == Page.LETTERS && shift.isUpper) key.text.uppercase() else key.text
                ic.commitText(t, 1)
                afterChar()
                refreshBar()
            }
            KeyType.SPACE -> {
                val now = System.currentTimeMillis()
                val before = ic.getTextBeforeCursor(2, 0)?.toString() ?: ""
                if (now - lastSpaceAt < 400 && before.length == 2 && before[1] == ' ' && before[0].isLetterOrDigit()) {
                    ic.deleteSurroundingText(1, 0)
                    ic.commitText(". ", 1)
                    lastSpaceAt = 0
                } else {
                    ic.commitText(" ", 1)
                    lastSpaceAt = now
                }
                if (keyboard.page != Page.LETTERS) keyboard.page = Page.LETTERS
                updateAutoCaps()
                refreshBar()
            }
            KeyType.DELETE -> {
                val sel = ic.getSelectedText(0)
                if (!sel.isNullOrEmpty()) ic.commitText("", 1) else sendDownUpKeyEvents(KeyEvent.KEYCODE_DEL)
                updateAutoCaps()
                refreshBar()
            }
            KeyType.ENTER -> handleEnter()
            KeyType.SHIFT -> {
                shift.tap(System.currentTimeMillis())
                keyboard.shift = shift.mode
            }
            KeyType.TO_SYMBOLS -> keyboard.page = Page.SYMBOLS
            KeyType.TO_MORE_SYMBOLS -> keyboard.page = Page.MORE_SYMBOLS
            KeyType.TO_LETTERS -> { keyboard.page = Page.LETTERS; updateAutoCaps() }
            KeyType.PAY -> onPay()
            KeyType.SPACER -> Unit
        }
    }

    /** An option picked from a held key: a digit, an accent, a currency or a token word. */
    override fun onText(text: String) {
        if (formOpen) { form.type(text); afterFormEdit(); return }
        if (::strip.isInitialized && strip.showingCard && !payCard.busy) showIdle()
        val ic = currentInputConnection ?: return
        // "5" then NEAR reads as "5 NEAR", which is what the pay sentence expects
        val before = ic.getTextBeforeCursor(1, 0)?.toString() ?: ""
        val spaced = if (text.length > 1 && before.isNotEmpty() && before[0].isLetterOrDigit()) " $text" else text
        ic.commitText(spaced, 1)
        afterChar()
        refreshBar()
    }

    private fun afterChar() {
        shift.afterChar()
        if (keyboard.page == Page.LETTERS) updateAutoCaps() else keyboard.shift = shift.mode
    }

    override fun onSpaceLongPress() {
        (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).showInputMethodPicker()
    }

    override fun onPayLongPress() = openForm(null)

    private fun handleEnter() {
        val ic = currentInputConnection ?: return
        val info = currentInputEditorInfo
        val action = (info?.imeOptions ?: 0) and EditorInfo.IME_MASK_ACTION
        val noAction = (info?.imeOptions ?: 0) and EditorInfo.IME_FLAG_NO_ENTER_ACTION != 0
        val multiLine = (info?.inputType ?: 0) and InputType.TYPE_TEXT_FLAG_MULTI_LINE != 0
        if (!noAction && !multiLine && action != EditorInfo.IME_ACTION_NONE && action != EditorInfo.IME_ACTION_UNSPECIFIED) {
            ic.performEditorAction(action)
        } else {
            ic.commitText("\n", 1)
        }
        updateAutoCaps()
    }

    private fun enterFor(info: EditorInfo?): KeyboardView.Enter {
        val opts = info?.imeOptions ?: 0
        val multiLine = (info?.inputType ?: 0) and InputType.TYPE_TEXT_FLAG_MULTI_LINE != 0
        if (opts and EditorInfo.IME_FLAG_NO_ENTER_ACTION != 0 || multiLine) return KeyboardView.Enter.RETURN
        return when (opts and EditorInfo.IME_MASK_ACTION) {
            EditorInfo.IME_ACTION_GO -> KeyboardView.Enter.GO
            EditorInfo.IME_ACTION_SEARCH -> KeyboardView.Enter.SEARCH
            EditorInfo.IME_ACTION_SEND -> KeyboardView.Enter.SEND
            EditorInfo.IME_ACTION_NEXT -> KeyboardView.Enter.NEXT
            EditorInfo.IME_ACTION_DONE -> KeyboardView.Enter.DONE
            else -> KeyboardView.Enter.RETURN
        }
    }

    private fun updateAutoCaps() {
        val info = currentInputEditorInfo
        val ic = currentInputConnection
        if (info == null || ic == null || keyboard.page != Page.LETTERS) {
            keyboard.shift = shift.mode; return
        }
        val caps = info.inputType != InputType.TYPE_NULL && ic.getCursorCapsMode(info.inputType) != 0
        shift.setAuto(caps)
        keyboard.shift = shift.mode
    }

    // ---------------------------------------------------------------- pay form

    private fun openForm(payee: String?, amount: BigDecimal? = null) {
        if (!::panel.isInitialized) return
        debugLog("openForm payee=$payee")
        payCard.cancel()
        form.reset()
        if (payee != null) { form.choosePayee(payee); payCard.prefetch(payee) }
        if (amount != null) { form.setAmount(amount); if (payee != null) form.active = PayForm.Field.MEMO }
        formOpen = true
        strip.visibility = View.GONE
        panel.visibility = View.VISIBLE
        panel.setNames(recent.all() + payees.all().map { it.name }) { name -> form.choosePayee(name); payCard.prefetch(name); afterFormEdit() }
        panel.clearProblem()
        shift.reset()
        keyboard.shift = shift.mode
        syncPageToField()
        panel.render()
    }

    private fun closeForm(clear: Boolean) {
        if (!::panel.isInitialized) return
        if (formOpen) debugLog("closeForm clear=$clear")
        formOpen = false
        panel.visibility = View.GONE
        strip.visibility = View.VISIBLE
        if (clear) form.reset()
        lastField = null
        if (keyboard.page != Page.LETTERS) keyboard.page = Page.LETTERS
        updateAutoCaps()
    }

    /** Keys while the form is open type into it. Returns false for keys the keyboard handles itself (page switches). */
    private fun formKey(key: Key): Boolean {
        when (key.type) {
            KeyType.CHAR -> {
                form.type(if (keyboard.page == Page.LETTERS && shift.isUpper) key.text.uppercase() else key.text)
                shift.afterChar(); keyboard.shift = shift.mode
            }
            KeyType.SPACE -> form.type(" ")
            KeyType.DELETE -> form.delete()
            KeyType.ENTER -> if (form.next()) { onReview(); return true }
            KeyType.PAY -> { onReview(); return true }
            KeyType.SHIFT -> { shift.tap(System.currentTimeMillis()); keyboard.shift = shift.mode; return true }
            else -> return false
        }
        afterFormEdit()
        return true
    }

    private var lastField: PayForm.Field? = null

    private fun afterFormEdit() {
        panel.clearProblem()
        if (form.active != lastField) {
            // leaving the name field: check that name now, while the amount is typed
            if (lastField == PayForm.Field.TO && form.to.isNotEmpty()) payCard.prefetch(form.to)
            syncPageToField()
        }
        panel.render()
    }

    /** Digits for the amount, letters for names and notes. */
    private fun syncPageToField() {
        lastField = form.active
        keyboard.page = if (form.active == PayForm.Field.AMOUNT) Page.SYMBOLS else Page.LETTERS
    }

    override fun onReview() {
        when (val c = form.check()) {
            is PayForm.Check.Ok -> { closeForm(clear = false); payCard.show(c.intent) }
            is PayForm.Check.Problem -> { form.active = c.field; syncPageToField(); panel.showProblem(c.message) }
        }
    }

    override fun onClose() { closeForm(clear = true); showIdle() }

    override fun onFieldTapped() = syncPageToField()

    // ---------------------------------------------------------------- pay from a sentence

    private fun onPay() {
        val before = currentInputConnection?.getTextBeforeCursor(200, 0)
        val intent = PayParser.parse(before)
        if (intent != null) { payCard.show(intent); return }
        val sentence = lastSentence(before)
        if (sentence.isBlank() || !ai.enabled) { openForm(null); return }
        strip.show("Reading “${sentence.take(40)}”", "Only this sentence goes to the AI on NEAR AI Cloud", onClose = { showIdle() })
        io.execute {
            val r = ai.parse(sentence)
            main.post {
                when (r) {
                    is AiParser.Result.Parsed -> payCard.show(r.intent)
                    is AiParser.Result.NotAPayment -> strip.show("That doesn't read as a payment", r.reason, StripView.Tone.WARN,
                        action = "Pay form", onAction = { openForm(null) }, onClose = { showIdle() })
                    is AiParser.Result.Unavailable -> strip.show("The AI couldn't be reached", r.reason.take(80), StripView.Tone.WARN,
                        action = "Pay form", onAction = { openForm(null) }, onClose = { showIdle() })
                }
            }
        }
    }

    /** The text after the last line break or sentence end, which is what the user means by "this". */
    private fun lastSentence(text: CharSequence?): String {
        val t = text?.toString() ?: return ""
        val cut = maxOf(t.lastIndexOf('\n'), t.lastIndexOf(". "), t.lastIndexOf("! "), t.lastIndexOf("? "))
        return t.substring(if (cut < 0) 0 else cut + 1).trim()
    }

    private fun showIdle() {
        if (!::strip.isInitialized || formOpen) return
        payCard.cancel()
        strip.showIdle(recent.all(), summary(),
            onNew = { openForm(null) }, onPick = { name -> openForm(name) })
    }

    /**
     * Reads the pocket in the background when the keyboard opens, so the toolbar shows what is
     * left today and the first payment reuses a warm connection to NEAR.
     */
    private fun warmUp() {
        if (System.currentTimeMillis() - pocketReadAt < 20_000) return
        pocketReadAt = System.currentTimeMillis()
        warm.execute {
            if (suggest == null) suggest = runCatching { Suggest(assets.open("words_en.txt").bufferedReader().readLines()) }.getOrNull()
            Prices.refresh()
            main.post { if (::strip.isInitialized && !formOpen && !strip.showingCard) strip.updateSummary(summary()) }
            // opens the mainnet connection too, so the first name check doesn't pay for the handshake
            runCatching { app.lunar.keyboard.data.NearRpc.viewAccount("near") }
            val me = accounts.accountId?.takeIf { accounts.isReady } ?: return@execute
            val r = runCatching { LunarPay(NearClient(), BuildConfig.PAY_CONTRACT).pocket(me) }.getOrNull() ?: return@execute
            val left = NearClient.toNear(r.leftToday).setScale(2, java.math.RoundingMode.DOWN).stripTrailingZeros().toPlainString() + " NEAR"
            main.post {
                pocketSummary = "$left left today"
                if (::strip.isInitialized && !formOpen) strip.updateSummary(summary())
            }
        }
    }

    /** Toolbar text: the live NEAR price and what the pocket can still pay today. */
    private fun summary(): String {
        val price = Prices.cached()["NEAR"]?.let { "NEAR \$${Prices.show(it)}" }
        val pocket = if (accounts.isReady) pocketSummary.takeIf { it.isNotEmpty() } else "Set up in the app"
        return listOfNotNull(price, pocket).joinToString(" · ")
    }

    // ---------------------------------------------------------------- suggestions

    private fun wantsSuggestions(info: EditorInfo?): Boolean {
        val t = info?.inputType ?: return false
        if (t and InputType.TYPE_MASK_CLASS != InputType.TYPE_CLASS_TEXT) return false
        val v = t and InputType.TYPE_MASK_VARIATION
        if (v == InputType.TYPE_TEXT_VARIATION_PASSWORD || v == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD ||
            v == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD || v == InputType.TYPE_TEXT_VARIATION_URI ||
            v == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS) return false
        return true
    }

    /**
     * Updates the bar above the keys after every key: action chips for what the sentence is
     * about, and words for the one being typed. A card on screen (a payment, a warning) stays.
     */
    private fun refreshBar() {
        if (!::strip.isInitialized || formOpen || strip.showingCard) return
        val before = currentInputConnection?.getTextBeforeCursor(160, 0)
        if (!suggestionsOn || before == null) { showIdle(); return }
        val word = Suggest.currentWord(before)
        val sentence = lastSentence(before)
        val prices = Prices.cached()
        val chips = SmartChips.read(sentence, prices["NEAR"], prices)
        val words = suggest?.words(word) ?: emptyList()
        if (chips.isEmpty() && words.isEmpty()) { showIdle(); return }
        strip.showSuggestions(chips.map { c -> c.label to { onChip(c) } }, words) { w -> pickWord(word, w) }
    }

    private fun pickWord(typed: String, word: String) {
        val ic = currentInputConnection ?: return
        ic.beginBatchEdit()
        if (typed.isNotEmpty()) ic.deleteSurroundingText(typed.length, 0)
        ic.commitText("$word ", 1)
        ic.endBatchEdit()
        shift.afterChar()
        updateAutoCaps()
        refreshBar()
    }

    private fun onChip(c: SmartChips.Chip) {
        when (c) {
            is SmartChips.Chip.PayName ->
                if (c.amount != null) payCard.show(app.lunar.keyboard.core.PayIntent(c.name, c.amount, "NEAR", null, 0)) else openForm(c.name)
            is SmartChips.Chip.PayIntent -> openForm(null, c.amount)
            is SmartChips.Chip.Convert -> openForm(null, c.near)
            is SmartChips.Chip.Swap -> payCard.showSwap(c.amount ?: BigDecimal.ONE, c.to)
            is SmartChips.Chip.Price -> {
                currentInputConnection?.commitText(" ${c.symbol} is \$${Prices.show(c.usd)} right now", 1)
                refreshBar()
            }
        }
    }

    // ---------------------------------------------------------------- paste check

    override fun onPrimaryClipChanged() {
        main.post { checkClipboard() }
    }

    private fun checkClipboard() {
        if (!::strip.isInitialized || formOpen) return
        val clip = try {
            clipboard?.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(this)
        } catch (e: SecurityException) {
            null // Android only lets the focused app or the default keyboard read the clipboard
        }
        when (val v = PasteCheck.check(clip, payees.all())) {
            is PasteVerdict.NotAnAddress -> Unit
            is PasteVerdict.Known -> strip.show(
                "Copied address is ${v.payee.name}", "Matches the address you paid before",
                StripView.Tone.OK, onClose = { showIdle() })
            is PasteVerdict.New -> strip.show(
                "Copied ${PasteCheck.short(v.address)}", "You've never paid this address. Check it before you send.",
                StripView.Tone.NEUTRAL, onClose = { showIdle() })
            is PasteVerdict.Lookalike -> strip.show(
                "Not ${v.payee.name}'s address", "Same start and end as ${PasteCheck.short(v.payee.address)}, different middle",
                StripView.Tone.WARN, onClose = { showIdle() })
        }
    }

    private companion object {
        val TYPING = setOf(KeyType.CHAR, KeyType.SPACE, KeyType.DELETE)
    }

    private fun debugLog(s: String) {
        if (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0) android.util.Log.d("LunarIme", s)
    }
}
