package app.lunar.keyboard.ime

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView

/**
 * The row above the keys. It shows one thing at a time: a hint, a payment card for the
 * sentence the user just typed, or a warning about the address on the clipboard.
 */
class StripView(context: Context) : LinearLayout(context) {

    enum class Tone { NEUTRAL, OK, WARN }

    private val dp = resources.displayMetrics.density
    private val dot = View(context)
    private val title = TextView(context)
    private val detail = TextView(context)
    private val primary = TextView(context)
    private val close = TextView(context)

    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setBackgroundColor(0xFFE9EBEF.toInt())
        setPadding((12 * dp).toInt(), (6 * dp).toInt(), (8 * dp).toInt(), (2 * dp).toInt())
        minimumHeight = (HEIGHT_DP * dp).toInt()

        dot.background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(0xFF9AA0AA.toInt()) }
        addView(dot, LayoutParams((8 * dp).toInt(), (8 * dp).toInt()).apply { marginEnd = (10 * dp).toInt() })

        val texts = LinearLayout(context).apply { orientation = VERTICAL }
        title.apply { textSize = 14f; setTextColor(0xFF111111.toInt()); maxLines = 1; ellipsize = TextUtils.TruncateAt.END }
        detail.apply { textSize = 11.5f; setTextColor(0x99111111.toInt()); maxLines = 5; ellipsize = TextUtils.TruncateAt.END }
        texts.addView(title)
        texts.addView(detail)
        addView(texts, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))

        primary.apply {
            textSize = 13f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(0xFFFFFFFF.toInt())
            gravity = Gravity.CENTER
            setPadding((16 * dp).toInt(), (7 * dp).toInt(), (16 * dp).toInt(), (7 * dp).toInt())
            background = GradientDrawable().apply { cornerRadius = 999f; setColor(0xFF0A0A0A.toInt()) }
            visibility = GONE
        }
        addView(primary, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { marginStart = (8 * dp).toInt() })

        close.apply {
            text = "✕"; textSize = 15f; setTextColor(0x99111111.toInt()); gravity = Gravity.CENTER
            setPadding((10 * dp).toInt(), (6 * dp).toInt(), (6 * dp).toInt(), (6 * dp).toInt())
            visibility = GONE
        }
        addView(close)
    }

    /** Current text, for tests and accessibility. */
    val titleText: CharSequence get() = title.text
    val detailText: CharSequence get() = detail.text

    fun show(
        title: String,
        detail: String,
        tone: Tone = Tone.NEUTRAL,
        action: String? = null,
        onAction: (() -> Unit)? = null,
        onClose: (() -> Unit)? = null,
    ) {
        this.title.text = title
        this.detail.text = detail
        this.detail.visibility = if (detail.isEmpty()) GONE else VISIBLE
        (dot.background as GradientDrawable).setColor(
            when (tone) {
                Tone.NEUTRAL -> 0xFF9AA0AA.toInt()
                Tone.OK -> 0xFF1AA36A.toInt()
                Tone.WARN -> 0xFFE0A100.toInt()
            }
        )
        primary.text = action ?: ""
        primary.visibility = if (action != null) VISIBLE else GONE
        primary.setOnClickListener(onAction?.let { f -> OnClickListener { f() } })
        close.visibility = if (onClose != null) VISIBLE else GONE
        close.setOnClickListener(onClose?.let { f -> OnClickListener { f() } })
        contentDescription = "$title. $detail"
        logForTests()
    }

    fun updateDetail(detail: String, tone: Tone? = null) {
        this.detail.text = detail
        this.detail.visibility = VISIBLE
        if (tone != null) (dot.background as GradientDrawable).setColor(
            when (tone) {
                Tone.NEUTRAL -> 0xFF9AA0AA.toInt()
                Tone.OK -> 0xFF1AA36A.toInt()
                Tone.WARN -> 0xFFE0A100.toInt()
            }
        )
        contentDescription = "${title.text}. $detail"
        logForTests()
    }

    /** Debug builds only: the end-to-end test reads the strip from logcat (tag LunarStrip). */
    private fun logForTests() {
        if (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE == 0) return
        android.util.Log.d("LunarStrip", "${title.text} || ${detail.text.toString().replace("\n", " / ")}")
        if (primary.visibility == VISIBLE) primary.post {
            val loc = IntArray(2)
            primary.getLocationOnScreen(loc)
            android.util.Log.d("LunarStripAction", "${primary.text}|${loc[0] + primary.width / 2}|${loc[1] + primary.height / 2}")
        }
    }

    companion object {
        const val HEIGHT_DP = 48
    }
}
