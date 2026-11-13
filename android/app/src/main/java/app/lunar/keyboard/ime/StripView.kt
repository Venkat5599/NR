package app.lunar.keyboard.ime

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import app.lunar.keyboard.ui.IconView
import app.lunar.keyboard.ui.Icons
import app.lunar.keyboard.ui.Palette

/**
 * The row above the keys. Idle, it is a toolbar: the Lunar mark, a "New payment" chip and the
 * people you paid lately, one tap each. Otherwise it shows one card: a payment being checked,
 * a result, or a warning about the address on the clipboard.
 */
class StripView(context: Context) : LinearLayout(context) {

    enum class Tone { NEUTRAL, OK, WARN }

    private val dp = resources.displayMetrics.density
    private var palette = Palette.LIGHT

    // idle toolbar
    private val idle = LinearLayout(context)
    private val mark = IconView(context, Icons.Kind.CRESCENT, 0, 18f)
    private val chips = LinearLayout(context)
    private val summary = TextView(context)

    // card
    private val card = LinearLayout(context)
    private val dot = View(context)
    private val title = TextView(context)
    private val detail = TextView(context)
    private val secondary = TextView(context)
    private val primary = TextView(context)
    private val close = IconView(context, Icons.Kind.CLOSE, 0, 16f)

    init {
        orientation = VERTICAL
        minimumHeight = (HEIGHT_DP * dp).toInt()
        setPadding(px(6), px(6), px(6), px(2))

        idle.apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            minimumHeight = px(HEIGHT_DP - 8)
            addView(mark, LayoutParams(px(34), px(34)))
            val scroll = HorizontalScrollView(context).apply {
                isHorizontalScrollBarEnabled = false
                // a keyboard never takes focus: no focus highlight, no overscroll glow
                isFocusable = false
                isFocusableInTouchMode = false
                descendantFocusability = FOCUS_BLOCK_DESCENDANTS
                overScrollMode = OVER_SCROLL_NEVER
                background = null
                addView(chips.apply { orientation = HORIZONTAL; gravity = Gravity.CENTER_VERTICAL })
            }
            addView(scroll, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
            summary.apply { textSize = 12f; maxLines = 1; setPadding(px(8), 0, px(8), 0) }
            addView(summary)
        }
        addView(idle, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))

