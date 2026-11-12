import { isRecord } from "../json.ts";

/** What the key history of a name says before you pay it. */
export type KeyVerdict =
  /** The account and its keys are older than RECENT_DAYS. */
  | { kind: "settled"; ageDays: number }
  /** A full-access key was added recently: whoever holds the name may have changed. */
  | { kind: "key-changed"; daysAgo: number; ageDays: number }
  /** The account itself is new. */
  | { kind: "new-account"; ageDays: number }
  | { kind: "unknown"; reason: string };

export const RECENT_DAYS = 7;
const DAY_MS = 86_400_000;

function createdMs(key: Record<string, unknown>): number | null {
  const created = key["created"];
  if (!isRecord(created)) return null;
  const block = created["block"];
  if (!isRecord(block)) return null;
  const ts = block["block_timestamp"];
  if (typeof ts !== "string" || !/^\d+$/.test(ts)) return null;
  return Number(BigInt(ts) / 1_000_000n);
}

/** Reads a nearblocks `/accounts/<id>/keys` response. Pure. */
export function keyVerdict(response: unknown, nowMs: number): KeyVerdict {
  const data = isRecord(response) ? response["data"] : undefined;
  if (!Array.isArray(data)) return { kind: "unknown", reason: "no key data" };
  if (data.length === 0) return { kind: "unknown", reason: "no keys listed" };
  let oldest = Number.POSITIVE_INFINITY;
  let newestFull = Number.NEGATIVE_INFINITY;
  for (const key of data) {
    if (!isRecord(key)) continue;
    const ms = createdMs(key);
    if (ms === null) continue;
    oldest = Math.min(oldest, ms);
    const deleted = key["deleted"];
    const live = !isRecord(deleted) || Object.keys(deleted).length === 0;
    if (key["permission_kind"] === "FULL_ACCESS" && live) newestFull = Math.max(newestFull, ms);
  }
  if (!Number.isFinite(oldest)) return { kind: "unknown", reason: "no key timestamps" };
  const ageDays = Math.floor((nowMs - oldest) / DAY_MS);
  if (ageDays < RECENT_DAYS) return { kind: "new-account", ageDays };
  if (Number.isFinite(newestFull) && newestFull > oldest + DAY_MS) {
    const daysAgo = Math.floor((nowMs - newestFull) / DAY_MS);
    if (daysAgo < RECENT_DAYS) return { kind: "key-changed", daysAgo, ageDays };
  }
  return { kind: "settled", ageDays };
}
