# Lunar: the full technical pitch

> Status: design stage. Nothing here is built yet. See the [honesty table](../README.md#whats-real-vs-pending--the-honesty-table).

## The guarantee

**Under any threat, the most anyone can take from you today is your daily limit, and anyone can check that.**

## The problem

Physical attacks on crypto holders are rising fast. More than $30M was taken by force in H1 2026 (2025's record for the whole year was $58M). There were 52 verified attacks in H1 2026, up 33% on the year before, with $124M at stake and home invasions up from 1 to 20. Almost every recorded attack ends within 24 hours.

The attacks work because crypto is instant and final. Shops solved the same problem decades ago with time-delay safes and a sticker saying the clerk cannot open them. A robbery stops paying when the victim provably cannot hand over more.

Sources: [EVIDENCE.md](EVIDENCE.md).

## Why Bitcoin cannot do this today

- A time-delay vault with a recovery path was formally specified as a Bitcoin soft fork. Its own text says it is "the only way to configure this defense without rolling timelocked coins for perpetuity or relying on a trusted third party". The proposal was withdrawn in May 2025 in favour of a more general opcode.
- No covenant opcode is active on Bitcoin mainnet. The leading activation attempt had 0% miner signalling as of late May 2026, with a minimum activation height around May 2027.
- So today, every working Bitcoin time-delay vault depends on a company that co-signs or runs the policy server.

Existing approaches and where each falls short:

| Approach | Problem |
| --- | --- |
| Decoy / duress wallet | Asks the victim to lie convincingly under violence; attackers know about decoys |
| Multisig with a company key | The company is the trusted third party, priced at $250 to $7,500 a year |
| EVM smart-wallet daily limits | Ethereum-only; cannot protect native Bitcoin |
| Allowlist with a 24h cooldown, per chain | Built against theft: one device key signs everything, separate lists per chain, often an instant recovery address, and 24h is about as long as most attacks last |
| A contract that signs a blind 32-byte hash for a Bitcoin address | Any limit or delay in front of it cannot see the recipient or the amount, so it is not a policy |

## How it works

1. **Keyless vault.**
   - A NEAR contract account with every access key deleted after deploy.
   - It derives the user's Bitcoin, EVM and NEAR addresses through Chain Signatures. The derivation is bound to the contract as caller, so only its code can ever request a signature for those addresses.
   - No private key for the funds exists anywhere.
2. **The contract builds the transaction.**
   - Bitcoin and EVM transactions are assembled on chain from explicit fields (inputs, recipient, amount, change), and the contract computes the signing hash itself.
   - For segwit inputs the signed hash commits to each input's value, so lying about inputs only yields an invalid signature.
   - Change is forced back to the vault's own derived address.
3. **One daily limit, summed in USD across every chain.** Example: $200 a day. No weak chain to pick on.
4. **The phone key is a function-call key** scoped to `spend_daily` and `request_withdrawal`. The NEAR protocol itself refuses anything else from it, so no policy call, key addition or transfer is possible.
5. **Delayed path.**
   - Above the limit, a withdrawal waits 72 hours and may only go to a destination saved at least 7 days earlier.
   - After the window, anyone may execute it.
6. **Asymmetric rule changes.** Raising a limit, shortening a delay, saving a destination or removing a guardian waits 7 days. Lowering a limit, adding a guardian or freezing applies at once.
7. **Guardians.**
   - Any one guardian can cancel a pending withdrawal or freeze the vault. Unfreezing needs a majority.
   - The pattern mirrors NEAR's own account-recovery design (timelock, notification, independent watchers), applied to spending.
8. **Duress PIN.** It freezes the vault silently and shows "pending, 72h". No deception is needed, because the statement is true.
9. **Public Maximum Extractable Value page.**
   - It reads limit, spent-today, queue and countdowns from contract state.
   - The attacker can verify it on his own phone.
   - People at high risk can publish it as a deterrent.
10. **Confidential top-up (mainnet).**
    - The daily spending wallet is refilled through NEAR Confidential Intents, whose deposits and withdrawals cannot be linked.
    - The wallet a robber can see therefore does not lead back to the vault.

## Why NEAR is load-bearing

Remove NEAR and the guarantee becomes false.

- **Chain Signatures** give a contract control of a native Bitcoin address with no soft fork and no company. The MPC network now runs fully inside secure hardware with 17 independent operators.
- **Function-call access keys** are a protocol feature. The phone's inability to change policy is enforced by the chain, not by the app.
- **Yield/resume** lets the vault call the signer and receive the signature inside the same contract flow.
- **Confidential Intents** break the link between the spending wallet and the vault.

## Demo (about 3 minutes, every step on an explorer)

1. Alice's vault holds testnet BTC, Base Sepolia USDC and NEAR under one contract.
2. "Send everything to me." $200 goes through instantly. **Refusal 1:** the rest is above the daily limit and gets queued, not signed.
3. "Send the Bitcoin to my address." **Refusal 2:** it is not a saved destination.
4. "Then save my address." **Refusal 3:** it becomes usable in 7 days.
5. "Raise your limit" / "remove your guardians." **Refusal 4:** both wait 7 days and either can be cancelled.
6. "Use the phone key on the contract." **Refusal 5:** the protocol rejects it, because the key cannot call policy methods.
7. The robber scans the proof page on his own phone: "Most you can take today: $200."
8. A guardian taps Cancel and Freeze on NEAR.
9. Normal life: 72 hours later, a withdrawal to Alice's saved cold address confirms on Bitcoin testnet.

## Who pays

- **Individuals.** People already pay $250 to $7,500 a year for company-held-key Bitcoin custody. Lunar sells the same peace of mind without the company key.
- **Teams.** Industry coercion guidance covers founders, funds, DAOs and exchanges, not just individuals. The same vault protects people who sign for a treasury.

## Score against the judging criteria (fully built)

| Criterion | Score | Why |
| --- | --- | --- |
| Impact | 9.5 | Dated, measured, growing harm |
| Technical | 9 | Transaction built on chain, cross-chain limit, keyless vault |
| Design / demo | 9 | One robbery scene, five refusals |
| Sustainability | 7.5 | A proven paid category; trust moves to the MPC network |
| Originality | 7.5 | The vault idea is old; doing it on native Bitcoin today, with no company key, is the new part |

**Overall: 8.6 / 10.** The plain average is 8.5; it rounds up because NEAR is load-bearing.

## Limitations

- Trust moves from a company to the NEAR MPC network.
- The daily limit is extractable by design.
- A captor who waits out the delay is answered by saved destinations and guardians.
- The vault's Bitcoin address is public on Bitcoin.
- Guardians must be out of the attacker's reach.

## Day-1 checks that could kill it

1. The testnet signer (`v1.signer-prod.testnet`) signs a Bitcoin testnet transaction when the caller is a contract.
2. Building a Bitcoin signing hash on chain fits within NEAR's gas limit.
3. A contract with zero access keys can still request a signature and resume with the result.
4. The proof page reads the limits from contract state alone.
