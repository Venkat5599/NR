import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LunarError } from "../src/lib/errors.ts";
import { isRecord, parseJson } from "../src/lib/json.ts";
import { Suggest } from "../src/lib/keyboard/suggest.ts";
import { nearToYocto, yoctoToNear } from "../src/lib/near/amount.ts";
import { isValidNearName } from "../src/lib/near/name.ts";
import { parsePay, type PayIntent } from "../src/lib/pay/parser.ts";

/** The cases the phone app's tests run too (~/lunar/shared-fixtures/README.md). */

type AmountCase = { near: string; yocto: string; plain: string };
type PayCase = { text: string; expect: Omit<PayIntent, "token"> & { token: string } | null };
type TopCase = { typed: string; top: string };
type FixCase = { typed: string; contains: string; edit: string };

function strings(v: unknown, what: string): string[] {
  assert.ok(Array.isArray(v), what);
  return v.map((x) => {
    assert.equal(typeof x, "string", what);
    return String(x);
  });
}

function records(v: unknown, what: string): Record<string, unknown>[] {
  assert.ok(Array.isArray(v), what);
  return v.map((x) => {
    assert.ok(isRecord(x), what);
    return x;
  });
}

function str(r: Record<string, unknown>, k: string): string {
  const v = r[k];
  assert.equal(typeof v, "string", k);
  return String(v);
}

const raw = parseJson(readFileSync(new URL("../../shared-fixtures/cases.json", import.meta.url), "utf8"), "shared cases");
assert.ok(isRecord(raw) && raw["version"] === 1);
const names = raw["names"];
const amounts = raw["amounts"];
const suggest = raw["suggest"];
assert.ok(isRecord(names) && isRecord(amounts) && isRecord(suggest));

const validNames = strings(names["valid"], "names.valid");
const invalidNames = strings(names["invalid"], "names.invalid");
const validAmounts: AmountCase[] = records(amounts["valid"], "amounts.valid").map((r) => ({ near: str(r, "near"), yocto: str(r, "yocto"), plain: str(r, "plain") }));
const invalidAmounts = strings(amounts["invalid"], "amounts.invalid");
const payCases: PayCase[] = records(raw["pay"], "pay").map((r) => {
  const e = r["expect"];
  if (e === null) return { text: str(r, "text"), expect: null };
  assert.ok(isRecord(e));
  const memo = e["memo"];
  const span = e["span"];
  assert.ok(memo === null || typeof memo === "string");
  assert.equal(typeof span, "number");
  return { text: str(r, "text"), expect: { payee: str(e, "payee"), amount: str(e, "amount"), token: str(e, "token"), memo, span: Number(span) } };
});
const prefixCases: TopCase[] = records(suggest["prefix"], "suggest.prefix").map((r) => ({ typed: str(r, "typed"), top: str(r, "top") }));
const exactCases: TopCase[] = records(suggest["exact"], "suggest.exact").map((r) => ({ typed: str(r, "typed"), top: str(r, "top") }));
const fixCases: FixCase[] = records(suggest["fix"], "suggest.fix").map((r) => ({ typed: str(r, "typed"), contains: str(r, "contains"), edit: str(r, "edit") }));

const words = readFileSync(new URL("../public/words_en.txt", import.meta.url), "utf8").split("\n").filter(Boolean);
const s = new Suggest(words);

const show = (x: string) => JSON.stringify(x);

test("shared cases hold enough of every kind", () => {
  assert.ok(validNames.length >= 200 && invalidNames.length >= 200);
  assert.ok(validAmounts.length >= 80 && invalidAmounts.length >= 20);
  assert.ok(payCases.length >= 150 && payCases.some((c) => c.expect === null));
  assert.ok(prefixCases.length >= 200 && exactCases.length >= 100 && fixCases.length >= 200);
  assert.equal(new Set([...validNames, ...invalidNames]).size, validNames.length + invalidNames.length, "no name is both valid and invalid");
});

for (const id of validNames) {
  test(`name is valid: ${show(id)}`, () => {
    assert.equal(isValidNearName(id), true);
  });
}

for (const id of invalidNames) {
  test(`name is invalid: ${show(id)}`, () => {
    assert.equal(isValidNearName(id), false);
  });
}

for (const c of validAmounts) {
  test(`amount ${c.near} NEAR is ${c.yocto} yocto and reads back as ${c.plain}`, () => {
    assert.equal(nearToYocto(c.near), BigInt(c.yocto));
    assert.equal(yoctoToNear(BigInt(c.yocto)), c.plain);
    assert.equal(nearToYocto(yoctoToNear(c.yocto)), BigInt(c.yocto));
  });
}

for (const a of invalidAmounts) {
  test(`amount is refused: ${show(a)}`, () => {
    assert.throws(() => nearToYocto(a), (e: unknown) => e instanceof LunarError && e.code === "bad_input");
  });
}

for (const c of payCases) {
  test(`pay sentence ${show(c.text)} → ${c.expect ? `${c.expect.amount} ${c.expect.token} to ${c.expect.payee}` : "not a payment"}`, () => {
    assert.deepEqual(parsePay(c.text), c.expect);
  });
}

for (const c of prefixCases) {
  test(`typing ${show(c.typed)} offers ${show(c.top)} first`, () => {
    const got = s.words(c.typed);
    assert.equal(got[0], c.top);
    assert.ok(got.length > 0 && got.length <= 3);
  });
}

for (const c of exactCases) {
  test(`a typed word ${show(c.typed)} is offered as ${show(c.top)} first and stays in the strip`, () => {
    const got = s.words(c.typed);
    assert.equal(got[0], c.top);
    assert.ok(got.some((w) => w.toLowerCase() === c.typed), "the word typed is never dropped");
  });
}

for (const c of fixCases) {
  test(`one slip (${c.edit}) ${show(c.typed)} suggests ${show(c.contains)}`, () => {
    assert.ok(s.words(c.typed).includes(c.contains), s.words(c.typed).join(","));
  });
}
