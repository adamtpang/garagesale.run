# Garage Sale

AI agents that find Marketplace deals, price them, and draft listings. The app is Next.js 14 in [`web/`](web/). It stores jobs, photos, the scout feed, and the ledger in Vercel Blob.

Live site: [https://grokbothackathon.vercel.app](https://grokbothackathon.vercel.app)

Repo: [https://github.com/adamtpang/garagesale.run](https://github.com/adamtpang/garagesale.run)

Built at the Grok Bot Hackathon, Austin, October 2026.

A photo or a buy query becomes a job. The Grok Bot worker identifies the item, writes the listing, and posts only after a person approves it. This repo stores the job and shows the log. It does not message sellers or take payment.

## Deal scout

The scheduled scout is a Grok Bot routine. It is not code in this repo. Garage Sale stores what the routine posts. The routine reads listings and sold comps. It does not contact sellers, make offers, or post anything.

The contract is [docs/SCOUT.md](docs/SCOUT.md).

`GET /api/scout/config` is public. `PUT /api/scout/config` replaces the config and requires the `x-worker-key` header (`GST_WORKER_KEY`). With no `BLOB_READ_WRITE_TOKEN`, the config file is `web/.data/scout-config.json`. Every field defaults to null until that PUT. The seed file is `web/config/scout-config.seed.json`.

```bash
GST_WORKER_KEY=... GARAGESALE_BASE_URL=https://grokbothackathon.vercel.app node scripts/seed-scout-config.mjs
```

`POST /api/deals` also requires `x-worker-key`. The body is `{ area?, deals: [...] }`. `source` is `fb`, `craigslist`, `ebay`, or `offerup`. A seller name or a client-supplied profit is dropped. `GET /api/deals` returns the stored feed. The deals page shows it, and says `Filters not set` when ranking did not run.

If `min_profit`, `max_pickup_miles`, `sites`, or a fee rate for one of those sites is null, deals are stored and left unranked.

## Server profit math

`web/lib/deals.js` scores each cleaned deal through `web/lib/decision.js`:

```text
net = resale - ask - fee(resale venue) - shipping - gas
gas = 2 * miles_from_new_braunfels * gas_per_mile
fee = rate * resale + flat
```

The fee follows the sold-comp venue. An eBay sold comp uses the eBay rate even when the buy is on Facebook, Craigslist, or OfferUp. Pickup miles are from New Braunfels only. Austin and San Marcos are not home origins. A stored distance counts only when `distance_from` is New Braunfels, or when the listing has coordinates.

Shipping is the median shipping on the sold comps used for the estimate. If any of those comps is missing shipping, shipping stays null and the net stays null. It is not stored as 0. If `gas_per_mile` is null, gas stays null and the net stays null. A fee rate with `confirmed: false` still produces a calculated net, and the deal is not a buy.

A comp is kept only when it is explicitly marked sold (`sold: true` or `status: "sold"`) and the URL is not a search, a price guide, retail, or Craigslist. An eBay `/itm/<id>` URL is not sold evidence by itself. With no sold comps left, `resale` is null and the deal is not a buy. One or two priced comps use their median and stay off the buy list. Three or more go through `estimate` in `web/lib/pricing.js`, which drops outliers and returns no price when fewer than three remain. A buy also needs a category in the six allowed categories, a confirmed model and condition match, a confirmed fee rate, and a net at or above `min_profit`.

When the filters are set, deals that pass are ranked by profit, high first.

The buy search (`POST /api/buy/search`) is separate. It reads Facebook Marketplace through a signed-in Helium browser on that machine, then `web/lib/pricing.js` ranks those listings against matching eBay sold comps. Fewer than three matches is `not enough comps`, not a guessed price.

## Ledger

The flip ledger is key-gated and encrypted. `GS_LEDGER_KEY` is required. `GET`, `POST`, `PATCH`, and `DELETE` under `/api/ledger` check the `x-ledger-key` header. A missing key is 503 (`ledger key not configured`). A wrong key is 401.

The blob store is public, so the ledger is AES-256-GCM ciphertext. The object path is an HMAC of a fixed label. It is not listed, and its URL is not returned. With no `BLOB_READ_WRITE_TOKEN`, the ciphertext is `web/.data/ledger.json`. The `/ledger` page keeps the key in `sessionStorage` for that tab.

`net_profit` is `sell_price - buy_price - gas - fees - repairs`, and it stays null until the item is sold. Bankroll is `starting_bankroll` minus money spent plus sales.

```bash
GS_LEDGER_KEY=... GARAGESALE_BASE_URL=https://grokbothackathon.vercel.app node scripts/ledger.mjs list
```

`scripts/ledger-rekey.mjs` decrypts with the old key and writes with the new one. A decrypt failure throws before any write.

## Env

Names only. Set them in the host. Do not commit values.

| Name | Used for |
| --- | --- |
| `GST_WORKER_KEY` | `x-worker-key` on scout config writes, `POST /api/deals`, and the relay |
| `GARAGESALE_BASE_URL` | Site origin for the seed and ledger scripts and the relay |
| `GST_WEBHOOK_URL` | Relay webhook URL. See Relay config. Not logged. |
| `GST_WEBHOOK_KEY` | Relay sender key. See Relay config. Not logged. |
| `GS_LEDGER_KEY` | Ledger API and encryption |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for jobs, images, the scout feed, and the ledger |

## Relay config

`relay/relay.py` polls `/api/pending` and wakes the Grok Bot worker. It reads these environment variables at startup. A missing or blank name is logged (the name only) and the process exits non-zero. It does not read config files.

| Name | Used for |
| --- | --- |
| `GARAGESALE_BASE_URL` | Site origin. A trailing slash is removed. |
| `GST_WORKER_KEY` | Sent as the `x-worker-key` header. |
| `GST_WEBHOOK_URL` | Worker routine webhook URL. |
| `GST_WEBHOOK_KEY` | Sent as `Authorization: Bearer ...`. |

The webhook URL and the sender key come from the worker routine panel. Do not commit values. The relay never logs secret values or the webhook URL.

## Tests

From `web/`:

```bash
npm test
npm run lint
npm run build
```

`npm test` runs `node --no-warnings --test lib/*.test.mjs components/*.test.mjs` (pricing, deal scoring, buy/skip decisions, the deal board markup, and the ledger).

The relay config check uses the stdlib:

```bash
python -m py_compile relay/relay.py
python -m unittest tests/test_relay_config.py
```
