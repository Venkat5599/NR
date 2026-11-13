import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { interpretModelReply, isFullAccount, MAX_SENTENCE, modelJson, readSentence, typedInSentence, type ParseOutcome } from "../src/lib/ai/parse-rules.ts";
import { cardFacts, daysText, type CardFacts } from "../src/lib/demo/card.ts";
import { LunarError, type ErrorCode } from "../src/lib/errors.ts";
import type { NameCheck } from "../src/lib/name-check/check.ts";
import { nearToYocto, ONE_NEAR_YOCTO, roundNear, yoctoToNear } from "../src/lib/near/amount.ts";
import { pocketFrom } from "../src/lib/near/lunar-pay.ts";
import { explorerTx, networkOf, type Network } from "../src/lib/near/name.ts";
import { fromUnits, readU128, REF, routeFor, ROUTES, swapQuote, WRAP } from "../src/lib/near/ref-swap.ts";
import { normalizeAmount } from "../src/lib/pay/parser.ts";
import { checkPaste, extractAddress, looksLike, shortAddress, type Payee } from "../src/lib/pay/paste-check.ts";
import { parsePrices } from "../src/lib/prices.ts";
import { createRateLimiter } from "../src/lib/rate-limit.ts";

const show = (x: unknown) => JSON.stringify(x);

function codeOf(fn: () => unknown): ErrorCode | "none" {
  try {
    fn();
  } catch (error) {
    if (error instanceof LunarError) return error.code;
    throw error;
  }
  return "none";
}

// ---------------------------------------------------------------- AI answer rules

const FULL: [string, boolean][] = [
  ["bob.near", true],
  ["alice.testnet", true],
  ["a.b", true],
  ["sub.bob.testnet", true],
  ["lunar-69787.testnet", true],
  ["ab".repeat(32), true],
  [`0x${"ab".repeat(20)}`, true],
  ["bob", false],
  ["near", false],
  ["testnet", false],
  ["alice", false],
  ["bob_smith", false],
  ["bob-2", false],
  [`0x${"a".repeat(39)}`, false],
  [`0x${"a".repeat(41)}`, false],
  ["AB".repeat(32), false],
  [`0x${"AB".repeat(20)}`, false],
  ["a".repeat(63), false],
];
for (const [payee, want] of FULL) {
  test(`${show(payee)} ${want ? "is" : "is not"} a full account`, () => {
    assert.equal(isFullAccount(payee), want);
  });
}

const TYPED: [string, string, boolean][] = [
  ["bob.near", "pay bob.near 5", true],
  ["bob.near", "pay @bob.near 5", true],
  ["bob.near", "pay Bob.Near 5", true],
  ["bob.near", "bob.near", true],
  ["bob.near", "send 2 to bob.near.", true],
  ["bob.near", "send 2 to bob.near...", true],
  ["bob.near", "send 2 to bob.near, thanks", true],
  ["bob.near", "(bob.near) 5", true],
  ["bob.near", "pay bob.near!", true],
  ["bob.near", "pay\tbob.near 5", true],
  ["bob.near", "pay bob.nearby 5", false],
  ["bob.near", "pay xbob.near 5", false],
  ["bob.near", "pay sub.bob.near 5", false],
  ["bob.near", "pay bob.near.x 5", false],
  ["bob.near", "pay bob.near-2 5", false],
  ["bob.near", "pay bob_near 5", false],
  ["bob.near", "pay bob 5", false],
  ["bob.near", "pay bobxnear 5", false],
  ["bob.near", "pay bob\\.near 5", false],
  ["bob.near", "", false],
  ["alice.testnet", "send alice.testnet 1 for lunch.", true],
  ["alice.testnet", "send alice 1", false],
  ["a-b.near", "pay a-b.near 1", true],
  ["a-b.near", "pay a.near 1", false],
];
for (const [payee, sentence, want] of TYPED) {
  test(`${show(payee)} ${want ? "was" : "was not"} typed in ${show(sentence)}`, () => {
    assert.equal(typedInSentence(payee, sentence), want);
  });
}

