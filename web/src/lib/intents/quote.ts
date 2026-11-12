import { LunarError } from "../errors.ts";
import { isRecord, list, record, text } from "../json.ts";
import { nearToYocto } from "../near/amount.ts";

const API = "https://1click.chaindefuser.com/v0";
const WNEAR = "nep141:wrap.near";
const TOKENS_TTL_MS = 10 * 60_000;
const TIMEOUT_MS = 10_000;

export type IntentsQuote = { amountOut: string; token: string; chain: string; seconds: number };

const CHAIN_NAMES: Record<string, string> = {
  base: "Base",
  arb: "Arbitrum",
  sol: "Solana",
  eth: "Ethereum",
  pol: "Polygon",
  bsc: "BNB Chain",
  near: "NEAR",
};

export function chainName(chain: string): string {
  return CHAIN_NAMES[chain.toLowerCase()] ?? chain;
}

/** The asset id for [token] on [chain] in a /v0/tokens list. */
export function findAsset(tokens: unknown, chain: string, token: string): string | null {
  for (const t of list(tokens, "token list")) {
    if (!isRecord(t)) continue;
    const sameChain = typeof t["blockchain"] === "string" && t["blockchain"].toLowerCase() === chain.toLowerCase();
    const sameToken = typeof t["symbol"] === "string" && t["symbol"].toLowerCase() === token.toLowerCase();
    if (sameChain && sameToken && typeof t["assetId"] === "string") return t["assetId"];
  }
  return null;
}

/** "3.4567" -> "3.45": quotes are shown rounded down to cents. */
export function centsDown(formatted: string): string {
  const [whole = "0", frac = ""] = formatted.split(".");
  return `${whole}.${frac.padEnd(2, "0").slice(0, 2)}`;
}

export function quoteFrom(response: unknown, token: string, chain: string): IntentsQuote {
  const q = record(record(response, "quote response")["quote"], "quote");
  const out = text(q["amountOutFormatted"], "amountOutFormatted");
  const seconds = typeof q["timeEstimate"] === "number" ? q["timeEstimate"] : 0;
  return { amountOut: centsDown(out), token: token.toUpperCase(), chain, seconds };
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (cause) {
    throw new LunarError("upstream", "the Intents API did not answer", { cause });
  }
  if (!response.ok) throw new LunarError("upstream", `the Intents API answered ${response.status}`);
  return response.json().catch((cause: unknown) => {
    throw new LunarError("upstream", "the Intents API sent non-JSON", { cause });
  });
}

let tokens: { at: number; value: unknown } | null = null;

async function tokenList(): Promise<unknown> {
  if (tokens && Date.now() - tokens.at < TOKENS_TTL_MS) return tokens.value;
  const value = await getJson(`${API}/tokens`);
  tokens = { at: Date.now(), value };
  return value;
}

/** A live dry-run quote for paying [nearAmount] NEAR into [token] on [chain]; null when that pair isn't offered. */
export async function intentsQuote(nearAmount: string, chain: string, token: string, recipient: string): Promise<IntentsQuote | null> {
  const asset = findAsset(await tokenList(), chain, token);
  if (!asset) return null;
  const response = await getJson(`${API}/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      dry: true,
      swapType: "EXACT_INPUT",
      slippageTolerance: 100,
      originAsset: WNEAR,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: asset,
      amount: nearToYocto(nearAmount).toString(),
      refundTo: "lunar.near",
      refundType: "ORIGIN_CHAIN",
      recipient,
      recipientType: "DESTINATION_CHAIN",
      deadline: new Date(Date.now() + 600_000).toISOString(),
    }),
  });
  return quoteFrom(response, token, chain);
}
