package app.lunar.keyboard.ime

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.view.View
import app.lunar.keyboard.ui.Palette

/**
 * Draws what floats above the keys: the bubble for the key under the finger and the row of
 * options when a key is held. It covers the whole keyboard window (strip included), so a
 * bubble for the top row can rise above the keys. It never takes touches.
 */
class KeyOverlay(context: Context) : View(context) {

    private val dp = resources.displayMetrics.density
    private var palette = Palette.LIGHT

    /** Where the keyboard view sits inside this overlay; set by the keyboard before each draw. */
    var keyboardTop = 0f

    private var bubble: Bubble? = null
    private var options: Options? = null

    private class Bubble(val label: String, val rect: RectF)
    private class Options(val labels: List<String>, val edges: FloatArray, val top: Float, val bottom: Float, var selected: Int)

    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val shadow = Paint(Paint.ANTI_ALIAS_FLAG)
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = Typeface.create("sans-serif", Typeface.NORMAL) }
    private val cell = RectF()
    private val shadowRect = RectF()

    init {
        isClickable = false
        isFocusable = false
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    fun setPalette(p: Palette) { palette = p; invalidate() }

    /**
     * Asks for no height of its own: the keyboard window wraps its content, and a full-height
     * child would stretch it over the whole screen. The frame then sizes this to match.
     */
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val h = if (MeasureSpec.getMode(heightMeasureSpec) == MeasureSpec.EXACTLY) MeasureSpec.getSize(heightMeasureSpec) else 0
        setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), h)
    }

    /** Shows the bubble for a key whose box is [left, top, right, bottom] in keyboard coordinates. */
    fun showBubble(label: String, left: Float, top: Float, right: Float, bottom: Float) {
        val w = (right - left) + 10 * dp
        val h = (bottom - top) * 1.05f
        val cx = (left + right) / 2
        var t = keyboardTop + top - h - 6 * dp
        if (t < 0) t = 0f
        var l = cx - w / 2
        l = l.coerceIn(2 * dp, width - w - 2 * dp)
        bubble = Bubble(label, RectF(l, t, l + w, t + h))
        invalidate()
    }

    fun hideBubble() {
        if (bubble != null) { bubble = null; invalidate() }
    }

    /**
     * Opens the options row above a held key. Returns the cell edges in keyboard x coordinates,
     * so the keyboard can tell which option the finger is over.
     */
    fun showOptions(labels: List<String>, keyLeft: Float, keyTop: Float, keyRight: Float, keyBottom: Float): FloatArray {
        bubble = null
        val minCell = maxOf(keyRight - keyLeft, 38 * dp)
        val widths = labels.map { label ->
            text.textSize = sizeFor(label)
            maxOf(minCell, text.measureText(label) + 20 * dp)
        }
        val total = widths.sum()
        // the first option sits over the held key, like every phone keyboard; clamp to the screen
        var left = keyLeft - (widths[0] - (keyRight - keyLeft)) / 2
        left = left.coerceIn(4 * dp, maxOf(4 * dp, width - total - 4 * dp))
        val edges = FloatArray(labels.size + 1)
        edges[0] = left
        for (i in widths.indices) edges[i + 1] = edges[i] + widths[i]
        val h = (keyBottom - keyTop) * 1.05f
        val top = maxOf(0f, keyboardTop + keyTop - h - 6 * dp)
        options = Options(labels, edges, top, top + h, 0)
        invalidate()
        return edges
    }

    fun selectOption(i: Int) {
        val o = options ?: return
        if (o.selected != i) { o.selected = i; invalidate() }
    }

    fun hideOptions() {
        if (options != null) { options = null; invalidate() }
    }

    private fun sizeFor(label: String) = if (label.length > 1) 15 * dp else 22 * dp

    override fun onDraw(canvas: Canvas) {
        bubble?.let { b ->
            drawCard(canvas, b.rect.left, b.rect.top, b.rect.right, b.rect.bottom)
            text.color = palette.text
            text.textSize = 26 * dp
            canvas.drawText(b.label, b.rect.centerX(), b.rect.centerY() - (text.descent() + text.ascent()) / 2, text)
        }
        options?.let { o ->
            drawCard(canvas, o.edges.first(), o.top, o.edges.last(), o.bottom)
            for (i in o.labels.indices) {
                cell.set(o.edges[i] + 3 * dp, o.top + 4 * dp, o.edges[i + 1] - 3 * dp, o.bottom - 4 * dp)
                if (i == o.selected) {
                    fill.color = palette.popupSelected
                    canvas.drawRoundRect(cell, 8 * dp, 8 * dp, fill)
                }
                text.color = if (i == o.selected) palette.onAccent else palette.text
                text.textSize = sizeFor(o.labels[i])
                canvas.drawText(o.labels[i], cell.centerX(), cell.centerY() - (text.descent() + text.ascent()) / 2, text)
            }
        }
    }

    private fun drawCard(canvas: Canvas, l: Float, t: Float, r: Float, b: Float) {
        val radius = 12 * dp
        shadow.color = if (palette.dark) 0x80000000.toInt() else 0x2A000000
        shadowRect.set(l, t + 2 * dp, r, b + 3 * dp)
        canvas.drawRoundRect(shadowRect, radius, radius, shadow)
        fill.color = palette.popup
        cell.set(l, t, r, b)
        canvas.drawRoundRect(cell, radius, radius, fill)
    }
}