const okPay = (payee: string, amount: string, token: "NEAR" | "USDC" | "USDT", memo: string | null): ParseOutcome => ({ isPayment: true, payee, amount, token, memo });
const notPay = (reason: string): ParseOutcome => ({ isPayment: false, reason });
const FULL_NAME = notPay("type the full NEAR name, e.g. bob.testnet");
const NO_AMOUNT = notPay("no amount in the sentence");
const base = { isPayment: true, payee: "bob.near", amount: "5", token: "NEAR", memo: null };
const SENT = "pay bob.near 5 for dinner";

const REPLIES: [string, Record<string, unknown>, string, ParseOutcome][] = [
  ["a full reply", { ...base, memo: "dinner" }, SENT, okPay("bob.near", "5", "NEAR", "dinner")],
  ["payee with @ and capitals", { ...base, payee: "@Bob.Near" }, "pay @bob.near 5", okPay("bob.near", "5", "NEAR", null)],
  ["payee with spaces around", { ...base, payee: "  bob.near " }, SENT, okPay("bob.near", "5", "NEAR", null)],
  ["a bare first name", { ...base, payee: "bob" }, "pay bob 5", FULL_NAME],
  ["a name the user did not type", { ...base, payee: "bob.near" }, "pay bob 5", FULL_NAME],
  ["a completed name", { ...base, payee: "bob.near" }, "pay bob.ne 5", FULL_NAME],
  ["an invalid name", { ...base, payee: "Bob..near" }, "pay bob..near 5", notPay("no valid NEAR name in the sentence")],
  ["no payee", { ...base, payee: undefined }, SENT, notPay("no valid NEAR name in the sentence")],
  ["a numeric payee", { ...base, payee: 42 }, SENT, notPay("no valid NEAR name in the sentence")],
  ["a sentence ending in a full stop", { ...base, payee: "alice.testnet", amount: "2" }, "send 2 to alice.testnet.", okPay("alice.testnet", "2", "NEAR", null)],
  ["an implicit payee", { ...base, payee: "cd".repeat(32) }, `pay ${"cd".repeat(32)} 5`, okPay("cd".repeat(32), "5", "NEAR", null)],
  ["an eth implicit payee", { ...base, payee: `0x${"cd".repeat(20)}` }, `pay 0x${"cd".repeat(20)} 5`, okPay(`0x${"cd".repeat(20)}`, "5", "NEAR", null)],
  ["a number amount", { ...base, amount: 5 }, SENT, okPay("bob.near", "5", "NEAR", null)],
  ["a fractional number amount", { ...base, amount: 0.5 }, SENT, okPay("bob.near", "0.5", "NEAR", null)],
  ["a comma amount", { ...base, amount: "1,5" }, SENT, okPay("bob.near", "1.5", "NEAR", null)],
  ["trailing zeros", { ...base, amount: "5.000" }, SENT, okPay("bob.near", "5", "NEAR", null)],
  ["leading zeros", { ...base, amount: "007" }, SENT, okPay("bob.near", "7", "NEAR", null)],
  ["24 decimals", { ...base, amount: `0.${"0".repeat(23)}1` }, SENT, okPay("bob.near", `0.${"0".repeat(23)}1`, "NEAR", null)],
  ["25 decimals", { ...base, amount: `0.${"0".repeat(24)}1` }, SENT, NO_AMOUNT],
  ["zero", { ...base, amount: "0" }, SENT, NO_AMOUNT],
  ["zero point zero", { ...base, amount: "0.00" }, SENT, NO_AMOUNT],
  ["a negative", { ...base, amount: "-1" }, SENT, NO_AMOUNT],
  ["a negative number", { ...base, amount: -1 }, SENT, NO_AMOUNT],
  ["an exponent", { ...base, amount: "1e3" }, SENT, NO_AMOUNT],
  ["a huge number", { ...base, amount: 1e21 }, SENT, NO_AMOUNT],
  ["ten whole digits", { ...base, amount: "1234567890" }, SENT, NO_AMOUNT],
  ["an empty amount", { ...base, amount: "" }, SENT, NO_AMOUNT],
  ["a null amount", { ...base, amount: null }, SENT, NO_AMOUNT],
  ["a word amount", { ...base, amount: "five" }, SENT, NO_AMOUNT],
  ["NaN", { ...base, amount: Number.NaN }, SENT, NO_AMOUNT],
  ["usd token", { ...base, token: "usd" }, SENT, okPay("bob.near", "5", "USDC", null)],
  ["usdc token", { ...base, token: "USDC" }, SENT, okPay("bob.near", "5", "USDC", null)],
  ["usdt token", { ...base, token: "usdt" }, SENT, okPay("bob.near", "5", "USDT", null)],
  ["mixed case near", { ...base, token: "Near" }, SENT, okPay("bob.near", "5", "NEAR", null)],
  ["no token", { ...base, token: undefined }, SENT, okPay("bob.near", "5", "NEAR", null)],
  ["an empty token", { ...base, token: "" }, SENT, okPay("bob.near", "5", "NEAR", null)],
  ["an unknown token", { ...base, token: "btc" }, SENT, notPay("unknown token")],
  ["a blank memo", { ...base, memo: "   " }, SENT, okPay("bob.near", "5", "NEAR", null)],
  ["a padded memo", { ...base, memo: "  rent  " }, SENT, okPay("bob.near", "5", "NEAR", "rent")],
  ["a long memo", { ...base, memo: "m".repeat(100) }, SENT, okPay("bob.near", "5", "NEAR", "m".repeat(80))],
  ["a numeric memo", { ...base, memo: 5 }, SENT, okPay("bob.near", "5", "NEAR", null)],
  ["not a payment with a reason", { isPayment: false, reason: "chit chat" }, "hi", notPay("chit chat")],
  ["not a payment without a reason", { isPayment: false }, "hi", notPay("not a payment")],
  ["not a payment with an empty reason", { isPayment: false, reason: "" }, "hi", notPay("not a payment")],
  ["a long reason", { isPayment: false, reason: "r".repeat(200) }, "hi", notPay("r".repeat(160))],
  ["isPayment as a string", { ...base, isPayment: "true" }, SENT, notPay("not a payment")],
  ["isPayment missing", { payee: "bob.near", amount: "5" }, SENT, notPay("not a payment")],
];
for (const [what, reply, sentence, want] of REPLIES) {
  test(`model reply: ${what}`, () => {
    assert.deepEqual(interpretModelReply(reply, sentence), want);
  });
}

