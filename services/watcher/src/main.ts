// CLI: `derive <receiver>` checks a receive address three ways;
// `watch [--once] [--from <block>]` recovers transfers to registered receivers.

import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { normalizeAddress, parseNearSecp256k1Key, bytesToHex } from "./codec.ts";
import { deriveKey, deriveTweak, evmAddress } from "./derivation.ts";
import { findTransfers, handle } from "./loop.ts";
import type { WatchConfig } from "./loop.ts";
import { NearCliSubmitter } from "./near-cli.ts";
import { EvmRpc, NearRpc, asString, isRecord } from "./rpc.ts";

const env = {
  nearRpc: process.env["NEAR_RPC"] ?? "https://rpc.testnet.fastnear.com",
  evmRpc: process.env["EVM_RPC"] ?? "https://sepolia.base.org",
  contract: process.env["RECEIVE_CONTRACT"] ?? "lunar-recv-80366.testnet",
  signer: process.env["SIGNER_CONTRACT"] ?? "v1.signer-prod.testnet",
  submitAs: process.env["NEAR_ACCOUNT"] ?? "",
  receivers: (process.env["RECEIVERS"] ?? "").split(",").filter((r) => r.length > 0),
  pollMs: Number(process.env["POLL_MS"] ?? "15000"),
};

const near = new NearRpc(env.nearRpc, fetch);
const evm = new EvmRpc(env.evmRpc, fetch);

async function contractConfig(): Promise<{ signDomain: number; chain: WatchConfig }> {
  const cfg = await near.view(env.contract, "get_config", {});
  if (!isRecord(cfg) || !Array.isArray(cfg["chains"]) || typeof cfg["sign_domain_id"] !== "number") {
    throw new Error("malformed get_config");
  }
  const chain = cfg["chains"][0];
  if (!isRecord(chain) || !Array.isArray(chain["tokens"])) {
    throw new Error("contract has no chain configured");
  }
  return {
    signDomain: cfg["sign_domain_id"],
    chain: {
      chain: asString(chain["name"], "chain.name"),
      token: normalizeAddress(asString(chain["tokens"][0], "token")),
      contract: env.contract,
      maxFeeCap: BigInt(asString(chain["max_fee_per_gas_cap"], "max_fee_per_gas_cap")),
    },
  };
}

async function receiverAddress(receiver: string): Promise<string | null> {
  const view = await near.view(env.contract, "get_receiver", { account_id: receiver });
  return isRecord(view) ? normalizeAddress(asString(view["receive_address"], "receive_address")) : null;
}

async function derive(receiver: string): Promise<boolean> {
  const { signDomain } = await contractConfig();
  const root = asString(await near.view(env.signer, "public_key", { domain_id: signDomain }), "public_key");
  const offChain = deriveKey(parseNearSecp256k1Key(root), deriveTweak(env.contract, receiver));
  const signerKey = asString(
    await near.view(env.signer, "derived_public_key", { path: receiver, predecessor: env.contract, domain_id: signDomain }),
    "derived_public_key",
  );
  const fromSigner = parseNearSecp256k1Key(signerKey);
  const registered = await receiverAddress(receiver);
  const keysMatch = bytesToHex(offChain) === bytesToHex(fromSigner);
  const address = evmAddress(offChain);
  console.log(JSON.stringify({ receiver, contract: env.contract, offChainAddress: address, signerAddress: evmAddress(fromSigner), contractAddress: registered, keysMatch }, null, 2));
  return keysMatch && (registered === null || registered === address);
}

async function watch(once: boolean, from: number | null): Promise<void> {
  if (env.submitAs === "") {
    throw new Error("set NEAR_ACCOUNT to the testnet account that submits recover calls");
  }
  const { chain } = await contractConfig();
  const submit = new NearCliSubmitter(env.contract, env.submitAs, "testnet");
  const addresses: string[] = [];
  for (const r of env.receivers) {
    const a = await receiverAddress(r);
    if (a === null) {
      throw new Error(`${r} is not registered with ${env.contract}`);
    }
    addresses.push(a);
  }
  // The signer verifies at Finalized, so only finalized blocks are scanned.
  let next = from ?? Math.max(0, (await evm.blockNumber("finalized")) - 1000);
  for (;;) {
    const head = await evm.blockNumber("finalized");
    if (head >= next) {
      let retryFrom: number | null = null;
      for (const log of await findTransfers(evm, chain, addresses, next, head)) {
        try {
          const step = await handle(evm, near, submit, chain, log);
          console.log(`${step.transfer.txHash}#${step.transfer.logIndex} ${step.action.kind}: ${step.result}`);
        } catch (err) {
          // One bad transfer must not stop the others; the scan resumes from its block next time.
          console.error(`${log.transactionHash}#${log.logIndex} error: ${err instanceof Error ? err.message : String(err)}`);
          const block = Number.parseInt(log.blockNumber, 16);
          retryFrom = retryFrom === null ? block : Math.min(retryFrom, block);
        }
      }
      next = retryFrom ?? head + 1;
    }
    if (once) {
      return;
    }
    await sleep(env.pollMs);
  }
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { once: { type: "boolean", default: false }, from: { type: "string" } },
});
const [command, arg] = positionals;
if (command === "derive" && arg !== undefined) {
  process.exitCode = (await derive(arg)) ? 0 : 1;
} else if (command === "watch") {
  await watch(values.once, values.from === undefined ? null : Number(values.from));
} else {
  console.error("usage: main.ts derive <receiver> | watch [--once] [--from <block>]");
  process.exitCode = 2;
}
