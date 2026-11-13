package app.lunar.keyboard.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import java.util.Random

/** Account ids from nearcore's own validity tests and the protocol spec. */
@RunWith(Parameterized::class)
class NearNameTableCasesTest(private val id: String, private val valid: Boolean) {
    @Test fun follows_the_protocol_rules() = assertEquals(valid, NearName.isValid(id))

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0} -> {1}")
        fun data(): List<Array<Any>> {
            val ok = listOf(
                "aa", "a-a", "a-aa", "100", "0o", "com", "near", "bowen", "b-o_w_e-n", "b.owen", "bro.wen", "a.ha", "a.b-a.ra",
                "system", "over.9000", "google.com", "illia.cheapaccounts.near", "0o0ooo00oo00o", "alex-skidanov", "10-4.8-2", "0o-oo00oo",
                "b-o_w_e-n", "no_lols", "0123456789012345678901234567890123456789012345678901234567890123", "near.a",
                "bob.testnet", "lunarpay-0111.testnet", "ref-finance-101.testnet", "usdc.itachicara.testnet",
                "0x" + "0123456789abcdef0123456789abcdef01234567", "f".repeat(64),
            )
            val bad = listOf(
                "", "a", "A", "Abc", "-near", "near-", "-near-", "near.", ".near", "near.-", "near._", "near_", "_near", "a..near",
                "a\$b", "near@", "@near", "100-", "bo__wen", "_illia", "a".repeat(65),
                "abcdefghijklmnopqrstuvwxyz.abcdefghijklmnopqrstuvwxyz.abcdefghijklmnopqrstuvwxyz", "üñîçø∂é", "$$$", "WAT",
                "me@google.com", "system@near", "a b", "bob.near\n", "!", "bob-_x.near", "BOB.near", "0x" + "A".repeat(40),
                "a".repeat(60) + ".near", "bob near", "bob.-near",
            )
            return ok.distinct().map { arrayOf<Any>(it, true) } + bad.distinct().map { arrayOf<Any>(it, false) }
        }
    }
}

class NearNameNetworkTest {
    @Test fun network_comes_from_the_suffix() {
        assertEquals(NearName.Network.TESTNET, NearName.network("bob.testnet"))
        assertEquals(NearName.Network.MAINNET, NearName.network("bob.near"))
        assertEquals(NearName.Network.MAINNET, NearName.network("a".repeat(64)))
        assertEquals(NearName.Network.MAINNET, NearName.network("testnet"))
    }
}

/**
 * A pay-sentence corpus built from parts, so the expected intent is known from the parts rather
 * than from the parser: payee, amount, token word, "$", memo, leading chat text, and both word orders.
 */
@RunWith(Parameterized::class)
class PayParserCorpusCasesTest(private val text: String, private val payee: String, private val amount: String, private val token: String, private val memo: String?, private val span: Int) {
    @Test fun reads_the_sentence() {
        val r = PayParser.parse(text)
        assertNotNull(text, r)
        r!!
        assertEquals(payee, r.payee)
        assertEquals(amount, r.amount.toPlainString())
        assertEquals(token, r.token)
        assertEquals(memo, r.memo)
        assertEquals(span, r.span)
        assertEquals(text.substring(text.length - span).trimStart(), text.substring(text.length - span))
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any?>> {
            val names = listOf("dan.near" to "dan.near", "@Eve.Testnet" to "eve.testnet", "shop_2.near" to "shop_2.near", "pay-me.testnet" to "pay-me.testnet",
                "a.b.c.near" to "a.b.c.near", "x9.testnet" to "x9.testnet", "0x" + "1f".repeat(20) to "0x" + "1f".repeat(20))
            val amounts = listOf("1" to "1", "2.5" to "2.5", "0.01" to "0.01", "40" to "40", "10.000" to "10", "8,25" to "8.25", "000123" to "123", "0.000009" to "0.000009")
            val tokens = listOf("" to null, " NEAR" to "NEAR", " usdt" to "USDT", " Dollars" to "USDC", "usd" to "USDC", " USDC" to "USDC")
            val memos = listOf(null, "lunch", "the \$12 tickets", "  movie night  ", "rent, march")
            val leads = listOf("", "cool ", "yes!\n", "got it, ")
            val out = ArrayList<Array<Any?>>()
            for (k in 0 until 150) {
                val (rawName, name) = names[k % names.size]
                val (rawAmt, amt) = amounts[(k * 3) % amounts.size]
                val (rawTok, tok) = tokens[(k * 5) % tokens.size]
                val memo = memos[(k * 7) % memos.size]
                val dollar = k % 4 == 1
                val verb = listOf("pay", "send", "Send", "PAY")[(k / 2) % 4]
                val a = (if (dollar) "$" else "") + rawAmt
                val m = memo?.let { " for $it" } ?: ""
                val sentence = if (k % 2 == 0) "$verb $rawName $a$rawTok$m" else "$verb $a$rawTok to $rawName$m"
                val token = tok ?: if (dollar) "USDC" else "NEAR"
                out += arrayOf<Any?>(leads[k % leads.size] + sentence, name, amt, token, memo?.trim(), sentence.length)
            }
            return out.distinctBy { it[0] }
        }
    }
}

