import { LunarError } from "@/lib/errors";
import { clientIp, fail, ok, readJson } from "@/lib/http";
import { readAccountRequest, requestTestnetAccount } from "@/lib/near/faucet";
import { createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const limiter = createRateLimiter(2, 10 * 60_000);

/**
 * Second route to the testnet faucet for the phone app, used when the phone's own request
 * is refused. Only the account name and the public key pass through here.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const req = readAccountRequest(await readJson(request));
    if (!limiter.take(clientIp(request))) throw new LunarError("rate_limited", "two new accounts per visitor every ten minutes");
    return ok(await requestTestnetAccount(req));
  } catch (error) {
    return fail(error);
  }
}
