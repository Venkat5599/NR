#!/usr/bin/env python3
"""Writes cases.json next to this file. Expected values are derived from the rules in
README.md (NEAR account-id spec, yocto = 10^-24 NEAR, frequency-ranked words), not by
running the app code. Deterministic: re-running gives the same file."""
import json
import random
import string
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORDS = (HERE.parent / "web" / "public" / "words_en.txt").read_text().split("\n")
WORDS = [w for w in WORDS if w]
RANK = {}
for i, w in enumerate(WORDS):
    RANK.setdefault(w, i)
APOS = {w.replace("'", ""): w for w in RANK if "'" in w}
rng = random.Random(20261113)
HEX = "0123456789abcdef"


def hexes(n):
    return "".join(rng.choice(HEX) for _ in range(n))


# ---------------------------------------------------------------- names
valid = [
    "bob.near", "alice.testnet", "near", "testnet", "aa", "a1", "00", "a.b", "x.y.z.near",
    "a-b_c.near", "lunar-69787.testnet", "carol_x.near", "dev.sub.testnet", "ref-finance-101.testnet",
    "wrap.testnet", "wrap.near", "usdc.itachicara.testnet", "lunarpay-0111.testnet", "1.near",
    "007.near", "a_b-c_d.e-f_g.near", "x1.near", "abc123.near", "q.q", "0x" + "a" * 40,
    "0x" + "f" * 40, "0x" + "0" * 40, "0" * 64, "f" * 64, "a" * 64, "zz",
    "a" * 59 + ".near", "1" * 61 + ".nx", "sub.account.of.someone.near", "token-v2.factory.testnet",
    "0x" + "a" * 39, "0x" + "g" * 40, "0x" + "a" * 41, "a" * 63 + "b", "my_wallet.testnet",
]
parts = ["bob", "alice", "carol", "dave", "eve", "lunar", "pay", "shop", "coffee", "x7", "dao", "app", "v2", "0", "42"]
while len(valid) < 200:
    k = rng.randint(1, 3)
    segs = []
    for _ in range(k):
        seg = rng.choice(parts)
        if rng.random() < 0.4:
            seg += rng.choice("-_") + rng.choice(parts)
        segs.append(seg)
    name = ".".join(segs + [rng.choice(["near", "testnet"])])
    if len(name) <= 64 and name not in valid:
        valid.append(name)
for _ in range(10):
    valid.append(hexes(64))
    valid.append("0x" + hexes(40))

invalid = [
    "", "a", "0", "-", "_", ".", "..", "Bob.near", "BOB.NEAR", "bob..near", ".near", ".bob.near",
    "bob.", "bob.near.", "-bob.near", "bob-.near", "bob_.near", "_bob.near", "bob--x.near",
    "bob__x.near", "bob-_x.near", "bob.-x.near", "bob._x.near", "bob near", " bob.near",
    "bob.near ", "bob@near", "@bob.near", "bob!.near", "bób.near", "bob/near", "bob:near",
    "bob,near", "bob+near", "bob#near", "a" * 65, "a" * 60 + ".near", "0X" + "a" * 40,
    "0x" + "A" * 40, "A" * 64, "bob\tnear", "bob\nnear", "b.", ".b", "-a", "a-", "a_", "_a",
    "a..b", "a.-b", "a-.b", "ab.", "x" * 100, "bob.near\u200b", "\u0430lice.near",
]
mutations = [
    lambda n: n.replace(".", "..", 1),
    lambda n: "." + n,
    lambda n: n + ".",
    lambda n: n + "-",
    lambda n: "_" + n,
    lambda n: n[0].upper() + n[1:],
    lambda n: n.replace(".", " ", 1),
    lambda n: n.replace(".", "!", 1),
    lambda n: n.replace(".", ".-", 1),
    lambda n: n.replace(".", "_.", 1),
    lambda n: (n + "z" * 70)[:65],
    lambda n: n.replace(".", "$", 1),
]
base = [v for v in valid if "." in v and not v.startswith("0x") and v[0].islower()]
i = 0
while len(invalid) < 200:
    n = base[i % len(base)]
    m = mutations[i % len(mutations)](n)
    i += 1
    if m != n and m not in invalid and m not in valid:
        invalid.append(m)

# ---------------------------------------------------------------- amounts
ONE = 10**24


def to_yocto(s):
    whole, _, frac = s.partition(".")
    return int(whole) * ONE + int(frac.ljust(24, "0") or "0")


