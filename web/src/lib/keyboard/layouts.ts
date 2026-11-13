/**
 * Key rows for the web keyboard, the same as the phone's (android/.../core/Layouts.kt):
 * same widths, digits on the top row, and what each key offers when held.
 */

export type KeyType = "char" | "shift" | "delete" | "space" | "enter" | "to-symbols" | "to-letters" | "pay" | "spacer";

export type Key = { label: string; type: KeyType; weight: number; hint?: string; popup?: readonly string[] };

export type Page = "letters" | "symbols";

export const ROW_UNITS = 10;

const ACCENTS: Record<string, string> = {
  q: "1", w: "2", e: "3èéêëē", r: "4", t: "5", y: "6ýÿ", u: "7ùúûüū", i: "8ìíîïī", o: "9òóôöõøœ", p: "0",
  a: "àáâäãåæā", s: "ßśš", c: "çćč", n: "ñń", z: "žźż", l: "ł",
};

/** Holding $ picks a currency: the symbols, then the tokens Lunar understands. */
export const CURRENCIES = ["$", "€", "£", "¥", "₹", "NEAR", "USDC", "USDT"] as const;

const SYMBOL_POPUPS: Record<string, readonly string[]> = {
  $: CURRENCIES,
  "-": ["-", "–", "—", "_"],
  '"': ['"', "“", "”", "«", "»"],
  "'": ["'", "‘", "’"],
  "?": ["?", "¿"],
  "!": ["!", "¡"],
};

const letters = (s: string, digits?: string): Key[] =>
  [...s].map((c, i) => {
    const hint = digits?.[i];
    const popup = ACCENTS[c] ? [...(ACCENTS[c] ?? "")] : undefined;
    return { label: c, type: "char", weight: 1, ...(hint ? { hint } : {}), ...(popup ? { popup } : {}) };
  });

const chars = (s: string): Key[] =>
  [...s].map((c) => {
    const popup = SYMBOL_POPUPS[c];
    return { label: c, type: "char", weight: 1, ...(popup ? { popup } : {}) };
  });

const key = (label: string, type: KeyType, weight: number, popup?: readonly string[]): Key => ({ label, type, weight, ...(popup ? { popup } : {}) });

const bottomRow = (switchLabel: string, switchType: KeyType): Key[] => [
  key(switchLabel, switchType, 1.3),
  key("Pay", "pay", 1.8),
  key(",", "char", 1, [",", ";", ":"]),
  key(" ", "space", 3.5),
  key(".", "char", 1, [".", "?", "!", "'", '"', "-", "…", "@"]),
  key("⏎", "enter", 1.4),
];

export const LAYOUTS: Record<Page, Key[][]> = {
  letters: [
    letters("qwertyuiop", "1234567890"),
    [key("", "spacer", 0.5), ...letters("asdfghjkl"), key("", "spacer", 0.5)],
    [key("⇧", "shift", 1.5), ...letters("zxcvbnm"), key("⌫", "delete", 1.5)],
    bottomRow("?123", "to-symbols"),
  ],
  symbols: [
    chars("1234567890"),
    chars("@#$_&-+()/"),
    [key("", "spacer", 1.5), ...chars("*\"':;!?"), key("⌫", "delete", 1.5)],
    bottomRow("ABC", "to-letters"),
  ],
};

/** What holding [k] offers, in the current case. */
export function optionsFor(k: Key, upper: boolean): string[] {
  const base = k.popup ? [...k.popup] : k.hint ? [k.hint] : [];
  return upper ? base.map((o) => (o.length === 1 ? o.toUpperCase() : o)) : base;
}

export type ShiftMode = "off" | "once" | "locked";

/** Shift like a phone: tap for one capital, double-tap to lock, tap again to unlock. */
export function tapShift(mode: ShiftMode, lastTap: number | null, now: number, doubleTapMs = 350): { mode: ShiftMode; lastTap: number | null } {
  if (mode === "locked") return { mode: "off", lastTap: null };
  if (lastTap !== null && now - lastTap <= doubleTapMs) return { mode: "locked", lastTap: null };
  return { mode: mode === "once" ? "off" : "once", lastTap: now };
}
