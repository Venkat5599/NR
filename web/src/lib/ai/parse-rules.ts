import { LunarError } from "../errors.ts";
import { isRecord, parseJson } from "../json.ts";
import { isValidNearName } from "../near/name.ts";
import { normalizeAmount, type Token } from "../pay/parser.ts";

export const MAX_SENTENCE = 300;
const MAX_MEMO = 80;

export type ParsedPayment = { isPayment: true; payee: string; amount: string; token: Token; memo: string | null };
export type NotAPayment = { isPayment: false; reason: string };
export type ParseOutcome = ParsedPayment | NotAPayment;

/** The request body: one sentence, at most MAX_SENTENCE characters. */
export function readSentence(body: unknown): string {
  if (!isRecord(body) || typeof body["sentence"] !== "string") {
    throw new LunarError("bad_input", "send {\"sentence\": \"...\"}");
  }
  const sentence = body["sentence"].trim();
  if (sentence === "") throw new LunarError("bad_input", "sentence is empty");
  if (sentence.length > MAX_SENTENCE) throw new LunarError("bad_input", `sentence is longer than ${MAX_SENTENCE} characters`);
  return sentence;
}

/** Takes the model's reply as JSON, or the first {...} block inside it when the model wrapped it in prose. */
export function modelJson(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) return parseJson(trimmed, "model reply");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new LunarError("upstream", "model reply holds no JSON object");
  return parseJson(trimmed.slice(start, end + 1), "model reply");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A bare word like "bob" is a valid top-level NEAR name, but in a chat it is someone's first
 * name. Free-form sentences only pay full accounts: a name with a suffix, or an implicit address.
 */
export function isFullAccount(payee: string): boolean {
  return payee.includes(".") || /^[0-9a-f]{64}$/.test(payee) || /^0x[0-9a-f]{40}$/.test(payee);
}

/** The model may only pick a name the user typed as a whole word; it never invents or completes one. */
export function typedInSentence(payee: string, sentence: string): boolean {
  const boundary = "[^a-z0-9._-]";
  // a full stop right after the name ends the sentence ("send 2 to bob.near."); it is not part of the name
  return new RegExp(`(^|${boundary})@?${escapeRegExp(payee)}\\.*($|${boundary})`).test(sentence.toLowerCase());
}

function tokenOf(raw: unknown): Token | null {
  const t = typeof raw === "string" && raw !== "" ? raw.toUpperCase() : "NEAR";
  if (t === "NEAR") return "NEAR";
  if (t === "USDC" || t === "USD") return "USDC";
  if (t === "USDT") return "USDT";
  return null;
}

function amountOf(raw: unknown): string | null {
  const s = typeof raw === "number" && Number.isFinite(raw) ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{1,9}([.,]\d{1,24})?$/.test(s)) return null;
  const amount = normalizeAmount(s);
  return /[1-9]/.test(amount) ? amount : null;
}

/** Checks everything the model returned before it can become a payment card. */
export function interpretModelReply(reply: unknown, sentence: string): ParseOutcome {
  if (!isRecord(reply)) throw new LunarError("upstream", "model reply is not an object");
  if (reply["isPayment"] !== true) {
    const reason = typeof reply["reason"] === "string" && reply["reason"] !== "" ? reply["reason"] : "not a payment";
    return { isPayment: false, reason: reason.slice(0, 160) };
  }
  const payee = typeof reply["payee"] === "string" ? reply["payee"].trim().toLowerCase().replace(/^@/, "") : "";
  if (!isValidNearName(payee)) return { isPayment: false, reason: "no valid NEAR name in the sentence" };
  if (!isFullAccount(payee)) return { isPayment: false, reason: "type the full NEAR name, e.g. bob.testnet" };
  if (!typedInSentence(payee, sentence)) return { isPayment: false, reason: "type the full NEAR name, e.g. bob.testnet" };
  const amount = amountOf(reply["amount"]);
  if (!amount) return { isPayment: false, reason: "no amount in the sentence" };
  const token = tokenOf(reply["token"]);
  if (!token) return { isPayment: false, reason: "unknown token" };
  const memo = typeof reply["memo"] === "string" && reply["memo"].trim() !== "" ? reply["memo"].trim().slice(0, MAX_MEMO) : null;
  return { isPayment: true, payee, amount, token, memo };
}
