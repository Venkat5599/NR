# Lunar payments contract

Deployed on NEAR testnet: [`lunarpay-0111.testnet`](https://testnet.nearblocks.io/address/lunarpay-0111.testnet) ([deploy tx](https://testnet.nearblocks.io/txns/ABdBvXH9E9ctCZXr74NXzN4RW9fwTBVmL3h5bpCpaDXk)).

A person keeps a small pocket of NEAR here and sets a daily cap. Their keyboard holds a function-call key on their own account that may call only `pay` on this contract. Everything else needs 1 yoctoNEAR attached, which NEAR never allows from a function-call key, so only the person's wallet (full-access key) can top up, withdraw, change the cap, or change where they get paid.

| Method | Who can call it | What it does |
|---|---|---|
| `deposit()` (payable) | wallet | adds the attached NEAR to the caller's pocket |
| `set_daily_cap({cap})` (1 yocto) | wallet | sets the most the keyboard may pay per UTC day |
| `withdraw({amount})` (1 yocto) | wallet | sends pocket money back to the owner |
| `set_receive({pref: {chain, token, address}})` (1 yocto) | wallet | where the caller wants to be paid; read by payers' keyboards for a live quote |
| `pay({to, amount, memo?})` | keyboard key | pays from the pocket if today's total stays within the cap; returns `Sent`, `RefusedOverCap` or `RefusedLowBalance` |
| `get_pocket({account})`, `get_receive({account})` | anyone | views |

Refusals don't panic: they are recorded as events and returned, so the public record can list them from chain data. A transfer that fails (for example to an account that doesn't exist) goes back to the pocket and today's total drops again.

Events are NEP-297 logs with `standard: "lunar"`: `pay`, `refused_over_cap`, `refused_low_balance`, `pay_failed_refunded`, `deposit`, `cap_set`, `withdraw`, `receive_set`.

## Build and test

```sh
cargo test                               # 10 unit tests: cap, day reset, refusals, 1-yocto guards, refund on failure
cargo near build non-reproducible-wasm   # target/near/lunar_pay.wasm
```

The real testnet run of the cap and key-scope guarantees, signed by the Android keyboard's own code, is in [android/README.md](../../android/README.md#why-the-keyboard-cant-drain-you).

The deploy key is still on the contract account during the hackathon so fixes can ship. It will be deleted before judging, after which nobody can change the code.
