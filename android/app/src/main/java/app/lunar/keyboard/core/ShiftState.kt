package app.lunar.keyboard.core

/** Shift behaves like every phone keyboard: tap once for one capital, double-tap to lock. */
class ShiftState(private val doubleTapMs: Long = 350) {
    enum class Mode { OFF, ONCE, LOCKED }

    var mode: Mode = Mode.OFF
        private set
    private var lastTap = Long.MIN_VALUE / 2

    /** The user chose the current state by hand since the last character; auto-capitalisation leaves it alone. */
    private var manual = false

    val isUpper get() = mode != Mode.OFF

    fun tap(now: Long) {
        mode = when {
            mode == Mode.LOCKED -> Mode.OFF
            mode == Mode.ONCE && now - lastTap <= doubleTapMs -> Mode.LOCKED
            mode == Mode.ONCE -> Mode.OFF
            else -> Mode.ONCE
        }
        lastTap = now
        manual = true
    }

    /** Called after a character is typed. A one-shot capital turns itself off. */
    fun afterChar() {
        if (mode == Mode.ONCE) mode = Mode.OFF
        manual = false
    }

    /** Auto-capitalisation from the editor (start of a sentence). Never overrides a lock or a choice made by hand. */
    fun setAuto(capitalize: Boolean) {
        if (mode == Mode.LOCKED || manual) return
        mode = if (capitalize) Mode.ONCE else Mode.OFF
    }

    fun reset() {
        mode = Mode.OFF
        manual = false
    }
}
