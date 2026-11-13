package app.lunar.keyboard.core

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Word suggestions from a frequency-ordered list (most common first). Prefix matches rank by
 * frequency; when nothing starts with what was typed, close misspellings (one edit away) are
 * offered instead. No network, no learning, nothing leaves the phone.
 */
class Suggest(wordsByFrequency: List<String>) {
    private val rank = HashMap<String, Int>(wordsByFrequency.size * 2)
    private val sorted: Array<String>
    /** "dont" → "don't": people skip the apostrophe; the bar puts it back. */
    private val apostrophes = HashMap<String, String>()

    init {
        wordsByFrequency.forEachIndexed { i, w -> rank.putIfAbsent(w, i) }
        sorted = rank.keys.toTypedArray().also { it.sort() }
        rank.keys.filter { '\'' in it }.forEach { apostrophes[it.replace("'", "")] = it }
    }

    /** Up to [n] words for the word being typed, in the case it was typed in. */
    fun words(typed: String, n: Int = 3): List<String> {
        if (typed.isEmpty() || typed.length > 24) return emptyList()
        val key = typed.lowercase()
        apostrophes[key]?.let { fixed -> return (listOf(matchCase(fixed, typed)) + byPrefix(key).sortedBy { rank[it] }.map { matchCase(it, typed) }).distinct().take(n) }
        val prefix = byPrefix(key)
        val picks = if (prefix.isNotEmpty()) prefix else oneEditAway(key)
        val out = picks.sortedBy { rank[it] }
            .filter { it != key || rank.containsKey(it) }
            .distinct()
            .take(n)
            .map { matchCase(it, typed) }
        // a typed word that is already a word stays first, so a tap never "corrects" it
        return if (rank.containsKey(key)) (listOf(matchCase(key, typed)) + out.filter { it.lowercase() != key }).take(n) else out
    }

    fun isWord(w: String) = rank.containsKey(w.lowercase())

    private fun byPrefix(p: String): List<String> {
        var lo = 0; var hi = sorted.size
        while (lo < hi) { val m = (lo + hi) ushr 1; if (sorted[m] < p) lo = m + 1 else hi = m }
        val out = ArrayList<String>()
        var i = lo
        while (i < sorted.size && sorted[i].startsWith(p)) { out += sorted[i]; i++ }
        return out
    }

    private fun oneEditAway(w: String): List<String> {
        if (w.length < 3) return emptyList()
        val letters = "abcdefghijklmnopqrstuvwxyz"
        val out = HashSet<String>()
        for (i in 0..w.length) {
            if (i < w.length) out += w.removeRange(i, i + 1)                                        // extra letter
            if (i < w.length - 1) out += w.substring(0, i) + w[i + 1] + w[i] + w.substring(i + 2)    // swapped pair
            for (c in letters) {
                if (i < w.length) out += w.substring(0, i) + c + w.substring(i + 1)                  // wrong letter
                out += w.substring(0, i) + c + w.substring(i)                                        // missing letter
            }
        }
        return out.filter { rank.containsKey(it) }
    }

    private fun matchCase(word: String, typed: String): String = when {
        word == "i" || word.startsWith("i'") -> "I" + word.drop(1)
        typed.length > 1 && typed.all { !it.isLetter() || it.isUpperCase() } -> word.uppercase()
        typed.firstOrNull()?.isUpperCase() == true -> word.replaceFirstChar { it.uppercase() }
        else -> word
    }

    companion object {
        /** The word right before the cursor, or "" after a space or punctuation. */
        fun currentWord(before: CharSequence?): String {
            val t = before?.toString() ?: return ""
            var i = t.length
            while (i > 0 && (t[i - 1].isLetter() || t[i - 1] == '\'')) i--
            return t.substring(i)
        }
    }
}

/**
 * Chips that read the sentence being typed and offer the one Lunar action that fits it:
 * pay a name that was typed, pay when the chat talks about money, convert a dollar amount at
 * the live price, swap, or drop the current price into the chat.
 */
