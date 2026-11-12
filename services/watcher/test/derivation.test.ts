import { test } from "node:test";
import assert from "node:assert/strict";
import { bytesToHex, parseNearSecp256k1Key } from "../src/codec.ts";
import { deriveKey, deriveTweak, evmAddress, receiveAddress } from "../src/derivation.ts";

// Values read from v1.signer-prod.testnet on testnet:
// public_key({domain_id: 0}) and
// derived_public_key({path: RECEIVER, predecessor: CONTRACT, domain_id: 0}).
const ROOT = "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3";
const CONTRACT = "lunar-recv-80366.testnet";
const RECEIVER = "lunar-user-80366.testnet";
const SIGNER_DERIVED = "secp256k1:1239iDeVHRuuGT5jwAWKbf4s9xSH6gLcDGta1WqDEmHNctyCUWmKD3VbvJwFJKR9hLYecPhuA7FVHtRhfLaMV29c";
// Returned by the receive contract's register() on testnet.
const REGISTERED_ADDRESS = "0xa8871e9879d17e229d73c5faeff677d5a8cd2bd2";

test("off-chain derivation equals the signer's derived key", () => {
  const derived = deriveKey(parseNearSecp256k1Key(ROOT), deriveTweak(CONTRACT, RECEIVER));
  assert.equal(bytesToHex(derived), bytesToHex(parseNearSecp256k1Key(SIGNER_DERIVED)));
});

test("receive address equals the one the contract registered", () => {
  assert.equal(receiveAddress(parseNearSecp256k1Key(ROOT), CONTRACT, RECEIVER), REGISTERED_ADDRESS);
  assert.equal(evmAddress(parseNearSecp256k1Key(SIGNER_DERIVED)), REGISTERED_ADDRESS);
});

test("a different receiver gets a different address", () => {
  assert.notEqual(receiveAddress(parseNearSecp256k1Key(ROOT), CONTRACT, "someone-else.testnet"), REGISTERED_ADDRESS);
});
