import { isRecord, parseJson } from "../json.ts";
import { yoctoToNear } from "../near/amount.ts";

export type Source = "payments" | "recovery";

export type RecordEvent =
  | "pay"
  | "refused_over_cap"
  | "refused_low_balance"
  | "pay_failed_refunded"
  | "registered"
  | "transfer_checked"
  | "transfer_verified"
  | "transfer_signed"
  | "transfer_rejected"
  | "recovery_refused";

export type RecordEntry = { txHash: string; at: number; source: Source; event: RecordEvent; summary: string };

/** One transaction as the indexer lists it. */
export type TxMeta = { hash: string; signer: string; at: number; methods: string[] };

const PAY_EVENTS: readonly RecordEvent[] = ["pay", "refused_over_cap", "refused_low_balance", "pay_failed_refunded"];

type Outcome = { executor: string; logs: string[]; failure: string | null; value: string | null };

function outcomes(txResult: unknown): Outcome[] {
  if (!isRecord(txResult) || !Array.isArray(txResult["receipts_outcome"])) return [];
  const out: Outcome[] = [];
  for (const r of txResult["receipts_outcome"]) {
    const o = isRecord(r) && isRecord(r["outcome"]) ? r["outcome"] : null;
    if (!o || typeof o["executor_id"] !== "string") continue;
    const logs = Array.isArray(o["logs"]) ? o["logs"].filter((l): l is string => typeof l === "string") : [];
    const status = isRecord(o["status"]) ? o["status"] : {};
    out.push({ executor: o["executor_id"], logs, failure: failureText(status["Failure"]), value: typeof status["SuccessValue"] === "string" ? status["SuccessValue"] : null });
  }
  return out;
}

function failureText(failure: unknown): string | null {
  if (failure === undefined) return null;
  const match = /Smart contract panicked: ([^"]+)/.exec(JSON.stringify(failure));
  return match?.[1] ?? "the transaction failed";
}

function near(yocto: unknown): string {
  return typeof yocto === "string" && /^\d+$/.test(yocto) ? `${yoctoToNear(yocto)} NEAR` : "an amount";
}

function field(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return typeof v === "string" ? v : "someone";
}

function paySummary(event: RecordEvent, d: Record<string, unknown>): string {
  const memo = typeof d["memo"] === "string" && d["memo"] !== "" ? ` · for ${d["memo"]}` : "";
  const route = `${field(d, "from")} → ${field(d, "to")}`;
  switch (event) {
    case "pay":
      return `Sent ${near(d["amount"])} ${route}${memo}`;
    case "refused_over_cap":
      return `Refused ${near(d["amount"])} ${route}: over the ${near(d["cap"])} daily cap (${near(d["spent_today"])} already spent)`;
    case "refused_low_balance":
      return `Refused ${near(d["amount"])} ${route}: not enough in the pocket`;
    default:
      return `Payment ${route} bounced; ${near(d["amount"])} went back to the pocket`;
  }
}

/** NEP-297 events the payments contract logged in one transaction. */
export function payEntries(meta: TxMeta, txResult: unknown, contract: string): RecordEntry[] {
  const entries: RecordEntry[] = [];
  for (const o of outcomes(txResult)) {
    if (o.executor !== contract) continue;
    for (const log of o.logs) {
      if (!log.startsWith("EVENT_JSON:")) continue;
      const body = parseJson(log.slice("EVENT_JSON:".length), "event log", "chain");
      if (!isRecord(body) || body["standard"] !== "lunar" || !Array.isArray(body["data"])) continue;
      const event = PAY_EVENTS.find((e) => e === body["event"]);
      if (!event) continue;
      for (const d of body["data"]) {
        if (isRecord(d)) entries.push({ txHash: meta.hash, at: meta.at, source: "payments", event, summary: paySummary(event, d) });
      }
    }
  }
  return entries;
}

const REGISTERED = /^registered (\S+) receive address (0x[0-9a-fA-F]{40})$/;
const REJECTED = /^transfer (\S+) rejected: (.+)$/;
const VERIFIED = /^transfer (\S+) verified; nonce (\d+)$/;
const SIGNED = /^transfer (\S+) signed: (\S+)$/;

function short(s: string): string {
  return s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}

function logEntry(log: string): { event: RecordEvent; summary: string } | null {
  const reg = REGISTERED.exec(log);
  if (reg) return { event: "registered", summary: `${reg[1]} registered receive address ${short(reg[2] ?? "")}` };
  const rej = REJECTED.exec(log);
  if (rej) return { event: "transfer_rejected", summary: `Refused transfer ${short(rej[1] ?? "")}: ${rej[2]}` };
  const ver = VERIFIED.exec(log);
  if (ver) return { event: "transfer_verified", summary: `Transfer ${short(ver[1] ?? "")} verified by the signer` };
  const sig = SIGNED.exec(log);
  if (sig) return { event: "transfer_signed", summary: `Return transfer signed: ${short(sig[2] ?? "")}` };
  return null;
}

function checkedSummary(value: string): string | null {
  const body = parseJson(Buffer.from(value, "base64").toString("utf8"), "check result", "chain");
  if (!isRecord(body) || typeof body["verified"] !== "boolean") return null;
  const t = isRecord(body["transfer"]) ? body["transfer"] : {};
  const what = typeof t["tx_id"] === "string" ? ` ${short(t["tx_id"])}` : "";
  return body["verified"]
    ? `Transfer${what} checked: verified by the signer`
    : `Transfer${what} checked: not verified (${typeof body["reason"] === "string" ? body["reason"] : "no reason given"})`;
}

/** Recovery events from the receive contract's logs, results and refusals in one transaction. */
export function recoveryEntries(meta: TxMeta, txResult: unknown, contract: string): RecordEntry[] {
  const entries: RecordEntry[] = [];
  const push = (event: RecordEvent, summary: string) => entries.push({ txHash: meta.hash, at: meta.at, source: "recovery", event, summary });
  const own = outcomes(txResult).filter((o) => o.executor === contract);
  for (const o of own) {
    for (const log of o.logs) {
      const e = logEntry(log);
      if (e) push(e.event, e.summary);
    }
  }
  const refusal = own.find((o) => o.failure !== null)?.failure;
  if (refusal) push("recovery_refused", `Refused ${meta.methods[0] ?? "a call"}: ${refusal}`);
  if (meta.methods.includes("check_transfer") && !refusal) {
    const value = own.at(-1)?.value;
    const summary = value ? checkedSummary(value) : null;
    if (summary) push("transfer_checked", summary);
  }
  return entries;
}

/** Reads one row of a nearblocks `/accounts/<id>/txns` response. */
export function txMetaFrom(row: unknown): TxMeta | null {
  if (!isRecord(row) || typeof row["transaction_hash"] !== "string" || typeof row["signer_account_id"] !== "string") return null;
  const ts = row["block_timestamp"];
  if (typeof ts !== "string" || !/^\d+$/.test(ts)) return null;
  const actions = Array.isArray(row["actions"]) ? row["actions"] : [];
  const methods = actions.flatMap((a) => (isRecord(a) && typeof a["method"] === "string" ? [a["method"]] : []));
  return { hash: row["transaction_hash"], signer: row["signer_account_id"], at: Number(BigInt(ts) / 1_000_000n), methods };
}