@RunWith(Parameterized::class)
class PayParserRejectCasesTest(private val text: String) {
    @Test fun is_not_a_payment() = assertNull(PayParser.parse(text))

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> = listOf(
            "pay", "send", "pay dan.near", "send dan.near five", "pay dan.near 5 yen", "pay dan.near 5 eth", "pay dan..near 5",
            "pay dan.near- 5", "pay -dan.near 5", "pay dan.near 0", "send 0.0 to dan.near", "pay 5 to", "pay 5 to dan..near",
            "pay dan.near 5 please", "pay dan.near 5 for " + "y".repeat(61), "pay dan.near 12345678901", "pay dan.near 3.1234567",
            "prepay dan.near 5", "spay dan.near 5", "pay dan.near 5\nok", "pay dan.near five dollars", "pay to dan.near 5",
            "pay dan.near 5.", "pay dan.near ,5", "pay dan.near \$", "send \$ to dan.near", "pay dan.near 5 usdc near",
            "Pay DAN NEAR 5", "pay dan.near 1 000", "pay dan.near 5 for",
        ).map { arrayOf<Any>(it) }
    }
}

/**
 * Shift over every sequence of up to three events, against a transition table written from the
 * documented behaviour: one tap = one capital, a quick second tap locks (from any state), a tap
 * on a lock unlocks without arming a double tap, typing ends a one-shot capital, and
 * auto-capitalisation never overrides a lock or a choice made by hand since the last character.
 */
@RunWith(Parameterized::class)
class ShiftSequenceCasesTest(private val events: List<String>) {
    private data class S(val mode: ShiftState.Mode, val armedAt: Long?, val manual: Boolean)

    private fun reference(): S {
        var s = S(ShiftState.Mode.OFF, null, false)
        var now = 0L
        for (e in events) {
            if (e == "tap-quick") now += 100 else if (e == "tap-slow") now += 1000
            s = when (e) {
                "tap-quick", "tap-slow" -> {
                    val quick = s.armedAt != null && now - s.armedAt!! <= 350
                    when {
                        s.mode == ShiftState.Mode.LOCKED -> S(ShiftState.Mode.OFF, null, true)
                        quick -> S(ShiftState.Mode.LOCKED, null, true)
                        s.mode == ShiftState.Mode.ONCE -> S(ShiftState.Mode.OFF, now, true)
                        else -> S(ShiftState.Mode.ONCE, now, true)
                    }
                }
                "char" -> S(if (s.mode == ShiftState.Mode.ONCE) ShiftState.Mode.OFF else s.mode, null, false)
                "auto-cap" -> if (s.mode == ShiftState.Mode.LOCKED || s.manual) s else s.copy(mode = ShiftState.Mode.ONCE)
                else -> if (s.mode == ShiftState.Mode.LOCKED || s.manual) s else s.copy(mode = ShiftState.Mode.OFF)
            }
        }
        return s
    }

