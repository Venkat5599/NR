# Lunar for Android

The keyboard app. One APK: an input method you switch to from any chat, plus a small app that sets up a NEAR testnet account and plays the wallet for it.

## What works today

Everything below runs on NEAR **testnet**. Payments are real testnet transactions; nothing touches mainnet money.

| Feature | State |
|---|---|
| QWERTY typing, two symbol pages, digits by long press on the top row | Works, end-to-end tested on an Android 15 emulator |
| Shift: one tap for one capital, double tap to lock; capital at the start of a sentence; double space types ". " | Works, tested |
| Delete (held delete repeats); enter shows and runs the box's action (Next, Done, Send, Search, Go) | Works, tested |
| Key preview, haptic tap, long press on space opens the keyboard picker; clear of the gesture bar on Android 15 | Works, checked by hand |
| One-tap testnet account: the app creates `name.testnet`, adds a keyboard key that can only call `pay`, puts 3 NEAR in the pocket and sets a 1 NEAR daily cap | Works, tested (uses the public testnet faucet, which rate-limits after many accounts from one IP) |
| `pay bob.testnet 0.5 for dinner` + **Pay**: the card checks the name, shows what's left of today's cap, then pays with the keyboard key | Works, tested with real testnet payments |
| Over the cap: the card says so and **Wallet** opens the app, where the account's own key approves it | Works, tested |
| The contract refuses a payment over the cap even if the keyboard sends it | Works, tested on testnet (table below) |
| Name check: the account exists, how old it is, and whether a new full-access key was added in the last 7 days | Works, tested against recorded and live data |
| If the payee chose where to get paid (Base, Arbitrum, Solana), the card shows a live NEAR Intents quote for what they'd receive on mainnet | Works; the quote is live, the cross-chain transfer is not made on testnet |
| Paste check: a copied address that shares its start and end with someone you paid, but isn't theirs, gets a warning | Works, tested with real clipboard changes |
| AI for free-form sentences ("send bob.testnet a fiver for the cab"): only that sentence goes to the web app's route, which asks a model on NEAR AI Cloud | Built and unit-tested; needs the web app running with its API key |
| Word suggestions, autocorrect, swipe typing, emoji, dark theme | Not built |

## Why the keyboard can't drain you

- The keyboard holds a NEAR **function-call key** that can call only `pay` on the Lunar payments contract (`lunarpay-0111.testnet`).
- NEAR does not let a function-call key attach a deposit. Changing the cap, withdrawing, and changing where you get paid all require 1 yoctoNEAR attached, so only the account's full-access key can do them.
- `pay` spends from a pocket you topped up, and the contract checks the daily cap on every call. Over the cap it records a refusal and moves nothing.

A live test signs with the same Kotlin code the keyboard uses ([`LiveTestnetTest.kt`](app/src/test/java/app/lunar/keyboard/near/LiveTestnetTest.kt)). Its first run:

