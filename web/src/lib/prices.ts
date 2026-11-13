import { LunarError } from "./errors.ts";
import { isRecord, list } from "./json.ts";

/**
 * Live USD prices from NEAR Intents' public token list (the same service that quotes the
 * cross-chain leg), one per symbol, preferring the NEAR-native listing.
 */

const URL = "https://1click.chaindefuser.com/v0/tokens";
const TTL_MS = 60_000;
const WANTED: Record<string, string> = { wNEAR: "NEAR", USDC: "USDC", USDT: "USDT", ETH: "ETH", BTC: "BTC", SOL: "SOL" };

export type PriceTable = { prices: Record<string, number>; updatedAt: string | null };

export function parsePrices(tokens: unknown): PriceTable {
  const out: Record<string, number> = {};
  let updatedAt: string | null = null;
  const rows = list(tokens, "token list").filter(isRecord);
  for (const nativeOnly of [true, false]) {
    for (const t of rows) {
      const sym = typeof t["symbol"] === "string" ? WANTED[t["symbol"]] : undefined;
      if (sym === undefined || out[sym] !== undefined) continue;
      if (nativeOnly && t["blockchain"] !== "near") continue;
      const price = typeof t["price"] === "number" ? t["price"] : Number(t["price"]);
      if (!Number.isFinite(price) || price <= 0) continue;
      out[sym] = price;
      if (typeof t["priceUpdatedAt"] === "string" && (updatedAt === null || t["priceUpdatedAt"] > updatedAt)) updatedAt = t["priceUpdatedAt"];
    }
  }
  return { prices: out, updatedAt };
}

let cache: { at: number; table: PriceTable } | null = null;

export async function livePrices(doFetch: typeof fetch = fetch, now: () => number = Date.now): Promise<PriceTable> {
  if (cache && now() - cache.at < TTL_MS) return cache.table;
  let body: unknown;
  try {
    const res = await doFetch(URL, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
    if (!res.ok) throw new LunarError("upstream", `the price service answered ${res.status}`);
    body = await res.json();
  } catch (cause) {
    if (cache) return cache.table;
    if (cause instanceof LunarError) throw cause;
    throw new LunarError("upstream", "the price service could not be reached", { cause });
  }
  const table = parsePrices(body);
  if (Object.keys(table.prices).length === 0) throw new LunarError("upstream", "the price service listed no prices");
  cache = { at: now(), table };
  return table;
}