    @Test fun matches_the_documented_behaviour() {
        val shift = ShiftState()
        var now = 0L
        for (e in events) {
            when (e) {
                "tap-quick" -> { now += 100; shift.tap(now) }
                "tap-slow" -> { now += 1000; shift.tap(now) }
                "char" -> shift.afterChar()
                "auto-cap" -> shift.setAuto(true)
                "auto-lower" -> shift.setAuto(false)
            }
        }
        val want = reference()
        assertEquals(want.mode, shift.mode)
        assertEquals(want.mode != ShiftState.Mode.OFF, shift.isUpper)
        shift.reset()
        assertEquals(ShiftState.Mode.OFF, shift.mode)
    }

    companion object {
        private val EVENTS = listOf("tap-quick", "tap-slow", "char", "auto-cap", "auto-lower")

        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> {
            val out = ArrayList<List<String>>()
            var frontier = listOf(emptyList<String>())
            repeat(3) {
                frontier = frontier.flatMap { seq -> EVENTS.map { seq + it } }
                out += frontier
            }
            return out.map { arrayOf<Any>(it) }
        }
    }
}

/** Hand-checked shift stories that matter most to people. */
@RunWith(Parameterized::class)
class ShiftStoryCasesTest(private val story: String, private val script: String, private val want: ShiftState.Mode) {
    @Test fun ends_in_the_expected_mode() {
        val s = ShiftState()
        var now = 0L
        for (step in script.split(" ")) {
            when {
                step.startsWith("tap+") -> { now += step.removePrefix("tap+").toLong(); s.tap(now) }
                step == "char" -> s.afterChar()
                step == "auto" -> s.setAuto(true)
                step == "noauto" -> s.setAuto(false)
            }
        }
        assertEquals(story, want, s.mode)
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> = listOf(
            Triple("one tap gives a capital", "tap+1000", ShiftState.Mode.ONCE),
            Triple("the capital ends after a letter", "tap+1000 char", ShiftState.Mode.OFF),
            Triple("double tap locks", "tap+1000 tap+200", ShiftState.Mode.LOCKED),
            Triple("double tap at exactly the window locks", "tap+1000 tap+350", ShiftState.Mode.LOCKED),
            Triple("just past the window toggles off", "tap+1000 tap+351", ShiftState.Mode.OFF),
            Triple("a lock survives typing", "tap+1000 tap+100 char char char", ShiftState.Mode.LOCKED),
            Triple("a tap unlocks", "tap+1000 tap+100 tap+1000", ShiftState.Mode.OFF),
            Triple("the unlocking tap does not arm a double tap", "tap+1000 tap+100 tap+1000 tap+100", ShiftState.Mode.ONCE),
            Triple("double tap at sentence start locks", "auto tap+1000 tap+100", ShiftState.Mode.LOCKED),
            Triple("one tap at sentence start turns the capital off", "auto tap+1000", ShiftState.Mode.OFF),
            Triple("a late cursor update does not undo a hand choice", "auto tap+1000 auto", ShiftState.Mode.OFF),
            Triple("auto-cap applies again after a letter", "auto tap+1000 char auto", ShiftState.Mode.ONCE),
            Triple("auto-lower never drops a lock", "tap+1000 tap+100 noauto", ShiftState.Mode.LOCKED),
            Triple("auto-cap after a full stop", "char auto", ShiftState.Mode.ONCE),
            Triple("auto-lower mid-sentence", "auto char noauto", ShiftState.Mode.OFF),
            Triple("three quick taps: lock then unlock", "tap+1000 tap+100 tap+100", ShiftState.Mode.OFF),
            Triple("four quick taps: lock, unlock, capital", "tap+1000 tap+100 tap+100 tap+100", ShiftState.Mode.ONCE),
            Triple("typing between taps breaks the double tap", "tap+1000 char tap+100", ShiftState.Mode.ONCE),
        ).map { arrayOf<Any>(it.first, it.second, it.third) }
    }
}

