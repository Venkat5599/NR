import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CURRENCIES, LAYOUTS, optionsFor, ROW_UNITS, tapShift, type Key, type ShiftMode } from "../src/lib/keyboard/layouts.ts";
import { checkForm, choosePayee, cycleToken, deleteFrom, emptyForm, MEMO_MAX, next, setAmount, typeInto, type FormCheck, type PayForm } from "../src/lib/keyboard/pay-form.ts";
import { currentWord, lastSentence, plain, readChips, showPrice, Suggest, usdOf, type Chip, type Prices } from "../src/lib/keyboard/suggest.ts";

const words = readFileSync(new URL("../public/words_en.txt", import.meta.url), "utf8").split("\n").filter(Boolean);
const s = new Suggest(words);
const show = (x: unknown) => JSON.stringify(x);

// ---------------------------------------------------------------- layouts

const letterKeys = LAYOUTS.letters.flat().filter((k) => k.type === "char");
const keyFor = (label: string): Key => {
  const k = [...LAYOUTS.letters.flat(), ...LAYOUTS.symbols.flat()].find((x) => x.label === label && x.type === "char");
  assert.ok(k, label);
  return k;
};

const HOLD: Record<string, string[]> = {
  q: ["1"], w: ["2"], e: ["3", "è", "é", "ê", "ë", "ē"], r: ["4"], t: ["5"], y: ["6", "ý", "ÿ"], u: ["7", "ù", "ú", "û", "ü", "ū"],
  i: ["8", "ì", "í", "î", "ï", "ī"], o: ["9", "ò", "ó", "ô", "ö", "õ", "ø", "œ"], p: ["0"], a: ["à", "á", "â", "ä", "ã", "å", "æ", "ā"],
  s: ["ß", "ś", "š"], d: [], f: [], g: [], h: [], j: [], k: [], l: ["ł"], z: ["ž", "ź", "ż"], x: [], c: ["ç", "ć", "č"], v: [], b: [],
  n: ["ñ", "ń"], m: [],
};
const HOLD_UPPER: Record<string, string[]> = {
  ...HOLD, e: ["3", "È", "É", "Ê", "Ë", "Ē"], y: ["6", "Ý", "Ÿ"], u: ["7", "Ù", "Ú", "Û", "Ü", "Ū"], i: ["8", "Ì", "Í", "Î", "Ï", "Ī"],
  o: ["9", "Ò", "Ó", "Ô", "Ö", "Õ", "Ø", "Œ"], a: ["À", "Á", "Â", "Ä", "Ã", "Å", "Æ", "Ā"], s: ["SS", "Ś", "Š"], l: ["Ł"], z: ["Ž", "Ź", "Ż"],
  c: ["Ç", "Ć", "Č"], n: ["Ñ", "Ń"],
};

test("the letter page has all 26 letters once", () => {
  assert.deepEqual(letterKeys.filter((k) => /^[a-z]$/.test(k.label)).map((k) => k.label).sort(), [..."abcdefghijklmnopqrstuvwxyz"]);
});

for (const letter of Object.keys(HOLD)) {
  test(`holding "${letter}" offers ${show(HOLD[letter])}`, () => {
    assert.deepEqual(optionsFor(keyFor(letter), false), HOLD[letter]);
  });
  test(`holding "${letter}" with shift offers ${show(HOLD_UPPER[letter])}`, () => {
    assert.deepEqual(optionsFor(keyFor(letter), true), HOLD_UPPER[letter]);
  });
}

[..."qwertyuiop"].forEach((letter, i) => {
  test(`top-row key "${letter}" shows digit hint ${(i + 1) % 10}`, () => {
    assert.equal(keyFor(letter).hint, String((i + 1) % 10));
    assert.equal(optionsFor(keyFor(letter), false)[0], String((i + 1) % 10));
  });
});

for (const page of ["letters", "symbols"] as const) {
  LAYOUTS[page].forEach((row, i) => {
    test(`${page} row ${i + 1} fills exactly ${ROW_UNITS} units`, () => {
      assert.ok(Math.abs(row.reduce((sum, k) => sum + k.weight, 0) - ROW_UNITS) < 1e-9);
    });
  });
}

