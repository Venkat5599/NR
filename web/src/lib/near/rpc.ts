import { LunarError } from "../errors.ts";
import { isRecord, list } from "../json.ts";
import { RPC_URL, type Network } from "./name.ts";

const TIMEOUT_MS = 15_000;

/** A JSON-RPC error from a NEAR node, keeping the node's error name (e.g. UNKNOWN_ACCOUNT). */
export class RpcError extends LunarError {
  readonly kind: string;

  constructor(kind: string, message: string) {
    super("chain", message);
    this.name = "RpcError";
    this.kind = kind;
  }
}

function rpcErrorOf(error: unknown): RpcError {
  if (!isRecord(error)) return new RpcError("UNKNOWN", "NEAR RPC error");
  const cause = isRecord(error["cause"]) ? error["cause"] : {};
  const kind = typeof cause["name"] === "string" ? cause["name"] : typeof error["name"] === "string" ? error["name"] : "UNKNOWN";
  const data = error["data"];
  const detail = typeof data === "string" ? data : isRecord(data) ? JSON.stringify(data) : typeof error["message"] === "string" ? error["message"] : kind;
  return new RpcError(kind, detail.slice(0, 300));
}

/** [revalidateSeconds] lets a server-rendered page cache the answer; calls are uncached by default. */
export async function rpcCall(method: string, params: unknown, url: string = RPC_URL.testnet, revalidateSeconds?: number): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "lunar", method, params }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(revalidateSeconds === undefined ? { cache: "no-store" as const } : { next: { revalidate: revalidateSeconds } }),
    });
  } catch (cause) {
    throw new LunarError("chain", "NEAR RPC did not answer", { cause });
  }
  const body: unknown = await response.json().catch((cause: unknown) => {
    throw new LunarError("chain", `NEAR RPC answered ${response.status} without JSON`, { cause });
  });
  if (!isRecord(body)) throw new LunarError("chain", "NEAR RPC answered with a non-object");
  if (body["error"] !== undefined) throw rpcErrorOf(body["error"]);
  return body["result"];
}

/** Calls a view method and decodes its JSON result. */
export async function viewFunction(contract: string, method: string, args: unknown, network: Network = "testnet"): Promise<unknown> {
  const result = await rpcCall(
    "query",
    {
      request_type: "call_function",
      finality: "optimistic",
      account_id: contract,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    },
    RPC_URL[network],
  );
  const bytes = list(isRecord(result) ? result["result"] : undefined, "view result", "chain");
  const raw = Buffer.from(bytes.filter((b): b is number => typeof b === "number")).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new LunarError("chain", `${method} returned non-JSON`, { cause });
  }
}

/** True when the account exists, false when the node says it does not. */
export async function accountExists(account: string, network: Network): Promise<boolean> {
  try {
    await rpcCall("query", { request_type: "view_account", finality: "final", account_id: account }, RPC_URL[network]);
    return true;
  } catch (error) {
    if (error instanceof RpcError && error.kind === "UNKNOWN_ACCOUNT") return false;
    throw error;
  }
}
