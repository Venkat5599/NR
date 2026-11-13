package app.lunar.keyboard.ime

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
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
import app.lunar.keyboard.ui.Icons
import app.lunar.keyboard.ui.Palette

/**
 * Draws the keys and turns touches into key events.
 *
 * Speed: the keys are drawn once into a bitmap whenever the page, shift, theme or size
 * changes; a touch only repaints the one pressed key on top of it, so a key press costs a
 * bitmap copy and one rounded rect. Nothing is allocated while drawing.
 *
 * Touch: one finger at a time per key; a second finger commits the first (fast two-thumb
 * typing). Holding a key opens its options (digits, accents, currencies); slide to pick, lift
 * to type it. Holding delete repeats; holding space switches keyboards; holding Pay opens the
 * pay form.
 */
class KeyboardView(context: Context, private val listener: Listener, private val overlay: KeyOverlay) : View(context) {

    interface Listener {
        fun onKey(key: Key)
        fun onText(text: String)
        fun onSpaceLongPress()
        fun onPayLongPress()
    }

    enum class Enter { RETURN, SEARCH, SEND, GO, NEXT, DONE }

    var page: Page = Page.LETTERS
        set(v) { if (field != v) { field = v; relayout() } }
    var shift: ShiftState.Mode = ShiftState.Mode.OFF
        set(v) { if (field != v) { field = v; dirty() } }
    var enter: Enter = Enter.RETURN
        set(v) { if (field != v) { field = v; dirty() } }
    var palette: Palette = Palette.LIGHT
        set(v) { field = v; overlay.setPalette(v); dirty() }

    private val dp = resources.displayMetrics.density
    private var boxes: List<KeyBox> = emptyList()
    private var keyRects: Array<RectF> = emptyArray()
    private var cache: Bitmap? = null
    private var cacheValid = false

