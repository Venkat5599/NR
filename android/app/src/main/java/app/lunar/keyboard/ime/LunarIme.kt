package app.lunar.keyboard.ime

import android.content.ClipboardManager
import android.content.Context
import android.inputmethodservice.InputMethodService
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.LinearLayout
import app.lunar.keyboard.core.Key
import app.lunar.keyboard.core.KeyType
import app.lunar.keyboard.core.Page
import app.lunar.keyboard.core.PasteCheck
import app.lunar.keyboard.core.PasteVerdict
import app.lunar.keyboard.core.PayParser
import app.lunar.keyboard.core.ShiftState
import app.lunar.keyboard.data.PayeeStore
import app.lunar.keyboard.data.AiParser
import app.lunar.keyboard.BuildConfig
import java.util.concurrent.Executors

class LunarIme : InputMethodService(), KeyboardView.Listener, ClipboardManager.OnPrimaryClipChangedListener {

    private lateinit var keyboard: KeyboardView
    private lateinit var strip: StripView
    private lateinit var payees: PayeeStore
    private lateinit var payCard: PayCard
    private val ai = AiParser(BuildConfig.API_BASE)
    private val shift = ShiftState()
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var clipboard: ClipboardManager? = null
    private var lastSpaceAt = 0L

    override fun onCreate() {
        super.onCreate()
        payees = PayeeStore(this)
        clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard?.addPrimaryClipChangedListener(this)
    }

    override fun onDestroy() {
        clipboard?.removePrimaryClipChangedListener(this)
        io.shutdownNow()
        if (::payCard.isInitialized) payCard.close()
        super.onDestroy()
    }

    override fun onCreateInputView(): View {
        strip = StripView(this)
        keyboard = KeyboardView(this, this)
        payCard = PayCard(this, strip, io) { showIdle() }
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFFE9EBEF.toInt())
            addView(strip, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
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
    }

    override fun onEvaluateFullscreenMode() = false

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        keyboard.page = when (info?.inputType?.and(InputType.TYPE_MASK_CLASS)) {
            InputType.TYPE_CLASS_NUMBER, InputType.TYPE_CLASS_PHONE -> Page.SYMBOLS
            else -> Page.LETTERS
        }
        keyboard.enterLabel = enterLabel(info)
        keyboard.relogKeys()
        shift.reset()
        updateAutoCaps()
        showIdle()
        // a fresh address on the clipboard is worth a look as soon as the keyboard opens
        checkClipboard(quietIfNone = true)
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        if (::payCard.isInitialized) payCard.cancel()
    }

    /** The cursor moved or the app changed the text (tap elsewhere, cleared box): recheck the auto-capital. */
    override fun onUpdateSelection(oldSelStart: Int, oldSelEnd: Int, newSelStart: Int, newSelEnd: Int, candidatesStart: Int, candidatesEnd: Int) {
        super.onUpdateSelection(oldSelStart, oldSelEnd, newSelStart, newSelEnd, candidatesStart, candidatesEnd)
        if (::keyboard.isInitialized && shift.mode != ShiftState.Mode.LOCKED) updateAutoCaps()
    }

    // ---------------------------------------------------------------- keys

    override fun onKey(key: Key, longPress: Boolean) {
        val ic = currentInputConnection ?: return
        when (key.type) {
            KeyType.CHAR -> {
                val t = if (longPress && key.hint != null) key.hint
                else if (keyboard.page == Page.LETTERS && shift.isUpper) key.text.uppercase() else key.text
                ic.commitText(t, 1)
                shift.afterChar()
                if (keyboard.page == Page.LETTERS) updateAutoCaps() else keyboard.shift = shift.mode
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
            }
            KeyType.DELETE -> {
                val sel = ic.getSelectedText(0)
                if (!sel.isNullOrEmpty()) ic.commitText("", 1) else sendDownUpKeyEvents(KeyEvent.KEYCODE_DEL)
                updateAutoCaps()
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

    override fun onSpaceLongPress() {
        (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).showInputMethodPicker()
    }

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

    private fun enterLabel(info: EditorInfo?): String {
        val opts = info?.imeOptions ?: 0
        if (opts and EditorInfo.IME_FLAG_NO_ENTER_ACTION != 0) return "⏎"
        return when (opts and EditorInfo.IME_MASK_ACTION) {
            EditorInfo.IME_ACTION_GO -> "Go"
            EditorInfo.IME_ACTION_SEARCH -> "Search"
            EditorInfo.IME_ACTION_SEND -> "Send"
            EditorInfo.IME_ACTION_NEXT -> "Next"
            EditorInfo.IME_ACTION_DONE -> "Done"
            else -> "⏎"
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

    // ---------------------------------------------------------------- pay

    private fun onPay() {
        val before = currentInputConnection?.getTextBeforeCursor(200, 0)
        val intent = PayParser.parse(before)
        if (intent != null) { payCard.show(intent); return }
        val sentence = lastSentence(before)
        if (sentence.isBlank() || !ai.enabled) {
            strip.show("Type who and how much, then tap Pay", "e.g.  pay bob.testnet 0.5 for dinner", onClose = { showIdle() })
            return
        }
        strip.show("Reading “${sentence.take(40)}”", "Only this sentence goes to the AI on NEAR AI Cloud", onClose = { showIdle() })
        io.execute {
            val r = ai.parse(sentence)
            main.post {
                when (r) {
                    is AiParser.Result.Parsed -> payCard.show(r.intent)
                    is AiParser.Result.NotAPayment -> strip.show("That doesn't read as a payment", r.reason, StripView.Tone.WARN, onClose = { showIdle() })
                    is AiParser.Result.Unavailable -> strip.show("The AI couldn't be reached", r.reason.take(80), StripView.Tone.WARN, onClose = { showIdle() })
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
        if (!::strip.isInitialized) return
        payCard.cancel()
        strip.show("Lunar", "Type  pay bob.testnet 0.5  and tap Pay")
    }

    // ---------------------------------------------------------------- paste check

    override fun onPrimaryClipChanged() {
        main.post { checkClipboard(quietIfNone = false) }
    }

    @Suppress("UNUSED_PARAMETER")
    private fun checkClipboard(quietIfNone: Boolean) {
        if (!::strip.isInitialized) return
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
}