for (const reply of [null, "yes", 5, [1, 2], true]) {
  test(`model reply ${show(reply)} is an upstream error`, () => {
    assert.equal(codeOf(() => interpretModelReply(reply, SENT)), "upstream");
  });
}

const JSONS: [string, unknown][] = [
  ['{"isPayment":false}', { isPayment: false }],
  ['  {"a":1}  ', { a: 1 }],
  ['Sure! {"a":1} hope that helps', { a: 1 }],
  ['```json\n{"a":{"b":2}}\n```', { a: { b: 2 } }],
  ['answer: {"x":"}"}', { x: "}" }],
];
for (const [content, want] of JSONS) {
  test(`model JSON is read from ${show(content)}`, () => {
    assert.deepEqual(modelJson(content), want);
  });
}

for (const content of ["", "no json here", "} backwards {", "{not json", "text {bad} text"]) {
  test(`model text ${show(content)} is an upstream error`, () => {
    assert.equal(codeOf(() => modelJson(content)), "upstream");
  });
}

const SENTENCES: [unknown, string | null][] = [
  [{ sentence: " pay bob.near 5 " }, "pay bob.near 5"],
  [{ sentence: "x".repeat(MAX_SENTENCE) }, "x".repeat(MAX_SENTENCE)],
  [{ sentence: ` ${"x".repeat(MAX_SENTENCE)} ` }, "x".repeat(MAX_SENTENCE)],
  [{ sentence: "x".repeat(MAX_SENTENCE + 1) }, null],
  [{ sentence: "" }, null],
  [{ sentence: "   " }, null],
  [{ sentence: 5 }, null],
  [{}, null],
  [null, null],
  [["pay bob.near 5"], null],
  ["pay bob.near 5", null],
];
for (const [body, want] of SENTENCES) {
  test(`request body ${show(body)?.slice(0, 40)} → ${want === null ? "bad_input" : "accepted"}`, () => {
    if (want === null) assert.equal(codeOf(() => readSentence(body)), "bad_input");
    else assert.equal(readSentence(body), want);
  });
}

