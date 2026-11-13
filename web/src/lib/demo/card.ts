import type { NameCheck } from "../name-check/check.ts";
import type { Pocket } from "../near/lunar-pay.ts";
import { nearToYocto, yoctoToNear } from "../near/amount.ts";

export type Tone = "neutral" | "ok" | "warn";

export type CardFacts = { lines: string[]; tone: Tone; canPay: boolean; overCap: boolean };

export function daysText(n: number): string {
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  return `${n} days ago`;
}

function nameLine(check: NameCheck): { line: string; warn: boolean } {
  const k = check.keys;
  switch (k.kind) {
    case "key-changed":
      return { line: `${check.account} got a new owner key ${daysText(k.daysAgo)}`, warn: true };
    case "new-account":
      return { line: `${check.account} was created ${daysText(k.ageDays)}`, warn: true };
    case "settled":
      return { line: `${check.account} · ${k.ageDays} days old`, warn: false };
    default:
      return { line: `${check.account} · exists`, warn: false };
  }
}

/** What the pay card says before paying: the same checks, in the same order, as the phone. */
export function cardFacts(payee: string, amount: string, check: NameCheck, pocket: Pocket | null, payer: string): CardFacts {
  const lines: string[] = [];
  let tone: Tone = "ok";
  let canPay = true;
  let overCap = false;
  if (!check.exists) {
    return { lines: [`No account called ${payee}`], tone: "warn", canPay: false, overCap: false };
  }
  const name = nameLine(check);
  lines.push(name.line);
  if (name.warn) tone = "warn";
  if (payee === payer) {
    lines.unshift("That's the demo account itself");
    canPay = false;
    tone = "warn";
  }
  if (canPay && pocket) {
    const left = BigInt(pocket.yocto.leftToday);
    const want = nearToYocto(amount);
    if (want > left) {
      overCap = true;
      tone = "warn";
      lines.push(`Over today's cap (${pocket.leftToday} NEAR left) · the contract will refuse`);
    } else {
      lines.push(`${yoctoToNear(left - want)} NEAR left today after this`);
    }
  }
  if (canPay && check.quote.kind === "quote") {
    const q = check.quote.quote;
    lines.push(`On mainnet: ≈ ${q.amountOut} ${q.token} on ${check.quote.chainLabel} (live Intents quote)`);
  }
  return { lines, tone, canPay, overCap };
}