const SYMBOL_HOLD: [string, readonly string[]][] = [
  ["$", CURRENCIES],
  ["-", ["-", "–", "—", "_"]],
  ['"', ['"', "“", "”", "«", "»"]],
  ["'", ["'", "‘", "’"]],
  ["?", ["?", "¿"]],
  ["!", ["!", "¡"]],
  [",", [",", ";", ":"]],
  [".", [".", "?", "!", "'", '"', "-", "…", "@"]],
  ["#", []],
  ["&", []],
  ["1", []],
];
for (const [label, want] of SYMBOL_HOLD) {
  test(`holding "${label}" offers ${show(want)}`, () => {
    assert.deepEqual(optionsFor(keyFor(label), false), [...want]);
  });
}

test("shift keeps token names as they are in the currency popup", () => {
  assert.deepEqual(optionsFor(keyFor("$"), true), ["$", "€", "£", "¥", "₹", "NEAR", "USDC", "USDT"]);
});

for (const [page, type] of [["letters", "to-symbols"], ["symbols", "to-letters"]] as const) {
  test(`the ${page} page has delete, space, enter, pay and a ${type} switch`, () => {
    const types = LAYOUTS[page].flat().map((k) => k.type);
    for (const t of ["delete", "space", "enter", "pay", type] as const) assert.equal(types.filter((x) => x === t).length, 1, t);
  });
}

// ---------------------------------------------------------------- shift

const SHIFT: [ShiftMode, number | null, number, number | undefined, ShiftMode, number | null][] = [
  ["off", null, 1000, undefined, "once", 1000],
  ["once", 1000, 1200, undefined, "locked", null],
  ["once", 1000, 1350, undefined, "locked", null],
  ["once", 1000, 1351, undefined, "off", 1351],
  ["once", 1000, 5000, undefined, "off", 5000],
  ["off", 1000, 1100, undefined, "locked", null],
  ["off", 1000, 2000, undefined, "once", 2000],
  ["locked", null, 1000, undefined, "off", null],
  ["locked", 990, 1000, undefined, "off", null],
  ["once", 1000, 1150, 100, "off", 1150],
  ["once", 1000, 1100, 100, "locked", null],
  ["off", null, 0, 350, "once", 0],
];
for (const [mode, lastTap, now, ms, wantMode, wantTap] of SHIFT) {
  test(`shift ${mode} tapped at ${now} (last ${lastTap}, window ${ms ?? 350}) → ${wantMode}`, () => {
    assert.deepEqual(ms === undefined ? tapShift(mode, lastTap, now) : tapShift(mode, lastTap, now, ms), { mode: wantMode, lastTap: wantTap });
  });
}

// ---------------------------------------------------------------- pay form

const at = (patch: Partial<PayForm>): PayForm => ({ ...emptyForm(), ...patch });
const typeAll = (f: PayForm, text: string): PayForm => [...text].reduce(typeInto, f);

