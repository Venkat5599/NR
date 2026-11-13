import { LunarError } from "@/lib/errors";
import { clientIp, fail, ok } from "@/lib/http";
import { RECORDED_SWAP_TX, swapQuote } from "@/lib/near/ref-swap";
import { explorerTx } from "@/lib/near/name";
import { livePrices } from "@/lib/prices";
import { createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(20, 60_000);

/** A live quote from the Ref Finance testnet pool the phone app swaps through, with the market value beside it. */
export async function GET(request: Request): Promise<Response> {
  try {
    if (!limiter.take(clientIp(request))) throw new LunarError("rate_limited", "too many quotes; try again in a minute");
    const url = new URL(request.url);
    const amount = url.searchParams.get("amount") ?? "";
    const to = url.searchParams.get("to") ?? "USDC";
    if (!/^\d{1,6}(\.\d{1,6})?$/.test(amount) || Number(amount) <= 0) throw new LunarError("bad_input", "amount must be a positive number of NEAR");
    const [quote, prices] = await Promise.all([swapQuote(amount, to), livePrices().catch(() => null)]);
    const near = prices?.prices["NEAR"];
    return ok({
      amount,
      to: quote.route.symbol,
      out: quote.out,
      pool: quote.route.pool,
      marketUsd: near === undefined ? null : (Number(amount) * near).toFixed(2),
      recordedSwap: explorerTx(RECORDED_SWAP_TX),
    });
  } catch (error) {
    return fail(error);
  }
}
