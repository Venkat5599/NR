#!/usr/bin/env python3
"""End-to-end test of payments on NEAR testnet, through the real keyboard and app.

Creates a fresh testnet account in the app (faucet), then types pay sentences with the
Lunar keyboard and taps Pay: one under the cap (sent), and one over it (sent to the wallet
screen). Every transaction is real and printed with its explorer link.

Run:  cd e2e && python3 pay_e2e.py
"""
import re
import sys
import time

import keyboard_e2e as k

RUN = str(int(time.time()))[-6:]
ME = f"lunar-e2e-{RUN}"
PAYEE = "lunar-69787.testnet"


def bounds(xml, text):
    m = re.search(r'text="' + re.escape(text) + r'"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
    if not m:
        return None
    a = list(map(int, m.groups()))
    return (a[0] + a[2]) // 2, (a[1] + a[3]) // 2


def scroll_to(text, tries=8):
    for _ in range(tries):
        xml = k.ui()
        c = bounds(xml, text)
        if c and 150 < c[1] < 1300:
            return c
        k.adb("shell", "input", "swipe", "540", "1600", "540", "900", "300")
        time.sleep(0.6)
    xml = k.ui()
    c = bounds(xml, text)
    if c is None:
        raise RuntimeError(f"not on screen: {text}")
    return c


def tap_text(text):
    c = scroll_to(text)
    k.tap(*c)
    time.sleep(0.6)


def wait_ui(substr, secs=60):
    end = time.time() + secs
    while time.time() < end:
        xml = k.ui()
        if substr in xml:
            return xml
        time.sleep(1.5)
    return None


def wait_strip(substr, secs=45):
    end = time.time() + secs
    while time.time() < end:
        lines = k.strip_text()
        if any(substr in l for l in lines):
            return lines
        time.sleep(1)
    return k.strip_text()


def tap_strip_action(label, secs=10):
    """Taps the strip's button, located from the debug build's LunarStripAction log."""
    end = time.time() + secs
    while time.time() < end:
        log = k.adb("logcat", "-d", "-s", "LunarStripAction:D")
        hits = [l.split("LunarStripAction:", 1)[1].strip().split("|") for l in log.splitlines() if "LunarStripAction:" in l]
        hits = [h for h in hits if h[0] == label]
        if hits:
            k.tap(int(hits[-1][1]), int(hits[-1][2]))
            return True
        time.sleep(0.5)
    return False


def type_sentence(s):
    """Types with the Lunar keyboard; '.' and digits included."""
    for ch in s:
        if ch == ".":
            k.press("LETTERS", ".")
        else:
            k.type_letters(ch)


def try_box():
    tap_text("Type here")
    time.sleep(1)


def main():
    k.adb("shell", "am", "force-stop", k.PKG)
    k.adb("shell", "pm", "clear", k.PKG)
    k.adb("shell", "ime", "enable", k.IME, check=False)
    k.adb("shell", "ime", "set", "com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME", check=False)
    time.sleep(1)
    k.adb("shell", "ime", "set", k.IME)
    time.sleep(1.5)
    k.adb("logcat", "-c")
    k.adb("shell", "am", "start", "-n", f"{k.PKG}/.setup.SetupActivity")
    time.sleep(2.5)

    # 1. create the testnet account in the app
    tap_text("pick a name")
    k.adb("shell", "input", "text", ME)
    k.adb("shell", "input", "keyevent", "KEYCODE_BACK")
    time.sleep(0.5)
    tap_text("Create account")
    wait_ui(f"{ME}.testnet", 90)
    xml = None
    for _ in range(4):
        xml = wait_ui("1 NEAR left today", 10)
        if xml:
            break
        k.adb("shell", "input", "swipe", "540", "1600", "540", "1000", "300")
    k.expect_true("app created the account, scoped the keyboard key, put 3 NEAR in the pocket with a 1 NEAR cap",
                  xml is not None and 'text="3 NEAR"' in xml and "1 NEAR left today · cap 1 NEAR a day" in xml, (xml or "")[-400:] if xml else "timeout")

    # 2. pay under the cap with the keyboard
    k.adb("shell", "input", "swipe", "540", "500", "540", "1800", "200")
    time.sleep(0.5)
    try_box()
    type_sentence("pay lunar")
    k.adb("shell", "input", "text", "-69787")
    type_sentence(".testnet 0.1")
    time.sleep(0.4)
    k.press("LETTERS", "Pay")
    lines = wait_strip("left today after this", 45)
    k.expect_true("card shows the cap left after this payment", any("0.9 NEAR left today after this" in l for l in lines), lines)
    k.expect_true("tapped the card's Pay button", tap_strip_action("Pay"))
    lines = wait_strip("Sent 0.1 NEAR", 45)
    k.expect_true("keyboard key paid 0.1 NEAR on testnet", any("Sent 0.1 NEAR to lunar-69787.testnet" in l for l in lines), lines)
    print("   strip:", lines)

    # 3. over the cap: the card sends you to the wallet screen instead
    k.adb("shell", "input", "keyevent", "KEYCODE_MOVE_END", *(["KEYCODE_DEL"] * 60))
    time.sleep(0.5)
    type_sentence("pay ")
    k.adb("shell", "input", "text", "lunar-69787")
    type_sentence(".testnet 2")
    pay_key = k.keys()["LETTERS"]["Pay"]
    k.adb("logcat", "-c")
    k.tap(pay_key[0], pay_key[1])
    lines = wait_strip("Over today's cap", 45)
    k.expect_true("over the cap the card says so and offers the wallet", any("Over today's cap" in l for l in lines), lines)
    k.expect_true("tapped the card's Wallet button", tap_strip_action("Wallet"))
    xml = wait_ui("Approve from wallet", 15)
    if xml is None:
        k.adb("shell", "input", "swipe", "540", "600", "540", "1800", "200")
        xml = wait_ui("Approve from wallet", 10)
    k.expect_true("the wallet screen opens with the payment to approve", xml is not None and "Pay lunar-69787.testnet · 2 NEAR" in xml)

    # 4. approve it from the wallet screen: a plain transfer signed by the account's full-access key
    tap_text("Approve from wallet")
    xml = wait_ui("Done · tap to see it on NEAR", 45)
    k.expect_true("the wallet approved the over-cap payment on testnet", xml is not None)

    # 5. swap: the keyboard quotes it from a sentence, the wallet screen signs it, test USDC arrives
    k.adb("shell", "input", "swipe", "540", "500", "540", "2000", "200")
    k.adb("shell", "input", "swipe", "540", "500", "540", "2000", "200")
    tap_text("Type here")
    time.sleep(1.2)
    k.adb("shell", "input", "keyevent", "KEYCODE_MOVE_END", *(["KEYCODE_DEL"] * 60))
    k.type_letters("swap 0.2 near to usdc")
    time.sleep(1)
    c = k.chips()
    swap = [l for l in c if l.startswith("Swap 0.2 NEAR to USDC")]
    k.expect_true("swap talk offers a swap chip", bool(swap), list(c))
    if swap:
        k.tap(*c[swap[0]])
    lines = wait_strip("Testnet pool", 20)
    k.expect_true("the keyboard shows the market price and the testnet pool's quote",
                  any("Market: 0.2 NEAR ≈ $" in l for l in lines) and any("Testnet pool: ≈" in l for l in lines), lines)
    k.expect_true("tapped the swap card's Review button", tap_strip_action("Review"))
    xml = wait_ui("Swap now", 15)
    k.expect_true("the wallet screen opens the swap with the amount filled in", xml is not None and 'text="0.2"' in xml)
    tap_text("Swap now")
    xml = wait_ui("Swapped: got", 60)
    k.expect_true("the wallet swapped NEAR for test USDC on Ref Finance (testnet)", xml is not None and "test-USDC" in xml,
                  re.findall(r'text="(Swap[^"]*)"', xml or "")[:3])

    print()
    print("ALL PASSED" if not k.FAILS else f"{len(k.FAILS)} FAILED: {', '.join(k.FAILS)}")
    sys.exit(1 if k.FAILS else 0)


if __name__ == "__main__":
    main()
