#!/usr/bin/env python3
"""End-to-end test: types on the Lunar keyboard with real taps on a running emulator/phone.

Needs: adb on PATH or at ~/Android/sdk/platform-tools/adb, the debug APK installed,
Lunar enabled and selected (the script does both). Debug builds log every key's
on-screen centre under the logcat tag LunarKeys; that is how the taps find the keys.

Run:  python3 e2e/keyboard_e2e.py
"""
import os
import re
import subprocess
import sys
import time

ADB = os.environ.get("ADB") or os.path.expanduser("~/Android/sdk/platform-tools/adb")
PKG = "app.lunar.keyboard"
IME = f"{PKG}/.ime.LunarIme"
FAILS = []


def adb(*args, check=True):
    r = subprocess.run([ADB, *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"adb {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout


def ui():
    adb("shell", "uiautomator", "dump", "/sdcard/lunar-ui.xml")
    return adb("shell", "cat", "/sdcard/lunar-ui.xml")


def node(xml, **attrs):
    for m in re.finditer(r"<node [^>]*>", xml):
        n = m.group(0)
        if all(re.search(fr'{k}="{re.escape(v)}"', n) for k, v in attrs.items()):
            b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n).groups()
            text = re.search(r'text="([^"]*)"', n).group(1)
            return text, tuple(map(int, b))
    return None


def field_text(xml):
    """Text of the first text box on the setup screen (the 'Try it' box). Empty shows its hint."""
    for m in re.finditer(r"<node [^>]*>", xml):
        n = m.group(0)
        if 'class="android.widget.EditText"' in n:
            t = re.search(r'text="([^"]*)"', n).group(1)
            return "" if t == "Type here" else t.replace("&#10;", "\n")
    return None


def keys():
    """Latest key map per page from logcat: {page: {label: (x, y, type)}}."""
    log = adb("logcat", "-d", "-s", "LunarKeys:D")
    pages = {}
    for line in log.splitlines():
        m = re.search(r"page=(\w+) (.*)$", line)
        if not m:
            continue
        km = {}
        for part in m.group(2).split(";"):
            t, hexl, x, y = part.split("|")
            label = "".join(chr(int(h, 16)) for h in hexl.split("-")) if hexl else ""
            km[label] = (int(x), int(y), t)
        pages[m.group(1)] = km
    return pages


def tap(x, y):
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(0.12)


def press(page, label):
    k = keys()[page][label]
    tap(k[0], k[1])


def long_press(page, label):
    x, y, _ = keys()[page][label]
    adb("shell", "input", "swipe", str(x), str(y), str(x), str(y), "700")
    time.sleep(0.2)


def type_letters(s):
    """Types lower-case letters, spaces, '.' and ','; digits via long-press hints."""
    digits = {"1": "q", "2": "w", "3": "e", "4": "r", "5": "t", "6": "y", "7": "u", "8": "i", "9": "o", "0": "p"}
    for ch in s:
        if ch == " ":
            press("LETTERS", " ")
        elif ch in digits:
            long_press("LETTERS", digits[ch])
        else:
            press("LETTERS", ch)


def expect(name, got, want):
    ok = got == want
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"\n     got:  {got!r}\n     want: {want!r}"))
    if not ok:
        FAILS.append(name)