const TYPE_ONE: [string, Partial<PayForm>, string, Partial<PayForm>][] = [
  ["a letter goes into the name", {}, "b", { to: "b" }],
  ["capitals become lowercase in the name", {}, "B", { to: "b" }],
  ["an @ before the name is dropped", {}, "@", {}],
  ["an @ inside the name is dropped", { to: "bo" }, "@", { to: "bo" }],
  ["a dot is kept in the name", { to: "bob" }, ".", { to: "bob." }],
  ["a dash is kept in the name", { to: "bob" }, "-", { to: "bob-" }],
  ["an underscore is kept in the name", { to: "bob" }, "_", { to: "bob_" }],
  ["a digit is kept in the name", { to: "bob" }, "7", { to: "bob7" }],
  ["an accent is dropped from the name", { to: "bob" }, "é", { to: "bob" }],
  ["punctuation is dropped from the name", { to: "bob" }, "!", { to: "bob" }],
  ["a picked option is lowercased into the name", { to: "x" }, "NEAR", { to: "xnear" }],
  ["space moves from name to amount", { to: "bob.near" }, " ", { to: "bob.near", active: "amount" }],
  ["a digit goes into the amount", { active: "amount" }, "5", { active: "amount", amount: "5" }],
  ["a digit replaces a lone zero", { active: "amount", amount: "0" }, "5", { active: "amount", amount: "5" }],
  ["zero after zero stays one zero", { active: "amount", amount: "0" }, "0", { active: "amount", amount: "0" }],
  ["a point on an empty amount starts 0.", { active: "amount" }, ".", { active: "amount", amount: "0." }],
  ["a comma counts as the decimal point", { active: "amount" }, ",", { active: "amount", amount: "0." }],
  ["a second point is ignored", { active: "amount", amount: "1." }, ".", { active: "amount", amount: "1." }],
  ["a comma after a point is ignored", { active: "amount", amount: "1.5" }, ",", { active: "amount", amount: "1.5" }],
  ["NEAR from the currency popup sets the token", { active: "amount", token: "USDC" }, "NEAR", { active: "amount", token: "NEAR" }],
  ["USDC from the currency popup sets the token", { active: "amount" }, "USDC", { active: "amount", token: "USDC" }],
  ["USDT from the currency popup sets the token", { active: "amount" }, "USDT", { active: "amount", token: "USDT" }],
  ["lowercase usdt still sets the token", { active: "amount" }, "usdt", { active: "amount", token: "USDT" }],
  ["$ means USDC", { active: "amount" }, "$", { active: "amount", token: "USDC" }],
  ["€ is not a token and changes nothing", { active: "amount", amount: "2" }, "€", { active: "amount", amount: "2" }],
  ["a letter in the amount is ignored", { active: "amount", amount: "2" }, "a", { active: "amount", amount: "2" }],
  ["a minus in the amount is ignored", { active: "amount", amount: "2" }, "-", { active: "amount", amount: "2" }],
  ["space moves from amount to memo", { active: "amount", amount: "2" }, " ", { active: "memo", amount: "2" }],
  ["a letter goes into the memo", { active: "memo" }, "d", { active: "memo", memo: "d" }],
  ["memo keeps capitals", { active: "memo", memo: "a" }, "B", { active: "memo", memo: "aB" }],
  ["memo keeps punctuation", { active: "memo", memo: "a" }, "!", { active: "memo", memo: "a!" }],
  ["memo keeps an @", { active: "memo" }, "@", { active: "memo", memo: "@" }],
  ["space is typed into the memo", { active: "memo", memo: "a" }, " ", { active: "memo", memo: "a " }],
  ["memo stops at the limit", { active: "memo", memo: "m".repeat(MEMO_MAX) }, "x", { active: "memo", memo: "m".repeat(MEMO_MAX) }],
  ["space at the memo limit adds nothing", { active: "memo", memo: "m".repeat(MEMO_MAX) }, " ", { active: "memo", memo: "m".repeat(MEMO_MAX) }],
  ["the name stops at 64 characters", { to: "a".repeat(64) }, "b", { to: "a".repeat(64) }],
  ["the amount stops at 18 characters", { active: "amount", amount: "1".repeat(18) }, "2", { active: "amount", amount: "1".repeat(18) }],
];
for (const [what, from, key, want] of TYPE_ONE) {
  test(`pay form: ${what}`, () => {
    assert.deepEqual(typeInto(at(from), key), at(want));
  });
}

const ok = (payee: string, amount: string, token: PayForm["token"], memo: string | null): FormCheck => ({ ok: true, payee, amount, token, memo });
const bad = (field: "to" | "amount", message: string): FormCheck => ({ ok: false, field, message });
const WHO = bad("to", "Who are you paying?");
const FULL = bad("to", "Type the full name, e.g. bob.testnet");
const HOW = bad("amount", "How much?");

