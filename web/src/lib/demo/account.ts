import { LunarError } from "../errors.ts";
import { isValidNearName } from "../near/name.ts";

export type DemoAccount = { accountId: string; secretKey: string };

/** The shared demo account and its pay-only key, from the server environment. */
export function demoAccount(env: Record<string, string | undefined>): DemoAccount {
  const accountId = env["LUNAR_DEMO_ACCOUNT"]?.trim() ?? "";
  const secretKey = env["LUNAR_DEMO_KEY"]?.trim() ?? "";
  if (accountId === "" || secretKey === "") {
    throw new LunarError("not_configured", "the demo needs LUNAR_DEMO_ACCOUNT and LUNAR_DEMO_KEY");
  }
  if (!isValidNearName(accountId)) throw new LunarError("not_configured", "LUNAR_DEMO_ACCOUNT is not a NEAR name");
  return { accountId, secretKey };
}