/** Every key on every page, lower and upper case: what holding it offers. */
@RunWith(Parameterized::class)
class KeyHoldCasesTest(private val label: String, private val page: Page, private val key: Key, private val upper: Boolean) {
    @Test fun hold_options_fit_the_key() {
        val opts = Layouts.options(key, upper)
        val lower = Layouts.options(key, false)
        assertEquals(lower.size, opts.size)
        lower.zip(opts).forEach { (l, o) -> assertEquals(if (upper && l.length == 1) l.uppercase() else l, o) }
        if (key.type != KeyType.CHAR) {
            assertTrue("modifier keys offer nothing", opts.isEmpty())
            return
        }
        assertEquals("no duplicates", opts.size, opts.toSet().size)
        if (key.hint != null) assertEquals("the digit comes first", key.hint, opts.first())
        when {
            key.label == "$" -> assertEquals(Layouts.CURRENCIES, opts)
            page == Page.LETTERS && key.label.single().isLetter() ->
                assertTrue(opts.all { o -> o.all { it.isLetterOrDigit() } })
            key.popup.isNotEmpty() -> assertEquals("a symbol's own character comes first", key.label, lower.first())
        }
        if (key.label in listOf("q", "w", "r", "t", "p")) assertEquals(1, opts.size)
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> = Page.values().flatMap { p ->
            Layouts.page(p).flatten().filter { it.type != KeyType.SPACER }.flatMap { k ->
                listOf(false, true).map { up -> arrayOf<Any>("$p '${k.label}' ${if (up) "upper" else "lower"}", p, k, up) }
            }
        }
    }
}

/** Every key's box: rows fill the width, and a touch anywhere inside a key (or on the spacers beside it) lands on it. */
@RunWith(Parameterized::class)
class KeyGeometryCasesTest(private val label: String, private val page: Page, private val index: Int) {
    @Test fun touches_land_on_the_key() {
        val boxes = Geometry.layout(Layouts.page(page), 1080f, 640f, 6f)
        val b = boxes[index]
        val rowRight = boxes.filter { it.row == b.row }.maxOf { it.right }
        assertEquals(1074f, rowRight, 0.01f)
        assertEquals(b.key.weight * 106.8f, b.right - b.left, 0.01f)
        assertEquals(157f, b.bottom - b.top, 0.01f)
        if (b.key.type == KeyType.SPACER) {
            val hit = Geometry.hit(boxes, b.centerX, b.centerY)
            assertNotNull(hit)
            assertFalse(hit!!.key.type == KeyType.SPACER)
            assertEquals(b.row, hit.row)
        } else {
            assertEquals(b, Geometry.hit(boxes, b.centerX, b.centerY))
            assertEquals(b, Geometry.hit(boxes, b.left + 0.5f, b.top + 0.5f))
            assertEquals(b, Geometry.hit(boxes, b.right - 0.5f, b.bottom - 0.5f))
        }
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> = Page.values().flatMap { p ->
            Geometry.layout(Layouts.page(p), 1080f, 640f, 6f).mapIndexed { i, b -> arrayOf<Any>("$p #$i '${b.key.label}' ${b.key.type}", p, i) }
        }
    }
}

@RunWith(Parameterized::class)
class RowHeightCasesTest(private val w: Int, private val h: Int, private val want: Float) {
    @Test fun row_height_follows_the_screen() = assertEquals(want, Geometry.rowHeightDp(w, h), 0.01f)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}x{1}dp")
        fun data(): List<Array<Any>> = listOf(
            Triple(360, 640, 46f), Triple(360, 740, 46.62f), Triple(393, 852, 53.676f), Triple(412, 915, 57.645f), Triple(412, 1000, 58f),
            Triple(320, 480, 46f), Triple(800, 1280, 58f), Triple(640, 360, 37.8f), Triple(740, 360, 37.8f), Triple(852, 393, 41.265f),
            Triple(915, 412, 43.26f), Triple(1280, 800, 46f), Triple(480, 320, 36f), Triple(600, 600, 46f),
        ).map { arrayOf<Any>(it.first, it.second, it.third) }
    }
}

