import { test } from "node:test";
import assert from "node:assert/strict";
import { fees, parseRecord, plan, ranges } from "../src/loop.ts";

const signed = {
  status: "Signed",
  nonce: 0,
  signed_tx: "0x02f8",
  evm_tx_hash: "0xabc",
};

test("an unknown transfer is recovered", () => {
  assert.deepEqual(plan(parseRecord(null), null), { kind: "recover" });
});

test("a verifying transfer waits and a verified one is signed again", () => {
  assert.equal(plan(parseRecord({ ...signed, status: "Verifying", signed_tx: null }), null).kind, "wait");
  assert.equal(plan(parseRecord({ ...signed, status: "Verified", signed_tx: null }), null).kind, "resign");
});

test("a signed transfer is broadcast until its receipt exists", () => {
  assert.deepEqual(plan(parseRecord(signed), "missing"), { kind: "broadcast", signedTx: "0x02f8", evmTxHash: "0xabc" });
  assert.deepEqual(plan(parseRecord(signed), "success"), { kind: "done", evmTxHash: "0xabc", outcome: "success" });
});

test("malformed records are refused", () => {
  assert.throws(() => parseRecord({ status: "Lost" }), /unknown transfer status/);
  assert.throws(() => plan(parseRecord({ status: "Signed" }), null), /without a transaction/);
});

test("fees stay under the contract cap", () => {
  assert.deepEqual(fees(10n, 1n, 100n), { max_fee_per_gas: "21", max_priority_fee_per_gas: "1" });
  assert.deepEqual(fees(1000n, 5n, 100n), { max_fee_per_gas: "100", max_priority_fee_per_gas: "5" });
});

test("log ranges respect the 200-block limit", () => {
  assert.deepEqual(ranges(0, 450), [[0, 199], [200, 399], [400, 450]]);
  assert.deepEqual(ranges(5, 4), []);
});