const TYPED: [string, FormCheck][] = [
  ["bob.testnet 0.5 dinner out", ok("bob.testnet", "0.5", "NEAR", "dinner out")],
  ["bob.testnet 5", ok("bob.testnet", "5", "NEAR", null)],
  ["bob.testnet 5.", ok("bob.testnet", "5", "NEAR", null)],
  ["bob.testnet 5.50", ok("bob.testnet", "5.5", "NEAR", null)],
  ["bob.testnet 00012", ok("bob.testnet", "12", "NEAR", null)],
  ["bob.testnet 1,5", ok("bob.testnet", "1.5", "NEAR", null)],
  ["bob.testnet 0.0000001", ok("bob.testnet", "0.0000001", "NEAR", null)],
  ["bob.testnet 0.000000000000000001", HOW],
  ["bob.testnet 123456789012345678901", ok("bob.testnet", "123456789012345678", "NEAR", null)],
  ["bob.testnet 2 ", ok("bob.testnet", "2", "NEAR", null)],
  ["bob.testnet 2    ", ok("bob.testnet", "2", "NEAR", null)],
  ["bob.testnet 2  rent", ok("bob.testnet", "2", "NEAR", "rent")],
  ["bob.testnet 2 rent ", ok("bob.testnet", "2", "NEAR", "rent")],
  ["Bob.Testnet 3", ok("bob.testnet", "3", "NEAR", null)],
  ["@bob.testnet 3", ok("bob.testnet", "3", "NEAR", null)],
  ["@alice.near 1 coffee", ok("alice.near", "1", "NEAR", "coffee")],
  ["lunar-69787.testnet 0.05 test", ok("lunar-69787.testnet", "0.05", "NEAR", "test")],
  ["sub.bob.testnet 9", ok("sub.bob.testnet", "9", "NEAR", null)],
  ["bób.testnet 3", ok("bb.testnet", "3", "NEAR", null)],
  [`${"ab".repeat(32)} 1`, ok("ab".repeat(32), "1", "NEAR", null)],
  [`0x${"cd".repeat(20)} 1`, ok(`0x${"cd".repeat(20)}`, "1", "NEAR", null)],
  ["", WHO],
  [" ", WHO],
  ["bob 5", FULL],
  ["near 5", FULL],
  ["bob..testnet 3", FULL],
  ["bob.testnet. 3", FULL],
  [".bob.testnet 3", FULL],
  ["bob-.testnet 3", FULL],
  [`0x${"cd".repeat(19)} 1`, FULL],
  ["b 1", FULL],
  ["bob.testnet", HOW],
  ["bob.testnet ", HOW],
  ["bob.testnet 0", HOW],
  ["bob.testnet 0.", HOW],
  ["bob.testnet 0.000", HOW],
  ["bob.testnet .", HOW],
  ["bob.testnet abc", HOW],
];
for (const [keys, want] of TYPED) {
  test(`pay form typed ${show(keys)} → ${want.ok ? `${want.amount} to ${want.payee}` : want.message}`, () => {
    assert.deepEqual(checkForm(typeAll(emptyForm(), keys)), want);
  });
}

const TOKEN_KEYS: [string[], PayForm["token"]][] = [
  [["5"], "NEAR"],
  [["5", "USDC"], "USDC"],
  [["$", "5"], "USDC"],
  [["5", "USDT"], "USDT"],
  [["USDT", "5", "NEAR"], "NEAR"],
  [["5", "€"], "NEAR"],
];
for (const [keys, token] of TOKEN_KEYS) {
  test(`pay form amount keys ${show(keys)} pay in ${token}`, () => {
    const f = keys.reduce(typeInto, at({ to: "bob.testnet", active: "amount" }));
    assert.deepEqual(checkForm(f), ok("bob.testnet", "5", token, null));
  });
}

const DELETES: [string, Partial<PayForm>, Partial<PayForm>][] = [
  ["removes the last name character", { to: "bob" }, { to: "bo" }],
  ["on an empty name stays put", {}, {}],
  ["removes the last amount digit", { active: "amount", amount: "12" }, { active: "amount", amount: "1" }],
  ["removes a trailing point", { active: "amount", amount: "1." }, { active: "amount", amount: "1" }],
  ["on an empty amount steps back to the name", { to: "bob.near", active: "amount" }, { to: "bob.near", active: "to" }],
  ["removes the last memo character", { active: "memo", memo: "ab" }, { active: "memo", memo: "a" }],
  ["on an empty memo steps back to the amount", { amount: "2", active: "memo" }, { amount: "2", active: "amount" }],
  ["keeps the token while deleting", { active: "amount", amount: "5", token: "USDT" }, { active: "amount", amount: "", token: "USDT" }],
];
for (const [what, from, want] of DELETES) {
  test(`delete ${what}`, () => {
    assert.deepEqual(deleteFrom(at(from)), at(want));
  });
}

