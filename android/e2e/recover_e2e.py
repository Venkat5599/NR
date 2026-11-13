"""The receive address, end to end: money paid to the account's Base address from an outside wallet
is forwarded by the app once Base finalizes it. NEAR's signer verifies the transfer and signs the
forward; nobody holds the address's key. Needs a transfer to the address made ~3 h earlier; waits up
to --wait minutes for Base to finalize it. Checks the result on Base itself, not just on screen."""
import argparse
import json
import re
import sys
import time
import urllib.request

import keyboard_e2e as k
from pay_e2e import scroll_to, tap_text

BASE = "https://sepolia.base.org"
NEAR = "https://rpc.testnet.fastnear.com"
USDC = "0x036cbd53842c5426634e7929541ec2318f3dcf7e"


def rpc(url, method, params):
    req = urllib.request.Request(url, json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(),
                                 {"content-type": "application/json", "user-agent": "lunar-e2e"})
    return json.load(urllib.request.urlopen(req, timeout=20))["result"]


def usdc_of(address):
    return int(rpc(BASE, "eth_call", [{"to": USDC, "data": "0x70a08231" + address[2:].rjust(64, "0")}, "latest"]), 16)


def view(contract, method, args):
    import base64
    r = rpc(NEAR, "query", {"request_type": "call_function", "finality": "optimistic", "account_id": contract,
                            "method_name": method, "args_base64": base64.b64encode(json.dumps(args).encode()).decode()})
    return json.loads(bytes(r["result"]).decode())


def texts(xml):
    return re.findall(r'text="([^"]+)"', xml)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wait", type=int, default=10, help="minutes to wait for Base to finalize")
    args = ap.parse_args()

    found = re.search(r"([a-z0-9_-]+\.testnet)", k.adb("shell", "run-as", k.PKG, "cat", "shared_prefs/account.xml"))
    if found is None:
        print("no account in the app: create one first")
        return 1
    account = found.group(1)
    receiver = view("lunar-recv-80366.testnet", "get_receiver", {"account_id": account})
    k.expect_true("the account has a receive address that forwards to its own address", receiver and receiver["forward_to"], receiver)
    dest = receiver["forward_to"]
    before = usdc_of(dest)

    k.adb("shell", "am", "start", "-n", f"{k.PKG}/.setup.SetupActivity")
    time.sleep(4)
    scroll_to("Check for payments")
    deadline = time.time() + args.wait * 60
    tapped = False
    while time.time() < deadline:
        tap_text("Check for payments")
        time.sleep(6)
        xml = k.ui()
        lines = [t for t in texts(xml) if re.search("USDC from|Arrived|Ready|Forwarded|signer|Signed|Sending", t)]
        print("   ", lines[:4])
        if any(t.startswith("Forwarded to") for t in texts(xml)) and tapped:
            break
        if not tapped and "Forward it" in texts(xml):
            tap_text("Forward it")
            tapped = True
            print("    tapped Forward it")
            deadline = max(deadline, time.time() + 300)
            time.sleep(20)
            continue
        time.sleep(30 if not tapped else 5)

    k.expect_true("the app offered Forward it once Base finalized the transfer, and it was tapped", tapped)
    xml = k.ui()
    k.expect_true("the app shows the money forwarded", any(t.startswith("Forwarded to") for t in texts(xml)), texts(xml)[-8:])

    req = urllib.request.Request(f"https://base-sepolia.blockscout.com/api/v2/addresses/{receiver['receive_address']}/token-transfers?type=ERC-20",
                                 headers={"user-agent": "lunar-e2e"})
    items = json.load(urllib.request.urlopen(req, timeout=20)).get("items", [])
    transfers = [{"transactionHash": t["transaction_hash"]} for t in items
                 if t["from"]["hash"].lower() == receiver["receive_address"] and t["to"]["hash"].lower() == dest]
    after = usdc_of(dest)
    k.expect_true("USDC left the receive address for the owner's address on Base", len(transfers) > 0 and after > before,
                  {"before": before, "after": after, "forward": transfers[0]["transactionHash"] if transfers else None})
    if transfers:
        print("    forward on Base:", transfers[0]["transactionHash"])
    print()
    print("ALL PASSED" if not k.FAILS else f"{len(k.FAILS)} FAILED: {', '.join(k.FAILS)}")
    return 1 if k.FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