const NORMALIZE: [string, string][] = [
  ["012.50", "12.5"],
  ["1,5", "1.5"],
  ["5", "5"],
  ["5.0", "5"],
  ["0.10", "0.1"],
  ["000", "0"],
  ["100", "100"],
  ["0.000001", "0.000001"],
];
for (const [raw, want] of NORMALIZE) {
  test(`amount ${show(raw)} normalizes to ${show(want)}`, () => {
    assert.equal(normalizeAmount(raw), want);
  });
}

// ---------------------------------------------------------------- NEAR amounts and names

const ROUND: [string, number, string][] = [
  ["1.23456", 2, "1.23"],
  ["1.20001", 2, "1.2"],
  ["1.001", 2, "1"],
  ["5", 3, "5"],
  ["0.999", 0, "0"],
  ["12.5", 4, "12.5"],
  ["0.000000000000000000000001", 4, "0"],
  ["3.999999", 5, "3.99999"],
  ["-1.55", 1, "-1.5"],
];
for (const [near, places, want] of ROUND) {
  test(`${near} NEAR rounded down to ${places} places is ${want}`, () => {
    assert.equal(roundNear(near, places), want);
  });
}

const YOCTO_BACK: [bigint | string, string][] = [
  [0n, "0"],
  ["0", "0"],
  [1n, "0.000000000000000000000001"],
  [-1n, "-0.000000000000000000000001"],
  [-ONE_NEAR_YOCTO, "-1"],
  ["1500000000000000000000000", "1.5"],
  [ONE_NEAR_YOCTO * 1000n, "1000"],
  [ONE_NEAR_YOCTO + 1n, "1.000000000000000000000001"],
  [10n ** 40n, "10000000000000000"],
];
for (const [yocto, want] of YOCTO_BACK) {
  test(`${yocto} yocto reads as ${want} NEAR`, () => {
    assert.equal(yoctoToNear(yocto), want);
  });
}

for (const padded of [" 1 ", "\t2.5\n", "  0.05"]) {
  test(`an amount with surrounding space ${show(padded)} is read`, () => {
    assert.equal(yoctoToNear(nearToYocto(padded)), normalizeAmount(padded.trim()));
  });
}

const NETWORKS: [string, Network][] = [
  ["bob.testnet", "testnet"],
  ["a.b.testnet", "testnet"],
  ["lunar-69787.testnet", "testnet"],
  ["bob.near", "mainnet"],
  ["testnet", "mainnet"],
  ["bob.testnet.near", "mainnet"],
  ["bobtestnet", "mainnet"],
  ["ab".repeat(32), "mainnet"],
  [`0x${"ab".repeat(20)}`, "mainnet"],
];
for (const [id, network] of NETWORKS) {
  test(`${id} lives on ${network}`, () => {
    assert.equal(networkOf(id), network);
  });
}

test("explorer links point at the network's explorer", () => {
  assert.equal(explorerTx("abc"), "https://testnet.nearblocks.io/txns/abc");
  assert.equal(explorerTx("abc", "testnet"), "https://testnet.nearblocks.io/txns/abc");
  assert.equal(explorerTx("abc", "mainnet"), "https://nearblocks.io/txns/abc");
});

// ---------------------------------------------------------------- swap

const UNITS: [bigint, number, string][] = [
  [0n, 24, "0"],
  [1n, 0, "1"],
  [ONE_NEAR_YOCTO, 24, "1"],
  [15n * 10n ** 23n, 24, "1.5"],
  [123456n, 6, "0.1234"],
  [1n, 6, "0"],
  [100n, 2, "1"],
  [12345n, 2, "123.45"],
  [999999n, 6, "0.9999"],
  [5n, 1, "0.5"],
  [10n ** 30n, 24, "1000000"],
  [12000n, 4, "1.2"],
  [2_500_000n, 6, "2.5"],
  [1n, 4, "0.0001"],
  [9n, 5, "0"],
];
for (const [raw, decimals, want] of UNITS) {
  test(`${raw} units at ${decimals} decimals read as ${want}`, () => {
    assert.equal(fromUnits(raw, decimals), want);
  });
}