@RunWith(Parameterized::class)
class OptionPickCasesTest(private val x: Float, private val want: Int) {
    @Test fun picks_the_cell_under_the_finger() = assertEquals(want, Geometry.optionAt(x, floatArrayOf(100f, 150f, 200f, 250f, 300f)))

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "x={0}")
        fun data(): List<Array<Any>> = listOf(
            -50f to 0, 0f to 0, 100f to 0, 149.9f to 0, 150f to 1, 199f to 1, 200f to 2, 249.99f to 2, 250f to 3, 299f to 3, 300f to 3, 1000f to 3,
        ).map { arrayOf<Any>(it.first, it.second) }
    }
}

/**
 * The in-keyboard pay form, driven key by key. Script steps are separated by "|":
 * "<" delete, ">" next field, "~" next token, "␣" the space bar; anything else is typed.
 */
@RunWith(Parameterized::class)
class PayFormScriptCasesTest(
    private val script: String,
    private val to: String,
    private val amount: String,
    private val token: String,
    private val memo: String,
    private val active: PayForm.Field,
) {
    @Test fun ends_in_the_expected_state() {
        val f = PayForm()
        script.split("|").filter { it.isNotEmpty() }.forEach { s ->
            when (s) {
                "<" -> f.delete()
                ">" -> f.next()
                "~" -> f.cycleToken()
                "␣" -> f.type(" ")
                else -> f.type(s)
            }
        }
        assertEquals(to, f.to)
        assertEquals(amount, f.amount)
        assertEquals(token, f.token)
        assertEquals(memo, f.memo)
        assertEquals(active, f.active)
    }

    companion object {
        private val T = PayForm.Field.TO
        private val A = PayForm.Field.AMOUNT
        private val M = PayForm.Field.MEMO

        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> = listOf(
            arrayOf<Any>("b|o|b|.|n|e|a|r", "bob.near", "", "NEAR", "", T),
            arrayOf<Any>("B|O|B", "bob", "", "NEAR", "", T),
            arrayOf<Any>("@|b|o|b", "bob", "", "NEAR", "", T),
            arrayOf<Any>("b|@|x", "bx", "", "NEAR", "", T),
            arrayOf<Any>("a|-|b|_|c", "a-b_c", "", "NEAR", "", T),
            arrayOf<Any>("b|é|!|?|x", "bx", "", "NEAR", "", T),
            arrayOf<Any>("b|o|b|␣", "bob", "", "NEAR", "", A),
            arrayOf<Any>("b|>|1|2", "b", "12", "NEAR", "", A),
            arrayOf<Any>(">|0|5", "", "5", "NEAR", "", A),
            arrayOf<Any>(">|0|0", "", "0", "NEAR", "", A),
            arrayOf<Any>(">|.|5", "", "0.5", "NEAR", "", A),
            arrayOf<Any>(">|,|5", "", "0.5", "NEAR", "", A),
            arrayOf<Any>(">|1|.|.|5", "", "1.5", "NEAR", "", A),
            arrayOf<Any>(">|1|.|5|,|2", "", "1.52", "NEAR", "", A),
            arrayOf<Any>(">|.|.", "", "0.", "NEAR", "", A),
            arrayOf<Any>(">|u|s|d", "", "", "NEAR", "", A),
            arrayOf<Any>(">|USDT", "", "", "USDT", "", A),
            arrayOf<Any>(">|usdc", "", "", "USDC", "", A),
            arrayOf<Any>(">|$", "", "", "USDC", "", A),
            arrayOf<Any>(">|~|NEAR", "", "", "NEAR", "", A),
            arrayOf<Any>(">|1|<", "", "", "NEAR", "", A),
            arrayOf<Any>(">|<", "", "", "NEAR", "", T),
            arrayOf<Any>("b|o|b|<|<|<|<", "", "", "NEAR", "", T),
            arrayOf<Any>(">|>|h|i", "", "", "NEAR", "hi", M),
            arrayOf<Any>(">|>|h|i|␣|y|o", "", "", "NEAR", "hi yo", M),
            arrayOf<Any>(">|>|H|i|!", "", "", "NEAR", "Hi!", M),
            arrayOf<Any>(">|>|<", "", "", "NEAR", "", A),
            arrayOf<Any>(">|>|<|<", "", "", "NEAR", "", T),
            arrayOf<Any>(">|>|>", "", "", "NEAR", "", M),
            arrayOf<Any>("~", "", "", "USDC", "", T),
            arrayOf<Any>("~|~", "", "", "USDT", "", T),
            arrayOf<Any>("~|~|~", "", "", "NEAR", "", T),
            arrayOf<Any>(">|" + "1|2|3|4|5|6|7|8|9|0|".repeat(2), "", "123456789012345678", "NEAR", "", A),
            arrayOf<Any>(">|>|" + "x|".repeat(70), "", "", "NEAR", "x".repeat(60), M),
            arrayOf<Any>("a|".repeat(70), "a".repeat(64), "", "NEAR", "", T),
            arrayOf<Any>("c|a|r|o|l|.|t|e|s|t|n|e|t|␣|2|5|USDC|␣|t|a|x|i", "carol.testnet", "25", "USDC", "taxi", M),
            arrayOf<Any>("d|a|n|␣|␣|␣", "dan", "", "NEAR", " ", M),
            arrayOf<Any>(">|3|>|<|<|9", "", "9", "NEAR", "", A),
        ).map { it }
    }
}

