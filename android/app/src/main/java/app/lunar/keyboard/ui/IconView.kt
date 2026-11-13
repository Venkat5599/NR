package app.lunar.keyboard.ui

import android.content.Context
import android.graphics.Canvas
import android.view.View

/** One [Icons] glyph as a view, for buttons outside the key canvas (close, chevrons). */
class IconView(context: Context, kind: Icons.Kind, color: Int, private val sizeDp: Float = 18f) : View(context) {
    var kind: Icons.Kind = kind
        set(v) { field = v; invalidate() }
    var color: Int = color
        set(v) { field = v; invalidate() }

    private val icons = Icons()
    private val dp = resources.displayMetrics.density

    override fun onDraw(canvas: Canvas) {
        icons.draw(canvas, kind, width / 2f, height / 2f, sizeDp * dp, color)
    }
}
