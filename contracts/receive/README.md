# Receive contract

Lets a Lunar user receive tokens that were sent on the wrong network. Each
registered NEAR account gets an EVM receive address; tokens that land there
can be recovered to the user's own address on that chain, or refunded to the
sender, without anyone holding the receive address's private key.

## How it works

1. `register(forward_to)` (attach 0.01 NEAR) asks the testnet signer
   `v1.signer-prod.testnet` for the key derived for
   (predecessor = this contract, path = caller account id, domain 0). Its EVM
   address is the caller's receive address.
2. Someone sends an ERC-20 token to that address on a supported chain.
3. Anyone calls `recover(chain, log, fees)` (attach 0.02 NEAR) with the
   `Transfer` log exactly as the chain RPC returns it. The contract:
   - refuses logs that are not `Transfer`s of an accepted token, transfers to
     an address that is not a registered receive address, and transfers it has
     already seen (replay);
   - computes the payload hash the signer will sign for that log and calls the
     signer's `verify_foreign_transaction` with it as `expected_payload_hash`
     (foreign-tx domain 3, `Finalized`);
   - in the callback, accepts the response only if its `payload_hash` equals
     the expected one and its signature recovers to the signer's foreign-tx
     root key stored at init;
   - asks the signer to `sign` an EIP-1559 `transfer(destination, amount)` from
     the receive address, where destination is the receiver's `forward_to`, or
     the original sender when none is set;
   - checks the returned signature recovers to the receive address key and
     stores the raw signed transaction (`get_transfer`).
4. The watcher broadcasts the signed transaction. `resign` signs the same
   transaction (same nonce) again with new fees if it is stuck.

`check_transfer(chain, log)` runs the same signer verification for any
Transfer log without recording or signing anything.

There are no owner or admin methods.

## Status (NEAR testnet)

| Part | Status |
| --- | --- |
| Build, 20 unit tests | works (`cargo test`, `cargo near build non-reproducible-wasm`) |
| Payload hash encoding | works: equals the hash the signer returned for a real Base Sepolia USDC transfer |
| Receive address derivation | works: contract, signer `derived_public_key` and the watcher's off-chain derivation agree |
| Signer verification through the contract | works: `check_transfer` on a real transfer returned `verified: true` |
| Refusal of a transfer not sent to a receive address | works on testnet |
| Signer `sign` of the forward transaction, broadcast, arrival | not run yet: needs a real transfer to a receive address and gas on it |

Deployed: `lunar-recv-80366.testnet`, registered receiver
`lunar-user-80366.testnet` with receive address
`0xa8871e9879d17e229d73c5faeff677d5a8cd2bd2` on Base Sepolia (no `forward_to`,
so a recovered transfer is refunded to its sender).

Testnet transactions:

- deploy and init: https://testnet.nearblocks.io/txns/5GHCcM3P4EecoXy4TKesfbRFkoCJSWQzYFfbucAydmPr
- register: https://testnet.nearblocks.io/txns/Bav6DbKJD575eYtKxctZ6pnRJiqs5SSrMpjF3dQfAAgR
- signer verification called directly: https://testnet.nearblocks.io/txns/65QFPCeHhod4Nqn4bCiiyiXU71AaG3H39k8UwsFRHD74
- `check_transfer` (verified through the contract): https://testnet.nearblocks.io/txns/5nG628mr1C9vWM9UWNqxgSGyA6pGdmmvwpwxVEAcFoUG
- `recover` refused, "recipient is not a registered receive address": https://testnet.nearblocks.io/txns/EkFC7jLr23579T33Sd5MLRqWpvwvcf7DHx8rW9knyKjY

The transfer used is Base Sepolia tx
`0xd3482e4e0cd1d42c0d94835447224ff08ef420dc1cfdccb49ccc512d5e04b0d0`, log 3
(`fixtures/base-sepolia-usdc-transfer-log.json`).

## Running the full forward

The receive address needs, on Base Sepolia:

- the tokens to recover: any amount of USDC
  (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`), e.g. 1 USDC;
- ETH for the forward transaction's gas: gas limit 100000 × max fee per gas.
  0.001 ETH covers max fees up to 10 gwei.

Then, from `services/watcher`:

```sh
RECEIVERS=lunar-user-80366.testnet NEAR_ACCOUNT=<your testnet account> node src/main.ts watch
```

It scans finalized blocks, calls `recover` through `near` (keys stay in the
local keychain) and broadcasts the signed transaction. To forward instead of
refunding, the receiver calls `register` again with `forward_to` set.

## Limits

- One configured chain (Base Sepolia, chain id 84532) and one token.
- Fees are fixed at signing time; `resign` replaces them but keeps the nonce.
- If a forward transaction never lands (for example, not enough gas on the
  receive address), later transfers to the same address wait behind its nonce.

## Build and deploy

```sh
cargo test
cargo near build non-reproducible-wasm
near contract deploy <account> use-file target/near/lunar_receive.wasm \
  with-init-call new json-args '{"signer_id":"v1.signer-prod.testnet","sign_domain_id":0,"foreign_tx_domain_id":3,"foreign_tx_public_key":"secp256k1:2KGCoy2pZt7n85QfJnQzCT1eHySuNpquUfNc8ySpRbr15F5kqU7agJYjfo5RkrzNd4tZimDFv2wAZri7RRZ32qj1","chains":[{"name":"Base","evm_chain_id":84532,"finality":"Finalized","tokens":["0x036CbD53842c5426634e7929541eC2318f3dCF7e"],"gas_limit":100000,"max_fee_per_gas_cap":"100000000000"}]}' \
  prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-legacy-keychain send
```

`env::ecrecover` needs the near-sdk `unstable` feature, which is enabled in
`Cargo.toml`.
