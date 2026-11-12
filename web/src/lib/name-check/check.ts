import { LunarError } from "../errors.ts";
import { chainName, intentsQuote, type IntentsQuote } from "../intents/quote.ts";
import { keyVerdict, type KeyVerdict } from "../near/key-history.ts";
import { getReceivePref, type ReceivePref } from "../near/lunar-pay.ts";
import { isValidNearName, networkOf, type Network } from "../near/name.ts";
import { nearblocks } from "../near/nearblocks.ts";
import { accountExists } from "../near/rpc.ts";

export type QuoteLine = { kind: "quote"; quote: IntentsQuote; chainLabel: string } | { kind: "unavailable"; reason: string } | { kind: "none" };

export type NameCheck = {
  account: string;
  network: Network;
  exists: boolean;
  keys: KeyVerdict;
  receive: ReceivePref | null;
  quote: QuoteLine;
};

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: Omit<NameCheck, "quote"> }>();

export function readAccountParam(raw: string | null): string {
  const account = (raw ?? "").trim().toLowerCase().replace(/^@/, "");
  if (!isValidNearName(account)) throw new LunarError("bad_input", "account must be a valid NEAR account name");
  return account;
}

/** Turns a coded failure of one lookup into a visible "unknown" instead of failing the whole check. */
async function orReason<T>(work: Promise<T>, onError: (reason: string) => T): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof LunarError) return onError(error.message);
    throw error;
  }
}

async function lookUp(account: string): Promise<Omit<NameCheck, "quote">> {
  const hit = cache.get(account);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const network = networkOf(account);
  const exists = await accountExists(account, network);
  const [keys, receive] = exists
    ? await Promise.all([
        orReason<KeyVerdict>(
          nearblocks(network, `/accounts/${account}/keys`).then((r) => keyVerdict(r, Date.now())),
          (reason) => ({ kind: "unknown", reason }),
        ),
        network === "testnet" ? getReceivePref(account) : Promise.resolve(null),
      ])
    : [{ kind: "unknown", reason: "no such account" } satisfies KeyVerdict, null];
  const value = { account, network, exists, keys, receive };
  cache.set(account, { at: Date.now(), value });
  return value;
}

/** Everything the pay card says about a name before paying it. */
export async function checkName(account: string, nearAmount: string | null): Promise<NameCheck> {
  const base = await lookUp(account);
  const pref = base.receive;
  if (!pref || pref.chain.toLowerCase() === "near" || nearAmount === null) return { ...base, quote: { kind: "none" } };
  const quote = await orReason<QuoteLine>(
    intentsQuote(nearAmount, pref.chain, pref.token, pref.address).then((q) =>
      q ? { kind: "quote", quote: q, chainLabel: chainName(q.chain) } : { kind: "unavailable", reason: `${pref.token} on ${chainName(pref.chain)} is not offered` },
    ),
    (reason) => ({ kind: "unavailable", reason }),
  );
  return { ...base, quote };
}
