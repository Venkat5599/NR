/**
 * Word suggestions and the action chips above the keys, the same rules as the phone
 * (android/.../core/Suggest.kt). Nothing here touches the network.
 */

export type Chip =
  | { kind: "pay-name"; name: string; amount: string | null; label: string }
  | { kind: "pay"; amount: string | null; label: string }
  | { kind: "convert"; usd: string; near: string; label: string }
  | { kind: "swap"; amount: string | null; to: "USDC" | "USDT"; label: string }
  | { kind: "price"; symbol: string; usd: string; label: string };

export type Prices = Readonly<Record<string, number>>;

/** Frequency-ordered words (most common first) with prefix completion and one-slip fixes. */
export class Suggest {
  private readonly rank = new Map<string, number>();
  private readonly sorted: string[];
  private readonly apostrophes = new Map<string, string>();

  constructor(wordsByFrequency: readonly string[]) {
    wordsByFrequency.forEach((w, i) => {
      if (w && !this.rank.has(w)) this.rank.set(w, i);
    });
    this.sorted = [...this.rank.keys()].sort();
    for (const w of this.rank.keys()) if (w.includes("'")) this.apostrophes.set(w.replaceAll("'", ""), w);
  }

  isWord(w: string): boolean {
    return this.rank.has(w.toLowerCase());
  }

  words(typed: string, n = 3): string[] {
    if (typed === "" || typed.length > 24) return [];
    const key = typed.toLowerCase();
    const byRank = (a: string, b: string) => (this.rank.get(a) ?? 0) - (this.rank.get(b) ?? 0);
    const fixed = this.apostrophes.get(key);
    if (fixed !== undefined) return unique([fixed, ...this.byPrefix(key).sort(byRank)].map((w) => matchCase(w, typed))).slice(0, n);
    const prefix = this.byPrefix(key);
    const picks = (prefix.length > 0 ? prefix : this.oneEditAway(key)).sort(byRank);
    const out = unique(picks.map((w) => matchCase(w, typed))).slice(0, n);
    if (!this.rank.has(key)) return out;
    const self = matchCase(key, typed);
    return [self, ...out.filter((w) => w.toLowerCase() !== key)].slice(0, n);
  }

  private byPrefix(p: string): string[] {
    let lo = 0;
    let hi = this.sorted.length;
    while (lo < hi) {
      const m = (lo + hi) >>> 1;
      if ((this.sorted[m] ?? "") < p) lo = m + 1;
      else hi = m;
    }
    const out: string[] = [];
    for (let i = lo; i < this.sorted.length; i++) {
      const w = this.sorted[i];
      if (w === undefined || !w.startsWith(p)) break;
      out.push(w);
    }
    return out;
  }

  private oneEditAway(w: string): string[] {
    if (w.length < 3) return [];
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const out = new Set<string>();
    for (let i = 0; i <= w.length; i++) {
      if (i < w.length) out.add(w.slice(0, i) + w.slice(i + 1));
      if (i < w.length - 1) out.add(w.slice(0, i) + (w[i + 1] ?? "") + (w[i] ?? "") + w.slice(i + 2));
      for (const c of letters) {
        if (i < w.length) out.add(w.slice(0, i) + c + w.slice(i + 1));
        out.add(w.slice(0, i) + c + w.slice(i));
      }
    }
    return [...out].filter((x) => this.rank.has(x));
  }
}

function unique(list: string[]): string[] {
  return [...new Set(list)];
}

function matchCase(word: string, typed: string): string {
  if (word === "i" || word.startsWith("i'")) return "I" + word.slice(1);
  if (typed.length > 1 && [...typed].every((c) => c.toLowerCase() === c.toUpperCase() || c === c.toUpperCase())) return word.toUpperCase();
  const first = typed[0];
  if (first !== undefined && first !== first.toLowerCase()) return word.charAt(0).toUpperCase() + word.slice(1);
  return word;
}

