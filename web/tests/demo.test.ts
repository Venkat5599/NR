import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readDemoPay } from "../src/lib/demo/pay-request.ts";
import { demoAccount } from "../src/lib/demo/account.ts";
import { LunarError } from "../src/lib/errors.ts";
import { centsDown, findAsset, quoteFrom } from "../src/lib/intents/quote.ts";
import { nearToYocto, roundNear, yoctoToNear } from "../src/lib/near/amount.ts";
import { keyVerdict } from "../src/lib/near/key-history.ts";
import { pocketFrom } from "../src/lib/near/lunar-pay.ts";
import { outcomeValue } from "../src/lib/near/sign.ts";
import { createRateLimiter } from "../src/lib/rate-limit.ts";

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const DEMO = "lunar-demo.lunar-69787.testnet";

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof LunarError) return error.code;
    throw error;
  }
  return "none";
}

test("NEAR decimals convert to yocto and back exactly", () => {
  assert.equal(nearToYocto("0.05"), 50_000_000_000_000_000_000_000n);
  assert.equal(nearToYocto("1"), 10n ** 24n);
  assert.equal(yoctoToNear(500_000_000_000_000_000_000_000n), "0.5");
  assert.equal(yoctoToNear("3000000000000000000000000"), "3");
  assert.equal(yoctoToNear("1"), "0.000000000000000000000001");
  assert.equal(roundNear("0.123456", 2), "0.12");
  for (const bad of ["", "-1", "1e3", "0.1.2", "abc", "1.0000000000000000000000001"]) assert.equal(codeOf(() => nearToYocto(bad)), "bad_input", bad);
});

test("demo payment amount must be above zero and at most 1 NEAR", () => {
  assert.equal(readDemoPay({ to: "lunar-69787.testnet", amount: "0.05" }, DEMO).yocto, nearToYocto("0.05"));
  assert.equal(readDemoPay({ to: "lunar-69787.testnet", amount: "1" }, DEMO).amount, "1");
  for (const amount of ["0", "1.000001", "2", "-0.1", "x", 1]) {
    assert.equal(codeOf(() => readDemoPay({ to: "lunar-69787.testnet", amount }, DEMO)), "bad_input", String(amount));
  }
});

test("demo payee must be a valid NEAR name other than the demo account", () => {
  assert.equal(readDemoPay({ to: "@Bob.testnet", amount: "0.1" }, DEMO).to, "bob.testnet");
  for (const to of ["b", "bob..testnet", "", DEMO, 42]) assert.equal(codeOf(() => readDemoPay({ to, amount: "0.1" }, DEMO)), "bad_input", String(to));
});

test("demo memo is optional text of at most 80 characters", () => {
  assert.equal(readDemoPay({ to: "bob.testnet", amount: "0.1", memo: " lunch " }, DEMO).memo, "lunch");
  assert.equal(readDemoPay({ to: "bob.testnet", amount: "0.1", memo: null }, DEMO).memo, null);
  assert.equal(codeOf(() => readDemoPay({ to: "bob.testnet", amount: "0.1", memo: "x".repeat(81) }, DEMO)), "bad_input");
  assert.equal(codeOf(() => readDemoPay({ to: "bob.testnet", amount: "0.1", memo: 7 }, DEMO)), "bad_input");
});

test("the demo is off until both env vars are set", () => {
  assert.equal(codeOf(() => demoAccount({})), "not_configured");
  assert.equal(codeOf(() => demoAccount({ LUNAR_DEMO_ACCOUNT: DEMO })), "not_configured");
  assert.equal(demoAccount({ LUNAR_DEMO_ACCOUNT: DEMO, LUNAR_DEMO_KEY: "ed25519:x" }).accountId, DEMO);
});

test("rate limiter allows a burst per IP, then refills over time", () => {
  let now = 0;
  const limiter = createRateLimiter(2, 1000, () => now);
  assert.ok(limiter.take("a"));
  assert.ok(limiter.take("a"));
  assert.ok(!limiter.take("a"));
  assert.ok(limiter.take("b"));
  now = 1000;
  assert.ok(limiter.take("a"));
  assert.ok(!limiter.take("a"));
});

