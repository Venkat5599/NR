const NAMED = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const IMPLICIT = /^[0-9a-f]{64}$/;
const ETH_IMPLICIT = /^0x[0-9a-f]{40}$/;

/** NEAR account ids, by the protocol's own rules. */
export function isValidNearName(id: string): boolean {
  if (id.length < 2 || id.length > 64) return false;
  return IMPLICIT.test(id) || ETH_IMPLICIT.test(id) || NAMED.test(id);
}

export type Network = "mainnet" | "testnet";

export function networkOf(id: string): Network {
  return id.endsWith(".testnet") ? "testnet" : "mainnet";
}

export const RPC_URL: Record<Network, string> = {
  mainnet: "https://free.rpc.fastnear.com",
  testnet: "https://rpc.testnet.fastnear.com",
};

export const ARCHIVAL_RPC_URL: Record<Network, string> = {
  mainnet: "https://archival-rpc.mainnet.fastnear.com",
  testnet: "https://archival-rpc.testnet.fastnear.com",
};

export const NEARBLOCKS_API: Record<Network, string> = {
  mainnet: "https://api.nearblocks.io/v3",
  testnet: "https://api-testnet.nearblocks.io/v3",
};

export function explorerTx(hash: string, network: Network = "testnet"): string {
  return network === "testnet" ? `https://testnet.nearblocks.io/txns/${hash}` : `https://nearblocks.io/txns/${hash}`;
}
