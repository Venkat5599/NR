// Submits receive-contract calls through near-cli-rs. Keys stay in the
// operator's local keychain (~/.near-credentials); this process never sees them.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RpcLog, Transfer } from "./codec.ts";
import type { Fees, Submitter } from "./loop.ts";

const run = promisify(execFile);

export class NearCliSubmitter implements Submitter {
  readonly contract: string;
  readonly signer: string;
  readonly network: string;

  constructor(contract: string, signer: string, network: string) {
    this.contract = contract;
    this.signer = signer;
    this.network = network;
  }

  private async call(method: string, args: unknown, deposit: string): Promise<string> {
    const { stdout, stderr } = await run(
      "near",
      [
        "contract", "call-function", "as-transaction", this.contract, method,
        "json-args", JSON.stringify(args),
        "prepaid-gas", "300.0 Tgas",
        "attached-deposit", deposit,
        "sign-as", this.signer,
        "network-config", this.network,
        "sign-with-legacy-keychain", "send",
      ],
      { maxBuffer: 4 * 1024 * 1024 },
    );
    const out = `${stdout}\n${stderr}`;
    const id = /Transaction ID: (\w+)/.exec(out)?.[1];
    if (id === undefined) {
      throw new Error(`${method}: no transaction id in near output`);
    }
    const failed = /Smart contract panicked: ([^"\n]+)/.exec(out)?.[1];
    return failed === undefined ? id : `${id} failed: ${failed}`;
  }

  recover(chain: string, log: RpcLog, fees: Fees): Promise<string> {
    return this.call("recover", { chain, log, fees }, "0.02 NEAR");
  }

  resign(chain: string, transfer: Transfer, fees: Fees): Promise<string> {
    return this.call("resign", { chain, tx_id: transfer.txHash, log_index: transfer.logIndex, fees }, "1 yoctoNEAR");
  }
}