object SmartChips {
    sealed class Chip {
        abstract val label: String
        data class PayName(val name: String, val amount: BigDecimal?) : Chip() {
            override val label get() = "Pay $name" + (amount?.let { " ${it.toPlainString()}" } ?: "")
        }
        data class PayIntent(val amount: BigDecimal?) : Chip() {
            override val label get() = if (amount != null) "Pay ${amount.toPlainString()} NEAR" else "Pay"
        }
        /** A dollar amount in the chat, shown in NEAR at the live price; tapping starts a payment of that much. */
        data class Convert(val usd: BigDecimal, val near: BigDecimal) : Chip() {
            override val label get() = "\$${usd.toPlainString()} ≈ ${near.toPlainString()} NEAR"
        }
        data class Swap(val amount: BigDecimal?, val to: String) : Chip() {
            override val label get() = "Swap" + (amount?.let { " ${it.toPlainString()} NEAR" } ?: "") + " to $to"
        }
        data class Price(val symbol: String, val usd: BigDecimal) : Chip() {
            override val label get() = "$symbol \$${usd.toPlainString()}"
        }
    }

    private val NAME = Regex("""(?<![\w.-])@?((?:[a-z\d]+[-_])*[a-z\d]+(?:\.(?:[a-z\d]+[-_])*[a-z\d]+)*\.(?:near|testnet))\b""")
    private val MONEY_WORDS = Regex("""\b(pay|paid|send|sent|owe|owes|owed|transfer|split|venmo|reimburse|refund|tip|chip in|pay back|pay you back)\b""")
    private val SWAP_WORDS = Regex("""\b(swap|convert|exchange|trade)\b""")
    private val PRICE_ASK = Regex("""\b(near|usdc|eth|btc|bitcoin|sol)\b.{0,12}\b(price|worth|trading at|at now)\b|\b(price|worth) of (near|usdc|eth|btc|bitcoin|sol)\b""")
    private val USD = Regex("""\$\s?(\d+(?:\.\d{1,2})?)|\b(\d+(?:\.\d{1,2})?)\s?(?:usd|dollars|bucks)\b""")
    private val NEAR_AMOUNT = Regex("""\b(\d+(?:\.\d+)?)\s?(?:n|near)\b""")
    private val NUMBER = Regex("""(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])""")

    /** [nearUsd] is the live NEAR price (null when unknown). At most [max] chips, the most specific first. */
    fun read(sentence: String, nearUsd: BigDecimal?, prices: Map<String, BigDecimal> = emptyMap(), max: Int = 2): List<Chip> {
        val s = sentence.lowercase()
        if (s.isBlank()) return emptyList()
        val out = ArrayList<Chip>()
        val nearAmount = NEAR_AMOUNT.find(s)?.groupValues?.get(1)?.toBigDecimalOrNull()

        NAME.findAll(s).map { it.groupValues[1] }.lastOrNull()?.let { name ->
            out += Chip.PayName(name, nearAmount ?: NUMBER.findAll(s.replace(name, " ")).lastOrNull()?.groupValues?.get(1)?.toBigDecimalOrNull())
        }
        if (SWAP_WORDS.containsMatchIn(s)) {
            val to = if ("usdt" in s || "tether" in s) "USDT" else "USDC"
            out += Chip.Swap(nearAmount ?: NUMBER.find(s)?.groupValues?.get(1)?.toBigDecimalOrNull(), to)
        }
        val usd = USD.find(s)?.let { m -> (m.groupValues[1].ifEmpty { m.groupValues[2] }).toBigDecimalOrNull() }
        if (usd != null && nearUsd != null && nearUsd.signum() > 0 && usd.signum() > 0) {
            out += Chip.Convert(usd.stripTrailingZeros(), usd.divide(nearUsd, 2, RoundingMode.HALF_UP).stripTrailingZeros())
        }
        if (out.none { it is Chip.PayName } && MONEY_WORDS.containsMatchIn(s)) out += Chip.PayIntent(nearAmount)
        PRICE_ASK.find(s)?.let { m ->
            val sym = (m.groupValues[1].ifEmpty { m.groupValues[4] }).let { if (it == "bitcoin") "btc" else it }.uppercase()
            prices[sym]?.let { out += Chip.Price(sym, it) }
        }
        return out.distinctBy { it.label }.take(max)
    }
}
