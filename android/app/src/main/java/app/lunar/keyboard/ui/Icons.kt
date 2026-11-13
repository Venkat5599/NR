package app.lunar.keyboard.ui

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF

/**
 * Line icons drawn with paths, so keys look the same on every phone (font glyphs like
 * ⇧ ⌫ ⏎ vary by maker and look dated). Every icon fits a box of [size] centred on (cx, cy).
 * Paths are reused between calls: drawing allocates nothing.
 */
class Icons {
    enum class Kind { SHIFT, SHIFT_ON, SHIFT_LOCKED, DELETE, RETURN, SEARCH, SEND, GO, NEXT, DONE, CLOSE, CHECK, CHEVRON_DOWN, CRESCENT }

    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val path = Path()
    private val cut = Path()
    private val oval = RectF()

    fun draw(canvas: Canvas, kind: Kind, cx: Float, cy: Float, size: Float, color: Int) {
        val s = size / 24f // icons are designed on a 24-unit grid
        stroke.color = color; fill.color = color
        stroke.strokeWidth = 1.9f * s
        fun x(v: Float) = cx + (v - 12f) * s
        fun y(v: Float) = cy + (v - 12f) * s
        path.reset()
        when (kind) {
            Kind.SHIFT, Kind.SHIFT_ON, Kind.SHIFT_LOCKED -> {
                // an arrow with a stem; filled when on, filled plus a bar when locked
                path.moveTo(x(12f), y(4.5f)); path.lineTo(x(20f), y(12.5f)); path.lineTo(x(15.5f), y(12.5f))
                path.lineTo(x(15.5f), y(17.5f)); path.lineTo(x(8.5f), y(17.5f)); path.lineTo(x(8.5f), y(12.5f))
                path.lineTo(x(4f), y(12.5f)); path.close()
                if (kind == Kind.SHIFT) canvas.drawPath(path, stroke) else { canvas.drawPath(path, fill); canvas.drawPath(path, stroke) }
                if (kind == Kind.SHIFT_LOCKED) canvas.drawLine(x(8.5f), y(21f), x(15.5f), y(21f), stroke)
            }
            Kind.DELETE -> {
                path.moveTo(x(8.5f), y(5.5f)); path.lineTo(x(20f), y(5.5f)); path.lineTo(x(20f), y(18.5f))
                path.lineTo(x(8.5f), y(18.5f)); path.lineTo(x(2.5f), y(12f)); path.close()
                canvas.drawPath(path, stroke)
                canvas.drawLine(x(11.5f), y(9.5f), x(16.5f), y(14.5f), stroke)
                canvas.drawLine(x(16.5f), y(9.5f), x(11.5f), y(14.5f), stroke)
            }
            Kind.RETURN -> {
                path.moveTo(x(19.5f), y(5f)); path.lineTo(x(19.5f), y(13.5f)); path.lineTo(x(5f), y(13.5f))
                canvas.drawPath(path, stroke)
                path.reset(); path.moveTo(x(9f), y(9.5f)); path.lineTo(x(5f), y(13.5f)); path.lineTo(x(9f), y(17.5f))
                canvas.drawPath(path, stroke)
            }
            Kind.SEARCH -> {
                oval.set(x(4f), y(4f), x(16f), y(16f)); canvas.drawOval(oval, stroke)
                canvas.drawLine(x(14.5f), y(14.5f), x(20f), y(20f), stroke)
            }
            Kind.SEND -> {
                path.moveTo(x(3.5f), y(11.5f)); path.lineTo(x(20.5f), y(4f)); path.lineTo(x(14f), y(20.5f))
                path.lineTo(x(11f), y(13.5f)); path.close()
                canvas.drawPath(path, stroke)
                canvas.drawLine(x(11f), y(13.5f), x(20.5f), y(4f), stroke)
            }
            Kind.GO, Kind.NEXT -> {
                canvas.drawLine(x(4.5f), y(12f), x(19f), y(12f), stroke)
                path.moveTo(x(13f), y(6f)); path.lineTo(x(19f), y(12f)); path.lineTo(x(13f), y(18f))
                canvas.drawPath(path, stroke)
            }
            Kind.DONE, Kind.CHECK -> {
                path.moveTo(x(5f), y(12.5f)); path.lineTo(x(10f), y(17.5f)); path.lineTo(x(19.5f), y(7f))
                canvas.drawPath(path, stroke)
            }
            Kind.CLOSE -> {
                canvas.drawLine(x(6.5f), y(6.5f), x(17.5f), y(17.5f), stroke)
                canvas.drawLine(x(17.5f), y(6.5f), x(6.5f), y(17.5f), stroke)
            }
            Kind.CHEVRON_DOWN -> {
                path.moveTo(x(7f), y(9.5f)); path.lineTo(x(12f), y(14.5f)); path.lineTo(x(17f), y(9.5f))
                canvas.drawPath(path, stroke)
            }
            Kind.CRESCENT -> {
                path.addCircle(x(12f), y(12f), 8.5f * s, Path.Direction.CW)
                cut.reset(); cut.addCircle(x(16.5f), y(8.5f), 7.2f * s, Path.Direction.CW)
                path.op(cut, Path.Op.DIFFERENCE)
                canvas.drawPath(path, fill)
            }
        }
    }
}
