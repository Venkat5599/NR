import { isValidNearName } from "../near/name.ts";

export type Token = "NEAR" | "USDC" | "USDT";

/** A payment the user asked for in plain words. Nothing is signed from this alone. */
export type PayIntent = {
  payee: string;
  /** Plain decimal with no trailing zeros, e.g. "12.5". */
  amount: string;
  token: Token;
  memo: string | null;
  /** Characters at the end of the text that the sentence occupied. */
  span: number;
};

const NAME = String.raw`@?[a-z0-9][a-z0-9._-]*[a-z0-9]`;
const AMOUNT = String.raw`(\$)?(\d{1,9}(?:[.,]\d{1,6})?)`;
const TOKEN = String.raw`(usdc|usdt|near|usd|dollars?)`;
const MEMO = String.raw`(?:\s+for\s+(.{1,60}?))?`;

/** pay bob.near 20 [usdc] [for dinner] */
const NAME_FIRST = new RegExp(String.raw`(?:^|\s)(?:pay|send)\s+(${NAME})\s+${AMOUNT}(?:\s*${TOKEN})?${MEMO}\s*$`, "i");
/** pay 20 [usdc] to bob.near [for dinner] */
const AMOUNT_FIRST = new RegExp(String.raw`(?:^|\s)(?:pay|send)\s+${AMOUNT}(?:\s*${TOKEN})?\s+to\s+(${NAME})${MEMO}\s*$`, "i");

/**
 * Reads the sentence at the end of the text, e.g. "pay bob.near 20 for dinner",
 * "pay 20 usdc to bob.near" or "send bob.near $5". A pay command has to be the last thing typed.
 */
export function parsePay(textBeforeCursor: string | null | undefined): PayIntent | null {
  if (!textBeforeCursor || textBeforeCursor.trim() === "") return null;
  const text = textBeforeCursor;
  const nameFirst = NAME_FIRST.exec(text);
  if (nameFirst) return build(nameFirst[1], nameFirst[3], nameFirst[4], nameFirst[5], nameFirst[2] === "$", text, nameFirst.index);
  const amountFirst = AMOUNT_FIRST.exec(text);
  if (amountFirst) return build(amountFirst[4], amountFirst[2], amountFirst[3], amountFirst[5], amountFirst[1] === "$", text, amountFirst.index);
  return null;
}

/** "012.50" -> "12.5"; "1,5" -> "1.5". */
export function normalizeAmount(raw: string): string {
  const [whole = "0", frac = ""] = raw.replace(",", ".").split(".");
  const w = whole.replace(/^0+(?=\d)/, "");
  const f = frac.replace(/0+$/, "");
  return f ? `${w}.${f}` : w;
}

function tokenOf(raw: string, dollarSign: boolean): Token | null {
  switch (raw.toLowerCase()) {
    case "":
      return dollarSign ? "USDC" : "NEAR";
    case "near":
      return "NEAR";
    case "usd":
    case "dollar":
    case "dollars":
    case "usdc":
      return "USDC";
    case "usdt":
      return "USDT";
    default:
      return null;
  }
}

function build(
  rawName: string | undefined,
  rawAmount: string | undefined,
  rawToken: string | undefined,
  rawMemo: string | undefined,
  /** The amount itself was written with "$"; a "$" in the memo does not count. */
  dollarSign: boolean,
  text: string,
  start: number,
): PayIntent | null {
  if (!rawName || !rawAmount) return null;
  const payee = rawName.replace(/^@/, "").toLowerCase();
  if (!isValidNearName(payee)) return null;
  const amount = normalizeAmount(rawAmount);
  if (!/[1-9]/.test(amount)) return null;
  const token = tokenOf(rawToken ?? "", dollarSign);
  if (!token) return null;
  const sentenceStart = /\s/.test(text.charAt(start)) ? start + 1 : start;
  const memo = (rawMemo ?? "").trim();
  return { payee, amount, token, memo: memo === "" ? null : memo, span: text.length - sentenceStart };
}