    private val icons = Icons()
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val shadow = Paint(Paint.ANTI_ALIAS_FLAG)
    private val blit = Paint(Paint.FILTER_BITMAP_FLAG)
    private val label = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
    private val hint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.RIGHT }
    private val shadowRect = RectF()
    private val letterFace = Typeface.create("sans-serif", Typeface.NORMAL)
    private val modFace = Typeface.create("sans-serif-medium", Typeface.NORMAL)

    private val handler = Handler(Looper.getMainLooper())
    private var pressed = -1
    private var pressedPointer = -1
    private var longFired = false
    private var repeating = false
    private var optionLabels: List<String> = emptyList()
    private var optionEdges: FloatArray? = null
    private var optionSelected = 0

    private val longPressRunnable = Runnable { onLongPress() }

    // ---------------------------------------------------------------- size and layout

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val w = MeasureSpec.getSize(widthMeasureSpec)
        val cfg = resources.configuration
        val row = Geometry.rowHeightDp(cfg.screenWidthDp, cfg.screenHeightDp)
        setMeasuredDimension(w, ((row * 4 + PAD_DP * 2) * dp).toInt())
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        cache?.recycle()
        cache = if (w > 0 && h > 0) Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888) else null
        relayout()
    }

    private fun relayout() {
        if (width == 0) return
        boxes = Geometry.layout(Layouts.page(page), width.toFloat(), height.toFloat(), PAD_DP * dp)
        val gx = GAP_X_DP * dp
        val gy = GAP_Y_DP * dp
        keyRects = Array(boxes.size) { i -> boxes[i].let { RectF(it.left + gx, it.top + gy, it.right - gx, it.bottom - gy) } }
        loggedAt = null
        dirty()
    }

    private fun dirty() {
        cacheValid = false
        invalidate()
    }

    // ---------------------------------------------------------------- drawing

    override fun onDraw(canvas: Canvas) {
        logKeysForTests()
        val bmp = cache ?: return
        if (!cacheValid) {
            val c = Canvas(bmp)
            c.drawColor(palette.board)
            for (i in boxes.indices) if (boxes[i].key.type != KeyType.SPACER) drawKey(c, i, false)
            cacheValid = true
        }
        canvas.drawBitmap(bmp, 0f, 0f, blit)
        if (pressed >= 0 && optionEdges == null) drawKey(canvas, pressed, true)
    }

    private fun drawKey(c: Canvas, i: Int, isPressed: Boolean) {
        val k = boxes[i].key
        val r = keyRects[i]
        val radius = RADIUS_DP * dp
        val isMod = k.type != KeyType.CHAR && k.type != KeyType.SPACE && k.type != KeyType.PAY
        val shiftOn = k.type == KeyType.SHIFT && shift != ShiftState.Mode.OFF
        fill.color = when {
            isPressed && k.type == KeyType.PAY -> palette.textMuted
            isPressed -> palette.keyPressed
            k.type == KeyType.PAY -> palette.accent
            shiftOn -> palette.key
            isMod -> palette.keyMod
            else -> palette.key
        }
        if (!palette.dark && !isPressed) {
            shadow.color = palette.keyShadow
            shadowRect.set(r.left, r.top + 1.1f * dp, r.right, r.bottom + 1.1f * dp)
            c.drawRoundRect(shadowRect, radius, radius, shadow)
        }
        c.drawRoundRect(r, radius, radius, fill)

        val cx = r.centerX(); val cy = r.centerY()
        val iconSize = minOf(r.height(), r.width()) * 0.5f
        when (k.type) {
            KeyType.PAY -> drawPay(c, r)
            KeyType.SHIFT -> icons.draw(c, when (shift) {
                ShiftState.Mode.OFF -> Icons.Kind.SHIFT
                ShiftState.Mode.ONCE -> Icons.Kind.SHIFT_ON
                ShiftState.Mode.LOCKED -> Icons.Kind.SHIFT_LOCKED
            }, cx, cy, iconSize, palette.text)
            KeyType.DELETE -> icons.draw(c, Icons.Kind.DELETE, cx, cy, iconSize, palette.text)
            KeyType.ENTER -> icons.draw(c, when (enter) {
                Enter.RETURN -> Icons.Kind.RETURN
                Enter.SEARCH -> Icons.Kind.SEARCH
                Enter.SEND -> Icons.Kind.SEND
                Enter.GO -> Icons.Kind.GO
                Enter.NEXT -> Icons.Kind.NEXT
                Enter.DONE -> Icons.Kind.DONE
            }, cx, cy, iconSize, palette.text)
            KeyType.SPACE -> {
                hint.textAlign = Paint.Align.CENTER
                hint.textSize = 11 * dp; hint.typeface = modFace; hint.color = palette.textFaint
                c.drawText("Lunar", cx, cy - (hint.descent() + hint.ascent()) / 2, hint)
                hint.textAlign = Paint.Align.RIGHT
            }
            KeyType.CHAR -> {
                val text = labelFor(k)
                label.typeface = letterFace
                label.textSize = if (text.length == 1 && text[0].isLetter()) 22 * dp else 20 * dp
                label.color = palette.text
                c.drawText(text, cx, cy - (label.descent() + label.ascent()) / 2, label)
                if (k.hint != null && page == Page.LETTERS) {
                    hint.textSize = 10.5f * dp; hint.typeface = letterFace; hint.color = palette.textFaint
                    c.drawText(k.hint, r.right - 5 * dp, r.top + 13 * dp, hint)
                }
            }
            else -> {
                label.typeface = modFace
                label.textSize = 14.5f * dp
                label.color = palette.text
                c.drawText(k.label, cx, cy - (label.descent() + label.ascent()) / 2, label)
            }
        }
    }

    private fun drawPay(c: Canvas, r: RectF) {
        label.typeface = modFace
        label.textSize = 15.5f * dp
        val word = "Pay"
        val iconSize = 15 * dp
        val gap = 6 * dp
        val total = iconSize + gap + label.measureText(word)
        val left = r.centerX() - total / 2
        icons.draw(c, Icons.Kind.CRESCENT, left + iconSize / 2, r.centerY(), iconSize, palette.onAccent)
        label.textAlign = Paint.Align.LEFT
        label.color = palette.onAccent
        c.drawText(word, left + iconSize + gap, r.centerY() - (label.descent() + label.ascent()) / 2, label)
        label.textAlign = Paint.Align.CENTER
    }

    private fun labelFor(k: Key): String =
        if (k.type == KeyType.CHAR && page == Page.LETTERS && shift != ShiftState.Mode.OFF) k.label.uppercase() else k.label

    // ---------------------------------------------------------------- touch

    override fun onTouchEvent(e: MotionEvent): Boolean {
        val idx = e.actionIndex
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
                // a new finger commits the key the previous finger is still holding
                if (pressed >= 0 && pressedPointer != e.getPointerId(idx)) commitPressed()
                val i = indexAt(e.getX(idx), e.getY(idx))
                if (i < 0) return true
                press(i, e.getPointerId(idx))
            }
            MotionEvent.ACTION_MOVE -> {
                val p = e.findPointerIndex(pressedPointer)
                if (p < 0) return true
                val edges = optionEdges
                if (edges != null) {
                    optionSelected = Geometry.optionAt(e.getX(p), edges)
                    overlay.selectOption(optionSelected)
                } else if (!repeating && !longFired) {
                    val i = indexAt(e.getX(p), e.getY(p))
                    if (i >= 0 && i != pressed) {
                        handler.removeCallbacks(longPressRunnable)
                        pressed = i
                        showBubble()
                        handler.postDelayed(longPressRunnable, LONG_PRESS_MS)
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

    private fun indexAt(x: Float, y: Float): Int {
        val b = Geometry.hit(boxes, x, y) ?: return -1
        return boxes.indexOf(b)
    }

    private fun press(i: Int, pointer: Int) {
        pressed = i
        pressedPointer = pointer
        longFired = false
        repeating = false
        haptic()
        val k = boxes[i].key
        if (k.type == KeyType.DELETE) { listener.onKey(k); longFired = true }
        showBubble()
        handler.postDelayed(longPressRunnable, if (k.type == KeyType.DELETE) 400 else LONG_PRESS_MS)
        invalidate()
    }

    private fun showBubble() {
        val b = boxes.getOrNull(pressed) ?: return
        overlay.keyboardTop = top.toFloat()
        if (b.key.type == KeyType.CHAR) {
            val r = keyRects[pressed]
            overlay.showBubble(labelFor(b.key), r.left, r.top, r.right, r.bottom)
        } else overlay.hideBubble()
    }

    private fun onLongPress() {
        val i = pressed
        if (i < 0) return
        val k = boxes[i].key
        when (k.type) {
            KeyType.DELETE -> { repeating = true; repeatDelete(0) }
            KeyType.SPACE -> { longFired = true; listener.onSpaceLongPress(); release() }
            KeyType.PAY -> { longFired = true; haptic(); listener.onPayLongPress(); release() }
            KeyType.CHAR -> {
                val upper = page == Page.LETTERS && shift != ShiftState.Mode.OFF
                val opts = Layouts.options(k, upper)
                if (opts.isEmpty()) return
                longFired = true
                haptic()
                if (opts.size == 1) {
                    listener.onText(opts[0]); overlay.hideBubble(); invalidate(); return
                }
                val r = keyRects[i]
                overlay.keyboardTop = top.toFloat()
                optionLabels = opts
                optionSelected = 0
                optionEdges = overlay.showOptions(opts, r.left, r.top, r.right, r.bottom)
                logPopupForTests()
                invalidate()
            }
            else -> Unit
        }
    }

    /** Held delete repeats, and speeds up after the first dozen characters. */
    private fun repeatDelete(count: Int) {
        val i = pressed
        if (i < 0 || boxes[i].key.type != KeyType.DELETE || !repeating) return
        listener.onKey(boxes[i].key)
        handler.postDelayed({ repeatDelete(count + 1) }, if (count < 12) 60 else 30)
    }

    private fun commitPressed() {
        val i = pressed
        handler.removeCallbacks(longPressRunnable)
        if (optionEdges != null) {
            optionLabels.getOrNull(optionSelected)?.let { listener.onText(it) }
        } else if (i >= 0 && !longFired && !repeating) {
            listener.onKey(boxes[i].key)
        }
        release()
    }

    private fun release() {
        handler.removeCallbacks(longPressRunnable)
        pressed = -1
        pressedPointer = -1
        repeating = false
        optionEdges = null
        optionLabels = emptyList()
        overlay.hideBubble()
        overlay.hideOptions()
        invalidate()
    }

    private fun haptic() {
        performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
    }

    // ---------------------------------------------------------------- test hooks (debug builds only)

    private var loggedAt: String? = null

    /** Debug: log the key map again on the next draw (each time the keyboard is shown). */
    fun relogKeys() {
        loggedAt = null
        invalidate()
        // the window slides in without redrawing the keys: check the position again once it settles
        if (debuggable) for (ms in longArrayOf(250, 600, 1200)) handler.postDelayed({ logKeysForTests() }, ms)
    }

    private val debuggable = context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0

    /**
     * Writes each key's on-screen centre to logcat (tag LunarKeys), so the end-to-end test can
     * tap real keys. Keys are drawn on a canvas, so UI dumps can't see them.
     */
    private fun logKeysForTests() {
        if (!debuggable) return
        val loc = IntArray(2)
        getLocationOnScreen(loc)
        // the keyboard window slides in, so log again whenever its on-screen position settles somewhere new
        val at = "$page@${loc[0]},${loc[1]},$height"
        if (at == loggedAt) return
        loggedAt = at
        val line = boxes.filter { it.key.type != KeyType.SPACER }.joinToString(";") {
            // label as hex code points: symbol keys include the separators
            val hex = it.key.label.codePoints().toArray().joinToString("-") { c -> Integer.toHexString(c) }
            "${it.key.type}|$hex|${(loc[0] + it.centerX).toInt()}|${(loc[1] + it.centerY).toInt()}"
        }
        android.util.Log.d("LunarKeys", "page=$page $line")
    }

    /** Writes the open options and each one's on-screen centre (tag LunarPopup). */
    private fun logPopupForTests() {
        if (!debuggable) return
        val edges = optionEdges ?: return
        val loc = IntArray(2)
        getLocationOnScreen(loc)
        val y = loc[1] + keyRects[pressed].top - keyRects[pressed].height() / 2 - 6 * dp
        val line = optionLabels.indices.joinToString(";") { i ->
            "${optionLabels[i]}|${(loc[0] + (edges[i] + edges[i + 1]) / 2).toInt()}|${y.toInt()}"
        }
        android.util.Log.d("LunarPopup", line)
    }

    fun keyBoxes(): List<KeyBox> = boxes

    companion object {
        const val PAD_DP = 4
        const val GAP_X_DP = 3f
        const val GAP_Y_DP = 5f
        const val RADIUS_DP = 8f
        const val LONG_PRESS_MS = 320L
    }
}
