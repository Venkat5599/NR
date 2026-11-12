package app.lunar.keyboard.ime

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import app.lunar.keyboard.core.Geometry
import app.lunar.keyboard.core.Key
import app.lunar.keyboard.core.KeyBox
import app.lunar.keyboard.core.KeyType
import app.lunar.keyboard.core.Layouts
import app.lunar.keyboard.core.Page
import app.lunar.keyboard.core.ShiftState

/**
 * Draws the keys on a Canvas and turns touches into key events.
 * One finger at a time per key; a second finger pressing another key commits the first
 * (fast two-thumb typing). Long press types the key's hint, or repeats delete.
 */
class KeyboardView(context: Context, private val listener: Listener) : View(context) {

    interface Listener {
        fun onKey(key: Key, longPress: Boolean)
        fun onSpaceLongPress()
    }

    var page: Page = Page.LETTERS
        set(v) { field = v; relayout(); invalidate() }
    var shift: ShiftState.Mode = ShiftState.Mode.OFF
        set(v) { field = v; invalidate() }
    var enterLabel: String = "⏎"
        set(v) { field = v; invalidate() }

    private val dp = resources.displayMetrics.density
    private var boxes: List<KeyBox> = emptyList()

    private val bg = Paint().apply { color = 0xFFE9EBEF.toInt() }
    private val keyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt() }
    private val modPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFCDD1D8.toInt() }
    private val payPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF0A0A0A.toInt() }
    private val pressedPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFB9BEC7.toInt() }
    private val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x26000000 }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF111111.toInt(); textAlign = Paint.Align.CENTER; typeface = Typeface.DEFAULT
    }
    private val hintText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x80111111.toInt(); textAlign = Paint.Align.RIGHT; textSize = 10 * dp
    }
    private val previewPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt() }
    private val previewShadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x33000000 }
    private val crescent = Path()

    private val handler = Handler(Looper.getMainLooper())
    private var pressed: KeyBox? = null
    private var pressedPointer = -1
    private var longFired = false
    private var repeating = false

    private val longPressRunnable = Runnable {
        val b = pressed ?: return@Runnable
        when (b.key.type) {
            KeyType.DELETE -> { repeating = true; repeatDelete() }
            KeyType.SPACE -> { longFired = true; listener.onSpaceLongPress(); release() }
            KeyType.CHAR -> if (b.key.hint != null) { longFired = true; haptic(); listener.onKey(b.key, true); invalidate() }
            else -> Unit
        }
    }

    private fun repeatDelete() {
        val b = pressed ?: return
        if (b.key.type != KeyType.DELETE || !repeating) return
        listener.onKey(b.key, false)
        handler.postDelayed({ repeatDelete() }, 55)
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val w = MeasureSpec.getSize(widthMeasureSpec)
        val h = (ROW_DP * 4 + PAD_DP * 2) * dp
        setMeasuredDimension(w, h.toInt())
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) = relayout()

    private fun relayout() {
        if (width == 0) return
        boxes = Geometry.layout(Layouts.page(page), width.toFloat(), height.toFloat(), PAD_DP * dp)
        loggedAt = null
    }

    private var loggedAt: String? = null

    /** Debug: log the key map again on the next draw (each time the keyboard is shown). */
    fun relogKeys() { loggedAt = null; invalidate() }

    /**
     * Debug builds only: writes each key's on-screen centre to logcat (tag LunarKeys), so the
     * end-to-end test can tap real keys. Keys are drawn on a canvas, so UI dumps can't see them.
     */
    private fun logKeysForTests() {
        if (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE == 0) return
        run {
            val loc = IntArray(2)
            getLocationOnScreen(loc)
            // the keyboard window slides in, so log again whenever its on-screen position settles somewhere new
            val at = "$page@${loc[0]},${loc[1]}"
            if (at == loggedAt) return
            loggedAt = at
            val line = boxes.filter { it.key.type != KeyType.SPACER }.joinToString(";") {
                // label as hex code points: symbol keys include the separators
                val hex = it.key.label.codePoints().toArray().joinToString("-") { c -> Integer.toHexString(c) }
                "${it.key.type}|$hex|${(loc[0] + it.centerX).toInt()}|${(loc[1] + it.centerY).toInt()}"
            }
            android.util.Log.d("LunarKeys", "page=$page $line")
        }
    }

    /** The current key boxes, for tests that need to tap a key by its label. */
    fun keyBoxes(): List<KeyBox> = boxes

    override fun onDraw(canvas: Canvas) {
        logKeysForTests()
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), bg)
        val gap = 3 * dp
        val r = 7 * dp
        for (b in boxes) {
            val k = b.key
            if (k.type == KeyType.SPACER) continue
            val rect = RectF(b.left + gap, b.top + gap * 1.6f, b.right - gap, b.bottom - gap * 1.6f)
            val isMod = k.type != KeyType.CHAR && k.type != KeyType.SPACE && k.type != KeyType.PAY
            val fill = when {
                b == pressed -> pressedPaint
                k.type == KeyType.PAY -> payPaint
                k.type == KeyType.SHIFT && shift != ShiftState.Mode.OFF -> keyPaint
                isMod -> modPaint
                else -> keyPaint
            }
            canvas.drawRoundRect(RectF(rect.left, rect.top + 1.2f * dp, rect.right, rect.bottom + 1.2f * dp), r, r, shadow)
            canvas.drawRoundRect(rect, r, r, fill)
            drawLabel(canvas, b, rect)
        }
        pressed?.let { if (it.key.type == KeyType.CHAR && !longFired) drawPreview(canvas, it) }
    }

    private fun labelFor(k: Key): String = when (k.type) {
        KeyType.CHAR -> if (page == Page.LETTERS && shift != ShiftState.Mode.OFF) k.label.uppercase() else k.label
        KeyType.ENTER -> enterLabel
        KeyType.SPACE -> ""
        KeyType.SHIFT -> if (shift == ShiftState.Mode.LOCKED) "⇪" else "⇧"
        else -> k.label
    }

    private fun drawLabel(canvas: Canvas, b: KeyBox, rect: RectF) {
        val k = b.key
        if (k.type == KeyType.PAY) {
            drawPay(canvas, rect); return
        }
        val label = labelFor(k)
        text.textSize = when {
            k.type == KeyType.CHAR && label.length == 1 -> 22 * dp
            label.length > 3 -> 13 * dp
            else -> 16 * dp
        }
        text.color = 0xFF111111.toInt()
        val y = rect.centerY() - (text.descent() + text.ascent()) / 2
        canvas.drawText(label, rect.centerX(), y, text)
        if (k.hint != null && page == Page.LETTERS) canvas.drawText(k.hint, rect.right - 4 * dp, rect.top + 12 * dp, hintText)
        if (k.type == KeyType.SPACE) {
            hintText.textAlign = Paint.Align.CENTER
            canvas.drawText("Lunar", rect.centerX(), rect.centerY() + 4 * dp, hintText)
            hintText.textAlign = Paint.Align.RIGHT
        }
    }

    private fun drawPay(canvas: Canvas, rect: RectF) {
        val cy = rect.centerY()
        val rad = 7 * dp
        val cx = rect.centerX() - 14 * dp
        crescent.reset()
        crescent.addCircle(cx, cy, rad, Path.Direction.CW)
        val cut = Path().apply { addCircle(cx + rad * 0.55f, cy - rad * 0.35f, rad * 0.85f, Path.Direction.CW) }
        crescent.op(cut, Path.Op.DIFFERENCE)
        text.color = 0xFFFFFFFF.toInt()
        canvas.drawPath(crescent, text)
        text.textSize = 15 * dp
        text.typeface = Typeface.DEFAULT_BOLD
        canvas.drawText("Pay", rect.centerX() + 9 * dp, cy - (text.descent() + text.ascent()) / 2, text)
        text.typeface = Typeface.DEFAULT
        text.color = 0xFF111111.toInt()
    }

    private fun drawPreview(canvas: Canvas, b: KeyBox) {
        // The preview sits over the key itself (a keyboard view cannot draw above its own top edge).
        val w = (b.right - b.left) * 1.25f
        val h = (b.bottom - b.top) * 1.15f
        val rect = RectF(b.centerX - w / 2, b.top - h * 0.35f, b.centerX + w / 2, b.top + h * 0.65f)
        if (rect.top < 0) rect.offset(0f, -rect.top)
        canvas.drawRoundRect(RectF(rect.left, rect.top + 2 * dp, rect.right, rect.bottom + 2 * dp), 9 * dp, 9 * dp, previewShadow)
        canvas.drawRoundRect(rect, 9 * dp, 9 * dp, previewPaint)
        text.textSize = 28 * dp
        canvas.drawText(labelFor(b.key), rect.centerX(), rect.centerY() - (text.descent() + text.ascent()) / 2, text)
    }

    override fun onTouchEvent(e: MotionEvent): Boolean {
        val idx = e.actionIndex
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
                // a new finger commits the key the previous finger is still holding
                if (pressed != null && pressedPointer != e.getPointerId(idx)) commitPressed()
                val b = Geometry.hit(boxes, e.getX(idx), e.getY(idx)) ?: return true
                pressed = b
                pressedPointer = e.getPointerId(idx)
                longFired = false
                repeating = false
                haptic()
                if (b.key.type == KeyType.DELETE) { listener.onKey(b.key, false); longFired = true }
                handler.postDelayed(longPressRunnable, if (b.key.type == KeyType.DELETE) 400 else 380)
                invalidate()
            }
            MotionEvent.ACTION_MOVE -> {
                val p = e.findPointerIndex(pressedPointer)
                if (p >= 0 && !repeating && !longFired) {
                    val b = Geometry.hit(boxes, e.getX(p), e.getY(p))
                    if (b != null && b != pressed) {
                        handler.removeCallbacks(longPressRunnable)
                        pressed = b
                        handler.postDelayed(longPressRunnable, 380)
                        invalidate()
                    }
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> {
                if (e.getPointerId(idx) == pressedPointer) commitPressed()
            }
            MotionEvent.ACTION_CANCEL -> release()
        }
        return true
    }

    private fun commitPressed() {
        val b = pressed
        handler.removeCallbacks(longPressRunnable)
        if (b != null && !longFired && !repeating) listener.onKey(b.key, false)
        release()
    }

    private fun release() {
        handler.removeCallbacks(longPressRunnable)
        pressed = null
        pressedPointer = -1
        repeating = false
        invalidate()
    }

    private fun haptic() {
        performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
    }

    companion object {
        const val ROW_DP = 54
        const val PAD_DP = 4
    }
}
