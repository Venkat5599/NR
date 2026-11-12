# Evidence

Every figure the README uses, with its source. Read on 10–11 Nov 2026. This is the one file that names other products, on purpose: a "nobody does this" claim needs the neighbours on the record.

## Money sent on the wrong network

| Fact | Source |
| --- | --- |
| OSL: depositing on an unsupported network "can result in a permanent loss of funds"; recovery not guaranteed, "can take a significant amount of time"; fee **USD 200 or USD 500** if successful. Dated 27 Aug 2026. | https://www.osl.com/en/support/recovery-fee-for-wrong-virtual-assets-or-unsupported-networks-deposit |
| CEX.IO: "Recovering incorrect crypto deposits" (1 Oct 2026). | https://support.cex.io/en/articles/5373268-recovering-incorrect-crypto-deposits |
| Bitvavo: checking whether the correct network was used (27 Sep 2026). | https://support.bitvavo.com/hc/en-us/articles/33523557113745 |
| Tokocrypto: deposit recovery request for wrong network or wrong address. | https://support.tokocrypto.com/hc/en-us/articles/48529361667981 |
| A 2025 academic study of 681 confirmed accidental transfers found $5.5M lost, about $8,000 each. Secondary source; the study itself was not read. | https://bitget.com/news/detail/12560605214465 (DailyCoin, 23 Feb 2026) |

## Money stuck inside NEAR Intents

| Fact | Source |
| --- | --- |
| A user reports a 1Click swap of 575,830 TRX (~$193K) with status FAILED since 12 Sep, `refundedAmount: 0`, and NEAR's docs saying failed deposits "are currently handled manually." Posted 9 Oct 2026. | https://gov.near.org/t/failed-near-intents-1-click-swap-575-830-trx-193k-stuck-failed-status-zero-refund-no-support-response/42664 |
| NEAR Intents' automatic refunds cover swaps that fail during atomic execution. A stuck BTC deposit has a manual three-step refund flow. Nothing in the docs recovers a wrong-network send. | https://docs.near-intents.org/llms-full.txt |

## What NEAR provides today

| Fact | How it was checked |
| --- | --- |
| The mainnet signer `v1.signer` exposes `verify_foreign_transaction` and `respond_verify_foreign_tx`. | Method names found in the deployed contract code, read over RPC on 10 Nov 2026 |
| `get_available_foreign_chains` returned Solana, Base, Bnb, Arbitrum, Abstract, Starknet, Polygon, HyperEvm, Aptos, Sui, Avalanche and Fogo on mainnet (`v1.signer`) and testnet (`v1.signer-prod.testnet`). Ethereum mainnet and Tron are not on the list. | View call on both networks, 10 Nov 2026 |
| EVM chains support an extractor that returns a transaction's log (address, topics, data), which is enough to prove an ERC-20 `Transfer`. | `near/mpc` `crates/near-mpc-contract-interface/src/types/foreign_chain.rs` (`EvmExtractor::Log`) |
| The network signs a hash of the request and the extracted values; an optional expected hash binds a response to one request. | `near/mpc` `docs/archive/design/foreign-chain-transactions.md` |
| Rented names in NEAR's top-level-account registry can be reclaimed and parked when the lease ends; the reclaim checks NEAR token balances, not other chains. | `houseofstake/tla-contracts` `contracts/tla-registry/src/reclaim.rs` |

## Neighbours

| Product | What it does | The gap it leaves |
| --- | --- | --- |
| Intents Desk | Paste a NEAR Intents deposit address, see where the swap is and why it was refunded | Shows the money; doesn't recover it |
| Where's My ZEC | Shows where lost ZEC is waiting and who must act | Shows the money; doesn't recover it |
| Quittance | Explains what happened to money after a NEAR Intents swap | Explains; doesn't recover |
| Gideon | Checks a NEAR address before you send | Warns before; nothing after |
| Payee lock | A cross-chain payee registry with a 72-hour delay on address changes | Protects senders who use it; no recovery, no keyboard |
| Paylink, OJA, Cobra | NEAR payment links and invoices inside WhatsApp and Telegram | Payment requests; no protection against wrong address or network |
| AI keyboards with payments | Already ship payments, swaps and orders from the keyboard on other chains | Built for speed: full wallet on the phone, no cap enforced by a chain, no recovery |
