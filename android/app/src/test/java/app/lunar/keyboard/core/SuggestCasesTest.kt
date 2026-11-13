package app.lunar.keyboard.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import java.io.File
import java.util.Random

/**
 * A brute-force reference for the suggestion bar, written from the documented rules (frequency
 * order, the typed word first when it is a word, apostrophes put back, one edit when nothing starts
 * with what was typed). It scans the whole list linearly, so it shares no code with [Suggest]'s
 * sorted-array search or its edit generator.
 */
internal object WordOracle {
    val list: List<String> = File("src/main/assets/words_en.txt").readLines().filter { it.isNotBlank() }
    val rank: Map<String, Int> = LinkedHashMap<String, Int>().also { m -> list.forEachIndexed { i, w -> m.putIfAbsent(w, i) } }
    val byRank: List<String> = rank.keys.toList() // insertion order = frequency order
    val apostrophes: Map<String, String> = byRank.filter { '\'' in it }.associateBy { it.replace("'", "") }
    val suggest by lazy { Suggest(list) }

    fun startingWith(p: String) = byRank.filter { it.startsWith(p) }

    private fun cap(w: String) = if (w == "i" || w.startsWith("i'")) "I" + w.drop(1) else w

    /** What the bar should show for a lowercase [typed] that is a prefix of some word. */
    fun expected(typed: String): List<String> {
        apostrophes[typed]?.let { fixed -> return (listOf(fixed) + startingWith(typed)).distinct().take(3).map(::cap) }
        val starts = startingWith(typed)
        val out = if (typed in rank) listOf(typed) + starts.filter { it != typed }.take(2) else starts.take(3)
        return out.map(::cap)
    }

    /** True when [a] and [b] are one insertion, deletion, substitution or adjacent swap apart. */
    fun oneEdit(a: String, b: String): Boolean {
        if (a == b) return false
        if (a.length == b.length) {
            val diff = a.indices.filter { a[it] != b[it] }
            return diff.size == 1 || diff.size == 2 && diff[1] == diff[0] + 1 && a[diff[0]] == b[diff[1]] && a[diff[1]] == b[diff[0]]
        }
        val (s, l) = if (a.length < b.length) a to b else b to a
        if (l.length - s.length != 1) return false
        var i = 0
        while (i < s.length && s[i] == l[i]) i++
        return s.substring(i) == l.substring(i + 1)
    }

    /** Dictionary words (letters only: the bar only ever inserts letters) one edit from [typo], commonest first. */
    fun corrections(typo: String) = byRank.filter { w -> w.all { it in 'a'..'z' } && oneEdit(typo, w) }
}

@RunWith(Parameterized::class)
class SuggestPrefixCasesTest(private val typed: String, private val from: String) {
    @Test fun completes_by_frequency() {
        val got = WordOracle.suggest.words(typed)
        assertEquals("prefix of '$from'", WordOracle.expected(typed), got)
        assertTrue(got.isNotEmpty())
        got.filter { it.lowercase().replace("'", "") != typed }.forEach { assertTrue("$it starts with $typed", it.lowercase().startsWith(typed)) }
    }

    companion object {
        /** One prefix per common word (the word minus its last letter), 400 distinct prefixes. */
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> {
            val seen = LinkedHashMap<String, String>()
            for (w in WordOracle.byRank) {
                if (seen.size >= 400) break
                val p = if (w.length <= 2) w else w.dropLast(1)
                if ('\'' !in p) seen.putIfAbsent(p, w)
            }
            return seen.map { (p, w) -> arrayOf<Any>(p, w) }
        }
    }
}

@RunWith(Parameterized::class)
class SuggestExactWordCasesTest(private val word: String, private val rank: Int) {
    @Test fun a_typed_word_is_offered_first_and_never_replaced() {
        val got = WordOracle.suggest.words(word)
        val first = WordOracle.apostrophes[word] ?: word
        val shown = if (first == "i" || first.startsWith("i'")) "I" + first.drop(1) else first
        assertEquals(shown, got.first())
        assertTrue("$word stays offered", got.map { it.lowercase() }.contains(word))
        assertTrue(WordOracle.suggest.isWord(word))
        assertTrue(WordOracle.suggest.isWord(word.uppercase()))
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "#{1} {0}")
        fun data(): List<Array<Any>> = WordOracle.byRank.take(300).mapIndexed { i, w -> arrayOf<Any>(w, i) }
    }
}

@RunWith(Parameterized::class)
class SuggestCaseCasesTest(private val typed: String) {
    @Test fun keeps_the_case_it_was_typed_in() {
        val lower = WordOracle.suggest.words(typed.lowercase())
        val got = WordOracle.suggest.words(typed)
        assertEquals(lower.size, got.size)
        val allCaps = typed.length > 1 && typed.all { !it.isLetter() || it.isUpperCase() }
        lower.zip(got).forEach { (l, g) ->
            val want = when {
                l == "I" || l.startsWith("I'") -> l
                allCaps -> l.uppercase()
                else -> l.replaceFirstChar { it.uppercase() }
            }
            assertEquals(want, g)
        }
    }

    companion object {
        /** Capitalised and all-caps forms of 120 common prefixes. */
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> {
            val prefixes = WordOracle.byRank.filter { it.length >= 4 && it.all { c -> c in 'a'..'z' } }.map { it.take(3) }.distinct().take(60)
            return prefixes.flatMap { p -> listOf(arrayOf<Any>(p.replaceFirstChar { it.uppercase() }), arrayOf<Any>(p.uppercase())) }
        }
    }
}

@RunWith(Parameterized::class)
class SuggestTypoCasesTest(private val typo: String, private val meant: String, private val edit: String) {
    @Test fun offers_the_closest_common_words() {
        val got = WordOracle.suggest.words(typo)
        val want = WordOracle.corrections(typo).take(3)
        assertEquals("$edit of '$meant'", want, got)
        assertTrue(WordOracle.corrections(typo).contains(meant))
    }

    companion object {
        /** 200 one-slip typos of common words that no word starts with, so only the corrector can answer. */
        @JvmStatic @Parameterized.Parameters(name = "{0} ({2} of {1})")
        fun data(): List<Array<Any>> {
            val rnd = Random(7)
            val out = ArrayList<Array<Any>>()
            val used = HashSet<String>()
            val kinds = listOf("deletion", "swap", "substitution", "insertion")
            for (w in WordOracle.byRank.drop(50)) {
                if (out.size >= 200) break
                if (w.length < 5 || !w.all { it in 'a'..'z' }) continue
                val kind = kinds[out.size % kinds.size]
                val j = 1 + rnd.nextInt(w.length - 2)
                val c = ('a' + rnd.nextInt(26))
                val typo = when (kind) {
                    "deletion" -> w.removeRange(j, j + 1)
                    "swap" -> w.substring(0, j) + w[j + 1] + w[j] + w.substring(j + 2)
                    "substitution" -> w.substring(0, j) + c + w.substring(j + 1)
                    else -> w.substring(0, j) + c + w.substring(j)
                }
                if (typo == w || typo in WordOracle.rank || typo in WordOracle.apostrophes || !used.add(typo)) continue
                if (WordOracle.byRank.any { it.startsWith(typo) }) continue
                out += arrayOf<Any>(typo, w, kind)
            }
            return out
        }
    }
}
