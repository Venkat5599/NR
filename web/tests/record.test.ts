import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { payEntries, recoveryEntries, txMetaFrom, type TxMeta } from "../src/lib/record/events.ts";

const fixture = (name: string): { result: unknown } => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const PAY = "lunarpay-0111.testnet";
const RECV = "lunar-recv-80366.testnet";
const meta = (hash: string, methods: string[]): TxMeta => ({ hash, signer: "x.testnet", at: 1, methods });

test("indexer rows become tx metadata with method names and ms timestamps", () => {
  const listed: { data: unknown[] } = JSON.parse(readFileSync(new URL("./fixtures/nearblocks-txns.json", import.meta.url), "utf8"));
  const rows = listed.data;
  const first = txMetaFrom(rows[0]);
  assert.deepEqual(first, { hash: "DqQrppNc9L9y2Dat82ax2WQVJeP3QWJyUtDhjSjNBC2v", signer: "lunar-e2e-480974.testnet", at: 1794481082847, methods: ["pay"] });
  assert.equal(txMetaFrom({ transaction_hash: "h" }), null);
});

test("a captured pay transaction yields one pay event from the contract's own log", () => {
  const rows = payEntries(meta("DqQ", ["pay"]), fixture("tx-pay-sent.json").result, PAY);
  assert.deepEqual(rows, [{ txHash: "DqQ", at: 1, source: "payments", event: "pay", summary: "Sent 0.1 NEAR lunar-e2e-480974.testnet → lunar-69787.testnet" }]);
});

test("logs from any other executor are ignored", () => {
  assert.deepEqual(payEntries(meta("DqQ", ["pay"]), fixture("tx-pay-sent.json").result, "someone-else.testnet"), []);
});

test("a refusal over the cap names the cap and what was already spent", () => {
  const log = 'EVENT_JSON:{"standard":"lunar","version":"1.0.0","event":"refused_over_cap","data":[{"from":"a.testnet","to":"b.testnet","amount":"1000000000000000000000000","memo":null,"cap":"500000000000000000000000","spent_today":"50000000000000000000000"}]}';
  const tx = { receipts_outcome: [{ outcome: { executor_id: PAY, logs: [log], status: { SuccessValue: "" } } }] };
  const [row] = payEntries(meta("R", ["pay"]), tx, PAY);
  assert.equal(row?.event, "refused_over_cap");
  assert.equal(row?.summary, "Refused 1 NEAR a.testnet → b.testnet: over the 0.5 NEAR daily cap (0.05 NEAR already spent)");
});

test("deposits and cap changes are not part of the record", () => {
  const log = 'EVENT_JSON:{"standard":"lunar","version":"1.0.0","event":"deposit","data":[{"account":"a.testnet","amount":"1"}]}';
  const tx = { receipts_outcome: [{ outcome: { executor_id: PAY, logs: [log], status: {} } }] };
  assert.deepEqual(payEntries(meta("D", ["deposit"]), tx, PAY), []);
});

test("a captured register transaction yields the receive address", () => {
  const rows = recoveryEntries(meta("Bav", ["register"]), fixture("tx-recv-register.json").result, RECV);
  assert.deepEqual(rows.map((r) => [r.event, r.summary]), [["registered", "lunar-user-80366.testnet registered receive address 0xa8871e…2bd2"]]);
});

test("a captured recover refusal yields the contract's reason", () => {
  const rows = recoveryEntries(meta("Ek", ["recover"]), fixture("tx-recv-recover-refused.json").result, RECV);
  assert.deepEqual(rows.map((r) => [r.event, r.summary]), [["recovery_refused", "Refused recover: recipient is not a registered receive address"]]);
});

test("a captured transfer check yields the signer's verdict", () => {
  const rows = recoveryEntries(meta("5nG", ["check_transfer"]), fixture("tx-recv-check.json").result, RECV);
  assert.deepEqual(rows.map((r) => [r.event, r.summary]), [["transfer_checked", "Transfer 0xd3482e…b0d0 checked: verified by the signer"]]);
});
