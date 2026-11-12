import { demoAccount } from "@/lib/demo/account";
import { fail, ok } from "@/lib/http";
import { getPocket } from "@/lib/near/lunar-pay";

export const dynamic = "force-dynamic";

/** The demo account's pocket as the payments contract reports it. */
export async function GET(): Promise<Response> {
  try {
    return ok(await getPocket(demoAccount(process.env).accountId));
  } catch (error) {
    return fail(error);
  }
}