@RunWith(Parameterized::class)
class PayFormCheckCasesTest(private val to: String, private val amount: String, private val memo: String, private val want: String) {
    @Test fun checks_before_review() {
        val f = PayForm()
        if (to.isNotEmpty()) f.choosePayee(to) else f.next()
        amount.forEach { f.type(it.toString()) }
        f.next()
        memo.forEach { f.type(it.toString()) }
        val got = when (val c = f.check()) {
            is PayForm.Check.Ok -> "ok ${c.intent.payee} ${c.intent.amount.toPlainString()} ${c.intent.token} ${c.intent.memo}"
            is PayForm.Check.Problem -> "problem ${c.field}"
        }
        assertEquals(want, got)
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0} {1} -> {3}")
        fun data(): List<Array<Any>> = listOf(
            arrayOf<Any>("", "5", "", "problem TO"),
            arrayOf<Any>("bob", "5", "", "problem TO"),
            arrayOf<Any>("near", "5", "", "problem TO"),
            arrayOf<Any>("bob..near", "5", "", "problem TO"),
            arrayOf<Any>("bob.near", "", "", "problem AMOUNT"),
            arrayOf<Any>("bob.near", "0", "", "problem AMOUNT"),
            arrayOf<Any>("bob.near", ".", "", "problem AMOUNT"),
            arrayOf<Any>("bob.near", "0.000", "", "problem AMOUNT"),
            arrayOf<Any>("bob.near", "5", "", "ok bob.near 5 NEAR null"),
            arrayOf<Any>("bob.near", "1.50", "", "ok bob.near 1.5 NEAR null"),
            arrayOf<Any>("bob.near", "100", "", "ok bob.near 100 NEAR null"),
            arrayOf<Any>("bob.near", ".5", "", "ok bob.near 0.5 NEAR null"),
            arrayOf<Any>("alice.testnet", "2", "  rent  ", "ok alice.testnet 2 NEAR rent"),
            arrayOf<Any>("alice.testnet", "2", "   ", "ok alice.testnet 2 NEAR null"),
            arrayOf<Any>("a".repeat(64), "1", "", "ok ${"a".repeat(64)} 1 NEAR null"),
            arrayOf<Any>("0x" + "b".repeat(40), "1", "", "ok 0x${"b".repeat(40)} 1 NEAR null"),
            arrayOf<Any>("a".repeat(63), "1", "", "problem TO"),
        )
    }
}

