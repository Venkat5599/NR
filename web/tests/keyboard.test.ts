import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { currentWord, lastSentence, readChips, Suggest, usdOf } from "../src/lib/keyboard/suggest.ts";
import { checkForm, choosePayee, cycleToken, deleteFrom, emptyForm, next, setAmount, typeInto, type PayForm } from "../src/lib/keyboard/pay-form.ts";
import { parsePrices } from "../src/lib/prices.ts";
import { fromUnits, routeFor, swapQuote } from "../src/lib/near/ref-swap.ts";

const words = readFileSync(new URL("../public/words_en.txt", import.meta.url), "utf8").split("\n").filter(Boolean);
const s = new Suggest(words);
const prices = { NEAR: 3.39, BTC: 71866 };

test("the web keyboard ships the same 20,000 words as the phone", () => {
  const phone = readFileSync(new URL("../../android/app/src/main/assets/words_en.txt", import.meta.url), "utf8");
  assert.equal(words.length, 20000);
  assert.equal(readFileSync(new URL("../public/words_en.txt", import.meta.url), "utf8"), phone);
});

test("suggestions complete by frequency and keep a real word first", () => {
  assert.equal(s.words("near")[0], "near");
  const the = s.words("the");
  assert.equal(the[0], "the");
  assert.ok(the.slice(1).every((w) => w.startsWith("the")));
});

test("suggestions fix one slip and put the apostrophe back", () => {
  assert.ok(s.words("becuase").includes("because"));
  assert.ok(s.words("dinnr").includes("dinner"));
  assert.equal(s.words("im")[0], "I'm");
  assert.equal(s.words("Dont")[0], "Don't");
  assert.equal(s.words("Dinn")[0], "Dinner");
});

test("the word and sentence before the cursor", () => {
  assert.equal(currentWord("pay bob for dinn"), "dinn");
  assert.equal(currentWord("pay bob "), "");
  assert.equal(lastSentence("ok. pay bob 2"), "pay bob 2");
});

test("chips read the sentence like the phone", () => {
  assert.deepEqual(readChips("sure, sending to alice.testnet 2.5 now", prices)[0], { kind: "pay-name", name: "alice.testnet", amount: "2.5", label: "Pay alice.testnet 2.5" });
  assert.deepEqual(readChips("i owe you for lunch", prices), [{ kind: "pay", amount: null, label: "Pay" }]);
  assert.deepEqual(readChips("it was $20 each", prices), [{ kind: "convert", usd: "20", near: "5.9", label: "$20 ≈ 5.9 NEAR" }]);
  assert.deepEqual(readChips("it was $20 each", {}), []);
  assert.deepEqual(readChips("can you swap 2 near to usdt", prices), [{ kind: "swap", amount: "2", to: "USDT", label: "Swap 2 NEAR to USDT" }]);
  assert.deepEqual(readChips("what's the btc price today", prices), [{ kind: "price", symbol: "BTC", usd: "71866", label: "BTC $71866" }]);
  assert.deepEqual(readChips("see you at 8, near the station", prices), []);
});

test("dollar values", () => {
  assert.equal(usdOf("2", "NEAR", { NEAR: 3.39 }), "$6.78");
  assert.equal(usdOf("0.1", "near", { NEAR: 3.39 }), "$0.339");
  assert.equal(usdOf("2", "XYZ", { NEAR: 3.39 }), null);
});

const typeAll = (f: PayForm, text: string) => [...text].reduce(typeInto, f);

test("the pay form: name, amount, memo make a payment", () => {
  const f = typeAll(emptyForm(), "Bob.Testnet 0.5 dinner out");
  assert.deepEqual(checkForm(f), { ok: true, payee: "bob.testnet", amount: "0.5", token: "NEAR", memo: "dinner out" });
});

test("the pay form keeps only what fits each field and steps back on delete", () => {
  let f = typeAll(emptyForm(), "@al!ce.test#net ");
  assert.equal(f.to, "alce.testnet");
  f = typeAll(f, "1a,2,5");
  assert.equal(f.amount, "1.25");
  f = typeInto(typeInto(f, "USDC"), "NEAR");
  assert.equal(f.token, "NEAR");
  f = deleteFrom(deleteFrom(deleteFrom(deleteFrom(deleteFrom(f)))));
  assert.equal(f.active, "to");
});

test("the pay form refuses a bare first name and a missing amount, naming the field", () => {
  assert.deepEqual(checkForm(typeAll(emptyForm(), "bob 5")), { ok: false, field: "to", message: "Type the full name, e.g. bob.testnet" });
  assert.equal((checkForm(typeAll(emptyForm(), "bob.testnet ")) as { field: string }).field, "amount");
  assert.deepEqual(checkForm(emptyForm()), { ok: false, field: "to", message: "Who are you paying?" });
});

test("the pay form: chips fill it, enter walks it, the currency cycles", () => {
  const f = choosePayee(setAmount(emptyForm(), "5.90"), "lunar-69787.testnet");
  assert.equal(f.amount, "5.9");
  assert.equal(f.active, "memo");
  assert.equal(next(emptyForm()).review, false);
  assert.equal(next({ ...emptyForm(), active: "memo" }).review, true);
  assert.equal(cycleToken(emptyForm()).token, "USDC");
});

test("prices come from the recorded Intents token list, one per symbol", () => {
  const t = parsePrices(JSON.parse(readFileSync(new URL("./fixtures/oneclick-tokens.json", import.meta.url), "utf8")));
  for (const sym of ["NEAR", "USDC", "USDT", "ETH", "BTC", "SOL"]) assert.ok((t.prices[sym] ?? 0) > 0, sym);
  assert.ok((t.prices["USDC"] ?? 0) > 0.9 && (t.prices["USDC"] ?? 0) < 1.1);
});

test("swap quotes read the Ref pool's u128 answer", async () => {
  assert.equal(fromUnits(2101762687040973554229815n, 24), "2.1017");
  assert.equal(fromUnits(0n, 24), "0");
  assert.equal(routeFor("usdt").pool, 1084);
  const seen: unknown[] = [];
  const q = await swapQuote("1", "USDC", async (contract, method, args) => {
    seen.push([contract, method, args]);
    return "2101762687040973554229815";
  });
  assert.equal(q.out, "2.1017");
  assert.deepEqual(seen[0], ["ref-finance-101.testnet", "get_return", { pool_id: 1103, token_in: "wrap.testnet", amount_in: "1000000000000000000000000", token_out: "usdc.itachicara.testnet" }]);
});
