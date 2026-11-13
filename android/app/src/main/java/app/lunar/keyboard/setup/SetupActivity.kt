package app.lunar.keyboard.setup

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import app.lunar.keyboard.BuildConfig
import app.lunar.keyboard.core.NearName
import app.lunar.keyboard.core.PasteCheck
import app.lunar.keyboard.core.Payee
import app.lunar.keyboard.data.PayeeStore
import app.lunar.keyboard.ime.LunarIme
import app.lunar.keyboard.ui.Appearance
import app.lunar.keyboard.ui.Icons
import app.lunar.keyboard.ui.Palette

/** Turn the keyboard on, set up the testnet wallet, try it, and keep the list of people you pay. */
class SetupActivity : Activity() {

    private lateinit var payees: PayeeStore
    private lateinit var kit: Kit
    private lateinit var root: LinearLayout
    private lateinit var scroll: ScrollView
    private lateinit var enableStatus: TextView
    private lateinit var chooseStatus: TextView
    private lateinit var stepsBox: LinearLayout
    private lateinit var payeeList: LinearLayout
    private var wallet: WalletSection? = null

    override fun onDestroy() {
        wallet?.close()
        super.onDestroy()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        payees = PayeeStore(this)
        kit = Kit(this, Palette.of(this))
        val p = kit.palette
        window.decorView.setBackgroundColor(p.page)
        @Suppress("DEPRECATION")
        if (Build.VERSION.SDK_INT < 35) { window.statusBarColor = p.page; window.navigationBarColor = p.page }
        if (Build.VERSION.SDK_INT >= 30) window.insetsController?.setSystemBarsAppearance(
            if (p.dark) 0 else WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS)

        root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = true // content scrolls under nothing: the status bar area stays clear
            isVerticalScrollBarEnabled = false
            setBackgroundColor(p.page)
            addView(kit.centred(root, 600))
        }
        // side padding grows a little with the screen; the column stops growing at 600dp
        val side = kit.px((resources.configuration.screenWidthDp * 0.055f).toInt().coerceIn(16, 28))
        // Android 15 draws edge to edge: keep content clear of the status bar, gesture bar and keyboard
        scroll.setOnApplyWindowInsetsListener { v, insets ->
            val (top, bottom) = if (Build.VERSION.SDK_INT >= 30) {
                val bars = insets.getInsets(WindowInsets.Type.systemBars())
                val ime = insets.getInsets(WindowInsets.Type.ime())
                bars.top to maxOf(bars.bottom, ime.bottom)
            } else @Suppress("DEPRECATION") (insets.systemWindowInsetTop to insets.systemWindowInsetBottom)
            v.setPadding(side, top + kit.px(12), side, bottom + kit.px(28))
            insets
        }
        setContentView(scroll)
        build()
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) refreshStatus() // the keyboard picker dialog returns focus here
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        root.removeAllViews()
        build()
        if (wallet?.waiting == null) scroll.post { scroll.smoothScrollTo(0, 0) }
    }

    private fun build() {
        header()

        // payment requests from the keyboard (over the cap) come first
        val request = intent?.getStringExtra(EXTRA_PAYEE)?.let { payee ->
            intent.getStringExtra(EXTRA_AMOUNT)?.toBigDecimalOrNull()?.let { WalletSection.PaymentRequest(payee, it, intent.getStringExtra(EXTRA_MEMO)) }
        }

        stepsBox = kit.card {
            addView(kit.label("Get set up"))
            addView(kit.space(6))
            enableStatus = kit.text("", 13.5f, muted = true)
            chooseStatus = kit.text("", 13.5f, muted = true)
        }
        root.addView(stepsBox)

        // "Try it" sits right under the setup steps: it's the first thing to do once the keyboard is on
        root.addView(tryCard())

        wallet?.close()
        val swap = intent?.getStringExtra(EXTRA_SWAP_AMOUNT)?.toBigDecimalOrNull()?.let { a ->
            WalletSection.SwapRequest(a, intent.getStringExtra(EXTRA_SWAP_TO) ?: "USDC")
        }
        wallet = WalletSection(this, kit).also { it.build(root, request, swap) }

        root.addView(payeesCard())
        root.addView(appearanceCard())
        // opened by the keyboard with something to approve: bring that card into view
        wallet?.waiting?.let { card ->
            scroll.post {
                val r = android.graphics.Rect()
                card.getDrawingRect(r)
                scroll.offsetDescendantRectToMyCoords(card, r)
                scroll.smoothScrollTo(0, (r.top - kit.px(24)).coerceAtLeast(0))
            }
        }
        root.addView(kit.text("Testnet build · ${BuildConfig.PAY_CONTRACT}", 12f, faint = true).apply {
            gravity = Gravity.CENTER
            setPadding(0, kit.px(22), 0, 0)
        })
        refreshStatus()
    }

    private fun header() {
        root.addView(kit.row {
            addView(kit.icon(Icons.Kind.CRESCENT, 24f), LinearLayout.LayoutParams(kit.px(30), kit.px(30)).apply { marginEnd = kit.px(6) })
            addView(kit.displayText("Lunar", 26f))
        })
        root.addView(kit.displayText("Pay anyone by name,\nright from your keyboard.", 31f).apply { setPadding(0, kit.px(18), 0, 0) })
        root.addView(kit.text("Lunar checks the name, your daily cap and the chain before anything moves. Built on NEAR.", 15f, muted = true)
            .apply { setPadding(0, kit.px(10), 0, kit.px(6)) })
    }

    private fun tryCard() = kit.card {
        addView(kit.label("Try it"))
        addView(kit.text("Tap Pay with nothing typed to open the pay form, or write it as a sentence and tap Pay.", 14.5f, muted = true)
            .apply { setPadding(0, kit.px(8), 0, 0) })
        addView(kit.field("Type here", "try").apply {
            isSingleLine = false
            minLines = 2
            gravity = Gravity.TOP
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or InputType.TYPE_TEXT_FLAG_MULTI_LINE
        })
    }

    private fun payeesCard() = kit.card {
        addView(kit.label("People you pay"))
        addView(kit.text("Lunar warns you when a copied address looks like one of these but isn't.", 14.5f, muted = true)
            .apply { setPadding(0, kit.px(8), 0, kit.px(4)) })
        payeeList = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        addView(payeeList)
        val name = kit.field("name, e.g. bob.testnet", "payee_name").apply { imeOptions = EditorInfo.IME_ACTION_NEXT }
        val addr = kit.field("address, 0x…", "payee_address").apply { imeOptions = EditorInfo.IME_ACTION_DONE }
        val error = kit.text("", 13f, muted = true)
        addView(name); addView(addr); addView(error)
        addView(kit.secondary("Save payee") {
            val n = name.text.toString().trim().lowercase()
            val a = PasteCheck.extract(addr.text)
            when {
                !NearName.isValid(n) -> error.text = "That isn't a valid NEAR name."
                a == null -> error.text = "That isn't a 0x address."
                else -> { payees.add(Payee(n, a)); name.setText(""); addr.setText(""); error.text = ""; renderPayees() }
            }
        })
        renderPayees()
    }

    private fun appearanceCard() = kit.card {
        addView(kit.label("Appearance"))
        val modes = listOf(Appearance.SYSTEM, Appearance.LIGHT, Appearance.DARK)
        addView(kit.segmented(listOf("System", "Light", "Dark"), modes.indexOf(Appearance.get(context))) { i ->
            if (Appearance.get(context) != modes[i]) {
                Appearance.set(context, modes[i])
                recreate() // the keyboard picks it up the next time it opens
            }
        })
    }

    private fun renderPayees() {
        payeeList.removeAllViews()
        val all = payees.all()
        if (all.isEmpty()) payeeList.addView(kit.text("Nobody yet.", 14.5f, faint = true).also { it.setPadding(0, kit.px(6), 0, kit.px(2)) })
        all.forEach { p ->
            payeeList.addView(kit.row {
                setPadding(0, kit.px(10), 0, kit.px(10))
                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(kit.text(p.name, 15.5f, bold = true))
                    addView(kit.text(PasteCheck.short(p.address), 13f, muted = true))
                }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
                addView(kit.text("Remove", 14f).apply {
                    setTextColor(kit.palette.danger)
                    setPadding(kit.px(12), kit.px(8), 0, kit.px(8))
                    setOnClickListener { payees.remove(p.name); renderPayees() }
                })
            })
        }
    }

    private fun refreshStatus() {
        if (!::stepsBox.isInitialized) return
        val me = ComponentName(this, LunarIme::class.java)
        val enabled = imm().enabledInputMethodList.any { it.component == me }
        // Android stores ids in either form ("pkg/.ime.LunarIme" or "pkg/pkg.ime.LunarIme"); compare components
        val current = Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
            ?.let { ComponentName.unflattenFromString(it) }
        val chosen = current == me
        enableStatus.text = if (enabled) "Lunar is on" else "Turn Lunar on in your keyboard settings"
        chooseStatus.text = if (chosen) "Lunar is your keyboard" else "Pick Lunar as the keyboard you type with"
        // rebuild the two steps so their dots and buttons match the new state
        while (stepsBox.childCount > 2) stepsBox.removeViewAt(2)
        (enableStatus.parent as? ViewGroup)?.removeView(enableStatus)
        (chooseStatus.parent as? ViewGroup)?.removeView(chooseStatus)
        stepsBox.addView(kit.step(1, "Turn on the keyboard", enableStatus, enabled, if (enabled) null else "Open") {
            startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
        })
        stepsBox.addView(kit.step(2, "Switch to Lunar", chooseStatus, chosen, if (chosen) null else "Choose") { imm().showInputMethodPicker() })
    }

    private fun imm() = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager

    companion object {
        const val EXTRA_PAYEE = "payee"
        const val EXTRA_AMOUNT = "amount"
        const val EXTRA_MEMO = "memo"
        const val EXTRA_SWAP_AMOUNT = "swap_amount"
        const val EXTRA_SWAP_TO = "swap_to"
    }
}
