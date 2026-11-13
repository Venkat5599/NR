# Shared test cases

`cases.json` is read by both test suites (web `tests/shared-cases.test.ts`, and the phone app's
unit tests), so the two keyboards stay on the same rules. `generate.py` writes it; the expected
values come from the rules below, not from running either app. Cases may be appended; keys are
never renamed.

## Schema (version 1)

| key | shape | rule |
| --- | --- | --- |
| `names.valid` / `names.invalid` | `string[]` | NEAR account ids: 2–64 chars; parts of `[a-z0-9]+` joined by single `-` or `_`; parts joined by single `.`; no leading/trailing/double separators; lowercase only. 64 lowercase hex (implicit) and `0x` + 40 lowercase hex (eth implicit) are valid. |
| `amounts.valid[]` | `{near, yocto, plain}` | `near` is a plain decimal (1–9 whole digits, optional `.` + 1–24 digits). `yocto` = near × 10^24 as a decimal string. `plain` = `near` without leading zeros in the whole part and without trailing fractional zeros (formatting `yocto` back gives `plain`). |
| `amounts.invalid` | `string[]` | Rejected by the NEAR→yocto conversion: signs, exponents, commas, missing digits on either side of `.`, more than 9 whole or 24 fractional digits, non-ASCII digits. |
| `pay[]` | `{text, expect}` | `text` is everything before the cursor. `expect` is `null` (not a payment) or `{payee, amount, token, memo, span}`: lowercase payee without `@`; `amount` plain decimal (`,` read as `.`); `token` one of `NEAR`/`USDC`/`USDT` (no token word: `USDC` if the amount itself carried `$`, else `NEAR`; a `$` inside the memo does not change the token); `memo` trimmed or `null`; `span` = characters from the start of `pay`/`send` to the end of the text. |
| `suggest.prefix[]` / `suggest.exact[]` | `{typed, top}` | First suggestion for a lowercase `typed` from `words_en.txt` (frequency order, first line most common): the contraction if `typed` is one with its apostrophe dropped; else `typed` itself if it is a word; else the most frequent word starting with `typed`. `i` and `i'…` are capitalised. |
| `suggest.fix[]` | `{typed, contains, edit}` | `typed` is one slip (`deletion`, `transposition`, `substitution`) from `contains`; no word starts with `typed`, and `contains` is among the 3 suggestions. |