/** The word right before the cursor, or "" after a space or punctuation. */
export function currentWord(before: string): string {
  const m = /[\p{L}']*$/u.exec(before);
  return m ? m[0] : "";
}

/** The text after the last line break or sentence end. */
export function lastSentence(text: string): string {
  const cut = Math.max(text.lastIndexOf("\n"), text.lastIndexOf(". "), text.lastIndexOf("! "), text.lastIndexOf("? "));
  return text.slice(cut < 0 ? 0 : cut + 1).trim();
}

const NAME = /(?<![\w.-])@?((?:[a-z\d]+[-_])*[a-z\d]+(?:\.(?:[a-z\d]+[-_])*[a-z\d]+)*\.(?:near|testnet))\b/g;
const MONEY_WORDS = /\b(pay|paid|send|sent|owe|owes|owed|transfer|split|venmo|reimburse|refund|tip|chip in|pay back|pay you back)\b/;
const SWAP_WORDS = /\b(swap|convert|exchange|trade)\b/;
const PRICE_ASK = /\b(near|usdc|eth|btc|bitcoin|sol)\b.{0,12}\b(price|worth|trading at|at now)\b|\b(price|worth) of (near|usdc|eth|btc|bitcoin|sol)\b/;
const USD = /\$\s?(\d+(?:\.\d{1,2})?)|\b(\d+(?:\.\d{1,2})?)\s?(?:usd|dollars|bucks)\b/;
const NEAR_AMOUNT = /\b(\d+(?:\.\d+)?)\s?(?:n|near)\b/;
const NUMBER = /(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])/g;

/** Trims trailing zeros: "5.90" -> "5.9", "6.00" -> "6". */
export function plain(n: number, digits: number): string {
  return String(Number(n.toFixed(digits)));
}

/** "$3.39" style price text; whole dollars from $1000 up. */
export function showPrice(p: number): string {
  return p >= 1000 ? p.toFixed(0) : p.toFixed(2);
}

/** "$6.78" for an amount of [symbol] at [prices], or null without a price. */
export function usdOf(amount: string, symbol: string, prices: Prices): string | null {
  const p = prices[symbol.toUpperCase()];
  const a = Number(amount);
  if (p === undefined || !Number.isFinite(a)) return null;
  const v = a * p;
  return "$" + (v < 1 ? v.toFixed(3) : v.toFixed(2));
}

/** The chips for [sentence], the most specific first; at most [max]. */
export function readChips(sentence: string, prices: Prices, max = 2): Chip[] {
  const s = sentence.toLowerCase();
  if (s.trim() === "") return [];
  const out: Chip[] = [];
  const nearAmount = NEAR_AMOUNT.exec(s)?.[1] ?? null;
  const names = [...s.matchAll(NAME)].map((m) => m[1]).filter((x): x is string => x !== undefined);
  const name = names.at(-1);
  if (name !== undefined) {
    const rest = [...s.replace(name, " ").matchAll(NUMBER)].map((m) => m[1]).at(-1) ?? null;
    const amount = nearAmount ?? rest;
    out.push({ kind: "pay-name", name, amount, label: `Pay ${name}${amount ? ` ${amount}` : ""}` });
  }
  if (SWAP_WORDS.test(s)) {
    const to = s.includes("usdt") || s.includes("tether") ? "USDT" : "USDC";
    const amount = nearAmount ?? [...s.matchAll(NUMBER)].map((m) => m[1])[0] ?? null;
    out.push({ kind: "swap", amount, to, label: `Swap${amount ? ` ${amount} NEAR` : ""} to ${to}` });
  }
  const usdMatch = USD.exec(s);
  const usd = usdMatch ? Number(usdMatch[1] ?? usdMatch[2]) : NaN;
  const nearUsd = prices["NEAR"];
  if (Number.isFinite(usd) && usd > 0 && nearUsd !== undefined && nearUsd > 0) {
    const near = plain(usd / nearUsd, 2);
    const usdText = plain(usd, 2);
    out.push({ kind: "convert", usd: usdText, near, label: `$${usdText} ≈ ${near} NEAR` });
  }
  if (!out.some((c) => c.kind === "pay-name") && MONEY_WORDS.test(s)) {
    out.push({ kind: "pay", amount: nearAmount, label: nearAmount ? `Pay ${nearAmount} NEAR` : "Pay" });
  }
  const ask = PRICE_ASK.exec(s);
  if (ask) {
    const raw = ask[1] ?? ask[4] ?? "";
    const symbol = (raw === "bitcoin" ? "btc" : raw).toUpperCase();
    const p = prices[symbol];
    if (p !== undefined) out.push({ kind: "price", symbol, usd: showPrice(p), label: `${symbol} $${showPrice(p)}` });
  }
  const seen = new Set<string>();
  return out.filter((c) => !seen.has(c.label) && seen.add(c.label)).slice(0, max);
}
