package app.lunar.keyboard.core

/**
 * The pay form inside the keyboard: who, how much, in what, and what for. Keys type into the
 * active field instead of the chat, so a payment never has to be typed as a sentence or in
 * another app. Each field only takes what makes sense for it.
 */
class PayForm {
    enum class Field { TO, AMOUNT, MEMO }

    sealed class Check {
        data class Ok(val intent: PayIntent) : Check()
        data class Problem(val field: Field, val message: String) : Check()
    }

    var to = ""; private set
    var amount = ""; private set
    var memo = ""; private set
    var token = TOKENS[0]; private set
    var active = Field.TO

    /** Types [s] (a key, or an option picked from a held key) into the active field. */
    fun type(s: String) {
        if (s == " ") { if (active == Field.MEMO) memo = (memo + " ").take(MEMO_MAX) else next(); return }
        when (active) {
            Field.TO -> {
                val clean = s.lowercase().filter { it in 'a'..'z' || it in '0'..'9' || it == '.' || it == '-' || it == '_' }
                if (to.isEmpty() && s == "@") return
                to = (to + clean).take(64)
            }
            Field.AMOUNT -> {
                val upper = s.uppercase()
                when {
                    upper in TOKENS -> token = upper
                    s == "$" -> token = "USDC"
                    s.all { it.isDigit() } -> amount = (if (amount == "0") s else amount + s).take(18)
                    (s == "." || s == ",") && '.' !in amount -> amount = (if (amount.isEmpty()) "0" else amount) + "."
                }
            }
            Field.MEMO -> memo = (memo + s).take(MEMO_MAX)
        }
    }

    /** Deletes one character; on an empty field it steps back to the previous one. */
    fun delete() {
        when (active) {
            Field.TO -> to = to.dropLast(1)
            Field.AMOUNT -> if (amount.isEmpty()) active = Field.TO else amount = amount.dropLast(1)
            Field.MEMO -> if (memo.isEmpty()) active = Field.AMOUNT else memo = memo.dropLast(1)
        }
    }

    /** Moves to the next field. Returns true when the last field was done, meaning "review". */
    fun next(): Boolean {
        active = when (active) {
            Field.TO -> Field.AMOUNT
            Field.AMOUNT -> Field.MEMO
            Field.MEMO -> return true
        }
        return false
    }

    fun cycleToken() {
        token = TOKENS[(TOKENS.indexOf(token) + 1) % TOKENS.size]
    }

    /** Fills the amount (from a chip like "$20 ≈ 5.9 NEAR"). */
    fun setAmount(value: java.math.BigDecimal) {
        amount = value.stripTrailingZeros().toPlainString().take(18)
    }

    fun choosePayee(name: String) {
        to = name
        active = Field.AMOUNT
    }

    fun reset() {
        to = ""; amount = ""; memo = ""; token = TOKENS[0]; active = Field.TO
    }

    fun check(): Check {
        if (to.isEmpty()) return Check.Problem(Field.TO, "Who are you paying?")
        val full = '.' in to || NearName.isValid(to) && (to.length == 64 || to.startsWith("0x"))
        if (!NearName.isValid(to) || !full) return Check.Problem(Field.TO, "Type the full name, e.g. bob.testnet")
        val value = amount.toBigDecimalOrNull()
        if (value == null || value.signum() <= 0) return Check.Problem(Field.AMOUNT, "How much?")
        return Check.Ok(PayIntent(to, value.stripTrailingZeros().let { if (it.scale() < 0) it.setScale(0) else it }, token, memo.trim().ifEmpty { null }, 0))
    }

    companion object {
        val TOKENS = listOf("NEAR", "USDC", "USDT")
        const val MEMO_MAX = 60
    }
}
