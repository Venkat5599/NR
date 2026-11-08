<div align="center">

# LUNAR

### Under any threat, the most anyone can take from you today is your daily limit, and anyone can check that.

[![Status](https://img.shields.io/badge/status-design%20stage-orange)](#live-status)
[![Chain](https://img.shields.io/badge/NEAR-Chain%20Signatures-000000)](docs/PITCH.md#how-it-works)
[![Bitcoin](https://img.shields.io/badge/Bitcoin-native%2C%20no%20soft%20fork-f7931a)](docs/PITCH.md#why-bitcoin-cannot-do-this-today)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

**[ Full pitch ↗ ](docs/PITCH.md)** · **[ Evidence ↗ ](docs/EVIDENCE.md)** · **[ Honesty table ↓ ](#whats-real-vs-pending--the-honesty-table)** · **[ Build plan ↓ ](#build-plan)**

</div>

> **Status: design stage. No code, contract or deployment exists yet.** Every row below says what is missing. Nothing in this file is a shipped claim.

People are being beaten, kidnapped and held at gunpoint until they send their crypto. It works for one reason: crypto moves instantly and can never be pulled back. Lunar takes that reason away. Your coins sit in a NEAR contract that has no key at all, and that contract controls your real Bitcoin, Ethereum, Base and NEAR addresses through Chain Signatures. Your phone can spend a small daily amount across every chain combined. Anything bigger waits 72 hours, can only go to an address you saved a week earlier, and any one of your guardians can stop it. A robber can check all of this on his own phone, so hurting you buys him nothing.

```
MAX EXTRACTABLE VALUE UNDER COERCION  =  TODAY'S DAILY LIMIT
```

## Live status

| Surface | Status | The evidence |
| --- | --- | --- |
| Vault contract (NEAR testnet) | Not built | — |
| Bitcoin testnet withdrawal through Chain Signatures | Not built | — |
| EVM (Base Sepolia) withdrawal | Not built | — |
| Public "Max Extractable Value" proof page | Not built | — |
| Guardian cancel / freeze | Not built | — |
| Confidential top-up of the spending wallet | Not built, mainnet only | — |
| Problem evidence | Collected | [docs/EVIDENCE.md](docs/EVIDENCE.md) |

## The 20-second pitch

Violent attacks on crypto holders hit a record in 2025 and 2026 is running ahead of it. Almost every attack ends within 24 hours. The fix has been known since 2014: a time-delay vault, the same idea as the shop safe the cashier cannot open. Bitcoin still cannot do it. Its vault proposal was withdrawn, no covenant opcode is active, and the only working versions today rely on a company holding a key or running a server.

**Lunar does it now, on native Bitcoin, with no company in the middle.** The contract builds every Bitcoin transaction itself and checks the real recipient and amount before the NEAR MPC network signs. A phone key can ask for money and nothing else. One limit covers every chain, so there is no weak chain to pick on.

## Table of contents

- [Live status](#live-status)
- [The 20-second pitch](#the-20-second-pitch)
- [What Lunar is NOT](#what-lunar-is-not)
- [The problem I set out to solve](#the-problem-i-set-out-to-solve)
- [What I am building](#what-i-am-building)
- [Architecture](#architecture)
- [The withdrawal loop, step by step](#the-withdrawal-loop-step-by-step)
- [Where the guarantee is enforced](#where-the-guarantee-is-enforced)
- [Who approves what](#who-approves-what)
- [Engineering decisions & the traps I expect](#engineering-decisions--the-traps-i-expect)
- [What's real vs pending — the honesty table](#whats-real-vs-pending--the-honesty-table)
- [Attack → test](#attack--test)
- [Limitations](#limitations)
- [Security](#security)
- [Tech stack](#tech-stack)
- [Build plan](#build-plan)
- [License](#license)

## What Lunar is NOT

- **Not a decoy wallet.** It never asks you to lie about your balance under stress. The app tells the robber the truth, and the truth is "you can have $200".
- **Not a new idea in Bitcoin.** Time-delay vaults with a recovery path have been discussed since 2014 and specified as a soft fork. What is new is running that design today, on native Bitcoin, enforced by a public contract and a decentralized signer instead of an opcode that has not activated or a company key.
- **Not custody.** Nobody holds your coins. The contract has no access keys, so no person, including me, can move them outside the rules.
- **Not a spending limit for AI agents.** The user is a human who may be under physical threat. Every rule is shaped by how coercion actually plays out.

## The problem I set out to solve

- More than $30M was taken by force in the first half of 2026, against a record $58M for all of 2025.
- 52 verified attacks in H1 2026, up 33% on the year before. Money at stake rose about 12× to $124M, and home invasions went from 1 to 20.
- 127 attacks logged in 2026 up to 24 October, after 134 in 2025 and 87 in 2024.
- Almost every recorded attack resolves in under a day.

The root cause is speed. A bank vault on a timer and a reversible wire transfer make robbery pointless. A seed phrase and an instant, final transfer make it pay. Sources for every figure: [docs/EVIDENCE.md](docs/EVIDENCE.md).

## What I am building

1. **A keyless vault contract on NEAR.** All access keys are deleted after deploy. Through Chain Signatures it derives and controls the user's Bitcoin, EVM and NEAR addresses.
2. **Transactions built on chain.** The contract assembles each Bitcoin and EVM transaction from its fields (inputs, recipient, amount, change) and computes the signing hash itself, so the rules see exactly what will be signed.
3. **One daily limit across all chains**, valued in USD.
4. **A delayed path for anything bigger**: 72 hours, saved destinations only, cancellable by any guardian.
5. **Slow rule changes**: raising a limit, shortening a delay, saving a new address or removing a guardian all take 7 days. Changes that make you safer apply immediately.
6. **A duress PIN** that freezes the vault quietly. The screen then shows "pending, 72h", which is true.
7. **A public proof page** that reads the limit, the queue and the countdowns straight from contract state.
8. **A confidential top-up** of the daily spending wallet through NEAR Confidential Intents, so that wallet cannot be linked to the vault (mainnet only).

## Architecture

```
 phone (function-call key: spend_daily, request_withdrawal only)
        │
        ▼
 ┌──────────────────────────── vault.<user> (no access keys) ───────────────────────────┐
 │  policy: daily_limit_usd · delay=72h · rule_change_delay=7d · saved_destinations     │
 │  queue:  pending withdrawals with unlock time                                        │
 │  guardians: cancel(id) · freeze() · unfreeze() needs majority                        │
 │  builder: BTC / EVM tx from fields → signing hash computed here                      │
 └───────────────────────────────┬──────────────────────────────────────────────────────┘
                                 │ sign(payload, path, domain)   (yield / resume)
                                 ▼
                     NEAR MPC network (Chain Signatures)
                                 │ signature
                                 ▼
               relayer broadcasts to Bitcoin / EVM  ──►  explorer link
```

| Component | Job |
| --- | --- |
| Vault contract (Rust, near-sdk) | Holds the policy, the queue and the guardians; the only caller allowed to request signatures for the user's derived addresses |
| Transaction builder | Builds Bitcoin and EVM transactions inside the contract so the signed bytes match the checked fields |
| Relayer | Broadcasts signed transactions; holds no authority, can only publish what the contract already approved |
| Proof page | Read-only view of limit, spent-today, queue and countdowns, straight from contract state |
| Phone app | Holds one function-call key; duress PIN; guardian notifications |

## The withdrawal loop, step by step

1. The phone calls `request_withdrawal(chain, to, amount)`.
2. If `amount` fits today's remaining limit across all chains, the contract builds the transaction and requests a signature at once.
3. Otherwise `to` must be a saved destination older than 7 days, or the call is refused.
4. The request enters the queue with `unlock_at = now + 72h`. Guardians are notified.
5. Any guardian may `cancel(id)` or `freeze()` during the window.
6. After `unlock_at`, anyone may call `execute(id)`. The contract builds the transaction, requests the signature, and the relayer broadcasts it.

## Where the guarantee is enforced

| Guarantee | Where it lives | Test |
| --- | --- | --- |
| No key can move funds outside the rules | Vault account has zero access keys after deploy | planned |
| The signed bytes match the checked recipient and amount | On-chain transaction builder computes the signing hash | planned |
| Instant spending never exceeds the daily limit, summed across chains | `spend_daily` accounting | planned |
| Large withdrawals wait 72h and go only to 7-day-old saved destinations | `request_withdrawal` / `execute` | planned |
| Rule changes that weaken protection wait 7 days | `propose_policy` / `apply_policy` | planned |
| One guardian can stop a withdrawal | `cancel` / `freeze` | planned |
| The phone key cannot touch policy | Function-call key scoped to two methods | planned |

## Who approves what

| Action | Phone | One guardian | Guardian majority | Wait |
| --- | --- | --- | --- | --- |
| Spend within today's limit | yes | — | — | none |
| Withdraw above the limit to a saved address | yes | can cancel | — | 72h |
| Save a new destination | yes | can cancel | — | 7 days |
| Raise limit / shorten delay / remove guardian | yes | can cancel | — | 7 days |
| Lower limit / add guardian / freeze | yes | yes (freeze) | — | none |
| Unfreeze | — | — | yes | none |

## Engineering decisions & the traps I expect

- **A policy over a hash is not a policy.** If the contract signs a 32-byte payload built somewhere else, a limit cannot see where the money goes. The contract therefore builds the transaction itself. For Bitcoin segwit inputs the signed hash commits to each input's amount, so a caller who lies about inputs only produces an invalid signature.
- **Change must come home.** Every Bitcoin transaction's change output is forced back to the vault's own derived address, or the "amount" check means nothing.
- **One limit, every chain.** A per-chain limit lets an attacker shop for the weakest chain. The limit is summed in USD.
- **No instant escape route.** No address, including a recovery address, skips the delay.
- **Gas.** Building a Bitcoin signing hash on chain has to fit NEAR's gas limit; this is the first thing to measure.

## What's real vs pending — the honesty table

| Claim | State |
| --- | --- |
| Problem figures | Real, sourced in [docs/EVIDENCE.md](docs/EVIDENCE.md) |
| Bitcoin has no active covenant opcode for vaults | Real, sourced |
| NEAR Chain Signatures can sign Bitcoin transactions | Real per NEAR docs; not yet exercised by this repo |
| Keyless vault contract | Pending: not written |
| On-chain Bitcoin transaction builder within gas | Pending: unmeasured |
| Cross-chain USD limit | Pending: needs a price source on chain |
| Proof page | Pending |
| Confidential top-up | Pending, mainnet only |
| Any test | None exist yet |

## Attack → test

| The abuse | The test that will answer it |
| --- | --- |
| "Send everything to me, now" | planned: transfer above the daily limit is queued, not signed |
| "Send it to my address" | planned: unsaved destination is refused |
| "Save my address, then send" | planned: new destination is unusable for 7 days |
| "Raise your limit" | planned: raise is delayed 7 days |
| "Remove your guardians" | planned: removal is delayed 7 days and cancellable |
| "Use the phone key directly on the contract" | planned: the key cannot call any policy method |
| "Spend the limit on every chain" | planned: the limit is shared across chains |
| "Hand me a signed blob to broadcast" | planned: the contract never signs a payload it did not build |
| "Take the phone and wait out the timer" | planned: guardian cancel; withdrawal only to saved addresses |

## Limitations

- You trust the NEAR MPC network (threshold signers in secure hardware) instead of one company.
- The daily limit can be taken under threat. That is the design: it is the price of being able to buy groceries.
- A robber who holds someone longer than the delay is answered by the saved-address rule and the guardians, not by the delay alone.
- The vault's Bitcoin address is public on the Bitcoin chain. Only the spending wallet's link to it can be hidden.
- Guardians must be people the attacker cannot reach.

## Security

No keys or secrets belong in this repository. Contract deployment keys are deleted from the vault account after deploy. Report issues privately to the repository owner.

## Tech stack

Planned: Rust + near-sdk (vault contract), NEAR Chain Signatures (`v1.signer`), on-chain transaction building for Bitcoin and EVM, TypeScript relayer, Next.js proof page, NEAR Confidential Intents (mainnet top-up).

## Build plan

1. Probe: a contract-owned derived Bitcoin testnet address, signed through Chain Signatures, broadcast and confirmed.
2. Measure gas for building a Bitcoin signing hash on chain.
3. Vault contract: limit, queue, saved destinations, rule-change delays, guardians, freeze.
4. EVM path on Base Sepolia.
5. Proof page reading contract state.
6. Phone flow with the function-call key and duress PIN.
7. Tests for every row of [Attack → test](#attack--test).
8. Confidential top-up on mainnet with a tiny amount.

## License

MIT, see [LICENSE](LICENSE).