for (const [symbol, pool] of [["USDC", 1103], ["usdc", 1103], ["USDT", 1084], ["Usdt", 1084]] as const) {
  test(`swaps to ${symbol} go through pool ${pool}`, () => {
    assert.equal(routeFor(symbol).pool, pool);
  });
}

for (const symbol of ["NEAR", "ETH", "", "usd"]) {
  test(`no swap route to ${show(symbol)}`, () => {
    assert.equal(codeOf(() => routeFor(symbol)), "bad_input");
  });
}

const U128_OK: [string, bigint][] = [
  ["0", 0n],
  ["1", 1n],
  ["340282366920938463463374607431768211455", 2n ** 128n - 1n],
];
for (const [raw, want] of U128_OK) {
  test(`pool value ${raw} reads as a u128`, () => {
    assert.equal(readU128(raw), want);
  });
}

for (const raw of ["-1", "1.5", "", " 1", "0x10", 5, null, undefined]) {
  test(`pool value ${show(raw) ?? "undefined"} is refused`, () => {
    assert.equal(codeOf(() => readU128(raw)), "chain");
  });
}

for (const route of ROUTES) {
  test(`a ${route.symbol} quote asks Ref for get_return on pool ${route.pool}`, async () => {
    const calls: unknown[][] = [];
    const view = async (contract: string, method: string, args: unknown): Promise<unknown> => {
      calls.push([contract, method, args]);
      return "2500000000000000000000000";
    };
    const q = await swapQuote("1.5", route.symbol, view);
    assert.deepEqual(q, { out: "2.5", route });
    assert.deepEqual(calls, [[REF, "get_return", { pool_id: route.pool, token_in: WRAP, amount_in: "1500000000000000000000000", token_out: route.token }]]);
  });
}

test("a quote with a malformed pool answer is a chain error", async () => {
  await assert.rejects(swapQuote("1", "USDC", async () => 12), (e: unknown) => e instanceof LunarError && e.code === "chain");
});

test("a quote to an unknown token never calls the pool", async () => {
  let called = false;
  const view = async (): Promise<unknown> => {
    called = true;
    return "1";
  };
  await assert.rejects(swapQuote("1", "ETH", view), (e: unknown) => e instanceof LunarError && e.code === "bad_input");
  assert.equal(called, false);
});

test("a quote for a malformed amount never calls the pool", async () => {
  let called = false;
  const view = async (): Promise<unknown> => {
    called = true;
    return "1";
  };
  await assert.rejects(swapQuote("1e3", "USDC", view), (e: unknown) => e instanceof LunarError && e.code === "bad_input");
  assert.equal(called, false);
});

// ---------------------------------------------------------------- prices

const tokens: unknown = JSON.parse(readFileSync(new URL("./fixtures/oneclick-tokens.json", import.meta.url), "utf8"));
const table = parsePrices(tokens);

const FIXTURE_PRICES: [string, number][] = [
  ["NEAR", 3.4],
  ["USDC", 0.999586],
  ["USDT", 0.999181],
  ["ETH", 2016.34],
  ["BTC", 71843],
  ["SOL", 81.67],
];
for (const [symbol, price] of FIXTURE_PRICES) {
  test(`the captured token list prices ${symbol} at ${price}`, () => {
    assert.equal(table.prices[symbol], price);
  });
}

test("the captured token list gives exactly the six wanted symbols and its update time", () => {
  assert.deepEqual(Object.keys(table.prices).sort(), ["BTC", "ETH", "NEAR", "SOL", "USDC", "USDT"]);
  assert.equal(table.updatedAt, "2026-11-12T17:56:31.253Z");
});

const row = (symbol: string, blockchain: string, price: unknown, priceUpdatedAt?: string) => ({ symbol, blockchain, price, ...(priceUpdatedAt ? { priceUpdatedAt } : {}) });

