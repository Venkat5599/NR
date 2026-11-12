import { demoAccount } from "@/lib/demo/account";
import { readDemoPay } from "@/lib/demo/pay-request";
import { LunarError } from "@/lib/errors";
import { clientIp, fail, ok, readJson } from "@/lib/http";
import { isPayResult, PAY_CONTRACT } from "@/lib/near/lunar-pay";
import { explorerTx } from "@/lib/near/name";
import { callFunction } from "@/lib/near/sign";
import { createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const PAY_GAS = 30_000_000_000_000n;
const limiter = createRateLimiter(4, 30_000);

/** Pays from the shared demo pocket with its pay-only key. The contract, not this route, enforces the cap. */
export async function POST(request: Request): Promise<Response> {
  try {
    if (!limiter.take(clientIp(request))) throw new LunarError("rate_limited", "a few payments a minute per visitor; try again shortly");
    const demo = demoAccount(process.env);
    const pay = readDemoPay(await readJson(request), demo.accountId);
    const { txHash, returned } = await callFunction({
      signerId: demo.accountId,
      secretKey: demo.secretKey,
      receiverId: PAY_CONTRACT,
      method: "pay",
      args: { to: pay.to, amount: pay.yocto.toString(), memo: pay.memo },
      gas: PAY_GAS,
      deposit: 0n,
    });
    if (!isPayResult(returned)) throw new LunarError("chain", "pay returned an unexpected value");
    return ok({ result: returned, txHash, explorer: explorerTx(txHash), to: pay.to, amount: pay.amount });
  } catch (error) {
    return fail(error);
  }
}
