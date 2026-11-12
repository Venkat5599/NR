export type KeyType = "char" | "shift" | "delete" | "space" | "enter" | "to-symbols" | "to-letters" | "pay" | "spacer";

/** One key; [weight] is its width in key units and every row sums to ROW_UNITS. */
export type Key = { label: string; type: KeyType; weight: number };

export type Page = "letters" | "symbols";

export const ROW_UNITS = 10;

const chars = (s: string): Key[] => [...s].map((c) => ({ label: c, type: "char", weight: 1 }));
const key = (label: string, type: KeyType, weight: number): Key => ({ label, type, weight });

const bottomRow = (switchLabel: string, switchType: KeyType): Key[] => [
  key(switchLabel, switchType, 1.4),
  key("Pay", "pay", 1.4),
  key(",", "char", 1),
  key(" ", "space", 3.5),
  key(".", "char", 1),
  key("⏎", "enter", 1.7),
];

export const LAYOUTS: Record<Page, Key[][]> = {
  letters: [
    chars("qwertyuiop"),
    [key("", "spacer", 0.5), ...chars("asdfghjkl"), key("", "spacer", 0.5)],
    [key("⇧", "shift", 1.5), ...chars("zxcvbnm"), key("⌫", "delete", 1.5)],
    bottomRow("?123", "to-symbols"),
  ],
  symbols: [
    chars("1234567890"),
    chars("@#$_&-+()/"),
    [key("", "spacer", 1.5), ...chars("*\"':;!?"), key("⌫", "delete", 1.5)],
    bottomRow("ABC", "to-letters"),
  ],
};
