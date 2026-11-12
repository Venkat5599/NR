import { createHash } from "node:crypto";
import { KeyPair } from "@near-js/crypto";
import { actionCreators, createTransaction, encodeTransaction, Signature, SignedTransaction } from "@near-js/transactions";
import { baseDecode, baseEncode } from "@near-js/utils";
import { LunarError } from "../errors.ts";
import { isRecord, record, text } from "../json.ts";
import { rpcCall } from "./rpc.ts";

export type FunctionCall = {
  signerId: string;
  /** "ed25519:<base58 secret>" as stored in a NEAR credentials file. */
  secretKey: string;
  receiverId: string;
  method: string;
  args: Record<string, unknown>;
  gas: bigint;
  deposit: bigint;
};

export type CallOutcome = { txHash: string; returned: unknown };

const ED25519 = "ed25519:";

function keyPairOf(secretKey: string): KeyPair {
  if (!secretKey.startsWith(ED25519)) throw new LunarError("not_configured", "the signing key must start with ed25519:");
  return KeyPair.fromString(`${ED25519}${secretKey.slice(ED25519.length)}`);
}

/** The value the transaction's first receipt returned, or the reason it failed. */
export function outcomeValue(result: unknown): unknown {
  const status = record(record(result, "transaction result", "chain")["status"], "transaction status", "chain");
  if ("Failure" in status) throw new LunarError("chain", `transaction failed: ${JSON.stringify(status["Failure"]).slice(0, 240)}`);
  const value = text(status["SuccessValue"], "transaction return value", "chain");
  if (value === "") return null;
  const raw = Buffer.from(value, "base64").toString("utf8");
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new LunarError("chain", "transaction returned non-JSON", { cause });
  }
}

let lastNonce = 0n;
let queue: Promise<unknown> = Promise.resolve();

async function signAndSend(call: FunctionCall): Promise<CallOutcome> {
  const keyPair = keyPairOf(call.secretKey);
  const publicKey = keyPair.getPublicKey();
  const accessKey = record(
    await rpcCall("query", {
      request_type: "view_access_key",
      finality: "optimistic",
      account_id: call.signerId,
      public_key: publicKey.toString(),
    }),
    "access key",
    "chain",
  );
  const chainNonce = BigInt(String(accessKey["nonce"]));
  const nonce = (chainNonce > lastNonce ? chainNonce : lastNonce) + 1n;
  const blockHash = baseDecode(text(accessKey["block_hash"], "block hash", "chain"));
  const action = actionCreators.functionCall(call.method, call.args, call.gas, call.deposit);
  const transaction = createTransaction(call.signerId, publicKey, call.receiverId, nonce, [action], blockHash);
  const digest = new Uint8Array(createHash("sha256").update(encodeTransaction(transaction)).digest());
  const signature = new Signature({ keyType: publicKey.keyType, data: keyPair.sign(digest).signature });
  const signed = new SignedTransaction({ transaction, signature });
  lastNonce = nonce;
  const txHash = baseEncode(digest);
  const result = await rpcCall("send_tx", {
    signed_tx_base64: Buffer.from(signed.encode()).toString("base64"),
    wait_until: "EXECUTED_OPTIMISTIC",
  });
  const reported = isRecord(result) && isRecord(result["transaction"]) ? result["transaction"]["hash"] : txHash;
  return { txHash: typeof reported === "string" ? reported : txHash, returned: outcomeValue(result) };
}

const settled = (): void => undefined;

/**
 * Signs and sends one function call. Calls run one at a time so a key never reuses a nonce;
 * the queue only waits for the previous call to settle, its caller still receives its error.
 */
export function callFunction(call: FunctionCall): Promise<CallOutcome> {
  const run = queue.then(() => signAndSend(call));
  queue = run.then(settled, settled);
  return run;
}
