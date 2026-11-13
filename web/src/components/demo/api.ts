import type { ParseOutcome } from "@/lib/ai/parse-rules";
import type { NameCheck } from "@/lib/name-check/check";
import type { PayResult, Pocket } from "@/lib/near/lunar-pay";

/** An error reply from one of this site's API routes, with the route's error code. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export type PayReply = { result: PayResult; txHash: string; explorer: string; to: string; amount: string };
export type ParseReply = ParseOutcome & { model: string };
export type PricesReply = { prices: Record<string, number>; updatedAt: string | null };
export type SwapQuoteReply = { amount: string; to: "USDC" | "USDT"; out: string; pool: number; marketUsd: string | null; recordedSwap: string };

function errorFrom(body: unknown, status: number): ApiError {
  const error = typeof body === "object" && body !== null && "error" in body ? body.error : null;
  if (typeof error === "object" && error !== null && "code" in error && "message" in error) {
    return new ApiError(String(error.code), String(error.message), status);
  }
  return new ApiError("http", `the server answered ${status}`, status);
}

/** Calls one of this site's routes; the routes and these types come from the same source. */
async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store" });
  } catch (cause) {
    throw new ApiError("network", "couldn't reach the server", 0, { cause });
  }
  const raw = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new ApiError("http", `the server answered ${response.status} without JSON`, response.status, { cause });
  }
  if (!response.ok) throw errorFrom(parsed, response.status);
  return parsed;
}

const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  pocket: () => call<Pocket>("/api/demo/pocket"),
  nameCheck: (account: string, amount: string) =>
    call<NameCheck>(`/api/name-check?account=${encodeURIComponent(account)}&amount=${encodeURIComponent(amount)}`),
  pay: (to: string, amount: string, memo: string | null) => call<PayReply>("/api/demo/pay", post({ to, amount, memo })),
  parse: (sentence: string) => call<ParseReply>("/api/parse", post({ sentence })),
  prices: () => call<PricesReply>("/api/prices"),
  swapQuote: (amount: string, to: string) => call<SwapQuoteReply>(`/api/swap-quote?amount=${encodeURIComponent(amount)}&to=${encodeURIComponent(to)}`),
};
