import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addressTopic, base58Decode, decodeTransfer, parseNearSecp256k1Key } from "../src/codec.ts";
import type { RpcLog } from "../src/codec.ts";

// Captured from https://sepolia.base.org (Base Sepolia block 57732715).
const log: RpcLog = JSON.parse(readFileSync(new URL("./fixtures/base-sepolia-usdc-transfer-log.json", import.meta.url), "utf8"));

test("decodes the captured Base Sepolia USDC Transfer log", () => {
  const t = decodeTransfer(log);
  assert.equal(t.token, "0x036cbd53842c5426634e7929541ec2318f3dcf7e");
  assert.equal(t.from, "0xc1f380ff86c07f16afb04ccaf125ae114e943000");
  assert.equal(t.to, "0x0a3440d212716282ebaf08b7871ba5bfe2c8ce34");
  assert.equal(t.amount, 2_000_000n);
  assert.equal(t.logIndex, 3);
  assert.equal(t.blockNumber, 57732715);
  assert.equal(t.txHash, "0xd3482e4e0cd1d42c0d94835447224ff08ef420dc1cfdccb49ccc512d5e04b0d0");
});

test("refuses logs that are not ERC-20 transfers", () => {
  assert.throws(() => decodeTransfer({ ...log, topics: log.topics.slice(0, 2) }), /not an ERC-20 Transfer/);
  assert.throws(() => decodeTransfer({ ...log, removed: true }), /removed/);
  assert.throws(() => decodeTransfer({ ...log, data: "0x00" }), /one word/);
});

test("address topics round-trip", () => {
  assert.equal(addressTopic("0x0A3440D212716282EBAF08B7871BA5BFE2C8CE34"), log.topics[2]);
});

test("base58 keeps leading zero bytes", () => {
  assert.deepEqual([...base58Decode("112")], [0, 0, 1]);
});

test("parses the signer's secp256k1 keys", () => {
  const key = parseNearSecp256k1Key("secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3");
  assert.equal(key.length, 64);
  assert.throws(() => parseNearSecp256k1Key("ed25519:abc"), /not a secp256k1 key/);
});
