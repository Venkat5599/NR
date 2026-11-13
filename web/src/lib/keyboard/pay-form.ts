import { isValidNearName } from "../near/name.ts";

/**
 * The pay form inside the keyboard: who, how much, in what, what for. Keys type into the
 * active field instead of the chat. Same rules as the phone (android/.../core/PayForm.kt).
 * The state is a plain value; every function returns a new one.
 */

export type Field = "to" | "amount" | "memo";
export const TOKENS = ["NEAR", "USDC", "USDT"] as const;
export type FormToken = (typeof TOKENS)[number];

export type PayForm = { to: string; amount: string; memo: string; token: FormToken; active: Field };

export type FormCheck =
  | { ok: true; payee: string; amount: string; token: FormToken; memo: string | null }
  | { ok: false; field: Field; message: string };

export const MEMO_MAX = 60;

export const emptyForm = (): PayForm => ({ to: "", amount: "", memo: "", token: "NEAR", active: "to" });

const NEXT: Record<Field, Field | null> = { to: "amount", amount: "memo", memo: null };
const PREV: Record<Field, Field> = { to: "to", amount: "to", memo: "amount" };

function isToken(s: string): s is FormToken {
  return (TOKENS as readonly string[]).includes(s);
}

/** Types [s] (a key, or an option picked from a held key) into the active field. */
export function typeInto(f: PayForm, s: string): PayForm {
  if (s === " ") return f.active === "memo" ? { ...f, memo: (f.memo + " ").slice(0, MEMO_MAX) } : next(f).form;
  switch (f.active) {
    case "to": {
      if (f.to === "" && s === "@") return f;
      const clean = s.toLowerCase().replace(/[^a-z0-9._-]/g, "");
      return { ...f, to: (f.to + clean).slice(0, 64) };
    }
    case "amount": {
      const upper = s.toUpperCase();
      if (isToken(upper)) return { ...f, token: upper };
      if (s === "$") return { ...f, token: "USDC" };
      if (/^\d+$/.test(s)) return { ...f, amount: (f.amount === "0" ? s : f.amount + s).slice(0, 18) };
      if ((s === "." || s === ",") && !f.amount.includes(".")) return { ...f, amount: (f.amount === "" ? "0" : f.amount) + "." };
      return f;
    }
    case "memo":
      return { ...f, memo: (f.memo + s).slice(0, MEMO_MAX) };
  }
}

/** Deletes one character; on an empty field it steps back to the previous one. */
export function deleteFrom(f: PayForm): PayForm {
  switch (f.active) {
    case "to":
      return { ...f, to: f.to.slice(0, -1) };
    case "amount":
      return f.amount === "" ? { ...f, active: PREV.amount } : { ...f, amount: f.amount.slice(0, -1) };
    case "memo":
      return f.memo === "" ? { ...f, active: PREV.memo } : { ...f, memo: f.memo.slice(0, -1) };
  }
}

/** Moves on; `review` is true when the last field was done. */
export function next(f: PayForm): { form: PayForm; review: boolean } {
  const n = NEXT[f.active];
  return n === null ? { form: f, review: true } : { form: { ...f, active: n }, review: false };
}

export function cycleToken(f: PayForm): PayForm {
  return { ...f, token: TOKENS[(TOKENS.indexOf(f.token) + 1) % TOKENS.length] ?? "NEAR" };
}

export function choosePayee(f: PayForm, name: string): PayForm {
  return { ...f, to: name, active: f.amount === "" ? "amount" : "memo" };
}

export function setAmount(f: PayForm, amount: string): PayForm {
  return { ...f, amount: String(Number(amount)).slice(0, 18) };
}

export function checkForm(f: PayForm): FormCheck {
  if (f.to === "") return { ok: false, field: "to", message: "Who are you paying?" };
  const implicit = /^[0-9a-f]{64}$/.test(f.to) || /^0x[0-9a-f]{40}$/.test(f.to);
  if (!isValidNearName(f.to) || (!f.to.includes(".") && !implicit)) return { ok: false, field: "to", message: "Type the full name, e.g. bob.testnet" };
  const value = Number(f.amount);
  if (f.amount === "" || !Number.isFinite(value) || value <= 0) return { ok: false, field: "amount", message: "How much?" };
  return { ok: true, payee: f.to, amount: String(value), token: f.token, memo: f.memo.trim() === "" ? null : f.memo.trim() };
}
