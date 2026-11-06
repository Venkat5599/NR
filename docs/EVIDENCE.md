# Evidence

Every figure in the README and the pitch, with its source. This is the one file in the repo that names existing products, because a claim like "nobody does this yet" needs them on the record.

## 1. The problem, measured

| Figure | Source |
| --- | --- |
| More than $30M taken by force in H1 2026; 2025's record was $58M; attempted extractions $107M so far in 2026 | Chainalysis, *Violent Wrench Attacks Targeting Crypto Holders* — https://chainalysis.com/blog/violent-crypto-wrench-attacks-2026 |
| 52 verified attacks in H1 2026 (+33% YoY); $124.1M exposure (≈12×); home invasions 1 → 20 | CertiK Intel3D H1 2026 — https://certik.com/certik-report/intel3d/intel3d-wrench-h1-2026 |
| Attacks logged per year: 87 (2024), 134 (2025), 127 (2026 to 24 Oct) | Counted from https://github.com/jlopp/physical-bitcoin-attacks |
| 77 incidents in one country in H1 2026, up from 45 in all of 2025 | Interior Minister statement, reported by Cointelegraph — https://cointelegraph.com/news/crypto-home-invasions-wrench-attacks-certik-h1-2026 |
| A family zip-tied at gunpoint for more than nine hours over their crypto | US court case, Cointelegraph — https://cointelegraph.com/news/texas-brothers-sentenced-to-15-years-in-prison-for-armed-crypto-robbery-kidnapping |
| Almost all documented attacks resolve in under 24 hours | Interview citing the public attack tracker — https://www.tftc.io/wrench-attack-bitcoin-protection-max-guise |
| Industry guidance treats coercion as a threat to individuals and to organizations (exchanges, funds, DAOs) | Security Alliance, *Coercion and Duress* — https://frameworks.securityalliance.org/physical-security/coercion-and-duress/overview |

## 2. What people say

- r/Bitcoin, "How to stop a $5 wrench attack if you become a target of sorts?" — https://reddit.com/r/Bitcoin/comments/1h8mkn2/how_to_stop_a_5_wrench_attack_if_you_become_a
- r/Bitcoin, "Thinking about how to protect from a wrench attack without purchasing a multi-sig plan" — https://reddit.com/r/Bitcoin/comments/1l8g3ki/thinking_about_how_to_protect_from_a_wrench
- r/CryptoCurrency, "Time-Delayed Withdrawal Crypto Wallet?" — https://reddit.com/r/CryptoCurrency/comments/psl63j/timedelayed_withdrawal_crypto_wallet

## 3. Why Bitcoin cannot do it natively

- BIP-345 (OP_VAULT): "the only way to configure this defense without rolling timelocked coins for perpetuity or relying on a trusted third party." https://bitcoin.org/bip/345
- BIP-345 withdrawn May 2025; no covenant opcode active on mainnet; CTV activation client at 0% signalling, minimum activation around May 2027. https://www.spark.money/research/bitcoin-covenant-activation-path-forward

## 4. What exists elsewhere, and the gap

| Product | What it does | Gap |
| --- | --- | --- |
| Casa | Multisig vault, $250 / $2,100 / $7,500 per year (https://casa.io/pricing) | Company-held key |
| Bitkey time-lock vault | Delay enforced with a company server key; in development | Company server; not shipped |
| ERC-8238 draft, Coercion-Resistant Vault (https://github.com/DeFiRe-business/eip-proposal-5wrench) | EVM daily limit, timelock, guardians | EVM only, no native Bitcoin |
| Decoy / duress-PIN wallets | Show a small fake wallet | Relies on lying under violence |
| Infinex XIP-39 Send V1 (https://proposals.infinex.xyz/xips/xip-39) | Allowlist; new addresses valid after 24h; per-chain lists; recovery address with no delay | Anti-theft design; no daily cap, per-chain lists, instant recovery path |
| Safe controlling a Bitcoin address via Chain Signatures on Aurora (https://doc.aurora.dev/blog/safe-bitcoin-demo) | Multisig over a derived BTC address | Signer requires only `Payload must be 32 bytes` (https://github.com/aurora-is-near/chain-signatures-signer/blob/main/src/ChainSignaturesSigner.sol): it signs a blind hash, so no rule can see the recipient |

## 5. NEAR facts the design rests on

- Chain Signatures let NEAR accounts, including contracts, sign for Bitcoin and EVM chains. https://docs.near.org/chain-abstraction/chain-signatures
- The MPC network runs fully inside TEEs with 17 independent operators (2026-10-23). https://near.org/blog/chain-signatures-tee
- Transaction builder for all chains in Rust. https://github.com/near/omni-transaction-rs
- Function-call access keys and their limits. https://docs.near.org/protocol/accounts-contracts/access-keys
- NEAR Recovery Keys: timelock, notification, independent watcher approval. https://www.near.org/blog/introducing-top-level-accounts-and-recovery-keys-on-near
- Confidential Intents: deposits and withdrawals cannot be linked. https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/confidential-swaps.md

## 6. Not yet proven

- That a keyless contract can request and receive a Chain Signature for a Bitcoin testnet transaction.
- That building a Bitcoin signing hash on chain fits NEAR's gas limit.
- A price source for a cross-chain USD limit.
- That a delayed withdrawal plus guardian cancel deters attackers in practice. This is argued from the attack-duration data, not measured.