const PRICE_CASES: [string, unknown[], Record<string, number>, string | null][] = [
  ["a non-native listing is used when there is no native one", [row("ETH", "eth", 2000)], { ETH: 2000 }, null],
  ["the NEAR-native listing wins even when listed later", [row("USDC", "base", 0.9), row("USDC", "near", 1)], { USDC: 1 }, null],
  ["the first native listing wins", [row("USDC", "near", 1), row("USDC", "near", 0.5)], { USDC: 1 }, null],
  ["a string price is read", [row("BTC", "btc", "70000.5")], { BTC: 70000.5 }, null],
  ["a non-numeric price is skipped", [row("BTC", "btc", "abc")], {}, null],
  ["a zero price is skipped", [row("BTC", "btc", 0)], {}, null],
  ["a negative price is skipped", [row("BTC", "btc", -5)], {}, null],
  ["an infinite price is skipped", [row("BTC", "btc", Number.POSITIVE_INFINITY)], {}, null],
  ["a skipped native price falls back to another chain", [row("USDC", "near", 0), row("USDC", "base", 0.99)], { USDC: 0.99 }, null],
  ["wNEAR is NEAR", [row("wNEAR", "near", 3)], { NEAR: 3 }, null],
  ["a token called NEAR is not wNEAR", [row("NEAR", "near", 3)], {}, null],
  ["unknown symbols are ignored", [row("DOGE", "doge", 0.1)], {}, null],
  ["symbols are case sensitive", [row("usdc", "near", 1)], {}, null],
  ["a symbol named like an object method is ignored", [row("toString", "near", 1), row("constructor", "near", 2), row("__proto__", "near", 3)], {}, null],
  ["rows that are not objects are skipped", [null, 5, "x", row("BTC", "btc", 1)], { BTC: 1 }, null],
  ["an empty list has no prices", [], {}, null],
  ["the latest update time of a used row is kept", [row("BTC", "btc", 1, "2026-01-01T00:00:00Z"), row("ETH", "eth", 2, "2026-02-01T00:00:00Z")], { BTC: 1, ETH: 2 }, "2026-02-01T00:00:00Z"],
  ["a skipped row's update time is not kept", [row("BTC", "btc", 1, "2026-01-01T00:00:00Z"), row("ETH", "eth", 0, "2027-01-01T00:00:00Z")], { BTC: 1 }, "2026-01-01T00:00:00Z"],
];
for (const [what, rows, prices, updatedAt] of PRICE_CASES) {
  test(`prices: ${what}`, () => {
    assert.deepEqual(parsePrices(rows), { prices, updatedAt });
  });
}

for (const notList of [null, {}, "tokens", 5]) {
  test(`a token list of ${show(notList)} is an upstream error`, () => {
    assert.equal(codeOf(() => parsePrices(notList)), "upstream");
  });
}

// ---------------------------------------------------------------- rate limit

function clock(start = 0): { now: () => number; advance: (ms: number) => void } {
  let t = start;
  return { now: () => t, advance: (ms) => void (t += ms) };
}

for (let capacity = 1; capacity <= 10; capacity++) {
  test(`a bucket of ${capacity} allows ${capacity} at once, then refuses`, () => {
    const c = clock();
    const limit = createRateLimiter(capacity, 1000, c.now);
    const takes = Array.from({ length: capacity + 2 }, () => limit.take("ip"));
    assert.deepEqual(takes, [...Array<boolean>(capacity).fill(true), false, false]);
  });
  test(`a drained bucket of ${capacity} refills one token per interval, up to ${capacity}`, () => {
    const c = clock(5_000);
    const limit = createRateLimiter(capacity, 1000, c.now);
    for (let i = 0; i < capacity; i++) assert.equal(limit.take("ip"), true);
    c.advance(999);
    assert.equal(limit.take("ip"), false, "not yet a whole token");
    c.advance(1);
    assert.equal(limit.take("ip"), true, "one token after the interval");
    assert.equal(limit.take("ip"), false);
    c.advance(1000 * (capacity + 5));
    const burst = Array.from({ length: capacity + 1 }, () => limit.take("ip"));
    assert.equal(burst.filter(Boolean).length, capacity, "never more than the capacity");
  });
}