test("deleting all the way back walks memo → amount → name", () => {
  let f = typeAll(emptyForm(), "ab.near 1 x");
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    f = deleteFrom(f);
    seen.push(f.active);
  }
  assert.deepEqual(f, emptyForm());
  assert.deepEqual(seen, ["memo", "amount", "amount", "to", "to", "to", "to", "to", "to", "to", "to", "to"]);
});

const NEXTS: [PayForm["active"], PayForm["active"], boolean][] = [
  ["to", "amount", false],
  ["amount", "memo", false],
  ["memo", "memo", true],
];
for (const [from, to, review] of NEXTS) {
  test(`next from ${from} goes to ${to}${review ? " and opens review" : ""}`, () => {
    assert.deepEqual(next(at({ active: from })), { form: at({ active: to }), review });
  });
}

const CYCLE: [PayForm["token"], PayForm["token"]][] = [
  ["NEAR", "USDC"],
  ["USDC", "USDT"],
  ["USDT", "NEAR"],
];
for (const [from, to] of CYCLE) {
  test(`token button cycles ${from} → ${to}`, () => {
    assert.equal(cycleToken(at({ token: from })).token, to);
  });
}

test("choosing a payee without an amount moves to the amount", () => {
  assert.deepEqual(choosePayee(at({ to: "x" }), "bob.near"), at({ to: "bob.near", active: "amount" }));
});

test("choosing a payee with an amount moves to the memo", () => {
  assert.deepEqual(choosePayee(at({ amount: "5" }), "bob.near"), at({ to: "bob.near", amount: "5", active: "memo" }));
});

const SET_AMOUNT: [string, string][] = [
  ["5.90", "5.9"],
  ["0.0000001", "0.0000001"],
  ["0.000000000000000001", "0.0000000000000000"],
  ["012", "12"],
  ["7", "7"],
  ["100", "100"],
  ["0.10", "0.1"],
  [".5", "0.5"],
  ["5.", "5"],
  ["  3.50 ", "3.5"],
  ["0", "0"],
  ["abc", ""],
  ["", ""],
  ["1e-7", ""],
  ["-1", ""],
  ["1,5", ""],
];
for (const [given, want] of SET_AMOUNT) {
  test(`a chip amount ${show(given)} fills the form as ${show(want)}`, () => {
    assert.equal(setAmount(emptyForm(), given).amount, want);
  });
}

const CHECKS: [Partial<PayForm>, FormCheck][] = [
  [{ to: "bob.near", amount: "1" }, ok("bob.near", "1", "NEAR", null)],
  [{ to: "bob.near", amount: "1", token: "USDT", memo: "  hi  " }, ok("bob.near", "1", "USDT", "hi")],
  [{ to: "bob.near", amount: "0.0000001" }, ok("bob.near", "0.0000001", "NEAR", null)],
  [{ to: "bob.near", amount: "1e3" }, HOW],
  [{ to: "bob.near", amount: "Infinity" }, HOW],
  [{ to: "bob.near", amount: "-2" }, HOW],
  [{ to: "bob.near", amount: "" }, HOW],
  [{ to: "Bob.near", amount: "1" }, FULL],
  [{ to: "a".repeat(65) + ".near", amount: "1" }, FULL],
  [{ to: "", amount: "1" }, WHO],
];
for (const [form, want] of CHECKS) {
  test(`check ${show(form)} → ${want.ok ? "ok" : want.message}`, () => {
    assert.deepEqual(checkForm(at(form)), want);
  });
}

// ---------------------------------------------------------------- words

const CURRENT: [string, string][] = [
  ["pay bob for dinn", "dinn"],
  ["", ""],
  ["hello", "hello"],
  ["don't", "don't"],
  ["it's 5", ""],
  ["café", "café"],
  ["naïve", "naïve"],
  ["bob.near", "near"],
  ["hey, yo", "yo"],
  ["abc123", ""],
  ["x ", ""],
  ["I'm", "I'm"],
  ["end.", ""],
  ["line\nnext", "next"],
  ["(quote", "quote"],
  ["über", "über"],
];
for (const [before, want] of CURRENT) {
  test(`the word before the cursor in ${show(before)} is ${show(want)}`, () => {
    assert.equal(currentWord(before), want);
  });
}

