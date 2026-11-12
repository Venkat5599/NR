import { LunarError } from "../errors.ts";
import { NEARBLOCKS_API, type Network } from "./name.ts";

const TIMEOUT_MS = 12_000;

/** GET from the nearblocks v3 API, e.g. nearblocks("testnet", "/accounts/bob.testnet/keys"). */
export async function nearblocks(network: Network, path: string, revalidateSeconds?: number): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${NEARBLOCKS_API[network]}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(revalidateSeconds === undefined ? { cache: "no-store" as const } : { next: { revalidate: revalidateSeconds } }),
    });
  } catch (cause) {
    throw new LunarError("upstream", "the chain indexer did not answer", { cause });
  }
  if (response.status === 429) throw new LunarError("upstream", "the chain indexer is rate-limiting; try again in a minute");
  if (!response.ok) throw new LunarError("upstream", `the chain indexer answered ${response.status}`);
  return response.json().catch((cause: unknown) => {
    throw new LunarError("upstream", "the chain indexer sent non-JSON", { cause });
  });
}
