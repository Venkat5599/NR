import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidNearName, networkOf } from "../src/lib/near/name.ts";
import { parsePay } from "../src/lib/pay/parser.ts";
import { checkPaste, extractAddress, shortAddress, type Payee } from "../src/lib/pay/paste-check.ts";

const p = (s: string | null) => parsePay(s);

function parsed(s: string) {
  const r = p(s);
  assert.ok(r, `expected "${s}" to parse`);
  return r;
}

test("parser reads name then amount", () => {
  const r = parsed("pay bob.near 20");
  assert.equal(r.payee, "bob.near");
  assert.equal(r.amount, "20");
  assert.equal(r.token, "NEAR");
  assert.equal(r.memo, null);
});

test("parser reads memo and token", () => {
  const r = parsed("ok pay bob.near 12.50 usdt for dinner");
  assert.equal(r.payee, "bob.near");
  assert.equal(r.amount, "12.5");
  assert.equal(r.token, "USDT");
  assert.equal(r.memo, "dinner");
});

test("parser reads amount then name, and $ means dollars", () => {
  const r = parsed("send $5 to alice.testnet");
  assert.equal(r.payee, "alice.testnet");
  assert.equal(r.amount, "5");
  assert.equal(r.token, "USDC");
});

test("parser reads a near token and a comma decimal", () => {
  const r = parsed("pay carol.near 1,5 near");
  assert.equal(r.amount, "1.5");
  assert.equal(r.token, "NEAR");
});

test("parser is case insensitive and lowercases the name", () => {
  assert.equal(parsed("Pay Bob.Near 20").payee, "bob.near");
});

test("parser strips a leading at sign", () => {
  assert.equal(parsed("pay @bob.near 3").payee, "bob.near");
});

test("parser only reads the end of the text", () => {
  assert.equal(p("pay bob.near 20 and then something else"), null);
});

test("parser span covers only the sentence", () => {
  assert.equal(parsed("thanks! pay bob.near 20").span, "pay bob.near 20".length);
});

test("parser refuses zero, bad names, missing amounts and empty text", () => {
  for (const s of ["pay bob.near 0", "pay Bob..near 5", "pay b 5", "pay bob.near", "", null]) assert.equal(p(s), null, String(s));
});

test("parser accepts an eth-implicit address as payee", () => {
  const addr = `0x${"a".repeat(40)}`;
  assert.equal(parsed(`pay ${addr} 2`).payee, addr);
});

test("valid NEAR names pass", () => {
  for (const id of ["bob.near", "alice.testnet", "a-b_c.near", "near", "x.y.z.near", "0".repeat(64), `0x${"f".repeat(40)}`]) {
    assert.ok(isValidNearName(id), id);
  }
});

test("invalid NEAR names fail", () => {
  for (const id of ["b", "Bob.near", "bob..near", ".near", "bob.", "bob-.near", "a".repeat(65), "bob near"]) {
    assert.ok(!isValidNearName(id), id);
  }
});

test("network comes from the suffix", () => {
  assert.equal(networkOf("bob.testnet"), "testnet");
  assert.equal(networkOf("bob.near"), "mainnet");
});

const bob: Payee = { name: "bob.near", address: "0x9f3a58aa2f90c1d2e3f4a5b6c7d8e9f0a1b2b21c" };
const payees = [bob];

test("paste check: no address on the clipboard", () => {
  assert.deepEqual(checkPaste("hello there", payees), { kind: "not-an-address" });
  assert.deepEqual(checkPaste(null, payees), { kind: "not-an-address" });
});

test("paste check: exact match is known even with different case and whitespace", () => {
  const v = checkPaste(`  ${bob.address.toUpperCase().replace("0X", "0x")}\n`, payees);
  assert.equal(v.kind, "known");
});

test("paste check: same start and end with a different middle is a lookalike", () => {
  const fake = `0x9f3a${"e71c0d4b"}${"0".repeat(24)}b21c`;
  assert.equal(fake.length, 42);
  const v = checkPaste(fake, payees);
  assert.equal(v.kind, "lookalike");
  assert.ok(v.kind === "lookalike" && v.payee === bob);
});

test("paste check: an unrelated address is new", () => {
  assert.equal(checkPaste(`0x1111${"2".repeat(32)}3333`, payees).kind, "new");
});

test("paste check: two addresses in one clip are not read", () => {
  assert.equal(extractAddress(`${bob.address} ${bob.address.replace("9f3a", "1234")}`), null);
});

test("paste check: short form", () => {
  assert.equal(shortAddress(bob.address), "0x9f3a…b21c");
});
