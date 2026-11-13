"""Account creation in the app: a taken name is caught while typing, Create offers a free one, and a
new account is ready fast. Makes one real testnet account. Run with the debug APK installed."""
import re
import sys
import time

import keyboard_e2e as k
from pay_e2e import tap_text, wait_ui


def field_value(xml):
    m = re.search(r'resource-id="[^"]*"[^>]*class="android.widget.EditText"[^>]*text="([^"]*)"', xml) or \
        re.search(r'<node[^>]*text="([^"]*)"[^>]*class="android.widget.EditText"', xml)
    return m.group(1) if m else None


def main():
    k.adb("shell", "am", "force-stop", k.PKG)
    k.adb("shell", "pm", "clear", k.PKG)
    k.adb("shell", "ime", "enable", k.IME, check=False)
    k.adb("shell", "ime", "set", k.IME)
    time.sleep(1.5)
    k.adb("shell", "am", "start", "-n", f"{k.PKG}/.setup.SetupActivity")
    time.sleep(2.5)

    k.adb("logcat", "-c")
    # 1. a name someone already owns is flagged before Create
    tap_text("pick a name")
    k.adb("shell", "input", "text", "solar")
    k.adb("shell", "input", "keyevent", "KEYCODE_BACK")
    xml = wait_ui("solar.testnet is taken", 10)
    k.expect_true("typing a taken name says so before Create", xml is not None, "no 'taken' hint")

    # 2. Create on a taken name fills in a free one instead of failing after a long wait
    t0 = time.time()
    tap_text("Create account")
    xml = wait_ui("is free, it's filled in for you", 15)
    log = k.adb("logcat", "-d", "-s", "LunarCreate:D", check=False)
    ms = re.search(r"taken, suggestion at (\d+) ms", log)
    k.expect_true("Create on a taken name answers within 3 s (timed in the app)", ms is not None and int(ms.group(1)) < 3000, ms.group(0) if ms else log[-200:])
    suggestion = re.search(r"(solar-\d{4})\.testnet is free", xml or "")
    k.expect_true("a free name like solar-1234 is filled in", suggestion is not None, (xml or "")[-300:])

    # 3. the free name is created and set up, and the time is reported
    t0 = time.time()
    tap_text("Create account")
    xml = wait_ui(f"{suggestion.group(1)}.testnet" if suggestion else "Pocket", 60)
    ready = wait_ui("left today", 30)
    took = round(time.time() - t0, 1)
    log = k.adb("logcat", "-d", "-s", "LunarCreate:D", check=False)
    print("   ", (log.strip().splitlines() or ["no log"])[-1], f"(screen ready after {took} s)")
    k.expect_true("the new account is ready with its pocket", ready is not None, took)
    k.expect_true("creating and setting up an account takes under 15 s", took < 15, took)

    print("ALL PASSED" if not k.FAILS else f"{len(k.FAILS)} FAILED: {', '.join(k.FAILS)}")
    return 1 if k.FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
