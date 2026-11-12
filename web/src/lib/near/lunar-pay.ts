import { LunarError } from "../errors.ts";
import { isRecord, record, text } from "../json.ts";
import { yoctoToNear } from "./amount.ts";
import { viewFunction } from "./rpc.ts";

export const PAY_CONTRACT = "lunarpay-0111.testnet";
export const RECEIVE_CONTRACT = "lunar-recv-80366.testnet";

export type PayResult = "Sent" | "RefusedOverCap" | "RefusedLowBalance";
export const PAY_RESULTS: readonly PayResult[] = ["Sent", "RefusedOverCap", "RefusedLowBalance"];

export function isPayResult(value: unknown): value is PayResult {
  return typeof value === "string" && (PAY_RESULTS as readonly string[]).includes(value);
}

export type Pocket = {
  account: string;
  balance: string;
  dailyCap: string;
  spentToday: string;
  leftToday: string;
  /** The same numbers in yocto, as the contract returned them. */
  yocto: { balance: string; dailyCap: string; spentToday: string; leftToday: string };
};

export type ReceivePref = { chain: string; token: string; address: string };

function yocto(value: unknown, what: string): string {
  const s = text(value, what, "chain");
  if (!/^\d+$/.test(s)) throw new LunarError("chain", `${what} is not a yocto amount`);
  return s;
}

export function pocketFrom(account: string, view: unknown): Pocket {
  const v = record(view, "pocket", "chain");
  const y = {
    balance: yocto(v["balance"], "balance"),
    dailyCap: yocto(v["daily_cap"], "daily_cap"),
    spentToday: yocto(v["spent_today"], "spent_today"),
    leftToday: yocto(v["left_today"], "left_today"),
  };
  return {
    account,
    balance: yoctoToNear(y.balance),
    dailyCap: yoctoToNear(y.dailyCap),
    spentToday: yoctoToNear(y.spentToday),
    leftToday: yoctoToNear(y.leftToday),
    yocto: y,
  };
}

export async function getPocket(account: string): Promise<Pocket> {
  return pocketFrom(account, await viewFunction(PAY_CONTRACT, "get_pocket", { account }));
}

export async function getReceivePref(account: string): Promise<ReceivePref | null> {
  const view = await viewFunction(PAY_CONTRACT, "get_receive", { account });
  if (view === null) return null;
  if (!isRecord(view)) throw new LunarError("chain", "get_receive returned a non-object");
  return {
    chain: text(view["chain"], "receive chain", "chain"),
    token: text(view["token"], "receive token", "chain"),
    address: text(view["address"], "receive address", "chain"),
  };
}