test("a captured pay transaction returns Sent", () => {
  const tx: { result: unknown } = JSON.parse(readFileSync(new URL("./fixtures/tx-pay-sent.json", import.meta.url), "utf8"));
  assert.equal(outcomeValue(tx.result), "Sent");
  assert.equal(codeOf(() => outcomeValue({ status: { Failure: { ActionError: {} } } })), "chain");
});

test("pocket view converts yocto to NEAR", () => {
  const p = pocketFrom(DEMO, { balance: "3000000000000000000000000", daily_cap: "500000000000000000000000", spent_today: "50000000000000000000000", left_today: "450000000000000000000000" });
  assert.deepEqual([p.balance, p.dailyCap, p.spentToday, p.leftToday], ["3", "0.5", "0.05", "0.45"]);
  assert.equal(codeOf(() => pocketFrom(DEMO, { balance: "x" })), "chain");
});

test("key history: a captured keys response for a new account says new-account", () => {
  const keys = fixture("nearblocks-keys.json");
  const created = 1794469789593;
  assert.deepEqual(keyVerdict(keys, created + 2 * 86_400_000), { kind: "new-account", ageDays: 2 });
  assert.deepEqual(keyVerdict(keys, created + 30 * 86_400_000), { kind: "settled", ageDays: 30 });
});

test("key history: a full-access key added this week on an old account is flagged", () => {
  const day = 86_400_000;
  const key = (ms: number, kind: string) => ({ created: { block: { block_timestamp: String(BigInt(ms) * 1_000_000n) } }, deleted: {}, permission_kind: kind });
  const now = 100 * day;
  assert.deepEqual(keyVerdict({ data: [key(0, "FULL_ACCESS"), key(now - 2 * day, "FULL_ACCESS")] }, now), { kind: "key-changed", daysAgo: 2, ageDays: 100 });
  assert.deepEqual(keyVerdict({ data: [key(0, "FULL_ACCESS"), key(now - 2 * day, "FUNCTION_CALL")] }, now), { kind: "settled", ageDays: 100 });
  assert.deepEqual(keyVerdict({ data: [] }, now), { kind: "unknown", reason: "no keys listed" });
});

test("intents quote picks the asset by chain and symbol and rounds down to cents", () => {
  const tokens = [{ assetId: "nep141:a", blockchain: "base", symbol: "WETH" }, { assetId: "nep141:usdc", blockchain: "base", symbol: "USDC" }];
  assert.equal(findAsset(tokens, "Base", "usdc"), "nep141:usdc");
  assert.equal(findAsset(tokens, "sol", "USDC"), null);
  assert.equal(centsDown("3.4567"), "3.45");
  assert.equal(centsDown("7"), "7.00");
  assert.deepEqual(quoteFrom({ quote: { amountOutFormatted: "0.171999", timeEstimate: 20 } }, "usdc", "base"), { amountOut: "0.17", token: "USDC", chain: "base", seconds: 20 });
});

test("pay card warns over the cap but still lets the contract decide", async () => {
  const { cardFacts } = await import("../src/lib/demo/card.ts");
  const pocket = pocketFrom(DEMO, { balance: "3000000000000000000000000", daily_cap: "500000000000000000000000", spent_today: "0", left_today: "500000000000000000000000" });
  const check = {
    account: "lunar-69787.testnet",
    network: "testnet" as const,
    exists: true,
    keys: { kind: "new-account" as const, ageDays: 0 },
    receive: { chain: "base", token: "USDC", address: "0xa8871e9879d17e229d73c5faeff677d5a8cd2bd2" },
    quote: { kind: "quote" as const, quote: { amountOut: "0.17", token: "USDC", chain: "base", seconds: 20 }, chainLabel: "Base" },
  };
  const under = cardFacts("lunar-69787.testnet", "0.05", check, pocket, DEMO);
  assert.deepEqual(under.lines, ["lunar-69787.testnet was created today", "0.45 NEAR left today after this", "On mainnet: ≈ 0.17 USDC on Base (live Intents quote)"]);
  assert.equal(under.overCap, false);
  const over = cardFacts("lunar-69787.testnet", "1", check, pocket, DEMO);
  assert.ok(over.overCap && over.canPay && over.tone === "warn");
  const missing = cardFacts("nobody.testnet", "1", { ...check, exists: false }, pocket, DEMO);
  assert.deepEqual([missing.canPay, missing.lines], [false, ["No account called nobody.testnet"]]);
});