const SENTENCES: [string, string][] = [
  ["ok. pay bob 2", "pay bob 2"],
  ["hi! there", "there"],
  ["what? now", "now"],
  ["a\nb c", "b c"],
  ["no cut here", "no cut here"],
  ["pay bob.near 2", "pay bob.near 2"],
  ["  spaced  ", "spaced"],
  ["one. two. three", "three"],
  ["end. ", ""],
  ["line\n", ""],
  ["3.5 near", "3.5 near"],
  ["sure! send 2 to bob.near", "send 2 to bob.near"],
  ["first\nsecond. third", "third"],
  ["", ""],
];
for (const [text, want] of SENTENCES) {
  test(`the last sentence of ${show(text)} is ${show(want)}`, () => {
    assert.equal(lastSentence(text), want);
  });
}

const CASES: [string, string][] = [
  ["Dinn", "Dinner"],
  ["DINN", "DINNER"],
  ["dinn", "dinner"],
  ["Becuase", "Because"],
  ["Dont", "Don't"],
  ["DONT", "DON'T"],
  ["im", "I'm"],
  ["IM", "I'm"],
  ["i", "I"],
  ["The", "The"],
  ["THE", "THE"],
];
for (const [typed, first] of CASES) {
  test(`suggestions follow the typed case: ${show(typed)} → ${show(first)}`, () => {
    assert.equal(s.words(typed)[0], first);
  });
}

const LIMITS: [string, number | undefined, number][] = [
  ["", undefined, 0],
  ["a".repeat(25), undefined, 0],
  ["th", 1, 1],
  ["th", 5, 5],
  ["th", undefined, 3],
  ["zzzzzzzzq", undefined, 0],
];
for (const [typed, n, count] of LIMITS) {
  test(`${show(typed)} with n=${n ?? 3} gives ${count} suggestions`, () => {
    assert.equal((n === undefined ? s.words(typed) : s.words(typed, n)).length, count);
  });
}

const IS_WORD: [string, boolean][] = [
  ["the", true],
  ["THE", true],
  ["near", true],
  ["dinner", true],
  ["don't", true],
  ["qzxv", false],
  ["", false],
];
for (const [w, want] of IS_WORD) {
  test(`${show(w)} ${want ? "is" : "is not"} a word`, () => {
    assert.equal(s.isWord(w), want);
  });
}

test("a prefix lists completions most frequent first", () => {
  const rank = new Map(words.map((w, i) => [w, i] as const));
  for (const p of ["pa", "di", "mon", "sen", "tha", "wor"]) {
    const got = s.words(p, 10).filter((w) => w !== p);
    const ranks = got.map((w) => rank.get(w) ?? -1);
    assert.ok(ranks.every((r) => r >= 0), p);
    assert.deepEqual([...ranks].sort((a, b) => a - b), ranks, p);
  }
});

// ---------------------------------------------------------------- money

const PRICES: Prices = { NEAR: 3.39, BTC: 71866, ETH: 2016.34, USDC: 1 };

const USD_OF: [string, string, Prices, string | null][] = [
  ["2", "NEAR", PRICES, "$6.78"],
  ["0.1", "NEAR", PRICES, "$0.339"],
  ["1", "near", PRICES, "$3.39"],
  ["1000", "NEAR", PRICES, "$3390.00"],
  ["0.2", "USDC", PRICES, "$0.200"],
  ["1", "BTC", PRICES, "$71866.00"],
  ["0", "NEAR", PRICES, "$0.000"],
  ["x", "NEAR", PRICES, null],
  ["2", "SOL", PRICES, null],
  ["2", "NEAR", {}, null],
  ["Infinity", "NEAR", PRICES, null],
];
for (const [amount, symbol, prices, want] of USD_OF) {
  test(`${amount} ${symbol} is worth ${want ?? "nothing shown"}`, () => {
    assert.equal(usdOf(amount, symbol, prices), want);
  });
}

const PLAIN: [number, number, string][] = [
  [5.899, 2, "5.9"],
  [6.004, 2, "6"],
  [12, 2, "12"],
  [0.1 + 0.2, 2, "0.3"],
  [3.14159, 3, "3.142"],
  [0, 2, "0"],
  [2.5, 0, "3"],
];
for (const [n, digits, want] of PLAIN) {
  test(`plain(${n}, ${digits}) is ${want}`, () => {
    assert.equal(plain(n, digits), want);
  });
}

