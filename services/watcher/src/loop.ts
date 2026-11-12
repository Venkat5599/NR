// One scan of the watched chain: find Transfer logs to registered receive
// addresses, ask the receive contract to recover them and broadcast the
// forward transactions it signed.

import { TRANSFER_TOPIC, addressTopic, decodeTransfer } from "./codec.ts";
import type { RpcLog, Transfer } from "./codec.ts";
import type { EvmRpc, NearRpc } from "./rpc.ts";
import { asString, isRecord } from "./rpc.ts";

/** The signer's RPC providers only allow this many blocks per `eth_getLogs`. */
export const MAX_LOG_RANGE = 200;

export interface Fees {
  max_fee_per_gas: string;
  max_priority_fee_per_gas: string;
}

export interface TransferRecord {
  status: "Verifying" | "Verified" | "Signed";
  nonce: number | null;
  signedTx: string | null;
  evmTxHash: string | null;
}

export type Action =
  | { kind: "recover" }
  | { kind: "wait"; reason: string }
  | { kind: "resign" }
  | { kind: "broadcast"; signedTx: string; evmTxHash: string }
  | { kind: "done"; evmTxHash: string; outcome: "success" | "reverted" };

/** Submits NEAR transactions to the receive contract. */
export interface Submitter {
  recover(chain: string, log: RpcLog, fees: Fees): Promise<string>;
  resign(chain: string, transfer: Transfer, fees: Fees): Promise<string>;
}

export interface WatchConfig {
  chain: string;
  token: string;
  contract: string;
  maxFeeCap: bigint;
}

export function parseRecord(v: unknown): TransferRecord | null {
  if (v === null) {
    return null;
  }
  if (!isRecord(v)) {
    throw new Error("malformed transfer record");
  }
  const status = asString(v["status"], "status");
  if (status !== "Verifying" && status !== "Verified" && status !== "Signed") {
    throw new Error(`unknown transfer status ${status}`);
  }
  const nonce = v["nonce"];
  return {
    status,
    nonce: typeof nonce === "number" ? nonce : null,
    signedTx: typeof v["signed_tx"] === "string" ? v["signed_tx"] : null,
    evmTxHash: typeof v["evm_tx_hash"] === "string" ? v["evm_tx_hash"] : null,
  };
}

/** Decides what to do with a transfer given its contract record and, once signed, its receipt. */
export function plan(record: TransferRecord | null, receipt: "missing" | "success" | "reverted" | null): Action {
  if (record === null) {
    return { kind: "recover" };
  }
  switch (record.status) {
    case "Verifying":
      return { kind: "wait", reason: "signer is verifying" };
    case "Verified":
      return { kind: "resign" };
    case "Signed": {
      if (record.signedTx === null || record.evmTxHash === null) {
        throw new Error("signed record without a transaction");
      }
      if (receipt === null || receipt === "missing") {
        return { kind: "broadcast", signedTx: record.signedTx, evmTxHash: record.evmTxHash };
      }
      return { kind: "done", evmTxHash: record.evmTxHash, outcome: receipt };
    }
  }
}

export function fees(baseFee: bigint, priority: bigint, cap: bigint): Fees {
  const tip = priority > cap ? cap : priority;
  const wanted = baseFee * 2n + tip;
  const max = wanted > cap ? cap : wanted;
  return { max_fee_per_gas: max.toString(), max_priority_fee_per_gas: tip.toString() };
}

/** Splits [from, to] into ranges of at most MAX_LOG_RANGE blocks. */
export function ranges(from: number, to: number): [number, number][] {
  const out: [number, number][] = [];
  for (let start = from; start <= to; start += MAX_LOG_RANGE) {
    out.push([start, Math.min(start + MAX_LOG_RANGE - 1, to)]);
  }
  return out;
}

export async function findTransfers(evm: EvmRpc, cfg: WatchConfig, addresses: string[], from: number, to: number): Promise<RpcLog[]> {
  if (addresses.length === 0) {
    return [];
  }
  const logs: RpcLog[] = [];
  for (const [a, b] of ranges(from, to)) {
    logs.push(
      ...(await evm.getLogs({
        address: cfg.token,
        topics: [TRANSFER_TOPIC, null, addresses.map(addressTopic)],
        fromBlock: a,
        toBlock: b,
      })),
    );
  }
  return logs;
}

export interface StepResult {
  transfer: Transfer;
  action: Action;
  result: string;
}

/** Handles one Transfer log end to end; returns what was done. */
export async function handle(evm: EvmRpc, near: NearRpc, submit: Submitter, cfg: WatchConfig, log: RpcLog): Promise<StepResult> {
  const transfer = decodeTransfer(log);
  const record = parseRecord(
    await near.view(cfg.contract, "get_transfer", {
      chain: cfg.chain,
      tx_id: transfer.txHash,
      log_index: transfer.logIndex,
    }),
  );
  const receipt = record?.evmTxHash != null ? await evm.receiptStatus(record.evmTxHash) : null;
  const action = plan(record, receipt);
  const currentFees = async (): Promise<Fees> => fees(await evm.baseFee(), await evm.maxPriorityFee(), cfg.maxFeeCap);
  switch (action.kind) {
    case "recover":
      return { transfer, action, result: await submit.recover(cfg.chain, log, await currentFees()) };
    case "resign":
      return { transfer, action, result: await submit.resign(cfg.chain, transfer, await currentFees()) };
    case "broadcast":
      return { transfer, action, result: await evm.sendRawTransaction(action.signedTx) };
    case "wait":
      return { transfer, action, result: action.reason };
    case "done":
      return { transfer, action, result: `${action.evmTxHash} ${action.outcome}` };
  }
}
