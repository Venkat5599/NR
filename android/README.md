# Lunar for Android

The keyboard app. One APK: an input method you switch to from any chat, plus a small app to turn it on and keep the list of people you pay.

## What works today

| Feature | State |
|---|---|
| QWERTY typing, two symbol pages, digits by long press on the top row | Works, tested on an Android 15 emulator |
| Shift: one tap for one capital, double tap to lock | Works, tested |
| Capital at the start of a sentence; double space types ". " | Works, tested |
| Delete, and held delete repeats | Works; single delete tested |
| Enter shows and runs the box's action (Next, Done, Send, Search, Go) | Works; Next and Done tested |
| Key preview, haptic tap, long press on space opens the keyboard picker | Works, checked by hand |
| Stays clear of the gesture bar on edge-to-edge Android 15 | Works, checked on a screenshot |
| `pay bob.near 20 for dinner` + **Pay** key: reads the sentence and shows a payment card | Works, tested |
| The card checks the name on NEAR (mainnet, or testnet for `.testnet` names) | Works against the live NEAR RPC, tested |
| Paste check: a copied address that shares its start and end with someone you paid, but isn't theirs, gets a warning | Works, tested with real clipboard changes |
| Sending a payment | **Not built.** The Pay button opens the app and says nothing was sent |
| Word suggestions, autocorrect, swipe typing, emoji, dark theme | Not built |

## Build

Needs JDK 17 and the Android SDK (platform 35, build-tools 35.0.0).

```sh
cd android
echo "sdk.dir=$HOME/Android/sdk" > local.properties
./gradlew testDebugUnitTest assembleDebug     # unit tests + debug APK
./gradlew assembleRelease                     # app/build/outputs/apk/release/app-release.apk
```

The release APK is signed with the debug key until a release key exists, so it installs but cannot go on Google Play.

## Install on a phone

```sh
adb install -r app/build/outputs/apk/release/app-release.apk
```

Or copy the APK to the phone and open it (allow installs from that app). Then open **Lunar**, tap **Open keyboard settings**, turn Lunar on, and tap **Choose keyboard**.

Android warns that a keyboard "may be able to collect all the text you type". That is the standard warning for every keyboard. Lunar sends one thing over the network: the NEAR name in a pay sentence, to the public NEAR RPC, to check it exists. People you pay are stored on the phone only.

## Tests

Unit tests (no phone needed), 30 tests: the pay-sentence parser, NEAR name rules, the lookalike check, shift, key layout and touch targets, and RPC parsing against responses recorded from `rpc.mainnet.near.org`.

```sh
./gradlew testDebugUnitTest
```

End-to-end tests drive the real keyboard on an emulator or a phone with USB debugging. They tap the drawn keys and read back the text box and the strip:

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
python3 e2e/keyboard_e2e.py     # 13 checks: typing, caps, symbols, delete, Pay card, live NEAR lookups
cd e2e && python3 paste_e2e.py  # 5 checks: save a payee, then lookalike / real / unknown / plain-text clipboard
```

Debug builds log each key's screen position and the strip's text to logcat, and include a receiver that lets the test set the clipboard. Release builds have neither.

## How it is built

Kept small on purpose, after reading how the established open-source keyboards do it (FlorisBoard, HeliBoard, Simple Keyboard):

- `ime/LunarIme.kt` — the `InputMethodService`: commits text, handles enter actions, auto-capitals, the Pay key and the clipboard listener.
- `ime/KeyboardView.kt` — draws every key on one `Canvas` and maps touches to keys. A second finger commits the first key, for fast two-thumb typing.
- `ime/StripView.kt` — the row above the keys: hint, payment card, or address warning.
- `core/` — plain Kotlin with no Android imports, so it runs in unit tests: layouts and hit testing, shift, the pay parser, NEAR name rules, the paste check.
- `data/` — NEAR RPC lookup, and the payee list in app-private storage.
- `setup/SetupActivity.kt` — turn on, switch to, try, and the people-you-pay list.