const SHOW_PRICE: [number, string][] = [
  [3.39, "3.39"],
  [0.5, "0.50"],
  [1000, "1000"],
  [71866.4, "71866"],
  [2016.34, "2016"],
  [999.5, "999.50"],
];
for (const [p, want] of SHOW_PRICE) {
  test(`a price of ${p} shows as ${want}`, () => {
    assert.equal(showPrice(p), want);
  });
}

const payName = (name: string, amount: string | null): Chip => ({ kind: "pay-name", name, amount, label: `Pay ${name}${amount ? ` ${amount}` : ""}` });
const pay = (amount: string | null): Chip => ({ kind: "pay", amount, label: amount ? `Pay ${amount} NEAR` : "Pay" });
const swap = (amount: string | null, to: "USDC" | "USDT"): Chip => ({ kind: "swap", amount, to, label: `Swap${amount ? ` ${amount} NEAR` : ""} to ${to}` });
const convert = (usd: string, near: string): Chip => ({ kind: "convert", usd, near, label: `$${usd} ≈ ${near} NEAR` });
const price = (symbol: string, usd: string): Chip => ({ kind: "price", symbol, usd, label: `${symbol} $${usd}` });

const CHIPS: [string, Chip[], number?][] = [
  ["pay bob.near 5", [payName("bob.near", "5")]],
  ["send alice.testnet 2 near", [payName("alice.testnet", "2")]],
  ["Pay Bob.Near 4", [payName("bob.near", "4")]],
  ["@alice.near 3", [payName("alice.near", "3")]],
  ["pay bob.near", [payName("bob.near", null)]],
  ["pay alice.near 2.5n", [payName("alice.near", "2.5")]],
  ["pay bob.near and carol.testnet 3", [payName("carol.testnet", "3")]],
  ["send 2 to sub.bob.testnet", [payName("sub.bob.testnet", "2")]],
  ["pay bob.near $5 for lunch", [payName("bob.near", "5"), convert("5", "1.47")]],
  ["pay bob.near $5 for lunch", [payName("bob.near", "5")], 1],
  ["i owe you 5 near", [pay("5")]],
  ["i owe you", [pay(null)]],
  ["tip 1.5 near", [pay("1.5")]],
  ["i paid 4 near", [pay("4")]],
  ["split the bill", [pay(null)]],
  ["reimburse me", [pay(null)]],
  ["pay back 6", [pay(null)]],
  ["pay bob.nearby 4", [pay(null)]],
  ["pay 0xabc", [pay(null)]],
  ["swap 10 near to usdt", [swap("10", "USDT")]],
  ["convert 3 to usdc", [swap("3", "USDC")]],
  ["trade 7 near for tether", [swap("7", "USDT")]],
  ["exchange near", [swap(null, "USDC")]],
  ["swap $10 of near", [swap("10", "USDC"), convert("10", "2.95")]],
  ["dinner was $20", [convert("20", "5.9")]],
  ["it cost 12 bucks", [convert("12", "3.54")]],
  ["that's 7.50 dollars", [convert("7.5", "2.21")]],
  ["what's the near price", [price("NEAR", "3.39")]],
  ["price of btc", [price("BTC", "71866")]],
  ["how much is bitcoin worth", [price("BTC", "71866")]],
  ["eth trading at", [price("ETH", "2016")]],
  ["usdc price", [price("USDC", "1.00")]],
  ["sol price", []],
  ["$0 thing", []],
  ["", []],
  ["   ", []],
  ["hello there", []],
  ["see you at 5", []],
];
CHIPS.forEach(([sentence, want, max], i) => {
  test(`chips #${i + 1} for ${show(sentence)}${max === undefined ? "" : ` (max ${max})`}: ${want.map((c) => c.label).join(" | ") || "none"}`, () => {
    assert.deepEqual(max === undefined ? readChips(sentence, PRICES) : readChips(sentence, PRICES, max), want);
  });
});

test("no NEAR price means no dollar conversion chip", () => {
  assert.deepEqual(readChips("dinner was $20", { BTC: 1 }), []);
});
