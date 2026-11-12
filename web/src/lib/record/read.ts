import { isRecord } from "../json.ts";
import { PAY_CONTRACT, RECEIVE_CONTRACT } from "../near/lunar-pay.ts";
import { ARCHIVAL_RPC_URL, RPC_URL } from "../near/name.ts";
import { nearblocks } from "../near/nearblocks.ts";
import { RpcError, rpcCall } from "../near/rpc.ts";
import { payEntries, recoveryEntries, txMetaFrom, type RecordEntry, type TxMeta } from "./events.ts";

export const REVALIDATE_SECONDS = 30;
const PAY_METHODS = ["pay"];
const RECOVERY_METHODS = ["register", "recover", "resign", "check_transfer"];
const PARALLEL = 6;

/** Finished transactions never change, so their results are kept for the life of the server. */
const settled = new Map<string, unknown>();

async function txResult(meta: TxMeta): Promise<unknown> {
  const hit = settled.get(meta.hash);
  if (hit !== undefined) return hit;
  const params = { tx_hash: meta.hash, sender_account_id: meta.signer, wait_until: "NONE" };
  let result: unknown;
  try {
    result = await rpcCall("tx", params, RPC_URL.testnet, REVALIDATE_SECONDS);
  } catch (error) {
    if (!(error instanceof RpcError) || error.kind !== "UNKNOWN_TRANSACTION") throw error;
    result = await rpcCall("tx", params, ARCHIVAL_RPC_URL.testnet, REVALIDATE_SECONDS);
  }
  if (isRecord(result) && isRecord(result["status"]) && !("NotStarted" in result["status"]) && !("Started" in result["status"])) {
    settled.set(meta.hash, result);
  }
  return result;
}

async function contractTxns(contract: string, methods: readonly string[]): Promise<TxMeta[]> {
  const body = await nearblocks("testnet", `/accounts/${contract}/txns?per_page=50`, REVALIDATE_SECONDS);
  const rows = isRecord(body) && Array.isArray(body["data"]) ? body["data"] : [];
  return rows
    .map(txMetaFrom)
    .filter((m): m is TxMeta => m !== null && m.methods.some((name) => methods.includes(name)));
}

async function inBatches<T, R>(items: readonly T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += PARALLEL) out.push(...(await Promise.all(items.slice(i, i + PARALLEL).map(work))));
  return out;
}

/** Every pay, refusal and recovery event the two contracts recorded, newest first. */
export async function readRecord(): Promise<RecordEntry[]> {
  const [pays, recoveries] = await Promise.all([contractTxns(PAY_CONTRACT, PAY_METHODS), contractTxns(RECEIVE_CONTRACT, RECOVERY_METHODS)]);
  const payRows = await inBatches(pays, async (m) => payEntries(m, await txResult(m), PAY_CONTRACT));
  const recoveryRows = await inBatches(recoveries, async (m) => recoveryEntries(m, await txResult(m), RECEIVE_CONTRACT));
  return [...payRows.flat(), ...recoveryRows.flat()].sort((a, b) => b.at - a.at);
}