| Step | Result | Transaction |
|---|---|---|
| Wallet adds the keyboard key (scope: `pay` on the contract) | ok | [CBWcH2nV…](https://testnet.nearblocks.io/txns/CBWcH2nVRfaXzMyN9qXKvciuFJeo9S3TFX8mxkgUi8uZ) |
| Wallet tops up 1 NEAR and sets a 0.5 NEAR cap | ok | [9t63xg7b…](https://testnet.nearblocks.io/txns/9t63xg7bBcQnnTUiZTAezEAev7i3SFFw1HRdcwvLquvP) |
| Keyboard key pays 0.2 NEAR | `Sent` | [4cQLBMGb…](https://testnet.nearblocks.io/txns/4cQLBMGbmZvcu1hkvG8Nvx3rmznTddtK7L753tTddkGd) |
| Keyboard key tries 1 NEAR | `RefusedOverCap`, nothing moved | [37coLecB…](https://testnet.nearblocks.io/txns/37coLecBmBPo1ShQTsKQoPDgB5UM5dqogW3zEd7W4jCe) |
| Keyboard key tries to raise the cap | rejected by NEAR: `DepositWithFunctionCall` | never included in a block |
| Keyboard key tries to call another account | rejected by NEAR: `ReceiverMismatch` | never included in a block |
| Keyboard key tries `withdraw` | rejected by NEAR: `MethodNameMismatch` | never included in a block |

## Build

Needs JDK 17 and the Android SDK (platform 35, build-tools 35.0.0).

```sh
cd android
echo "sdk.dir=$HOME/Android/sdk" > local.properties
./gradlew testDebugUnitTest assembleDebug                           # unit tests + debug APK
./gradlew assembleRelease -Plunar.apiBase=https://<web-app-host>    # release APK with the AI parser on
```

`-Plunar.payContract=<account>` points the app at another deployment of the payments contract. The release APK is signed with the debug key until a release key exists, so it installs on any phone but is not a Play Store build.

## Install on a phone

Download `lunar.apk` from the [latest release](https://github.com/Venkat5599/NR/releases/latest), open it and allow installs from that app. Then:

1. Open **Lunar** → **Open keyboard settings** → turn Lunar on → **Choose keyboard**.
2. Under **Your testnet account**, pick a name and tap **Create account**.
3. In any chat, type `pay lunar-69787.testnet 0.1 for coffee`, tap **Pay**, then **Pay** on the card. **Receipt** opens the transaction.

Android warns that a keyboard "may be able to collect all the text you type"; every keyboard gets that warning. What Lunar sends over the network: the payee name (to NEAR RPC and the explorer API, to check it), the payment itself, and only when you tap Pay on a sentence the phone can't read, that one sentence to the AI route. Keys and your payee list stay in the app's private storage.

## Tests

Unit tests, no phone needed (45): the pay-sentence parser, NEAR name rules, Base58/Borsh/key encoding, the lookalike check, shift, key layout and touch targets, validation of AI answers (including "the model can't pick a name you didn't type"), and parsing of transactions and account data recorded from NEAR testnet, mainnet and the explorer API.

```sh
./gradlew testDebugUnitTest
LUNAR_LIVE=1 LUNAR_CONTRACT=lunarpay-0111.testnet LUNAR_WALLET=<your-testnet-account> \
  ./gradlew testDebugUnitTest --tests '*LiveTestnetTest*'      # the real testnet run above
```

End-to-end tests drive the real keyboard on an emulator or a phone with USB debugging. They tap the drawn keys and read back the text box and the strip:

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
cd e2e
python3 keyboard_e2e.py   # 13 checks: typing, caps, symbols, delete, the Pay card, live NEAR name checks
python3 paste_e2e.py      # 5 checks: save a payee, then lookalike / real / unknown / plain-text clipboard
python3 pay_e2e.py        # 8 checks: create a testnet account in the app, pay under the cap, over the cap → wallet approves
```

Debug builds log key positions and the strip's text to logcat and include a receiver that lets the tests set the clipboard. Release builds have neither.

## How it is built

- `ime/LunarIme.kt` — the `InputMethodService`: commits text, enter actions, auto-capitals, the Pay key, the clipboard listener.
- `ime/KeyboardView.kt` — draws every key on one `Canvas` and maps touches to keys; a second finger commits the first key for fast two-thumb typing.
- `ime/StripView.kt`, `ime/PayCard.kt` — the row above the keys and the payment card (its checks run in parallel).
- `core/` — plain Kotlin with no Android imports: layouts, shift, the pay parser, NEAR name rules, the paste check.
- `near/` — Base58, Borsh, ed25519 signing, NEAR RPC, and the payments-contract calls. Transactions are built and signed on the phone.
- `data/` — name check, live Intents quotes, the AI parser client, the account and payee stores.
- `setup/` — turn on, switch to, try, the testnet account (the wallet role) and the people-you-pay list.
