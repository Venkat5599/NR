package app.lunar.keyboard.core

/**
 * Shift behaves like every phone keyboard: tap once for one capital, double-tap to lock,
 * tap again to unlock. A double tap locks from any state, including the automatic capital at
 * the start of a sentence (where the first tap turns it off and the second used to turn it
 * back on instead of locking).
 */
class ShiftState(private val doubleTapMs: Long = 350) {
    enum class Mode { OFF, ONCE, LOCKED }

    var mode: Mode = Mode.OFF
        private set
    private var lastTap: Long? = null

    /** The user chose the current state by hand since the last character; auto-capitalisation leaves it alone. */
    private var manual = false

    val isUpper get() = mode != Mode.OFF

    fun tap(now: Long) {
        val quick = lastTap?.let { now - it <= doubleTapMs } == true
        if (mode == Mode.LOCKED) {
            mode = Mode.OFF
            lastTap = null // a tap that unlocks never starts a double tap
        } else if (quick) {
            mode = Mode.LOCKED
            lastTap = null
        } else {
            mode = if (mode == Mode.ONCE) Mode.OFF else Mode.ONCE
            lastTap = now
        }
        manual = true
    }

    /** Called after a character is typed. A one-shot capital turns itself off. */
    fun afterChar() {
        if (mode == Mode.ONCE) mode = Mode.OFF
        manual = false
        lastTap = null
    }

    /** Auto-capitalisation from the editor (start of a sentence). Never overrides a lock or a choice made by hand. */
    fun setAuto(capitalize: Boolean) {
        if (mode == Mode.LOCKED || manual) return
        mode = if (capitalize) Mode.ONCE else Mode.OFF
    }

    fun reset() {
        mode = Mode.OFF
        manual = false
        lastTap = null
    }
}