def plain(s):
    whole, _, frac = s.partition(".")
    w = str(int(whole))
    f = frac.rstrip("0")
    return f"{w}.{f}" if f else w


amount_strings = [
    "0", "0.0", "1", "1.0", "0.05", "0.5", "12.5", "012.50", "007", "100", "1000000",
    "999999999", "999999999." + "9" * 24, "0." + "0" * 23 + "1", "1." + "0" * 23 + "1",
    "0.000001", "0.1", "0.25", "3.39", "123456789.123456789", "42", "10", "0.000000000000000001",
    "5.000000000000000000000000"[:26],
]
while len(amount_strings) < 90:
    w = str(rng.randint(0, 10 ** rng.randint(1, 9) - 1))
    if rng.random() < 0.8:
        w += "." + "".join(rng.choice(string.digits) for _ in range(rng.randint(1, 24)))
    if w not in amount_strings:
        amount_strings.append(w)
amounts = [{"near": a, "yocto": str(to_yocto(a)), "plain": plain(a)} for a in amount_strings]
amounts_invalid = [
    "", " ", "-1", "-0.5", "+1", "1e3", "1E-3", "1.", ".5", "1,5", "abc", "0x10", "1 000",
    "1..2", "1.2.3", "NaN", "Infinity", "1234567890", "0." + "0" * 24 + "1", "1." + "1" * 25,
    "١", "５", "1_000", "$5", "5near",
]

# ---------------------------------------------------------------- pay sentences
payees = [("bob.near", "bob.near"), ("alice.testnet", "alice.testnet"), ("@bob.near", "bob.near"),
          ("Bob.Near", "bob.near"), ("lunar-69787.testnet", "lunar-69787.testnet"),
          ("carol_x.near", "carol_x.near"), ("dev.sub.testnet", "dev.sub.testnet"),
          ("0x" + "ab" * 20, "0x" + "ab" * 20), ("c" * 64, "c" * 64), ("x1.near", "x1.near")]
amts = [("20", "20"), ("0.5", "0.5"), ("012.50", "12.5"), ("1,5", "1.5"), ("100", "100"),
        ("3.000001", "3.000001"), ("999999999", "999999999"), ("7", "7"), ("0.25", "0.25")]
toks = [("", None), (" usdc", "USDC"), (" USDT", "USDT"), (" near", "NEAR"), (" usd", "USDC"),
        (" dollars", "USDC"), (" dollar", "USDC"), ("usdc", "USDC"), (" Near", "NEAR")]
memos = [None, "dinner", "the cab ride", "rent share", "coffee and cake"]
lead = ["", "ok ", "thanks! ", "sure. ", "line one\n"]
pay = []
seen = set()
for k in range(160):
    raw_name, payee = payees[k % len(payees)]
    raw_amt, amt = amts[(k * 7) % len(amts)]
    raw_tok, tok = toks[(k * 5) % len(toks)]
    memo = memos[(k * 3) % len(memos)]
    dollar = k % 6 == 0
    verb = ["pay", "send", "Pay", "SEND"][k % 4]
    a = ("$" if dollar else "") + raw_amt
    m = f" for {memo}" if memo else ""
    if k % 2 == 0:
        sentence = f"{verb} {raw_name} {a}{raw_tok}{m}"
    else:
        sentence = f"{verb} {a}{raw_tok} to {raw_name}{m}"
    token = tok if tok else ("USDC" if dollar else "NEAR")
    text = lead[k % len(lead)] + sentence
    if text in seen:
        continue
    seen.add(text)
    pay.append({"text": text, "expect": {"payee": payee, "amount": amt, "token": token, "memo": memo, "span": len(sentence)}})
extra_ok = [
    ("pay bob.near 5 ", {"payee": "bob.near", "amount": "5", "token": "NEAR", "memo": None, "span": 15}),
    ("pay bob.near 5 for the $3 coffee", {"payee": "bob.near", "amount": "5", "token": "NEAR", "memo": "the $3 coffee", "span": 32}),
    ("send 2 to alice.testnet for $ stuff", {"payee": "alice.testnet", "amount": "2", "token": "NEAR", "memo": "$ stuff", "span": 35}),
    ("pay bob.near $5 near", {"payee": "bob.near", "amount": "5", "token": "NEAR", "memo": None, "span": 20}),
    ("pay bob.near 1.123456", {"payee": "bob.near", "amount": "1.123456", "token": "NEAR", "memo": None, "span": 21}),
    ("pay bob.near 0.10", {"payee": "bob.near", "amount": "0.1", "token": "NEAR", "memo": None, "span": 17}),
    ("i said pay bob.near 2", {"payee": "bob.near", "amount": "2", "token": "NEAR", "memo": None, "span": 14}),
]
for t, e in extra_ok:
    pay.append({"text": t, "expect": e})
