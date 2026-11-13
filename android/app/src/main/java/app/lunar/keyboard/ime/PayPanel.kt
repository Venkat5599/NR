package app.lunar.keyboard.ime

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.TextUtils
import android.text.style.ForegroundColorSpan
import android.view.Gravity
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import app.lunar.keyboard.core.PayForm
import app.lunar.keyboard.ui.IconView
import app.lunar.keyboard.ui.Icons
import app.lunar.keyboard.ui.Palette

/**
 * The pay form above the keys: To, Amount (with its currency), and What for. The keys type
 * into the highlighted field instead of the chat; tapping a field or a recent name moves there.
 */
class PayPanel(context: Context, private val form: PayForm, private val actions: Actions) : LinearLayout(context) {

    interface Actions {
        fun onReview()
        fun onClose()
        fun onFieldTapped()
    }

    private val dp = resources.displayMetrics.density
    private var palette = Palette.LIGHT

    private val to = field("To", PayForm.Field.TO)
    private val amount = field("Amount", PayForm.Field.AMOUNT)
    private val memo = field("What for", PayForm.Field.MEMO)
    private val token = TextView(context)
    private val tokenIcon = IconView(context, Icons.Kind.CHEVRON_DOWN, 0, 14f)
    private val tokenBox = LinearLayout(context)
    private val review = TextView(context)
    private val close = IconView(context, Icons.Kind.CLOSE, 0, 16f)
    private val problem = TextView(context)
    private val names = LinearLayout(context)
    private val namesRow = HorizontalScrollView(context)
    private var problemText: String? = null

    init {
        orientation = VERTICAL
        setPadding(px(8), px(8), px(8), px(4))

        addView(LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(to, LayoutParams(0, px(44), 1f))
            close.contentDescription = "Close the pay form"
            close.setOnClickListener { actions.onClose() }
            addView(close, LayoutParams(px(40), px(44)))
        })

