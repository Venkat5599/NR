import { LunarError } from "../errors.ts";
import { nearToYocto } from "./amount.ts";
import { viewFunction } from "./rpc.ts";

/**
 * Swap quotes from Ref Finance on NEAR testnet, the pools the phone app swaps through
 * (android/.../near/TestnetSwap.kt). Test pools hold test tokens, so the rate is not the
 * market rate; the market value comes from live prices.
 */

export const REF = "ref-finance-101.testnet";
export const WRAP = "wrap.testnet";

export type SwapRoute = { symbol: "USDC" | "USDT"; token: string; pool: number; decimals: number };

export const ROUTES: readonly SwapRoute[] = [
  { symbol: "USDC", token: "usdc.itachicara.testnet", pool: 1103, decimals: 24 },
  { symbol: "USDT", token: "usdt.itachicara.testnet", pool: 1084, decimals: 24 },
];

/** A real swap the phone app made through these pools, for the demo to link. */
export const RECORDED_SWAP_TX = "2D1Quz6d5BfQPKbC6d7gxtc59G7bdRVhJLpDpSSpeXn6";

export function routeFor(symbol: string): SwapRoute {
  const r = ROUTES.find((x) => x.symbol === symbol.toUpperCase());
  if (!r) throw new LunarError("bad_input", "swaps go to USDC or USDT");
  return r;
}

/** Raw units to a short decimal, rounded down to 4 places. */
export function fromUnits(raw: bigint, decimals: number): string {
  const s = raw.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).slice(0, 4).replace(/0+$/, "");
  return frac === "" ? whole : `${whole}.${frac}`;
}

export function readU128(v: unknown): bigint {
  if (typeof v !== "string" || !/^\d+$/.test(v)) throw new LunarError("chain", "the pool returned an unexpected value");
  return BigInt(v);
}

export async function swapQuote(amountNear: string, symbol: string, view: typeof viewFunction = viewFunction): Promise<{ out: string; route: SwapRoute }> {
  const route = routeFor(symbol);
  const raw = readU128(await view(REF, "get_return", { pool_id: route.pool, token_in: WRAP, amount_in: nearToYocto(amountNear).toString(), token_out: route.token }));
  return { out: fromUnits(raw, route.decimals), route };
}