not_pay = [
    "", "   ", "hello there", "pay bob.near", "pay 5", "pay bob.near 0", "pay bob.near 0.000",
    "pay bob.near 00", "pay Bob..near 5", "pay b 5", "pay bob.near 20 and then something else",
    "pay bob.near 1.1234567", "pay bob.near 1234567890", "pay bob.near -5", "pay bob.near 5 eur",
    "pay bob.near 5 btc", "repay bob.near 5", "paybob.near 5", "pay to bob.near 5", "pay 5 bob.near",
    "send 5 usdc bob.near", "pay bob.near five", "pay bob.near 1e3", "pay .bob.near 5",
    "pay bob.near. 5", "pay bob-.near 5", "pay bob.near 5 for", "pay bob.near 5 for ",
    "pay bob.near 5,", "pay bob.near 5.", "pay bob.near .5", "pay bob.near 5 usdc usdt",
    "pay bob.near 5 for " + "x" * 61, "pay " + "a" * 65 + " 5", "pay 5 to", "send to bob.near",
    "transfer bob.near 5", "pay bob.near 5 to alice.near", "pay bob.near 5\nthanks",
    "pay 0 to bob.near", "send $0 to bob.near", "pay bob.near $", "pay bob.near 5 $",
]
for t in not_pay:
    pay.append({"text": t, "expect": None})

# ---------------------------------------------------------------- suggestions
def cap(w):
    return "I" + w[1:] if w == "i" or w.startswith("i'") else w


def top_for(key):
    if key in APOS:
        return APOS[key]
    if key in RANK:
        return key
    cands = [w for w in RANK if w.startswith(key)]
    return min(cands, key=lambda w: RANK[w]) if cands else None


suggest_prefix = []
seen_p = set()
for w in WORDS[:600]:
    if len(w) < 4 or "'" in w:
        continue
    p = w[:3]
    if p in seen_p:
        continue
    seen_p.add(p)
    suggest_prefix.append({"typed": p, "top": cap(top_for(p))})
suggest_prefix = suggest_prefix[:200]
suggest_exact = [{"typed": w, "top": cap(top_for(w))} for w in WORDS[:200] if "'" not in w][:150]


def edits1(w):
    out = set()
    for i in range(len(w) + 1):
        if i < len(w):
            out.add(w[:i] + w[i + 1:])
        if i < len(w) - 1:
            out.add(w[:i] + w[i + 1] + w[i] + w[i + 2:])
        for c in string.ascii_lowercase:
            if i < len(w):
                out.add(w[:i] + c + w[i + 1:])
            out.add(w[:i] + c + w[i:])
    return out


def has_prefix(p):
    return any(x.startswith(p) for x in RANK)


suggest_fix = []
for w in WORDS[:3000]:
    if len(suggest_fix) >= 200:
        break
    if len(w) < 5 or not w.isalpha():
        continue
    kind = len(suggest_fix) % 3
    j = rng.randint(1, len(w) - 2)
    if kind == 0:
        typo = w[:j] + w[j + 1:]
    elif kind == 1:
        typo = w[:j] + w[j + 1] + w[j] + w[j + 2:]
    else:
        typo = w[:j] + rng.choice([c for c in string.ascii_lowercase if c != w[j]]) + w[j + 1:]
    if typo == w or typo in RANK or typo in APOS or has_prefix(typo):
        continue
    near = sorted((x for x in edits1(typo) if x in RANK), key=lambda x: RANK[x])
    if w not in near[:3]:
        continue
    suggest_fix.append({"typed": typo, "contains": w, "edit": ["deletion", "transposition", "substitution"][kind]})

out = {
    "version": 1,
    "names": {"valid": valid, "invalid": invalid},
    "amounts": {"valid": amounts, "invalid": amounts_invalid},
    "pay": pay,
    "suggest": {"prefix": suggest_prefix, "exact": suggest_exact, "fix": suggest_fix},
}
(HERE / "cases.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
print({k: (len(v) if isinstance(v, list) else {kk: len(vv) for kk, vv in v.items()}) for k, v in out.items() if k != "version"})
