package app.lunar.keyboard.shared

import app.lunar.keyboard.core.NearName
import app.lunar.keyboard.core.PayParser
import app.lunar.keyboard.core.Suggest
import app.lunar.keyboard.near.NearClient
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import java.io.File
import java.math.BigInteger

/**
 * The cases shared with the web keyboard (lunar/shared-fixtures/cases.json, rules in its README).
 * Every case is its own test, so a disagreement names the exact input.
 */
internal object Shared {
    val root: JSONObject by lazy {
        val f = File("../../shared-fixtures/cases.json")
        check(f.isFile) { "shared fixture missing at ${f.absolutePath}" }
        JSONObject(f.readText()).also { check(it.getInt("version") == 1) { "unknown fixture version" } }
    }
    val suggest by lazy { Suggest(File("src/main/assets/words_en.txt").readLines().filter { it.isNotBlank() }) }

    fun strings(path: String): List<String> {
        val (a, b) = path.split(".")
        val arr = root.getJSONObject(a).getJSONArray(b)
        return (0 until arr.length()).map { arr.getString(it) }
    }

    fun objects(path: String): List<JSONObject> {
        val parts = path.split(".")
        val arr = if (parts.size == 1) root.getJSONArray(parts[0]) else root.getJSONObject(parts[0]).getJSONArray(parts[1])
        return (0 until arr.length()).map { arr.getJSONObject(it) }
    }

    fun show(s: String) = s.replace("\n", "\\n").replace("\t", "\\t").let { if (it.length > 60) it.take(57) + "..." else it }
}

@RunWith(Parameterized::class)
class SharedNameCasesTest(private val label: String, private val name: String, private val valid: Boolean) {
    @Test fun agrees_with_the_spec() {
        assertEquals("'$name'", valid, NearName.isValid(name))
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> =
            Shared.strings("names.valid").mapIndexed { i, n -> arrayOf<Any>("valid $i ${Shared.show(n)}", n, true) } +
                Shared.strings("names.invalid").mapIndexed { i, n -> arrayOf<Any>("invalid $i ${Shared.show(n)}", n, false) }
    }
}

@RunWith(Parameterized::class)
class SharedAmountCasesTest(private val label: String, private val near: String, private val yocto: String?, private val plain: String?) {
    @Test fun agrees_with_the_spec() {
        val parsed = NearClient.parseNear(near)
        if (yocto == null) {
            assertNull("'$near' must be rejected", parsed)
            return
        }
        assertNotNull("'$near' must be accepted", parsed)
        assertEquals(BigInteger(yocto), NearClient.toYocto(parsed!!))
        assertEquals(plain, NearClient.toNear(BigInteger(yocto)).toPlainString())
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any?>> =
            Shared.objects("amounts.valid").mapIndexed { i, o -> arrayOf<Any?>("valid $i ${o.getString("near")}", o.getString("near"), o.getString("yocto"), o.getString("plain")) } +
                Shared.strings("amounts.invalid").mapIndexed { i, s -> arrayOf<Any?>("invalid $i '${Shared.show(s)}'", s, null, null) }
    }
}

@RunWith(Parameterized::class)
class SharedPayCasesTest(private val label: String, private val text: String, private val expect: JSONObject?) {
    @Test fun agrees_with_the_spec() {
        val got = PayParser.parse(text)
        if (expect == null) {
            assertNull("'$text' is not a payment", got)
            return
        }
        assertNotNull("'$text' is a payment", got)
        got!!
        assertEquals(expect.getString("payee"), got.payee)
        assertEquals(expect.getString("amount"), got.amount.toPlainString())
        assertEquals(expect.getString("token"), got.token)
        assertEquals(if (expect.isNull("memo")) null else expect.getString("memo"), got.memo)
        assertEquals(expect.getInt("span"), got.span)
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any?>> = Shared.objects("pay").mapIndexed { i, o ->
            arrayOf<Any?>("$i ${Shared.show(o.getString("text"))}", o.getString("text"), o.optJSONObject("expect"))
        }
    }
}

@RunWith(Parameterized::class)
class SharedSuggestCasesTest(private val label: String, private val kind: String, private val typed: String, private val want: String) {
    @Test fun agrees_with_the_spec() {
        val got = Shared.suggest.words(typed)
        when (kind) {
            "prefix", "exact" -> assertEquals(want, got.firstOrNull())
            "fix" -> {
                assertFalse("no word starts with '$typed'", Shared.suggest.isWord(typed))
                assertTrue("'$want' in $got", want in got)
                assertTrue(got.size <= 3)
            }
        }
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun data(): List<Array<Any>> =
            listOf("prefix", "exact").flatMap { k ->
                Shared.objects("suggest.$k").map { o -> arrayOf<Any>("$k ${o.getString("typed")}", k, o.getString("typed"), o.getString("top")) }
            } + Shared.objects("suggest.fix").map { o ->
                arrayOf<Any>("fix ${o.getString("typed")} -> ${o.getString("contains")}", "fix", o.getString("typed"), o.getString("contains"))
            }
    }
}
