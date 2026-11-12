# Lunar web

The Lunar landing page as a Next.js (App Router, TypeScript) project. It replaces the static export in `../site` with source code that can grow API routes under `src/app/api/`.

## Run

```bash
npm install
npm run dev        # http://localhost:4180, hot reload
npm run build      # production build
npm run start      # serve the build on http://localhost:4180
npm run typecheck  # tsc --noEmit (strict)
npm test           # node --test tests/
```

Node 22.6 or newer is needed for `npm test` (it runs the `.ts` tests directly).

## Layout

- `src/app/` – `layout.tsx` (metadata, header, scrollbar) and `page.tsx` (the sections in order).
- `src/components/<section>/` – one folder per landing section: `hero`, `intro`, `rules`, `signing`, `guarantee`, `parts`, `approvers`, `waitlist`, `footer`, plus `header`, `loader`, `scrollbar` and shared `ui`.
- `src/components/pixi/` – `PixiCanvas`, the one canvas wrapper every Pixi scene runs in, and small helpers (texture loading, floating motion, themed layers).
- `src/lib/` – content (copy, links, parts, quotes), the time-of-day theme store and small utilities.
- `src/styles/` – the original compiled stylesheets, unchanged apart from a dead SCSS `@mixin` rule removed from `base.css`.
- `public/` – images, fonts, icons and `site.webmanifest`.

## Behaviour worth knowing

- The hero sky, moon, clouds and title follow the visitor's local time (morning, midday, afternoon, night). The dial in the header lets you drag through the day.
- The waitlist form posts to formsubmit.co (`WAITLIST_ENDPOINT` in `src/lib/content.ts`). The Android pill downloads the latest APK from GitHub releases; the App Store is still marked "coming soon".
- `next.config.ts` keeps `images.unoptimized` so image URLs stay the plain `/assets/...` paths the scenes also load.

## Demo, AI parse and public record

| Route | What it does |
| --- | --- |
| `/demo` | The keyboard on screen. Type `pay <name> <amount> [for memo]`, tap Pay: the card checks the name, today's cap and the payee's receive chain (with a live Intents quote), then pays from the shared demo pocket. Also has the paste check. |
| `/record` | Every `pay`, `refused_over_cap`, `refused_low_balance` and `pay_failed_refunded` event from `lunarpay-0111.testnet` plus recovery events from `lunar-recv-80366.testnet`, newest first, read from chain transactions (revalidated every 30 s). |
| `POST /api/parse` | `{sentence}` (max 300 chars) → `{isPayment, payee, amount, token, memo, model}` or `{isPayment:false, reason}` from NEAR AI Cloud. The payee must be a name the user typed. 400 bad input, 502 upstream, 503 without `NEARAI_API_KEY`. Sentences are not stored or logged. |
| `POST /api/demo/pay` | `{to, amount, memo?}` (0 < amount ≤ 1 NEAR) → `{result, txHash, explorer}`; signed server-side with the demo's pay-only key, 4 calls then one per 30 s per IP. |
| `GET /api/demo/pocket` | The demo pocket (`get_pocket`). |
| `GET /api/name-check?account=&amount=` | Exists, key history (new account / new full-access key), receive preference, Intents quote. |

Environment (`.env.example` lists the names; values live in `.env.local`, which is not tracked):
`LUNAR_DEMO_ACCOUNT`, `LUNAR_DEMO_KEY`, `NEARAI_API_KEY`, `NEARAI_MODEL` (default `deepseek/deepseek-v3.2`).

Signing uses `@near-js/transactions` + `@near-js/crypto` + `@near-js/utils` (2.5): only transaction encoding, the ed25519 key and base58 (about 130 KB unpacked for the first two) instead of the full client library (3.6 MB unpacked); RPC calls are plain `fetch`. `npm test` runs the live NEAR AI test only when `NEARAI_API_KEY` is set.

### Demo account (NEAR testnet)

`lunar-demo.lunar-69787.testnet`: 3 NEAR in its pocket, daily cap 0.5 NEAR, and a function-call key limited to `pay` on `lunarpay-0111.testnet` with a 0.25 NEAR fee allowance.

- create and fund (4 NEAR): https://testnet.nearblocks.io/txns/2Ya3r4PfU248H4Ur5Cm3Ltq3yKT2o9SZu46PVeeMGpiL
- deposit 3 NEAR: https://testnet.nearblocks.io/txns/J2pQ5TAB3oDe8ZJSYzdaGD3ooWEEXMLPqLPKyRKFRsnM
- daily cap 0.5 NEAR: https://testnet.nearblocks.io/txns/A2ZgizryEqpQH49Wq9A7ZTtDwfh4gKMRrmF5rB6qn7rW
- pay-only key: https://testnet.nearblocks.io/txns/Dmc7wSxt8Tg6mVY5UmKL5jpEtDvJWHMvdf9iHR5buARN
- receive preference of `lunar-69787.testnet` (USDC on Base), so the card shows a quote: https://testnet.nearblocks.io/txns/8JwCZHVQmkUUa9BJtCryNapKo2yXoQhHP9TdnoCqkP1r

Paid from the browser demo:

- 0.05 NEAR, Sent: https://testnet.nearblocks.io/txns/HAG69hnCxU5eipN869jnYMXaVTpNW1eKtiUHiSfHb8s7
- 1 NEAR, refused by the contract (over cap): https://testnet.nearblocks.io/txns/4XmdHqWBbE7WAsVy46T6cMWtJawhAkJzwzpA1YxEJ9o1
