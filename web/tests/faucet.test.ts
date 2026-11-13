import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { faucetFailure, faucetOutcome, readAccountRequest, requestTestnetAccount } from "../src/lib/near/faucet.ts";
import { LunarError } from "../src/lib/errors.ts";

const KEY = "ed25519:Aj1EA4YM5se9AjUceBjfj1WUdfCzjQ1yG319WmcY2fMk";

test("only a top-level name.testnet and an ed25519 public key are accepted", () => {
  assert.deepEqual(readAccountRequest({ accountId: "alice.testnet", publicKey: KEY }), { accountId: "alice.testnet", publicKey: KEY });
  for (const bad of [
    { accountId: "alice.near", publicKey: KEY },
    { accountId: "a.b.testnet", publicKey: KEY },
    { accountId: "Alice.testnet", publicKey: KEY },
    { accountId: "alice.testnet", publicKey: "ed25519:" },
    { accountId: "alice.testnet", publicKey: "secp256k1:" + KEY.slice(8) },
    null,
  ]) {
    assert.throws(() => readAccountRequest(bad), (e: unknown) => e instanceof LunarError && e.code === "bad_input");
  }
});

test("faucet answers map to created, busy, taken or upstream", () => {
  assert.deepEqual(faucetOutcome(200, "{}"), { created: true });
  assert.throws(() => faucetOutcome(429, ""), (e: unknown) => e instanceof LunarError && e.code === "rate_limited");
  assert.throws(() => faucetOutcome(400, "account already exists"), (e: unknown) => e instanceof LunarError && e.code === "bad_input");
  assert.throws(() => faucetOutcome(500, "boom"), (e: unknown) => e instanceof LunarError && e.code === "upstream");
});

test("only the name and public key are sent to the faucet", async () => {
  let sent = "";
  const fake: typeof fetch = async (_url, init) => {
    sent = String(init?.body ?? "");
    return new Response("{}", { status: 200 });
  };
  await requestTestnetAccount({ accountId: "alice.testnet", publicKey: KEY }, fake);
  assert.deepEqual(JSON.parse(sent), { newAccountId: "alice.testnet", newAccountPublicKey: KEY });
});

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("a 200 from the faucet whose transaction failed with AccountAlreadyExists is a taken name, not a new account", () => {
  const taken = fixture("faucet_taken.json");
  assert.equal(faucetFailure(taken), "taken");
  assert.throws(() => faucetOutcome(200, taken), (e: unknown) => e instanceof LunarError && e.code === "bad_input" && /taken/.test(e.message));
});

test("a 200 from the faucet whose transaction succeeded is a new account", () => {
  const created = fixture("faucet_created.json");
  assert.equal(faucetFailure(created), null);
  assert.deepEqual(faucetOutcome(200, created), { created: true });
});
