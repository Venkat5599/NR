// Hex, base58 and ERC-20 Transfer log decoding.

export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** A log as returned by `eth_getLogs` / `eth_getTransactionReceipt`. */
export interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockHash: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  logIndex: string;
  removed?: boolean;
}

export interface Transfer {
  token: string;
  from: string;
  to: string;
  amount: bigint;
  txHash: string;
  logIndex: number;
  blockNumber: number;
}

const HEX = /^0x[0-9a-fA-F]*$/;

export function hexToBytes(hex: string): Uint8Array {
  if (!HEX.test(hex) || hex.length % 2 !== 0) {
    throw new Error(`invalid hex: ${hex.slice(0, 20)}`);
  }
  return Uint8Array.from(Buffer.from(hex.slice(2), "hex"));
}

export function bytesToHex(bytes: Uint8Array): string {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

export function quantity(hex: string): number {
  if (!/^0x[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`invalid quantity: ${hex}`);
  }
  const n = Number.parseInt(hex.slice(2), 16);
  if (!Number.isSafeInteger(n)) {
    throw new Error(`quantity too large: ${hex}`);
  }
  return n;
}

export function toQuantity(n: bigint | number): string {
  return `0x${n.toString(16)}`;
}

/** Normalizes an address to lowercase `0x` + 40 hex digits. */
export function normalizeAddress(address: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`invalid address: ${address}`);
  }
  return address.toLowerCase();
}

/** Left-pads an address to a 32-byte topic. */
export function addressTopic(address: string): string {
  return `0x${"0".repeat(24)}${normalizeAddress(address).slice(2)}`;
}

function topicAddress(topic: string): string {
  if (!/^0x0{24}[0-9a-fA-F]{40}$/.test(topic)) {
    throw new Error(`topic is not an address: ${topic}`);
  }
  return `0x${topic.slice(26).toLowerCase()}`;
}

/** Decodes an ERC-20 `Transfer(address,address,uint256)` log. */
export function decodeTransfer(log: RpcLog): Transfer {
  if (log.removed === true) {
    throw new Error("log was removed by a reorg");
  }
  const [topic0, fromTopic, toTopic] = log.topics;
  if (log.topics.length !== 3 || topic0 === undefined || topic0.toLowerCase() !== TRANSFER_TOPIC) {
    throw new Error("not an ERC-20 Transfer log");
  }
  if (fromTopic === undefined || toTopic === undefined) {
    throw new Error("missing Transfer topics");
  }
  const data = hexToBytes(log.data);
  if (data.length !== 32) {
    throw new Error("Transfer data is not one word");
  }
  return {
    token: normalizeAddress(log.address),
    from: topicAddress(fromTopic),
    to: topicAddress(toTopic),
    amount: BigInt(log.data),
    txHash: log.transactionHash.toLowerCase(),
    logIndex: quantity(log.logIndex),
    blockNumber: quantity(log.blockNumber),
  };
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) {
    const v = B58.indexOf(c);
    if (v < 0) {
      throw new Error(`invalid base58 character: ${c}`);
    }
    n = n * 58n + BigInt(v);
  }
  const body: number[] = [];
  while (n > 0n) {
    body.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  let zeros = 0;
  while (s[zeros] === "1") {
    zeros += 1;
  }
  return Uint8Array.from([...new Array<number>(zeros).fill(0), ...body]);
}

/** Parses `secp256k1:<base58>` into the 64-byte uncompressed key without prefix. */
export function parseNearSecp256k1Key(key: string): Uint8Array {
  const prefix = "secp256k1:";
  if (!key.startsWith(prefix)) {
    throw new Error(`not a secp256k1 key: ${key.slice(0, 16)}`);
  }
  const bytes = base58Decode(key.slice(prefix.length));
  if (bytes.length !== 64) {
    throw new Error(`secp256k1 key has ${bytes.length} bytes, expected 64`);
  }
  return bytes;
}
