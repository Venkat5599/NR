package app.lunar.keyboard.setup

import android.app.Activity
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.InputType
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import app.lunar.keyboard.R
import app.lunar.keyboard.ui.IconView
import app.lunar.keyboard.ui.Icons
import app.lunar.keyboard.ui.Palette

/**
 * The app's building blocks, all sized in dp and coloured from one [Palette], so the screens
 * look the same on every phone and switch cleanly between light and dark.
 */
class Kit(private val activity: Activity, val palette: Palette) {
    private val dp = activity.resources.displayMetrics.density
    val displayFace: Typeface = runCatching { activity.resources.getFont(R.font.eb_garamond) }.getOrDefault(Typeface.SERIF)
    private val medium: Typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)

    fun px(v: Int) = (v * dp).toInt()
    fun pxf(v: Float) = v * dp

    // ---------------------------------------------------------------- type

    fun text(s: String, size: Float = 15f, muted: Boolean = false, faint: Boolean = false, bold: Boolean = false) = TextView(activity).apply {
        text = s
        textSize = size
        setTextColor(when { faint -> palette.textFaint; muted -> palette.textMuted; else -> palette.text })
        if (bold) typeface = medium
        setLineSpacing(pxf(2f), 1f)
    }

    fun displayText(s: String, size: Float) = TextView(activity).apply {
        text = s
        textSize = size
        typeface = displayFace
        setTextColor(palette.text)
        setLineSpacing(0f, 1.02f)
        letterSpacing = -0.01f
    }

    fun label(s: String) = text(s.uppercase(), 11.5f, faint = true, bold = true).apply { letterSpacing = 0.08f }

    // ---------------------------------------------------------------- surfaces

    fun card(body: LinearLayout.() -> Unit) = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(px(18), px(18), px(18), px(18))
        background = GradientDrawable().apply {
            cornerRadius = pxf(22f)
            setColor(palette.card)
            setStroke(px(1).coerceAtLeast(1), palette.line)
        }
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = px(14) }
        body()
    }

    fun row(gravity: Int = Gravity.CENTER_VERTICAL, body: LinearLayout.() -> Unit) = LinearLayout(activity).apply {
        orientation = LinearLayout.HORIZONTAL
        this.gravity = gravity
        body()
    }

    fun space(h: Int) = View(activity).apply { layoutParams = LinearLayout.LayoutParams(1, px(h)) }

    fun divider() = View(activity).apply {
        setBackgroundColor(palette.line)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, px(1).coerceAtLeast(1)).apply { topMargin = px(14); bottomMargin = px(14) }
    }

    // ---------------------------------------------------------------- controls

    fun primary(label: String, onClick: () -> Unit) = button(label, palette.accent, palette.onAccent, onClick)

    fun secondary(label: String, onClick: () -> Unit) = button(label, palette.field, palette.text, onClick)

    private fun button(label: String, bg: Int, fg: Int, onClick: () -> Unit) = TextView(activity).apply {
        text = label
        textSize = 15f
        typeface = medium
        gravity = Gravity.CENTER
        setTextColor(fg)
        maxLines = 1
        ellipsize = TextUtils.TruncateAt.END
        minHeight = px(50)
        setPadding(px(20), px(12), px(20), px(12))
        background = GradientDrawable().apply { cornerRadius = 999f; setColor(bg) }
        isClickable = true
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = px(12) }
    }

    /** A small pill button for the end of a row. */
    fun pill(label: String, onClick: () -> Unit) = TextView(activity).apply {
        text = label
        textSize = 14f
        typeface = medium
        gravity = Gravity.CENTER
        setTextColor(palette.onAccent)
        setPadding(px(16), px(9), px(16), px(9))
        background = GradientDrawable().apply { cornerRadius = 999f; setColor(palette.accent) }
        setOnClickListener { onClick() }
    }

    fun field(hint: String, tag: String, number: Boolean = false) = EditText(activity).apply {
        this.hint = hint
        this.tag = tag
        isSingleLine = true
        textSize = 16f
        setTextColor(palette.text)
        setHintTextColor(palette.textFaint)
        inputType = if (number) InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
        else InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        setPadding(px(16), px(14), px(16), px(14))
        background = GradientDrawable().apply { cornerRadius = pxf(14f); setColor(palette.field) }
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = px(10) }
    }

    /** Choose one of a few options; the chosen one is filled. */
    fun segmented(options: List<String>, selected: Int, onPick: (Int) -> Unit): LinearLayout {
        val box = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(px(4), px(4), px(4), px(4))
            background = GradientDrawable().apply { cornerRadius = 999f; setColor(palette.field) }
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = px(12) }
        }
        var current = selected
        val cells = options.mapIndexed { i, o ->
            TextView(activity).apply {
                text = o
                textSize = 14f
                typeface = medium
                gravity = Gravity.CENTER
                setPadding(0, px(10), 0, px(10))
            }
        }
        fun paint() = cells.forEachIndexed { i, c ->
            c.setTextColor(if (i == current) palette.text else palette.textMuted)
            c.background = if (i == current) GradientDrawable().apply { cornerRadius = 999f; setColor(palette.card) } else null
        }
        cells.forEachIndexed { i, c ->
            c.setOnClickListener { current = i; paint(); onPick(i) }
            box.addView(c, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        }
        paint()
        return box
    }

    /** A setup step: a numbered dot (a check once done), what to do, its state, and the action. */
    fun step(number: Int, title: String, status: TextView, done: Boolean, action: String?, onAction: () -> Unit) = row {
        setPadding(0, px(8), 0, px(8))
        addView(StepDot(activity, number, done, palette), LinearLayout.LayoutParams(px(30), px(30)).apply { marginEnd = px(14) })
        addView(LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            addView(text(title, 16f, bold = true))
            addView(status)
        }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        if (action != null) addView(pill(action, onAction))
    }

    fun icon(kind: Icons.Kind, sizeDp: Float, color: Int = palette.text) = IconView(activity, kind, color, sizeDp)

    /** A bar showing how much of today's cap is left. */
    fun meter(fraction: Float) = Meter(activity, fraction.coerceIn(0f, 1f), palette).apply {
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, px(8)).apply { topMargin = px(14) }
    }

    /** Wraps the screen's content in a centred column no wider than [maxDp], for tablets, foldables and landscape. */
    fun centred(content: View, maxDp: Int) = FrameLayout(activity).apply {
        addView(MaxWidth(activity, px(maxDp)).apply { addView(content) },
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER_HORIZONTAL))
    }

    private class MaxWidth(context: android.content.Context, private val max: Int) : FrameLayout(context) {
        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            val w = MeasureSpec.getSize(widthMeasureSpec)
            super.onMeasure(if (w > max) MeasureSpec.makeMeasureSpec(max, MeasureSpec.EXACTLY) else widthMeasureSpec, heightMeasureSpec)
        }
    }

    class StepDot(context: android.content.Context, private val n: Int, private val done: Boolean, private val p: Palette) : View(context) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val icons = Icons()
        private val dp = resources.displayMetrics.density
        override fun onDraw(canvas: Canvas) {
            val r = minOf(width, height) / 2f
            val cx = width / 2f; val cy = height / 2f
            if (done) {
                paint.style = Paint.Style.FILL; paint.color = p.ok
                canvas.drawCircle(cx, cy, r, paint)
                icons.draw(canvas, Icons.Kind.CHECK, cx, cy, r * 1.2f, 0xFFFFFFFF.toInt())
            } else {
                paint.style = Paint.Style.STROKE; paint.strokeWidth = 1.5f * dp; paint.color = p.textFaint
                canvas.drawCircle(cx, cy, r - paint.strokeWidth, paint)
                paint.style = Paint.Style.FILL; paint.color = p.text; paint.textAlign = Paint.Align.CENTER
                paint.textSize = 13 * dp; paint.typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                canvas.drawText(n.toString(), cx, cy - (paint.descent() + paint.ascent()) / 2, paint)
            }
        }
    }

    class Meter(context: android.content.Context, private val fraction: Float, private val p: Palette) : View(context) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val rect = RectF()
        override fun onDraw(canvas: Canvas) {
            val h = height.toFloat()
            paint.color = p.field
            rect.set(0f, 0f, width.toFloat(), h); canvas.drawRoundRect(rect, h / 2, h / 2, paint)
            if (fraction > 0f) {
                paint.color = p.accent
                rect.set(0f, 0f, maxOf(h, width * fraction), h); canvas.drawRoundRect(rect, h / 2, h / 2, paint)
            }
        }
    }
}
