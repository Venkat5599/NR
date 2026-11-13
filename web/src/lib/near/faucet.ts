import { LunarError } from "../errors.ts";
import { isValidNearName } from "../near/name.ts";

export const FAUCET_URL = "https://helper.nearprotocol.com/account";

export type AccountRequest = { accountId: string; publicKey: string };

const ED25519_PUBLIC = /^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/;

/** A new top-level testnet name and the public half of a key made on the phone. */
export function readAccountRequest(body: unknown): AccountRequest {
  if (typeof body !== "object" || body === null) throw new LunarError("bad_input", "body must be an object");
  const accountId = (body as Record<string, unknown>)["accountId"];
  const publicKey = (body as Record<string, unknown>)["publicKey"];
  if (typeof accountId !== "string" || !accountId.endsWith(".testnet") || accountId.split(".").length !== 2 || !isValidNearName(accountId)) {
    throw new LunarError("bad_input", "accountId must look like name.testnet");
  }
  if (typeof publicKey !== "string" || !ED25519_PUBLIC.test(publicKey)) {
    throw new LunarError("bad_input", "publicKey must be ed25519:<base58>");
  }
  return { accountId, publicKey };
}

/**
 * The faucet answers 200 even when the account wasn't made: the transaction it sent is in the body,
 * and a taken name shows up only as a failed `CreateAccount` action inside it.
 */
export function faucetFailure(text: string): string | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null; // not a transaction outcome; the HTTP status decides
  }
  if (typeof body !== "object" || body === null) return null;
  const status = (body as Record<string, unknown>)["status"];
  if (typeof status !== "object" || status === null || !("Failure" in status)) return null;
  const failure = JSON.stringify((status as Record<string, unknown>)["Failure"]);
  return failure.includes("AccountAlreadyExists") ? "taken" : failure.slice(0, 160);
}

/** Maps the faucet's answer to an outcome; the private key never reaches this server. */
export function faucetOutcome(status: number, text: string): { created: true } {
  if (status >= 200 && status < 300) {
    const failure = faucetFailure(text);
    if (failure === "taken") throw new LunarError("bad_input", "that name is taken, pick another");
    if (failure !== null) throw new LunarError("upstream", `the faucet's transaction failed: ${failure}`);
    return { created: true };
  }
  if (status === 429) throw new LunarError("rate_limited", "the NEAR testnet faucet is busy; try again in a few minutes");
  if (/exist/i.test(text)) throw new LunarError("bad_input", "that name is taken, pick another");
  throw new LunarError("upstream", `the testnet faucet answered ${status}`);
}

export async function requestTestnetAccount(req: AccountRequest, doFetch: typeof fetch = fetch): Promise<{ created: true }> {
  let res: Response;
  try {
    res = await doFetch(FAUCET_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newAccountId: req.accountId, newAccountPublicKey: req.publicKey }),
    });
  } catch (cause) {
    throw new LunarError("upstream", "the testnet faucet could not be reached", { cause });
  }
  return faucetOutcome(res.status, await res.text());
}
