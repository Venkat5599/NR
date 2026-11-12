/** Someone the user has paid before, with the address they paid. */
export type Payee = { name: string; address: string };

/** What the keyboard says about a pasted address. */
export type PasteVerdict =
  | { kind: "not-an-address" }
  | { kind: "new"; address: string }
  | { kind: "known"; payee: Payee }
  /** Shares its start and end with a saved address but is not it: the address-poisoning pattern. */
  | { kind: "lookalike"; pasted: string; payee: Payee };

const EVM = /0x[0-9a-fA-F]{40}/g;

/** Hex characters after "0x", and at the end, that must match to count as a lookalike. */
export const PREFIX = 4;
export const SUFFIX = 4;

/** Pulls one address out of the pasted text, if it is (mostly) just an address. */
export function extractAddress(clip: string | null | undefined): string | null {
  if (!clip || clip.trim() === "") return null;
  const text = clip.trim();
  if (text.length > 120) return null;
  const all = text.match(EVM) ?? [];
  return all.length === 1 ? (all[0] ?? null) : null;
}

export function looksLike(a: string, b: string): boolean {
  if (a === b || a.length !== b.length || a.length < 2 + PREFIX + SUFFIX) return false;
  return a.slice(2, 2 + PREFIX) === b.slice(2, 2 + PREFIX) && a.slice(-SUFFIX) === b.slice(-SUFFIX);
}

export function checkPaste(clip: string | null | undefined, payees: readonly Payee[]): PasteVerdict {
  const pasted = extractAddress(clip);
  if (!pasted) return { kind: "not-an-address" };
  const p = pasted.toLowerCase();
  const known = payees.find((it) => it.address.toLowerCase() === p);
  if (known) return { kind: "known", payee: known };
  const lookalike = payees.find((it) => looksLike(p, it.address.toLowerCase()));
  if (lookalike) return { kind: "lookalike", pasted, payee: lookalike };
  return { kind: "new", address: pasted };
}

/** "0x9f3a…b21c", the way wallets show it. */
export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
