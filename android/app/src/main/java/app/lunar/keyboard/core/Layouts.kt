package app.lunar.keyboard.core

/** What a key does when it is released. */
enum class KeyType { CHAR, SHIFT, DELETE, SPACE, ENTER, TO_SYMBOLS, TO_LETTERS, TO_MORE_SYMBOLS, PAY, SPACER }

/**
 * One key. [weight] is its width in key units; every row in a layout sums to [Layouts.ROW_UNITS].
 * [hint] is the character a long press types (digits on the top letter row).
 */
data class Key(
    val label: String,
    val type: KeyType = KeyType.CHAR,
    val weight: Float = 1f,
    val hint: String? = null,
) {
    val text: String get() = label
}

enum class Page { LETTERS, SYMBOLS, MORE_SYMBOLS }

object Layouts {
    const val ROW_UNITS = 10f

    private fun chars(s: String, hints: String? = null): List<Key> =
        s.mapIndexed { i, c -> Key(c.toString(), hint = hints?.getOrNull(i)?.toString()) }

    private fun bottomRow(switchLabel: String, switchType: KeyType) = listOf(
        Key(switchLabel, switchType, 1.4f),
        Key("Pay", KeyType.PAY, 1.4f),
        Key(","),
        Key(" ", KeyType.SPACE, 3.5f),
        Key("."),
        Key("⏎", KeyType.ENTER, 1.7f),
    )

    val letters: List<List<Key>> = listOf(
        chars("qwertyuiop", "1234567890"),
        listOf(Key("", KeyType.SPACER, 0.5f)) + chars("asdfghjkl") + listOf(Key("", KeyType.SPACER, 0.5f)),
        listOf(Key("⇧", KeyType.SHIFT, 1.5f)) + chars("zxcvbnm") + listOf(Key("⌫", KeyType.DELETE, 1.5f)),
        bottomRow("?123", KeyType.TO_SYMBOLS),
    )

    val symbols: List<List<Key>> = listOf(
        chars("1234567890"),
        chars("@#\$_&-+()/"),
        listOf(Key("=\\<", KeyType.TO_MORE_SYMBOLS, 1.5f)) + chars("*\"':;!?") + listOf(Key("⌫", KeyType.DELETE, 1.5f)),
        bottomRow("ABC", KeyType.TO_LETTERS),
    )

    val moreSymbols: List<List<Key>> = listOf(
        chars("~`|•√π÷×¶∆"),
        chars("£¢€¥^°={}\\"),
        listOf(Key("?123", KeyType.TO_SYMBOLS, 1.5f)) + chars("%©®™✓[]") + listOf(Key("⌫", KeyType.DELETE, 1.5f)),
        bottomRow("ABC", KeyType.TO_LETTERS),
    )

    fun page(p: Page): List<List<Key>> = when (p) {
        Page.LETTERS -> letters
        Page.SYMBOLS -> symbols
        Page.MORE_SYMBOLS -> moreSymbols
    }
}

/** A key's rectangle, in pixels, inside the keyboard view. */
data class KeyBox(val key: Key, val row: Int, val left: Float, val top: Float, val right: Float, val bottom: Float) {
    fun contains(x: Float, y: Float) = x >= left && x < right && y >= top && y < bottom
    val centerX get() = (left + right) / 2
    val centerY get() = (top + bottom) / 2
}

object Geometry {
    /**
     * Lays out [rows] inside a [width] x [height] area with [pad] outer padding.
     * Every key gets its row slot; spacers get a box too, so touches near the edges
     * of the second letter row still land on the nearest real key (see [hit]).
     */
    fun layout(rows: List<List<Key>>, width: Float, height: Float, pad: Float): List<KeyBox> {
        val rowH = (height - pad * 2) / rows.size
        val unit = (width - pad * 2) / Layouts.ROW_UNITS
        val out = ArrayList<KeyBox>()
        rows.forEachIndexed { r, row ->
            var x = pad
            val top = pad + r * rowH
            row.forEach { k ->
                val w = k.weight * unit
                out += KeyBox(k, r, x, top, x + w, top + rowH)
                x += w
            }
        }
        return out
    }

    /** The real key under (x, y), or the nearest real key in that row when (x, y) is on a spacer or edge. */
    fun hit(boxes: List<KeyBox>, x: Float, y: Float): KeyBox? {
        val direct = boxes.firstOrNull { it.contains(x, y) }
        if (direct != null && direct.key.type != KeyType.SPACER) return direct
        val rowBoxes = boxes.filter { y >= it.top && y < it.bottom && it.key.type != KeyType.SPACER }
        if (rowBoxes.isEmpty()) return null
        return rowBoxes.minBy { kotlin.math.abs(it.centerX - x) }
    }
}
