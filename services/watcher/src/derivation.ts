// Off-chain derivation of a receive address, the same way the signer derives
// the key for (predecessor = receive contract, path = receiver account id).

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256, sha3_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "./codec.ts";

const TWEAK_PREFIX = "near-mpc-recovery v0.1.0 epsilon derivation:";

export function deriveTweak(predecessor: string, path: string): Uint8Array {
  return sha3_256(new TextEncoder().encode(`${TWEAK_PREFIX}${predecessor},${path}`));
}

/** `root + tweak·G`, both keys as 64-byte uncompressed points without prefix. */
export function deriveKey(root: Uint8Array, tweak: Uint8Array): Uint8Array {
  if (root.length !== 64) {
    throw new Error("root key must be 64 bytes");
  }
  const scalar = BigInt(bytesToHex(tweak));
  const { Point } = secp256k1;
  if (scalar === 0n || scalar >= Point.CURVE().n) {
    throw new Error("tweak is not a valid scalar");
  }
  const rootPoint = Point.fromBytes(Uint8Array.from([4, ...root]));
  const derived = Point.BASE.multiply(scalar).add(rootPoint);
  return derived.toBytes(false).slice(1);
}

export function evmAddress(publicKey: Uint8Array): string {
  if (publicKey.length !== 64) {
    throw new Error("public key must be 64 bytes");
  }
  return bytesToHex(keccak_256(publicKey).slice(12));
}

export function receiveAddress(root: Uint8Array, contract: string, receiver: string): string {
  return evmAddress(deriveKey(root, deriveTweak(contract, receiver)));
}