test("each key has its own bucket", () => {
  const c = clock();
  const limit = createRateLimiter(1, 1000, c.now);
  assert.deepEqual(["a", "b", "a", "b", "c"].map((k) => limit.take(k)), [true, true, false, false, true]);
});

test("refused takes do not push the refill back", () => {
  const c = clock();
  const limit = createRateLimiter(1, 1000, c.now);
  assert.equal(limit.take("ip"), true);
  for (let i = 0; i < 9; i++) {
    c.advance(100);
    assert.equal(limit.take("ip"), false);
  }
  c.advance(100);
  assert.equal(limit.take("ip"), true);
});

// ---------------------------------------------------------------- pay card

const DAYS: [number, string][] = [
  [-3, "today"],
  [0, "today"],
  [1, "yesterday"],
  [2, "2 days ago"],
  [30, "30 days ago"],
];
for (const [n, want] of DAYS) {
  test(`${n} days reads "${want}"`, () => {
    assert.equal(daysText(n), want);
  });
}

const DEMO = "lunar-demo.lunar-69787.testnet";
const pocket = pocketFrom(DEMO, { balance: "3000000000000000000000000", daily_cap: "500000000000000000000000", spent_today: "0", left_today: "500000000000000000000000" });
const check = (patch: Partial<NameCheck>): NameCheck => ({
  account: "bob.testnet",
  network: "testnet",
  exists: true,
  keys: { kind: "settled", ageDays: 400 },
  receive: null,
  quote: { kind: "none" },
  ...patch,
});

const CARDS: [string, string, string, NameCheck, boolean, string, CardFacts][] = [
  ["a settled account", "bob.testnet", "0.1", check({}), true, DEMO, { lines: ["bob.testnet · 400 days old", "0.4 NEAR left today after this"], tone: "ok", canPay: true, overCap: false }],
  ["a new owner key yesterday", "bob.testnet", "0.1", check({ keys: { kind: "key-changed", daysAgo: 1, ageDays: 300 } }), true, DEMO, { lines: ["bob.testnet got a new owner key yesterday", "0.4 NEAR left today after this"], tone: "warn", canPay: true, overCap: false }],
  ["an account made 3 days ago", "bob.testnet", "0.1", check({ keys: { kind: "new-account", ageDays: 3 } }), true, DEMO, { lines: ["bob.testnet was created 3 days ago", "0.4 NEAR left today after this"], tone: "warn", canPay: true, overCap: false }],
  ["unknown key history", "bob.testnet", "0.1", check({ keys: { kind: "unknown", reason: "no key data" } }), true, DEMO, { lines: ["bob.testnet · exists", "0.4 NEAR left today after this"], tone: "ok", canPay: true, overCap: false }],
  ["exactly the cap", "bob.testnet", "0.5", check({}), true, DEMO, { lines: ["bob.testnet · 400 days old", "0 NEAR left today after this"], tone: "ok", canPay: true, overCap: false }],
  ["one yocto over the cap", "bob.testnet", "0.500000000000000000000001", check({}), true, DEMO, { lines: ["bob.testnet · 400 days old", "Over today's cap (0.5 NEAR left) · the contract will refuse"], tone: "warn", canPay: true, overCap: true }],
  ["no pocket read", "bob.testnet", "0.1", check({}), false, DEMO, { lines: ["bob.testnet · 400 days old"], tone: "ok", canPay: true, overCap: false }],
  ["paying the demo account itself", DEMO, "0.1", check({ account: DEMO }), true, DEMO, { lines: ["That's the demo account itself", `${DEMO} · 400 days old`], tone: "warn", canPay: false, overCap: false }],
  ["a missing account", "nobody.testnet", "0.1", check({ exists: false }), true, DEMO, { lines: ["No account called nobody.testnet"], tone: "warn", canPay: false, overCap: false }],
  ["an unavailable quote", "bob.testnet", "0.1", check({ quote: { kind: "unavailable", reason: "down" } }), false, DEMO, { lines: ["bob.testnet · 400 days old"], tone: "ok", canPay: true, overCap: false }],
  ["a live quote", "bob.testnet", "0.1", check({ quote: { kind: "quote", quote: { amountOut: "0.33", token: "USDC", chain: "base", seconds: 20 }, chainLabel: "Base" } }), false, DEMO, { lines: ["bob.testnet · 400 days old", "On mainnet: ≈ 0.33 USDC on Base (live Intents quote)"], tone: "ok", canPay: true, overCap: false }],
];
for (const [what, payee, amount, c, withPocket, payer, want] of CARDS) {
  test(`pay card: ${what}`, () => {
    assert.deepEqual(cardFacts(payee, amount, c, withPocket ? pocket : null, payer), want);
  });
}

