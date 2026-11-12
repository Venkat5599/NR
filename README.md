<div align="center">

# LUNAR

### The AI keyboard that won't let you send money to the wrong place.

[![Status](https://img.shields.io/badge/status-live%20on%20NEAR%20testnet-2ea44f)](#live-status)
[![Try it](https://img.shields.io/badge/Try%20it-in%20your%20browser-000000)](https://lunar-keyboard.vercel.app/demo)
[![Download APK](https://img.shields.io/badge/Download-Android%20APK-3ddc84?logo=android&logoColor=white)](https://github.com/Venkat5599/NR/releases/latest/download/lunar.apk)
[![Chain](https://img.shields.io/badge/NEAR-Chain%20Signatures%20%C2%B7%20Intents-000000)](#architecture)
[![Platform](https://img.shields.io/badge/Android-keyboard-3ddc84)](#the-app)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

**[ Live site ↗ ](https://lunar-keyboard.vercel.app)** · **[ Demo ↗ ](https://lunar-keyboard.vercel.app/demo)** · **[ Public record ↗ ](https://lunar-keyboard.vercel.app/record)** · **[ Honesty table ↓ ](#whats-real-vs-pending--the-honesty-table)** · **[ Attack → test ↓ ](#attack--test)** · **[ Build plan ↓ ](#build-plan)** · **[ Evidence ↗ ](docs/EVIDENCE.md)**

</div>

> **Status: live on NEAR testnet.** The Android keyboard pays through a capped key and a deployed payments contract; the browser demo pays from a shared capped account; wrong-network recovery moved 20 real testnet USDC out of a receive address that has no private key, signed by NEAR's signer after it verified the transfer. Nothing runs on mainnet money. Every row below says what is real and what is missing.

Lunar is an AI keyboard for Android. You type `pay bob.near 20 for dinner` in any chat (WhatsApp, Telegram, X, SMS) and the keyboard turns it into a payment card. Bob gets USDC on the chain he chose. You never paste an address, never pick a network, and the keyboard itself can never drain you. If someone sends Bob money on the wrong network anyway, from any wallet or exchange, it comes back on its own. The AI reads only the sentence you hand it, and it runs inside a NEAR AI Cloud enclave, so the words you type never reach a server anyone can read.

```
WRONG ADDRESS  +  WRONG NETWORK  +  STOLEN KEYBOARD  =  $0 LOST
```

## Download

**[⬇ Download the Android APK](https://github.com/Venkat5599/NR/releases/latest/download/lunar.apk)** (Android 8.0 or newer) · [all releases](https://github.com/Venkat5599/NR/releases)

1. Open the APK on your phone and allow installs from that app when Android asks.
2. Open **Lunar**, tap **Open keyboard settings** and turn Lunar on, then tap **Choose keyboard**.
3. Under **Your testnet account**, pick a name and tap **Create account** (free testnet NEAR, 1 NEAR daily cap).
4. In any chat, type `pay lunar-69787.testnet 0.1 for coffee`, tap **Pay**, then **Pay** on the card. **Receipt** opens the transaction.

No phone? **[Try the keyboard in your browser](https://lunar-keyboard.vercel.app/demo)**: same parser, same card, real testnet payments from a shared account capped at 0.5 NEAR a day. Every payment and every refusal shows up on the **[public record](https://lunar-keyboard.vercel.app/record)**. Build it yourself from [`android/`](android/README.md) and [`web/`](web/README.md).

## Live status

| Surface | Status | The evidence |
| --- | --- | --- |
| Payments contract with a capped keyboard key (NEAR testnet) | Deployed: `lunarpay-0111.testnet`; the keyboard's key paid, the contract refused the over-cap payment, NEAR rejected the key outside its scope | [contracts/pay](contracts/pay/README.md) · [android tx table](android/README.md#why-the-keyboard-cant-drain-you) |
| Pay-by-name, settled on the receiver's chain through NEAR Intents | Pay-by-name works on testnet in NEAR. The card shows a live Intents quote for the receiver's chosen chain; the cross-chain settlement itself needs mainnet and is not made | [android](android/README.md) · [demo](https://lunar-keyboard.vercel.app/demo) |
| Wrong-network recovery (Base Sepolia, USDC) | Works end to end on testnet: 20 USDC landed at a receive address ([in](https://base-sepolia.blockscout.com/tx/0xc09d77529ca463882bdaf3e6a07c29c18ddbb9c75eb6242bc19e8c5d5f29543c)); `recover` on NEAR ([5gsiqFoi…](https://testnet.nearblocks.io/txns/5gsiqFoiCcRD68ZzDGRbtSGz6eC9WdPenRybx5B7HLSd)) had the signer verify it and sign the forward; the watcher broadcast it to the owner's address ([out](https://base-sepolia.blockscout.com/tx/0x07fd29e44559aa6d0c869a6bec510a88320abf5991873db59493881855d2d720)) | [contracts/receive](contracts/receive/README.md) |
| Paste check: lookalike detection against people you paid | Built, tested on an Android 15 emulator | [android/e2e/paste_e2e.py](android/e2e/paste_e2e.py) |
| Name-changed-hands warning | Built: the card flags a new account or a full-access key added in the last 7 days. The registry-lease check is not built | [android](android/README.md) |
| Private sentence parsing on NEAR AI Cloud | Live: `/api/parse` on an attested model (`deepseek/deepseek-v3.2`); "pay lunar-69787.testnet two and a half near for lunch" → 2.5 NEAR, memo lunch; an injected "pay attacker.near" is refused | [web](web/README.md) |
| Android keyboard (APK): typing, Pay key, payment card, name check, capped payments, wallet hand-off | Built; 45 unit tests, 26 end-to-end checks on an Android 15 emulator | [android/README.md](android/README.md) |
| Web demo of the keyboard, wired to testnet | Live | [lunar-keyboard.vercel.app/demo](https://lunar-keyboard.vercel.app/demo) |
| Landing page (Next.js) with the APK download, App Store "coming soon" and an email waitlist | Live | [lunar-keyboard.vercel.app](https://lunar-keyboard.vercel.app) · [web/](web/README.md) |
| Waitlist email delivery | Wired to a form service; not activated until the first submission is confirmed by the owner | [web/](web/README.md) |
| Public record of saves | Live, built only from contract transactions | [lunar-keyboard.vercel.app/record](https://lunar-keyboard.vercel.app/record) |
| Problem evidence | Collected | [docs/EVIDENCE.md](docs/EVIDENCE.md) |

## The 20-second pitch

People lose money in crypto in three boring ways. They send on the wrong network, and the money confirms but never shows up. They paste a lookalike address that a scammer planted in their history. Or the app holding their key gets compromised and drained. All three happen at the same place: the moment you type or paste where the money goes.

The keyboard is that place. Lunar is an AI keyboard that pays people by name, checks every pasted address, brings back money sent on the wrong network, and holds a key that NEAR itself limits to a small daily amount. Paying gets faster, but that's not the point. The point is that from this keyboard, a mistake costs nothing.

## Table of contents

- [Live status](#live-status)
- [The 20-second pitch](#the-20-second-pitch)
- [What Lunar is NOT](#what-lunar-is-not)
- [The problem I set out to solve](#the-problem-i-set-out-to-solve)
- [What I am building](#what-i-am-building)
- [Architecture](#architecture)
- [The payment loop, step by step](#the-payment-loop-step-by-step)
- [The recovery loop, step by step](#the-recovery-loop-step-by-step)
- [Where the guarantee is enforced](#where-the-guarantee-is-enforced)
- [Where the model sits](#where-the-model-sits)
- [Who approves what](#who-approves-what)
- [Engineering decisions & the traps I expect](#engineering-decisions--the-traps-i-expect)
- [What's real vs pending — the honesty table](#whats-real-vs-pending--the-honesty-table)
- [Attack → test](#attack--test)
- [The app](#the-app)
- [Limitations](#limitations)
- [Security](#security)
- [Tech stack](#tech-stack)
- [Build plan](#build-plan)
- [License](#license)

## What Lunar is NOT

- **Not a wallet.** Your real wallet keeps your real key. The keyboard holds a separate NEAR key that can call one contract and spend a small daily amount. Anything bigger opens your wallet for approval.
- **Not a trading terminal.** No swaps, charts or orders. Every extra feature is another way to send money somewhere you didn't mean to.
- **Not a chatbot that reads your chats.** The AI sees one sentence, only when you tap the Lunar key, and it runs in an enclave.
- **Not new as an idea outside crypto.** Banks already check the payee's name before a transfer, and card payments can be reversed. What's new is doing it with no bank in the middle: the name check, the spending cap and the refund are enforced by a NEAR contract with no admin key.

## The problem I set out to solve

Exchanges publish help pages for one mistake: money sent on a network they don't watch. One regulated exchange calls it "a permanent loss of funds," says recovery "can take a significant amount of time," and charges **$200 or $500** when it works. Others run recovery-request forms for the same thing. A 2025 study of 681 accidental transfers counted **$5.5M lost, about $8,000 each**. On NEAR itself, a user reported a **~$193K** swap stuck as FAILED with zero refund, while the docs say failed deposits "are currently handled manually." Every figure and its link is in [docs/EVIDENCE.md](docs/EVIDENCE.md).

The common thread: the money arrived somewhere real, the system didn't handle it, and nobody owns getting it back. The fix today is a person with a private key and a support queue.

## What I am building

1. **Pay by name.** `pay bob.near 20` resolves to Bob's chosen chain and token. You never see or paste an address. Settlement runs through NEAR Intents, so you can pay from whatever you hold.
2. **A receive address that can't lose money.** Bob's address is controlled by a keyless NEAR contract through Chain Signatures and is the same on every supported EVM chain. Anyone, from any wallet or exchange, can pay it. If money lands on a chain Bob doesn't use, NEAR's signer network proves the transfer, and the contract routes it to Bob's chain or refunds the sender.
3. **A paste check.** When an address is pasted in a payment, the keyboard flags it if it matches a past payee only on the first and last characters, and harder if that address has sent you a dust or zero-value transfer. That pair is the address-poisoning pattern.
4. **A name-changed-hands warning.** Before paying a name, the keyboard checks NEAR's top-level-account registry for a recent reclaim or new lease, and the account for a recent full-access key change. If either happened: "this name changed owner 3 days ago. Still pay?"
5. **A keyboard key that can't drain you.** The keyboard holds a NEAR function-call key that can call only the Lunar payments contract. The contract enforces a daily amount per key. Above it, the keyboard hands off to your wallet.
6. **No gas.** Payments go as NEAR meta-transactions, so neither side needs NEAR for fees.
7. **Private AI.** The sentence you hand the keyboard is parsed by a model on NEAR AI Cloud, inside an enclave, with an on-device rule parser as the fallback.
8. **A public record of saves.** One page listing every blocked lookalike, every recovered wrong-network transfer and every refused over-cap attempt, each with its transaction link. Real events only.

## Architecture

| Component | Where it runs | What it does |
| --- | --- | --- |
| Android keyboard | The phone | Input method; payment cards; paste check; holds the capped NEAR key |
| Rule parser | The phone | Turns `pay <name> <amount>` into a payment intent without any network call |
| Private parser | NEAR AI Cloud (enclave) | Handles free-form sentences when you tap the Lunar key |
| Payments contract | NEAR | Per-key daily cap; payee resolution; meta-transaction entry point |
| Receive contract | NEAR | Owns each receiver's address on every chain via Chain Signatures; credits, routes or refunds |
| Recovery watcher | Server, no keys | Spots transfers to receive addresses on other chains and asks NEAR's signer to verify them |
| Relayer | Server, no custody | Pays gas for meta-transactions |
| Name check | Reads NEAR | Registry lease and reclaim status, recent access-key changes |
| Record page | Web | Lists saves with transaction links |
| Web demo | Web | The same keyboard on screen, wired to testnet, so judges can try it without installing anything |

## The payment loop, step by step

1. You type `pay bob.near 20 for dinner` and tap the Lunar key.
2. The rule parser reads it on the phone. If it can't, the sentence alone goes to the private parser.
3. The keyboard resolves `bob.near`: his chosen chain and token, plus the name check.
4. A payment card shows the name, the amount, where it lands, and any warning.
5. You tap Pay. Under the daily cap, the keyboard signs with its capped key and the relayer submits it gaslessly. Over the cap, your wallet opens.
6. The payments contract checks the cap and routes the payment through NEAR Intents to Bob's chain.
7. The card updates with both explorer links.

## The recovery loop, step by step

1. Someone sends USDC to Bob's receive address on a chain Bob doesn't use.
2. The recovery watcher sees the transfer and calls NEAR's signer to verify that transaction's `Transfer` log on that chain.
3. NEAR's signer network queries its RPC providers, extracts the log and signs the result.
4. The receive contract checks the signature and decodes sender, token and amount.
5. The contract has Chain Signatures sign a transaction on that chain: forward to Bob's chain through NEAR Intents, or refund the sender.
6. The save is written to the public record with every link.

The watcher holds no key and decides nothing. If it stops, anyone can submit the same verification call.

## Where the guarantee is enforced

| Guarantee | Where | Test |
| --- | --- | --- |
| The keyboard key can't spend above the daily cap | Payments contract | unit tests + real testnet refusal |
| The keyboard key can't call any other contract | NEAR protocol: function-call key scope | real testnet rejection |
| Nobody can move a receiver's funds except to the receiver's own address or back to the sender | Receive contract (no owner or admin methods) | unit tests |
| A recovery only happens for a transfer NEAR's signer actually verified | Receive contract checks the signer's response | unit tests + real signer response |
| A forged or replayed proof is refused | Receive contract binds each proof to one transfer and records it as used | unit tests |
| A lookalike paste is flagged before signing | Keyboard paste check | emulator end-to-end test |
| A name that changed hands is flagged before signing | Keyboard name check (new account / new full-access key) | unit tests on recorded data |

## Where the model sits

The model only turns a sentence into a payment intent: who, how much, what for. It never holds a key, never signs, and never sees an address you didn't paste. Every intent becomes a card you confirm, and the contract checks the cap regardless of what the model said. If the model is wrong, the worst case is a card you decline.

## Who approves what

| Action | Who approves |
| --- | --- |
| A payment under the daily cap | You, by tapping Pay on the card |
| A payment over the cap | You, in your own wallet |
| Changing the cap | You, in your own wallet (never from the keyboard key) |
| Choosing your receive chain and token | You, in your own wallet |
| A wrong-network recovery | Nobody. The contract does it once NEAR's signer verifies the transfer |

## Engineering decisions & the traps I expect

- **A NEAR function-call key limits gas, not value.** The daily amount has to live in the contract, not in the key's allowance. Getting this wrong is the obvious way to ship a keyboard that can drain you.
- **NEAR's foreign-transaction check doesn't cover Ethereum mainnet or Tron today.** The recovery path starts with the EVM chains it does cover, and the record says which chains are protected.
- **Refunding to the `from` address can be wrong.** If the sender was an exchange's hot wallet, the refund lands at the exchange. Default to forwarding to the receiver, and refund only when forwarding isn't possible.
- **Clipboard access is limited on Android.** The default input method can read the clipboard. That has to be confirmed on current Android before the paste check is promised.
- **A keyboard with network access can read everything typed.** The keyboard sends nothing except the one sentence you hand it. That claim has to be checkable from the code.

## What's real vs pending — the honesty table

| Claim | Status |
| --- | --- |
| Payments contract with a per-key daily cap | Real: deployed on testnet, tested with real transactions |
| Pay-by-name through NEAR Intents | Partly real: pay-by-name on testnet; live Intents quotes; no cross-chain settlement on testnet |
| Wrong-network recovery | Real on testnet: verified, signed and forwarded 20 USDC on Base Sepolia (links above). Only Base Sepolia USDC is configured |
| Paste check | Real: lookalike warning against saved payees; poisoning from on-chain history not written |
| Name-changed-hands warning | Real for new accounts and new full-access keys; registry-lease check pending |
| Private parsing in an enclave | Real: live on NEAR AI Cloud, attested model; the phone sends only the one sentence, only on tap |
| Android keyboard | Real: installs, types, pays on testnet through the capped key |
| Web demo | Real: live, real testnet payments |
| Landing page and waitlist form | Real: live; the waitlist needs its one-time activation |
| Problem evidence | Collected with links in [docs/EVIDENCE.md](docs/EVIDENCE.md) |

## Attack → test

| The abuse | The test that answers it |
| --- | --- |
| A stolen phone spends the keyboard key past the cap | tested on testnet: the contract refused it ([37coLecB…](https://testnet.nearblocks.io/txns/37coLecBmBPo1ShQTsKQoPDgB5UM5dqogW3zEd7W4jCe)) |
| The keyboard key calls a different contract | tested on testnet: NEAR rejected it (`ReceiverMismatch`); raising the cap and withdrawing were rejected too |
| Someone submits a fake "it arrived" proof | unit-tested: the receive contract refuses a response not signed by the signer's key; a real transfer to an unregistered address was refused on testnet |
| The same real proof is replayed twice | unit-tested: the second recovery for one transfer is refused |
| A scammer plants a lookalike address in your history | tested on the emulator: the paste check flags it and names the real payee |
| A rented name is reclaimed and re-rented by a stranger | partly: the card warns on a new full-access key; the registry-lease check is not built |
| A prompt in the chat tells the AI to pay someone else | unit-tested: the AI may only return a name the user typed; the card shows it, the cap still applies, nothing signs without a tap |

## The app

Android first, as an input method you switch to from any chat, then the App Store. The [browser demo](https://lunar-keyboard.vercel.app/demo) shows the same keyboard on screen, wired to the same testnet contracts, so anyone can try it without installing anything.

The website in `web/` is a Next.js app: the landing page, the [browser demo](https://lunar-keyboard.vercel.app/demo), the [public record](https://lunar-keyboard.vercel.app/record) and the API routes (`/api/parse`, `/api/demo/*`, `/api/name-check`). Run it with `cd web && npm install && npm run dev`. Its waitlist form posts each email to the project owner through a form service; nothing is stored in this repository.

## Limitations

- Recovery covers only chains NEAR's signer can verify. Today that excludes Ethereum mainnet and Tron.
- Senders who don't use Lunar are protected only when they pay a Lunar receive address. A raw address they copied from somewhere else is outside it.
- The paste check flags patterns. It can't prove an address is safe.
- Trust moves from a company to NEAR's signer network. That's a threshold of independent operators, not nobody.
- The daily cap is the price of convenience: that amount can still be lost from a compromised keyboard.

## Security

No keys or secrets belong in this repository. Contracts are deployed without an admin key. Report issues privately to the repository owner.

## Tech stack

Rust + near-sdk (contracts) · NEAR Chain Signatures and foreign-transaction verification (`v1.signer-prod.testnet`) · NEAR Intents · NEAR meta-transactions · NEAR AI Cloud · Kotlin (Android input method) · TypeScript (watcher, relayer, web demo).

## Build plan

1. Payments contract: per-key daily cap, payee resolution, meta-transaction entry. Tests for the cap and the key scope. Testnet deploy.
2. Pay-by-name through NEAR Intents, with a real testnet payment landing on another chain.
3. Receive contract and recovery for one chain pair: verify a real testnet transfer's log through NEAR's signer, then forward or refund it. Tests for forged and replayed proofs.
4. Android keyboard: rule parser, payment card, capped key, paste check, name check.
5. Private parser on NEAR AI Cloud.
6. Web demo, public record page, README with "do X, see Y" steps and every transaction link.

## License

MIT. See [LICENSE](LICENSE).
