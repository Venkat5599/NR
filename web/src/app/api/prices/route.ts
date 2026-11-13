import { fail, ok } from "@/lib/http";
import { livePrices } from "@/lib/prices";

export const dynamic = "force-dynamic";

/** Live USD prices for NEAR, USDC, USDT, ETH, BTC and SOL from NEAR Intents. */
export async function GET(): Promise<Response> {
  try {
    return ok(await livePrices());
  } catch (error) {
    return fail(error);
  }
}