/** Address-poisoning checks over many generated payees and lookalikes. */
@RunWith(Parameterized::class)
class PasteLookalikeCasesTest(private val label: String, private val clip: String, private val payees: List<Payee>, private val want: String) {
    @Test fun gives_the_right_verdict() {
        val got = when (val v = PasteCheck.check(clip, payees)) {
            PasteVerdict.NotAnAddress -> "none"
            is PasteVerdict.New -> "new"
            is PasteVerdict.Known -> "known ${v.payee.name}"
            is PasteVerdict.Lookalike -> "lookalike ${v.payee.name}"
        }
        assertEquals(want, got)
    }

    companion object {
        private const val HEX = "0123456789abcdef"

        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> {
            val rnd = Random(4)
            fun hex(n: Int) = (1..n).map { HEX[rnd.nextInt(16)] }.joinToString("")
            fun other(c: Char) = HEX[(HEX.indexOf(c) + 1 + rnd.nextInt(15)) % 16]
            val out = ArrayList<Array<Any>>()
            for (i in 0 until 40) {
                val addr = "0x" + hex(40)
                val payees = listOf(Payee("friend$i.near", addr), Payee("shop$i.near", "0x" + hex(40)))
                val mid = 6 + rnd.nextInt(30)
                val look = addr.substring(0, mid) + other(addr[mid]) + addr.substring(mid + 1)
                val p = 2 + rnd.nextInt(4)
                val newPrefix = addr.substring(0, p) + other(addr[p]) + addr.substring(p + 1)
                val s = addr.length - 1 - rnd.nextInt(4)
                val newSuffix = addr.substring(0, s) + other(addr[s]) + addr.substring(s + 1)
                out += arrayOf<Any>("$i exact", addr, payees, "known friend$i.near")
                out += arrayOf<Any>("$i exact upper", "0x" + addr.drop(2).uppercase(), payees, "known friend$i.near")
                out += arrayOf<Any>("$i lookalike", look, payees, "lookalike friend$i.near")
                out += arrayOf<Any>("$i lookalike in a sentence", "send it to $look thanks", payees, "lookalike friend$i.near")
                out += arrayOf<Any>("$i differs in the first four", newPrefix, payees, "new")
                out += arrayOf<Any>("$i differs in the last four", newSuffix, payees, "new")
            }
            out += arrayOf<Any>("empty", "", emptyList<Payee>(), "none")
            out += arrayOf<Any>("words", "see you at 5", emptyList<Payee>(), "none")
            out += arrayOf<Any>("too short", "0x" + "a".repeat(39), emptyList<Payee>(), "none")
            out += arrayOf<Any>("two addresses", "0x" + "a".repeat(40) + " or 0x" + "b".repeat(40), emptyList<Payee>(), "none")
            out += arrayOf<Any>("long chat", "0x" + "a".repeat(40) + " " + "x".repeat(100), emptyList<Payee>(), "none")
            out += arrayOf<Any>("no payees yet", "0x" + "c".repeat(40), emptyList<Payee>(), "new")
            return out
        }
    }
}

class PasteShortTest {
    @Test fun shortens_like_wallets() {
        assertEquals("0x9f3a…b21c", PasteCheck.short("0x9f3a" + "0".repeat(30) + "b21c"))
        assertEquals("bob.near", PasteCheck.short("bob.near"))
    }

    @Test fun lookalike_rule_needs_same_length() {
        assertFalse(PasteCheck.looksLike("0xabcd1234", "0xabcd01234"))
        assertTrue(PasteCheck.looksLike("0xabcd00001234", "0xabcd99991234"))
    }
}
