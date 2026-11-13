package app.lunar.keyboard.core

/** What a key does when it is released. */
enum class KeyType { CHAR, SHIFT, DELETE, SPACE, ENTER, TO_SYMBOLS, TO_LETTERS, TO_MORE_SYMBOLS, PAY, SPACER }

/**
 * One key. [weight] is its width in key units; every row in a layout sums to [Layouts.ROW_UNITS].
 * [hint] is drawn in the corner (the digit on the top letter row). [popup] is what holding the
 * key offers: the first entry is selected when the panel opens.
 */
data class Key(
    val label: String,
    val type: KeyType = KeyType.CHAR,
    val weight: Float = 1f,
    val hint: String? = null,
    val popup: List<String> = emptyList(),
) {
    val text: String get() = label
}

enum class Page { LETTERS, SYMBOLS, MORE_SYMBOLS }

object Layouts {
    const val ROW_UNITS = 10f

    /** Letters with accents, digits on the top row (a long press gives the digit first). */
    private val accents = mapOf(
        'q' to "1", 'w' to "2", 'e' to "3èéêëē", 'r' to "4", 't' to "5", 'y' to "6ýÿ", 'u' to "7ùúûüū",
        'i' to "8ìíîïī", 'o' to "9òóôöõøœ", 'p' to "0", 'a' to "àáâäãåæā", 's' to "ßśš", 'c' to "çćč",
        'n' to "ñń", 'z' to "žźż", 'l' to "ł",
    )

    /** Holding $ picks a currency: the symbols, then the tokens Lunar understands in a sentence. */
    val CURRENCIES = listOf("$", "€", "£", "¥", "₹", "NEAR", "USDC", "USDT")

    private fun letters(s: String, digits: String? = null): List<Key> = s.mapIndexed { i, c ->
        Key(c.toString(), hint = digits?.getOrNull(i)?.toString(), popup = accents[c]?.map { it.toString() } ?: emptyList())
    }

    private fun chars(s: String): List<Key> = s.map { c ->
        when (c) {
            '$' -> Key("$", popup = CURRENCIES)
            '-' -> Key("-", popup = listOf("-", "–", "—", "_"))
            '"' -> Key("\"", popup = listOf("\"", "“", "”", "«", "»"))
            '\'' -> Key("'", popup = listOf("'", "‘", "’"))
            '?' -> Key("?", popup = listOf("?", "¿"))
            '!' -> Key("!", popup = listOf("!", "¡"))
            else -> Key(c.toString())
        }
    }

    private fun bottomRow(switchLabel: String, switchType: KeyType) = listOf(
        Key(switchLabel, switchType, 1.3f),
        Key("Pay", KeyType.PAY, 1.8f),
        Key(",", popup = listOf(",", ";", ":")),
        Key(" ", KeyType.SPACE, 3.5f),
        Key(".", popup = listOf(".", "?", "!", "'", "\"", "-", "…", "@")),
        Key("⏎", KeyType.ENTER, 1.4f),
    )

    val letters: List<List<Key>> = listOf(
        letters("qwertyuiop", "1234567890"),
        listOf(Key("", KeyType.SPACER, 0.5f)) + letters("asdfghjkl") + listOf(Key("", KeyType.SPACER, 0.5f)),
        listOf(Key("⇧", KeyType.SHIFT, 1.5f)) + letters("zxcvbnm") + listOf(Key("⌫", KeyType.DELETE, 1.5f)),
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

    /** What holding [key] offers, in the case the keyboard is in now. */
    fun options(key: Key, upper: Boolean): List<String> {
        val base = key.popup.ifEmpty { listOfNotNull(key.hint) }
        return if (upper) base.map { if (it.length == 1) it.uppercase() else it } else base
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

    /**
     * Row height in dp for a screen of [heightDp] x [widthDp]: about 6% of a portrait screen
     * (so tall and short phones both get a comfortable board), flatter in landscape.
     */
    fun rowHeightDp(widthDp: Int, heightDp: Int): Float {
        val landscape = widthDp > heightDp
        return if (landscape) (heightDp * 0.105f).coerceIn(36f, 46f) else (heightDp * 0.063f).coerceIn(46f, 58f)
    }

    /** Which option a finger at [x] picks in a popup whose cells span [edges] (n options, n + 1 edges), clamped to the ends. */
    fun optionAt(x: Float, edges: FloatArray): Int {
        val n = edges.size - 1
        for (i in 0 until n) if (x < edges[i + 1]) return i
        return n - 1
    }
}