// ---------------------------------------------------------------- pasted addresses

const A = `0x9f3a${"1".repeat(32)}b21c`;
const LOOK = `0x9f3a${"2".repeat(32)}b21c`;
const OTHER = `0x${"7".repeat(40)}`;
const BOB: Payee = { name: "bob", address: A };
const payees: readonly Payee[] = [BOB, { name: "eve", address: OTHER }];

const EXTRACT: [string | null, string | null][] = [
  [A, A],
  [`  ${A}  `, A],
  [`send to ${A} pls`, A],
  [A.toUpperCase().replace("0X", "0x"), A.toUpperCase().replace("0X", "0x")],
  [`${A} ${OTHER}`, null],
  ["", null],
  ["   ", null],
  [null, null],
  ["0x123", null],
  [`${"x".repeat(100)} ${A}`, null],
  ["bob.near", null],
  [`0X${A.slice(2)}`, null],
];
for (const [clip, want] of EXTRACT) {
  test(`pasting ${show(clip)?.slice(0, 50) ?? "null"} gives ${want ? "an address" : "no address"}`, () => {
    assert.equal(extractAddress(clip), want);
  });
}

const LOOKS: [string, string, boolean][] = [
  [A, LOOK, true],
  [LOOK, A, true],
  [A, A, false],
  [A, OTHER, false],
  [A, `0x9f3b${"1".repeat(32)}b21c`, false],
  [A, `0x9f3a${"1".repeat(32)}b21d`, false],
  [A, `0x9f3a${"1".repeat(31)}b21c`, false],
  ["0x12341234", "0x12341234", false],
  ["0x1234aa1234", "0x1234bb1234", true],
  ["0x1234a234", "0x1234b234", false],
];
for (const [a, b, want] of LOOKS) {
  test(`${a.slice(0, 10)}… ${want ? "looks like" : "does not look like"} ${b.slice(0, 10)}…`, () => {
    assert.equal(looksLike(a, b), want);
  });
}

test("a pasted saved address is known", () => {
  assert.deepEqual(checkPaste(A, payees), { kind: "known", payee: BOB });
});

test("a pasted saved address in capitals is still known", () => {
  assert.deepEqual(checkPaste(A.toUpperCase().replace("0X", "0x"), payees), { kind: "known", payee: BOB });
});

test("a pasted lookalike of a saved address is flagged", () => {
  assert.deepEqual(checkPaste(`pay ${LOOK}`, payees), { kind: "lookalike", pasted: LOOK, payee: BOB });
});

test("a pasted new address is new", () => {
  const fresh = `0x${"5".repeat(40)}`;
  assert.deepEqual(checkPaste(fresh, payees), { kind: "new", address: fresh });
});

test("a lookalike with no saved payees is just new", () => {
  assert.deepEqual(checkPaste(LOOK, []), { kind: "new", address: LOOK });
});

for (const clip of ["hello", "", null, `${A}${A}`]) {
  test(`pasting ${show(clip)?.slice(0, 20) ?? "null"} is not an address`, () => {
    assert.deepEqual(checkPaste(clip, payees), { kind: "not-an-address" });
  });
}

const SHORT: [string, string][] = [
  [A, "0x9f3a…b21c"],
  ["0x1234", "0x1234"],
  ["0x1234567890", "0x1234567890"],
  ["0x12345678901", "0x1234…8901"],
];
for (const [address, want] of SHORT) {
  test(`${address} is shown as ${want}`, () => {
    assert.equal(shortAddress(address), want);
  });
}
