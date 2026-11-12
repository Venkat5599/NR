import { LunarError } from "../errors.ts";
import { isRecord } from "../json.ts";
import { nearToYocto, ONE_NEAR_YOCTO, yoctoToNear } from "../near/amount.ts";
import { isValidNearName } from "../near/name.ts";

export const MAX_DEMO_YOCTO = ONE_NEAR_YOCTO;
const MAX_MEMO = 80;

export type DemoPayRequest = { to: string; amount: string; yocto: bigint; memo: string | null };

/** Validates a demo payment: a valid NEAR name that is not the demo account, 0 < amount <= 1 NEAR. */
export function readDemoPay(body: unknown, demoAccount: string): DemoPayRequest {
  if (!isRecord(body)) throw new LunarError("bad_input", "send {\"to\", \"amount\", \"memo\"?}");
  const to = typeof body["to"] === "string" ? body["to"].trim().toLowerCase().replace(/^@/, "") : "";
  if (!isValidNearName(to)) throw new LunarError("bad_input", "to must be a valid NEAR account name");
  if (to === demoAccount) throw new LunarError("bad_input", "the demo account can't pay itself");
  if (typeof body["amount"] !== "string") throw new LunarError("bad_input", "amount must be a string of NEAR, e.g. \"0.05\"");
  const yocto = nearToYocto(body["amount"]);
  if (yocto <= 0n) throw new LunarError("bad_input", "amount must be above zero");
  if (yocto > MAX_DEMO_YOCTO) throw new LunarError("bad_input", "the demo pays at most 1 NEAR");
  const rawMemo = body["memo"];
  if (rawMemo !== undefined && rawMemo !== null && typeof rawMemo !== "string") throw new LunarError("bad_input", "memo must be text");
  const memo = typeof rawMemo === "string" && rawMemo.trim() !== "" ? rawMemo.trim() : null;
  if (memo !== null && memo.length > MAX_MEMO) throw new LunarError("bad_input", `memo is longer than ${MAX_MEMO} characters`);
  return { to, amount: yoctoToNear(yocto), yocto, memo };
}
