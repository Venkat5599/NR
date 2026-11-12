// JSON-RPC clients for an EVM chain and NEAR (view calls only).

import type { RpcLog } from "./codec.ts";
import { quantity, toQuantity } from "./codec.ts";

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, what: string): string {
  if (typeof v !== "string") {
    throw new Error(`${what} is not a string`);
  }
  return v;
}

let nextId = 1;

export async function jsonRpc(fetchFn: Fetch, url: string, method: string, params: unknown): Promise<unknown> {
  const id = nextId++;
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (!res.ok) {
    throw new Error(`${method}: HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!isRecord(body)) {
    throw new Error(`${method}: malformed response`);
  }
  if (body["error"] !== undefined) {
    throw new Error(`${method}: ${JSON.stringify(body["error"])}`);
  }
  return body["result"];
}

function asLog(v: unknown): RpcLog {
  if (!isRecord(v) || !Array.isArray(v["topics"])) {
    throw new Error("malformed log");
  }
  const log: RpcLog = {
    address: asString(v["address"], "log.address"),
    topics: v["topics"].map((t) => asString(t, "log.topic")),
    data: asString(v["data"], "log.data"),
    blockHash: asString(v["blockHash"], "log.blockHash"),
    blockNumber: asString(v["blockNumber"], "log.blockNumber"),
    transactionHash: asString(v["transactionHash"], "log.transactionHash"),
    transactionIndex: asString(v["transactionIndex"], "log.transactionIndex"),
    logIndex: asString(v["logIndex"], "log.logIndex"),
  };
  if (typeof v["removed"] === "boolean") {
    log.removed = v["removed"];
  }
  return log;
}

export class EvmRpc {
  readonly url: string;
  readonly fetchFn: Fetch;

  constructor(url: string, fetchFn: Fetch) {
    this.url = url;
    this.fetchFn = fetchFn;
  }

  private call(method: string, params: unknown[]): Promise<unknown> {
    return jsonRpc(this.fetchFn, this.url, method, params);
  }

  async blockNumber(tag: "latest" | "finalized" = "latest"): Promise<number> {
    if (tag === "latest") {
      return quantity(asString(await this.call("eth_blockNumber", []), "blockNumber"));
    }
    const block = await this.call("eth_getBlockByNumber", [tag, false]);
    if (!isRecord(block)) {
      throw new Error(`no ${tag} block`);
    }
    return quantity(asString(block["number"], "block.number"));
  }

  async getLogs(filter: { address: string; topics: (string | string[] | null)[]; fromBlock: number; toBlock: number }): Promise<RpcLog[]> {
    const result = await this.call("eth_getLogs", [
      {
        address: filter.address,
        topics: filter.topics,
        fromBlock: toQuantity(filter.fromBlock),
        toBlock: toQuantity(filter.toBlock),
      },
    ]);
    if (!Array.isArray(result)) {
      throw new Error("eth_getLogs did not return an array");
    }
    return result.map(asLog);
  }

  async baseFee(): Promise<bigint> {
    const block = await this.call("eth_getBlockByNumber", ["latest", false]);
    if (!isRecord(block)) {
      throw new Error("no latest block");
    }
    return BigInt(asString(block["baseFeePerGas"], "baseFeePerGas"));
  }

  async maxPriorityFee(): Promise<bigint> {
    return BigInt(asString(await this.call("eth_maxPriorityFeePerGas", []), "maxPriorityFeePerGas"));
  }

  async nonce(address: string): Promise<number> {
    return quantity(asString(await this.call("eth_getTransactionCount", [address, "latest"]), "nonce"));
  }

  async balance(address: string): Promise<bigint> {
    return BigInt(asString(await this.call("eth_getBalance", [address, "latest"]), "balance"));
  }

  async receiptStatus(txHash: string): Promise<"missing" | "success" | "reverted"> {
    const receipt = await this.call("eth_getTransactionReceipt", [txHash]);
    if (receipt === null) {
      return "missing";
    }
    if (!isRecord(receipt)) {
      throw new Error("malformed receipt");
    }
    return receipt["status"] === "0x1" ? "success" : "reverted";
  }

  async sendRawTransaction(raw: string): Promise<string> {
    return asString(await this.call("eth_sendRawTransaction", [raw]), "tx hash");
  }
}

export class NearRpc {
  readonly url: string;
  readonly fetchFn: Fetch;

  constructor(url: string, fetchFn: Fetch) {
    this.url = url;
    this.fetchFn = fetchFn;
  }

  /** Calls a view method and returns its parsed JSON result. */
  async view(accountId: string, method: string, args: unknown): Promise<unknown> {
    const result = await jsonRpc(this.fetchFn, this.url, "query", {
      request_type: "call_function",
      finality: "final",
      account_id: accountId,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });
    if (!isRecord(result) || !Array.isArray(result["result"])) {
      throw new Error(`${method}: no result (${JSON.stringify(result).slice(0, 200)})`);
    }
    const bytes = Uint8Array.from(
      result["result"].map((b) => {
        if (typeof b !== "number") {
          throw new Error(`${method}: result is not a byte array`);
        }
        return b;
      }),
    );
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  }
}

export { isRecord, asString };
