package app.lunar.keyboard.core

/** Someone the user has paid before, with the address they paid. */
data class Payee(val name: String, val address: String)

/** What the keyboard says about a copied address. */
sealed class PasteVerdict {
    /** The clipboard holds no address. */
    data object NotAnAddress : PasteVerdict()

    /** An address the user has never paid, and that looks like none they have. */
    data class New(val address: String) : PasteVerdict()

    /** Exactly an address the user has paid before. */
    data class Known(val payee: Payee) : PasteVerdict()

    /**
     * Shares its start and end with an address the user has paid, but is not that address.
     * This is the address-poisoning pattern: a lookalike planted in the user's history.
     */
    data class Lookalike(val pasted: String, val payee: Payee) : PasteVerdict()
}

object PasteCheck {
    private val EVM = Regex("0x[0-9a-fA-F]{40}")

    /** How many hex characters after "0x", and at the end, must match to count as a lookalike. */
    const val PREFIX = 4
    const val SUFFIX = 4

    /** Pulls one address out of the clipboard text, if it is (mostly) just an address. */
    fun extract(clip: CharSequence?): String? {
        if (clip.isNullOrBlank()) return null
        val text = clip.toString().trim()
        if (text.length > 120) return null
        val all = EVM.findAll(text).map { it.value }.toList()
        return if (all.size == 1) all[0] else null
    }

    fun check(clip: CharSequence?, payees: List<Payee>): PasteVerdict {
        val pasted = extract(clip) ?: return PasteVerdict.NotAnAddress
        val p = pasted.lowercase()
        payees.firstOrNull { it.address.lowercase() == p }?.let { return PasteVerdict.Known(it) }
        payees.firstOrNull { looksLike(p, it.address.lowercase()) }?.let { return PasteVerdict.Lookalike(pasted, it) }
        return PasteVerdict.New(pasted)
    }

    fun looksLike(a: String, b: String): Boolean {
        if (a == b || a.length != b.length || a.length < 2 + PREFIX + SUFFIX) return false
        return a.substring(2, 2 + PREFIX) == b.substring(2, 2 + PREFIX) && a.takeLast(SUFFIX) == b.takeLast(SUFFIX)
    }

    /** "0x9f3a…b21c", the way wallets show it. */
    fun short(address: String) = if (address.length > 12) address.take(6) + "…" + address.takeLast(4) else address
}