        card.apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(px(12), px(8), px(4), px(8))
            dot.background = GradientDrawable().apply { shape = GradientDrawable.OVAL }
            addView(dot, LayoutParams(px(8), px(8)).apply { marginEnd = px(10) })
            val texts = LinearLayout(context).apply { orientation = VERTICAL }
            title.apply { textSize = 14.5f; typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL); maxLines = 1; ellipsize = TextUtils.TruncateAt.END }
            detail.apply { textSize = 12.5f; maxLines = 5; ellipsize = TextUtils.TruncateAt.END; setLineSpacing(px(2).toFloat(), 1f) }
            texts.addView(title)
            texts.addView(detail)
            addView(texts, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
            secondary.apply {
                textSize = 13f; typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                setPadding(px(10), px(8), px(6), px(8)); visibility = GONE
            }
            addView(secondary)
            primary.apply {
                textSize = 13.5f; typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                gravity = Gravity.CENTER
                setPadding(px(18), px(9), px(18), px(9))
                visibility = GONE
            }
            addView(primary, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { marginStart = px(6) })
            close.visibility = GONE
            close.contentDescription = "Close"
            addView(close, LayoutParams(px(36), px(36)))
        }
        addView(card, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        card.visibility = GONE
        applyPalette()
    }

    fun setPalette(p: Palette) { palette = p; applyPalette() }

    private fun applyPalette() {
        setBackgroundColor(palette.board)
        mark.color = palette.text
        summary.setTextColor(palette.textMuted)
        card.background = GradientDrawable().apply { cornerRadius = 14 * dp; setColor(palette.key) }
        title.setTextColor(palette.text)
        detail.setTextColor(palette.textMuted)
        secondary.setTextColor(palette.text)
        primary.setTextColor(palette.onAccent)
        primary.background = GradientDrawable().apply { cornerRadius = 999f; setColor(palette.accent) }
        close.color = palette.textMuted
        for (i in 0 until chips.childCount) styleChip(chips.getChildAt(i) as TextView, i == 0)
    }

    /** True while a card (payment, result, warning) is on screen; suggestions never replace it. */
    val showingCard: Boolean get() = card.visibility == VISIBLE

    /**
     * While typing: action chips that fit the sentence (filled), then word suggestions (plain,
     * the likeliest in the middle like every phone keyboard). Tapping a word replaces the word
     * being typed.
     */
    fun showSuggestions(actions: List<Pair<String, () -> Unit>>, words: List<String>, onWord: (String) -> Unit) {
        card.visibility = GONE
        idle.visibility = VISIBLE
        chips.removeAllViews()
        actions.forEach { (label, go) -> chips.addView(chip(label, true) { go() }) }
        val ordered = if (words.size == 3) listOf(words[1], words[0], words[2]) else words
        ordered.forEach { w ->
            chips.addView(TextView(context).apply {
                text = w
                textSize = 15.5f
                typeface = if (w == words.firstOrNull()) Typeface.create("sans-serif-medium", Typeface.NORMAL) else Typeface.DEFAULT
                setTextColor(palette.text)
                gravity = Gravity.CENTER
                maxLines = 1
                setPadding(px(14), px(7), px(14), px(7))
                setOnClickListener { onWord(w) }
            })
        }
        summary.visibility = GONE
        log("Suggest", (actions.map { "[${it.first}]" } + words).joinToString(" | "))
        logChipsForTests()
    }

    /** Debug builds only: every chip's label and on-screen centre (tag LunarChips), for the end-to-end test. */
    private fun logChipsForTests() {
        if (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE == 0) return
        chips.post {
            val line = (0 until chips.childCount).map { chips.getChildAt(it) as TextView }.joinToString(";") { v ->
                val loc = IntArray(2); v.getLocationOnScreen(loc)
                "${v.text}|${loc[0] + v.width / 2}|${loc[1] + v.height / 2}"
            }
            android.util.Log.d("LunarChips", line)
        }
    }

    /** Current text, for tests and accessibility. */
    val titleText: CharSequence get() = title.text
    val detailText: CharSequence get() = detail.text

    /** The idle toolbar: a chip to start a payment, then recent names (tapping one starts a payment to them). */
    fun showIdle(recent: List<String>, summaryText: String, onNew: () -> Unit, onPick: (String) -> Unit) {
        card.visibility = GONE
        idle.visibility = VISIBLE
        chips.removeAllViews()
        chips.addView(chip("New payment", true) { onNew() })
        recent.forEach { name -> chips.addView(chip(name, false) { onPick(name) }) }
        summary.text = summaryText
        summary.visibility = if (summaryText.isEmpty()) GONE else VISIBLE
        contentDescription = "Lunar. $summaryText"
        log("Lunar", summaryText)
        logChipsForTests()
    }

    fun updateSummary(text: String) {
        summary.text = text
        summary.visibility = if (text.isEmpty()) GONE else VISIBLE
    }

    private fun chip(label: String, lead: Boolean, onClick: () -> Unit) = TextView(context).apply {
        text = label
        textSize = 13f
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        maxLines = 1
        setPadding(px(14), px(7), px(14), px(7))
        setOnClickListener { onClick() }
        layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { marginEnd = px(6) }
        styleChip(this, lead)
    }

    private fun styleChip(v: TextView, lead: Boolean) {
        v.setTextColor(if (lead) palette.onAccent else palette.text)
        v.background = GradientDrawable().apply { cornerRadius = 999f; setColor(if (lead) palette.accent else palette.key) }
    }

    fun show(
        title: String,
        detail: String,
        tone: Tone = Tone.NEUTRAL,
        action: String? = null,
        onAction: (() -> Unit)? = null,
        onClose: (() -> Unit)? = null,
        secondaryAction: String? = null,
        onSecondary: (() -> Unit)? = null,
    ) {
        idle.visibility = GONE
        card.visibility = VISIBLE
        this.title.text = title
        this.detail.text = detail
        this.detail.visibility = if (detail.isEmpty()) GONE else VISIBLE
        setTone(tone)
        primary.text = action ?: ""
        primary.visibility = if (action != null) VISIBLE else GONE
        primary.setOnClickListener(onAction?.let { f -> OnClickListener { f() } })
        secondary.text = secondaryAction ?: ""
        secondary.visibility = if (secondaryAction != null) VISIBLE else GONE
        secondary.setOnClickListener(onSecondary?.let { f -> OnClickListener { f() } })
        close.visibility = if (onClose != null) VISIBLE else GONE
        close.setOnClickListener(onClose?.let { f -> OnClickListener { f() } })
        contentDescription = "$title. $detail"
        log(title, detail)
    }

    fun updateDetail(detail: String, tone: Tone? = null) {
        this.detail.text = detail
        this.detail.visibility = VISIBLE
        if (tone != null) setTone(tone)
        contentDescription = "${title.text}. $detail"
        log(title.text, detail)
    }

    private fun setTone(tone: Tone) {
        (dot.background as GradientDrawable).setColor(
            when (tone) {
                Tone.NEUTRAL -> palette.textFaint
                Tone.OK -> palette.ok
                Tone.WARN -> palette.warn
            }
        )
    }

    private fun px(v: Int) = (v * dp).toInt()

    /** Debug builds only: the end-to-end test reads the strip from logcat (tag LunarStrip). */
    private fun log(t: CharSequence, d: CharSequence) {
        if (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE == 0) return
        android.util.Log.d("LunarStrip", "$t || ${d.toString().replace("\n", " / ")}")
        for (b in listOf(primary, secondary)) if (b.visibility == VISIBLE && card.visibility == VISIBLE) b.post {
            val loc = IntArray(2)
            b.getLocationOnScreen(loc)
            android.util.Log.d("LunarStripAction", "${b.text}|${loc[0] + b.width / 2}|${loc[1] + b.height / 2}")
        }
    }

    companion object {
        const val HEIGHT_DP = 52
    }
}