def expect_true(name, cond, detail: object = ""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  ({detail})"))
    if not cond:
        FAILS.append(name)


def strip_text(_xml=None):
    """Title and detail of the row above the keys, as the debug build logs them (newest last)."""
    log = adb("logcat", "-d", "-s", "LunarStrip:D")
    lines = [l.split("LunarStrip:", 1)[1].strip() for l in log.splitlines() if "LunarStrip:" in l]
    return lines[-1:] and lines[-1].split(" || ") or []


def clear_field(field_bounds):
    x = (field_bounds[0] + field_bounds[2]) // 2
    y = (field_bounds[1] + field_bounds[3]) // 2
    tap(x, y)
    adb("shell", "input", "keyevent", "KEYCODE_MOVE_END", *(["KEYCODE_DEL"] * 40))
    time.sleep(0.4)


def chips():
    """The bar's chips and suggestions with their on-screen centres, from the debug log (tag LunarChips)."""
    lines = [l.split("LunarChips:", 1)[1].strip() for l in adb("logcat", "-d", "-s", "LunarChips:D").splitlines() if "LunarChips:" in l]
    if not lines or not lines[-1]:
        return {}
    return {c.split("|")[0]: (int(c.split("|")[1]), int(c.split("|")[2])) for c in lines[-1].split(";")}


def hold_and_pick(page, label, option):
    """Holds a key until its options open, slides to `option`, lifts. Returns the offered options."""
    x, y, _ = keys()[page][label]
    def popups():
        return [l.split("LunarPopup:", 1)[1].strip() for l in adb("logcat", "-d", "-s", "LunarPopup:D").splitlines() if "LunarPopup:" in l]
    seen = len(popups())                                       # don't clear logcat: the key map lives there too
    adb("shell", "input", "motionevent", "DOWN", str(x), str(y))
    time.sleep(0.8)
    lines = popups()[seen:]
    if not lines:
        adb("shell", "input", "motionevent", "UP", str(x), str(y))
        return None
    opts = {o.split("|")[0]: int(o.split("|")[1]) for o in lines[-1].split(";")}
    tx = opts.get(option, x)
    for i in range(1, 6):
        adb("shell", "input", "motionevent", "MOVE", str(x + (tx - x) * i // 5), str(y))
        time.sleep(0.04)
    adb("shell", "input", "motionevent", "UP", str(tx), str(y))
    return list(opts)


def main():
    adb("shell", "am", "force-stop", PKG)  # stopping the package makes Android fall back to another keyboard,
    adb("shell", "ime", "enable", IME, check=False)  # so select Lunar after it
    # switching away and back makes Android bind the freshly started keyboard right away
    adb("shell", "ime", "set", "com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME", check=False)
    time.sleep(1)
    adb("shell", "ime", "set", IME)
    time.sleep(1.5)
    adb("logcat", "-c")
    adb("shell", "am", "start", "-n", f"{PKG}/.setup.SetupActivity")
    time.sleep(2.5)

    xml = ui()
    expect_true("setup screen sees Lunar is on", 'text="Lunar is on"' in xml)
    expect_true("setup screen sees Lunar is selected", 'text="Lunar is your keyboard"' in xml)

    field = node(xml, **{"class": "android.widget.EditText", "text": "Type here"})
    if not field:
        field = node(xml, **{"class": "android.widget.EditText"})
    fb = field[1]
    tap((fb[0] + fb[2]) // 2, (fb[1] + fb[3]) // 2)
    time.sleep(1.5)
    expect_true("keyboard opened and logged its keys", "LETTERS" in keys(), "no LunarKeys log")

    # 1. auto-capital at the start, then plain letters
    type_letters("hello world")
    time.sleep(0.4)
    expect("auto-capitalises the first letter", field_text(ui()), "Hello world")

    # 2. double-space makes a full stop, and the next word is capitalised
    press("LETTERS", " "); press("LETTERS", " ")
    type_letters("ok")
    time.sleep(0.4)
    expect("double space types '. ' and capitalises", field_text(ui()), "Hello world. Ok")

    # 3. delete removes one character
    press("LETTERS", "⌫")
    time.sleep(0.3)
    expect("delete removes one character", field_text(ui()), "Hello world. O")

    # 4. shift: at the start it is on (auto-capital); one tap turns it off, a later tap gives one capital
    clear_field(fb)
    time.sleep(0.5)
    press("LETTERS", "⇧")
    type_letters("a")
    press("LETTERS", "⇧")
    type_letters("bc")
    time.sleep(0.3)
    expect("shift gives exactly one capital", field_text(ui()), "aBc")

    # 5. symbols page and back
    clear_field(fb)
    tap((fb[0] + fb[2]) // 2, (fb[1] + fb[3]) // 2)
    time.sleep(0.6)
    press("LETTERS", "?123"); time.sleep(0.3)
    press("SYMBOLS", "@"); press("SYMBOLS", "#")
    press("SYMBOLS", "ABC"); time.sleep(0.3)
    type_letters("x")
    expect("symbols page types symbols and returns to letters", field_text(ui()), "@#x")

    # 6. the pay sentence, then the Pay key: card shows and the name is checked on NEAR
    clear_field(fb)
    tap((fb[0] + fb[2]) // 2, (fb[1] + fb[3]) // 2)
    time.sleep(0.6)
    # start with a lower-case 'p': auto-cap gives 'P', which the parser accepts
    type_letters("pay near 2")
    time.sleep(0.3)
    expect("typed the pay sentence", field_text(ui()), "Pay near 2")
    press("LETTERS", "Pay")
    time.sleep(0.5)
    texts = strip_text()
    expect_true("Pay shows the payment card", any(t.startswith("Pay near · 2 NEAR") for t in texts), texts)
    for _ in range(20):
        texts = strip_text()
        if len(texts) > 1 and not texts[1].startswith("Checking"):
            break
        time.sleep(0.5)
    expect_true("Pay checked the name on NEAR mainnet (exists, account age)", len(texts) > 1 and texts[1].startswith("near · "), texts)

    # 7. a name that does not exist is flagged
    clear_field(fb)
    tap((fb[0] + fb[2]) // 2, (fb[1] + fb[3]) // 2)
    time.sleep(0.6)
    type_letters("pay zzqqlunarnobody")
    press("LETTERS", "."); type_letters("near 5")
    press("LETTERS", "Pay")
    for _ in range(20):
        texts = strip_text()
        if any("No account" in t or "Couldn't reach" in t for t in texts):
            break
        time.sleep(0.5)
    expect_true("a missing NEAR name is flagged", any("No account called zzqqlunarnobody.near" in t for t in texts), texts)

    # 8. shift: a quick double tap locks capitals even at the start of a sentence (auto-capital on)
    clear_field(fb)
    tap((fb[0] + fb[2]) // 2, (fb[1] + fb[3]) // 2)
    time.sleep(0.6)
    x, y, _ = keys()["LETTERS"]["⇧"]
    adb("shell", f"input tap {x} {y}; input tap {x} {y}")   # one shell call: the two taps land well inside the double-tap window
    time.sleep(0.3)
    type_letters("abc")
    time.sleep(0.3)
    expect("double-tap shift locks capitals", field_text(ui()), "ABC")
    press("LETTERS", "⇧")                                     # one tap unlocks
    type_letters("d")
    time.sleep(0.3)
    expect("a tap unlocks shift", field_text(ui()), "ABCd")

    # 9. holding a key offers options: hold $ and slide to NEAR types the token after the amount
    clear_field(fb)
    tap((fb[0] + fb[2]) // 2, (fb[1] + fb[3]) // 2)
    time.sleep(0.6)
    press("LETTERS", "?123"); time.sleep(0.3)
    press("SYMBOLS", "5")
    picked = hold_and_pick("SYMBOLS", "$", "NEAR")
    time.sleep(0.4)
    expect_true("holding $ lists currencies and tokens", picked is not None and "USDC" in picked, picked)
    expect("sliding to NEAR types ' NEAR' after the amount", field_text(ui()), "5 NEAR")

    # 10. Pay with nothing typed opens the pay form; keys type into it, enter moves on, Review checks it
    clear_field(fb)
    tap((fb[0] + fb[2]) // 2, (fb[1] + fb[3]) // 2)
    time.sleep(0.6)
    press("LETTERS", "Pay")
    time.sleep(0.6)
    texts = strip_text()
    expect_true("Pay with nothing typed opens the pay form", texts[:1] == ["Pay form"], texts)
    type_letters("bob")
    press("LETTERS", "."); type_letters("near")
    press("LETTERS", "⏎"); time.sleep(0.5)
    press("SYMBOLS", "2")
    time.sleep(0.4)
    texts = strip_text()
    expect_true("the form took the name and the amount", texts[1:2] and "to=bob.near amount=2 token=NEAR" in texts[1], texts)
    press("SYMBOLS", "Pay")                                   # Pay inside the form means Review
    for _ in range(20):
        texts = strip_text()
        if len(texts) > 1 and not texts[1].startswith("Checking"):
            break
        time.sleep(0.5)
    expect_true("Review shows the checked payment card", texts[:1] == ["Pay bob.near · 2 NEAR"] and texts[1].startswith("bob.near · "), texts)
    adb("shell", "input", "keyevent", "KEYCODE_BACK"); time.sleep(0.6)   # keyboard down: the chat box is visible again
    expect("nothing typed into the form reached the chat", field_text(ui()), "")

    # 11. suggestions: the bar completes the word being typed, and a tap replaces it
    clear_field(fb)
    tap((fb[0] + fb[2]) // 2, (fb[1] + fb[3]) // 2)
    time.sleep(0.8)
    type_letters("see you at dinn")
    time.sleep(0.6)
    c = chips()
    expect_true("the bar suggests 'dinner' for 'dinn'", "dinner" in c, list(c))
    if "dinner" in c:
        tap(*c["dinner"]); time.sleep(0.5)
    expect("tapping a suggestion replaces the word and adds a space", field_text(ui()), "See you at dinner ")

    # 12. smart chips read the sentence: money talk offers Pay, dollars convert at the live price
    type_letters("i owe you ")
    press("LETTERS", "?123"); time.sleep(0.3)
    for ch in "$12":
        press("SYMBOLS", ch)
    time.sleep(0.8)
    c = chips()
    conv = [l for l in c if l.startswith("$12 ≈ ") and l.endswith(" NEAR")]
    expect_true("dollars in the chat show their value in NEAR at the live price", bool(conv), list(c))
    if conv:
        tap(*c[conv[0]]); time.sleep(0.8)
        texts = strip_text()
        expect_true("the conversion chip opens the pay form with that amount",
                    texts[:1] == ["Pay form"] and "amount=" + conv[0].split("≈ ")[1].split(" ")[0] in texts[1] and "info=" in texts[1], texts)

    print()
    print(f"{'ALL PASSED' if not FAILS else str(len(FAILS)) + ' FAILED: ' + ', '.join(FAILS)}")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
