#!/usr/bin/env python3
"""End-to-end test of the paste check: save a payee in the app, copy addresses, read the keyboard's warning.

Run after keyboard_e2e.py's setup (debug APK installed). Uses the same helpers.
Run:  python3 e2e/paste_e2e.py
"""
import re
import sys
import time

import keyboard_e2e as k

BOB = "0x9f3a58aa2f90c1d2e3f4a5b6c7d8e9f0a1b2b21c"
LOOKALIKE = "0x9f3a" + "e71c0d4b" + "0" * 24 + "b21c"
STRANGER = "0x1111" + "2" * 32 + "3333"


def bounds(xml, text):
    m = re.search(r'text="' + re.escape(text) + r'"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
    if not m:
        return None
    a = list(map(int, m.groups()))
    return (a[0] + a[2]) // 2, (a[1] + a[3]) // 2


def tap_text(text):
    c = None
    for _ in range(8):
        c = bounds(k.ui(), text)
        if c and 150 < c[1] < 1300:
            break
        k.adb("shell", "input", "swipe", "540", "1600", "540", "900", "300")
        time.sleep(0.6)
    if c is None:
        raise RuntimeError(f"not on screen: {text}")
    k.tap(*c)
    time.sleep(0.6)


def bounds_any(text):
    for _ in range(4):
        if text in k.ui():
            return True
        k.adb("shell", "input", "swipe", "540", "1600", "540", "1000", "300")
        time.sleep(0.5)
    return False


def set_clip(text):
    k.adb("shell", "am", "broadcast", "-n", f"{k.PKG}/.debug.SetClipReceiver", "--es", "text", text)
    time.sleep(1.2)


def strip_has(substr, tries=10):
    for _ in range(tries):
        lines = k.strip_text()
        if any(substr in l for l in lines):
            return True, lines
        time.sleep(0.3)
    return False, k.strip_text()


def main():
    k.adb("shell", "am", "force-stop", k.PKG)
    k.adb("shell", "ime", "set", "com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME", check=False)
    time.sleep(1)
    k.adb("shell", "ime", "set", k.IME)
    time.sleep(1.5)
    k.adb("logcat", "-c")
    k.adb("shell", "am", "start", "-n", f"{k.PKG}/.setup.SetupActivity")
    time.sleep(2.5)

    # save bob.near with his address, through the app's own form, typing with Lunar
    tap_text("name, e.g. bob.testnet")
    k.adb("shell", "input", "text", "bob.near")
    k.press("LETTERS", "⏎")          # the field asks for "Next": Lunar's enter key moves to the address box
    time.sleep(0.5)
    k.adb("shell", "input", "text", BOB)
    k.press("LETTERS", "⏎")          # "Done" closes the keyboard
    time.sleep(0.8)
    tap_text("Save payee")
    k.expect_true("enter key moved to the next box and Save stored the payee", bounds_any("bob.near") and bounds_any("0x9f3a…b21c"))

    # open the keyboard in the Try box so the strip is on screen
    k.adb("shell", "input", "swipe", "540", "500", "540", "2000", "200")
    k.adb("shell", "input", "swipe", "540", "500", "540", "2000", "200")
    tap_text("Type here")
    time.sleep(0.8)

    set_clip(LOOKALIKE)
    ok, lines = strip_has("Not bob.near's address")
    k.expect_true("a lookalike of bob.near's address is flagged", ok, lines)
    with open("/tmp/lunar-lookalike.png", "wb") as f:
        import subprocess
        f.write(subprocess.run([k.ADB, "exec-out", "screencap", "-p"], capture_output=True).stdout)

    set_clip(BOB)
    ok, lines = strip_has("Copied address is bob.near")
    k.expect_true("bob.near's real address is recognised", ok, lines)

    set_clip(STRANGER)
    ok, lines = strip_has("never paid this address")
    k.expect_true("an unknown address gets a check-it note", ok, lines)

    before = k.strip_text()
    set_clip("see you at 8")
    time.sleep(0.5)
    k.expect_true("plain text on the clipboard changes nothing", k.strip_text() == before, k.strip_text())

    print()
    print("ALL PASSED" if not k.FAILS else f"{len(k.FAILS)} FAILED: {', '.join(k.FAILS)}")
    sys.exit(1 if k.FAILS else 0)


if __name__ == "__main__":
    main()
