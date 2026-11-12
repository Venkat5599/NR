package app.lunar.keyboard.core

import java.math.BigDecimal

/** NEAR account ids, by the protocol's own rules. */
object NearName {
    private val NAMED = Regex("^(([a-z\\d]+[-_])*[a-z\\d]+\\.)*([a-z\\d]+[-_])*[a-z\\d]+$")
    private val IMPLICIT = Regex("^[0-9a-f]{64}$")
    private val ETH_IMPLICIT = Regex("^0x[0-9a-f]{40}$")

    fun isValid(id: String): Boolean {
        if (id.length < 2 || id.length > 64) return false
        return IMPLICIT.matches(id) || ETH_IMPLICIT.matches(id) || NAMED.matches(id)
    }

    /** Which network a name belongs to, from its top-level suffix. */
    fun network(id: String): Network = if (id.endsWith(".testnet")) Network.TESTNET else Network.MAINNET

    enum class Network(val rpc: String) {
        MAINNET("https://rpc.mainnet.near.org"),
        TESTNET("https://rpc.testnet.near.org"),
    }
}

/** A payment the user asked for in plain words. Nothing is signed from this alone. */
data class PayIntent(
    val payee: String,
    val amount: BigDecimal,
    val token: String,
    val memo: String?,
    /** Number of characters at the end of the text that the sentence occupied. */
    val span: Int,
)

/**
 * Reads the sentence the user just typed, e.g. "pay bob.near 20 for dinner",
 * "pay 20 usdc to bob.near" or "send bob.near $5". Only the end of the text is read,
 * so a pay command has to be the last thing typed.
 */
object PayParser {
    private const val NAME = "@?[a-z0-9][a-z0-9._-]*[a-z0-9]"
    private const val AMOUNT = "\\$?(\\d{1,9}(?:[.,]\\d{1,6})?)"
    private const val TOKEN = "(usdc|usdt|near|usd|dollars?)"
    private const val MEMO = "(?:\\s+for\\s+(.{1,60}?))?"

    // pay bob.near 20 [usdc] [for dinner]
    private val NAME_FIRST = Regex(
        "(?:^|\\s)(?:pay|send)\\s+($NAME)\\s+$AMOUNT(?:\\s*$TOKEN)?$MEMO\\s*$",
        RegexOption.IGNORE_CASE,
    )

    // pay 20 [usdc] to bob.near [for dinner]
    private val AMOUNT_FIRST = Regex(
        "(?:^|\\s)(?:pay|send)\\s+$AMOUNT(?:\\s*$TOKEN)?\\s+to\\s+($NAME)$MEMO\\s*$",
        RegexOption.IGNORE_CASE,
    )

    fun parse(textBeforeCursor: CharSequence?): PayIntent? {
        if (textBeforeCursor.isNullOrBlank()) return null
        val text = textBeforeCursor.toString()

        NAME_FIRST.find(text)?.let { m ->
            return build(m.groupValues[1], m.groupValues[2], m.groupValues[3], m.groupValues[4], text, m.range.first)
        }
        AMOUNT_FIRST.find(text)?.let { m ->
            return build(m.groupValues[3], m.groupValues[1], m.groupValues[2], m.groupValues[4], text, m.range.first)
        }
        return null
    }

    private fun build(rawName: String, rawAmount: String, rawToken: String, rawMemo: String, text: String, start: Int): PayIntent? {
        val name = rawName.removePrefix("@").lowercase()
        if (!NearName.isValid(name)) return null
        val amount = rawAmount.replace(',', '.').toBigDecimalOrNull() ?: return null
        if (amount.signum() <= 0) return null
        val token = when (rawToken.lowercase()) {
            "", "usd", "dollar", "dollars", "usdc" -> "USDC"
            "usdt" -> "USDT"
            "near" -> "NEAR"
            else -> return null
        }
        // the match may start on the whitespace before "pay"; the span is what the sentence itself took
        val sentenceStart = if (text.getOrNull(start)?.isWhitespace() == true) start + 1 else start
        val clean = amount.stripTrailingZeros().let { if (it.scale() < 0) it.setScale(0) else it }
        return PayIntent(name, clean, token, rawMemo.trim().ifEmpty { null }, text.length - sentenceStart)
    }
}