        addView(LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(amount, LayoutParams(0, px(44), 1f))
            tokenBox.apply {
                orientation = HORIZONTAL
                gravity = Gravity.CENTER
                setPadding(px(12), 0, px(8), 0)
                token.textSize = 14f
                token.typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                addView(token)
                addView(tokenIcon, LayoutParams(px(18), px(18)))
                contentDescription = "Currency"
                setOnClickListener { form.cycleToken(); render() }
            }
            addView(tokenBox, LayoutParams(LayoutParams.WRAP_CONTENT, px(44)).apply { marginStart = px(6) })
            addView(memo, LayoutParams(0, px(44), 1.2f).apply { marginStart = px(6) })
            review.apply {
                text = "Review"
                textSize = 14f
                typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                gravity = Gravity.CENTER
                setPadding(px(16), 0, px(16), 0)
                setOnClickListener { actions.onReview() }
            }
            addView(review, LayoutParams(LayoutParams.WRAP_CONTENT, px(44)).apply { marginStart = px(6) })
        }, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply { topMargin = px(6) })

        problem.apply { textSize = 12.5f; setPadding(px(4), px(6), px(4), 0); visibility = GONE }
        addView(problem)

        namesRow.apply {
            isHorizontalScrollBarEnabled = false
            isFocusable = false
            overScrollMode = OVER_SCROLL_NEVER
            addView(names.apply { orientation = HORIZONTAL })
        }
        addView(namesRow, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply { topMargin = px(6) })
    }

    private fun field(hint: String, which: PayForm.Field) = TextView(context).apply {
        tag = hint
        textSize = 15f
        maxLines = 1
        ellipsize = TextUtils.TruncateAt.START
        gravity = Gravity.CENTER_VERTICAL
        setPadding(px(12), 0, px(12), 0)
        setOnClickListener { form.active = which; problemText = null; actions.onFieldTapped(); render() }
    }

    fun setPalette(p: Palette) { palette = p; render() }

    /** Names to offer as one-tap chips: recent first, then saved payees. */
    fun setNames(list: List<String>, onPick: (String) -> Unit) {
        names.removeAllViews()
        list.distinct().take(8).forEach { name ->
            names.addView(TextView(context).apply {
                text = name
                textSize = 13f
                setPadding(px(12), px(6), px(12), px(6))
                setTextColor(palette.text)
                background = GradientDrawable().apply { cornerRadius = 999f; setColor(palette.key) }
                setOnClickListener { onPick(name) }
                layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { marginEnd = px(6) }
            })
        }
        namesRow.visibility = if (names.childCount == 0) GONE else VISIBLE
    }

    fun showProblem(message: String) { problemText = message; render() }

    fun clearProblem() { if (problemText != null) { problemText = null; render() } }

    fun render() {
        setBackgroundColor(palette.board)
        paint(to, form.to, "To  ·  name.testnet", form.active == PayForm.Field.TO)
        val usd = form.amount.toBigDecimalOrNull()?.takeIf { it.signum() > 0 }?.let { app.lunar.keyboard.data.Prices.usd(it, form.token) }
        paint(amount, form.amount, "Amount", form.active == PayForm.Field.AMOUNT)
        paint(memo, form.memo, "What for", form.active == PayForm.Field.MEMO)
        token.text = form.token
        token.setTextColor(palette.text)
        tokenIcon.color = palette.textMuted
        tokenBox.background = GradientDrawable().apply { cornerRadius = 12 * dp; setColor(palette.key) }
        review.setTextColor(palette.onAccent)
        review.background = GradientDrawable().apply { cornerRadius = 12 * dp; setColor(palette.accent) }
        close.color = palette.textMuted
        // a problem to fix wins; otherwise the amount in dollars, so a slipped digit stands out
        val info = usd?.let { "${form.amount} ${form.token} ≈ $it at today's price" }
        problem.text = problemText ?: info ?: ""
        problem.setTextColor(if (problemText != null) palette.warn else palette.textMuted)
        problem.visibility = if (problemText == null && info == null) GONE else VISIBLE
        log()
    }

    private fun paint(v: TextView, value: String, hint: String, active: Boolean, suffix: String? = null) {
        val s = SpannableStringBuilder()
        if (value.isEmpty()) {
            s.append(hint)
            s.setSpan(ForegroundColorSpan(palette.textFaint), 0, s.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            if (active) s.insert(0, caret())
        } else {
            s.append(value)
            s.setSpan(ForegroundColorSpan(palette.text), 0, s.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            if (active) s.append(caret())
            suffix?.let {
                val at = s.length
                s.append(it)
                s.setSpan(ForegroundColorSpan(palette.textFaint), at, s.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }
        v.text = s
        v.background = GradientDrawable().apply {
            cornerRadius = 12 * dp
            setColor(palette.key)
            if (active) setStroke((1.6f * dp).toInt(), palette.accent)
        }
    }

    private fun caret(): CharSequence = SpannableStringBuilder("|").apply {
        setSpan(ForegroundColorSpan(palette.accent), 0, 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }

    private fun px(v: Int) = (v * dp).toInt()

    /** Debug builds only: the form's state and the Review button's position, for the end-to-end test. */
    private fun log() {
        if (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE == 0) return
        if (visibility != VISIBLE) return
        android.util.Log.d("LunarStrip", "Pay form || to=${form.to} amount=${form.amount} token=${form.token} memo=${form.memo} " +
            "active=${form.active}${problemText?.let { " problem=$it" } ?: ""}${if (problemText == null && problem.visibility == VISIBLE) " info=${problem.text}" else ""}")
        review.post {
            val loc = IntArray(2)
            review.getLocationOnScreen(loc)
            if (review.width > 0) android.util.Log.d("LunarStripAction", "Review|${loc[0] + review.width / 2}|${loc[1] + review.height / 2}")
        }
    }
}
