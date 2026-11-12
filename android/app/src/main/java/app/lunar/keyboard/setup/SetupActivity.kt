package app.lunar.keyboard.setup

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import app.lunar.keyboard.core.NearName
import app.lunar.keyboard.core.PasteCheck
import app.lunar.keyboard.core.Payee
import app.lunar.keyboard.data.PayeeStore
import app.lunar.keyboard.ime.LunarIme

/** Turn the keyboard on, try it, and keep the list of people you pay. */
class SetupActivity : Activity() {

    private lateinit var payees: PayeeStore
    private lateinit var root: LinearLayout
    private lateinit var enableStatus: TextView
    private lateinit var chooseStatus: TextView
    private lateinit var payeeList: LinearLayout
    private val dp by lazy { resources.displayMetrics.density }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        payees = PayeeStore(this)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(px(22), px(28), px(22), px(40))
        }
        setContentView(ScrollView(this).apply { addView(root) })
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
    }

    private fun build() {
        root.addView(text("Lunar", 30f, bold = true))
        root.addView(text("The AI keyboard that won't let you send money to the wrong place.", 15f, muted = true).also { pad(it, 4, 22) })

        intent?.getStringExtra(EXTRA_PAYEE)?.let { payee ->
            val amount = intent.getStringExtra(EXTRA_AMOUNT) ?: ""
            val token = intent.getStringExtra(EXTRA_TOKEN) ?: ""
            root.addView(card {
                addView(text("Payment to $payee · $amount $token", 16f, bold = true))
                addView(text("Nothing was sent. Lunar can't send payments yet: its payments contract is not deployed. " +
                        "When it is, this button will pay through your NEAR account.", 14f, muted = true).also { pad(it, 6, 0) })
            })
        }

        root.addView(section("1 · Turn on the keyboard"))
        enableStatus = text("", 14f, muted = true)
        root.addView(enableStatus)
        root.addView(button("Open keyboard settings") { startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)) })

        root.addView(section("2 · Switch to Lunar"))
        chooseStatus = text("", 14f, muted = true)
        root.addView(chooseStatus)
        root.addView(button("Choose keyboard") { imm().showInputMethodPicker() })

        root.addView(section("3 · Try it"))
        root.addView(text("Type “pay bob.near 20 for dinner”, then tap Pay.", 14f, muted = true))
        root.addView(EditText(this).apply {
            hint = "Type here"
            tag = "try"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            minLines = 2
        }.also { pad(it, 8, 0) })

        root.addView(section("People you pay"))
        root.addView(text("Lunar warns you when a copied address looks like one of these but isn't.", 14f, muted = true))
        payeeList = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(payeeList)
        val name = EditText(this).apply { hint = "name, e.g. bob.near"; tag = "payee_name"; isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS; imeOptions = EditorInfo.IME_ACTION_NEXT }
        val addr = EditText(this).apply { hint = "address, 0x…"; tag = "payee_address"; isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS; imeOptions = EditorInfo.IME_ACTION_DONE }
        val error = text("", 13f, muted = true)
        root.addView(name); root.addView(addr); root.addView(error)
        root.addView(button("Save") {
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

    private fun renderPayees() {
        payeeList.removeAllViews()
        val all = payees.all()
        if (all.isEmpty()) payeeList.addView(text("Nobody yet.", 14f, muted = true).also { pad(it, 8, 8) })
        all.forEach { p ->
            payeeList.addView(LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, px(8), 0, px(8))
                addView(text("${p.name}   ${PasteCheck.short(p.address)}", 15f), LinearLayout.LayoutParams(0, -2, 1f))
                addView(TextView(context).apply {
                    text = "Remove"; textSize = 14f; setTextColor(0xFF8A1C1C.toInt()); setPadding(px(10), px(6), 0, px(6))
                    setOnClickListener { payees.remove(p.name); renderPayees() }
                })
            })
        }
    }

    private fun refreshStatus() {
        if (!::enableStatus.isInitialized) return
        val me = ComponentName(this, LunarIme::class.java)
        val enabled = imm().enabledInputMethodList.any { it.component == me }
        // Android stores ids in either form ("pkg/.ime.LunarIme" or "pkg/pkg.ime.LunarIme"); compare components
        val current = Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
            ?.let { ComponentName.unflattenFromString(it) }
        enableStatus.text = if (enabled) "✓ Lunar is on." else "Lunar is off. Turn it on in keyboard settings."
        chooseStatus.text = if (current == me) "✓ Lunar is your keyboard." else "Another keyboard is selected."
    }

    // ---------------------------------------------------------------- tiny view helpers

    private fun imm() = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    private fun px(v: Int) = (v * dp).toInt()
    private fun pad(v: View, top: Int, bottom: Int) { v.setPadding(v.paddingLeft, px(top), v.paddingRight, px(bottom)) }

    private fun text(s: String, size: Float, bold: Boolean = false, muted: Boolean = false) = TextView(this).apply {
        text = s; textSize = size
        setTextColor(if (muted) 0x99111111.toInt() else 0xFF111111.toInt())
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }

    private fun section(s: String) = text(s, 18f, bold = true).also { pad(it, 26, 6) }

    private fun button(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        setTextColor(0xFFFFFFFF.toInt())
        background = GradientDrawable().apply { cornerRadius = 999f; setColor(0xFF0A0A0A.toInt()) }
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(-2, -2).apply { topMargin = px(10) }
    }

    private fun card(body: LinearLayout.() -> Unit) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(px(16), px(14), px(16), px(14))
        background = GradientDrawable().apply { cornerRadius = 18 * dp; setColor(0xFFF2F3F5.toInt()) }
        body()
    }

    companion object {
        const val EXTRA_PAYEE = "payee"
        const val EXTRA_AMOUNT = "amount"
        const val EXTRA_TOKEN = "token"
    }
}
