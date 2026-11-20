# Worker API

For Flipping, the Grok bot that posts to garagesale.run. Spec problem 6 in `docs/TRANSFER-MARKET-SPEC.md`. What to do each day, and what to report, is in `docs/FLIPPING-DAILY.md`.

Every write needs the worker key. Every write takes `?dry_run=1` to test a post without changing the live site. Nothing in this API bids, buys, offers, messages a seller or posts a listing.

## Setup

The bot needs two secrets in its own store. Neither is ever written in a repo, a PR, a log or a chat.

- `GST_WORKER_KEY`: the worker key. Adam gives it to the bot.
- `GARAGESALE_BASE_URL`: `https://garagesale.run`.

Send the key as `x-worker-key: <key>` or `Authorization: Bearer <key>`.

## The daily run, in order

1. **Check the key.** `GET /api/worker/check`. Stop if it is not `{"ok": true}`.
2. **Dry run the surplus lots.** `POST /api/surplus?dry_run=1`. Read the scored lots. Fix any `400`.
3. **Post the surplus lots.** The same body, without `?dry_run=1`.
4. **Dry run, then post, the local listings.** `POST /api/deals?dry_run=1`, then without it.
5. **Refresh drive times.** `POST /api/drive/refresh`. Repeat while `unknown` is above 0 and the answer changes.
6. **Read the result.** `GET /api/feed`, the same feed Adam sees on the Market.
7. **Bring Adam the Buy items** with their links. Adam decides. The bot never bids or messages.

## Dry run

Add `?dry_run=1` to `POST /api/surplus`, `POST /api/deals` or `PUT /api/scout/config`.

- The body is checked and scored exactly as a real write would score it.
- **Nothing is saved.** No photos are copied. No drive times are looked up; known ones come from the cache.
- The answer carries `"dry_run": true`, `"saved": false` and a `note`.
- It still needs the worker key.

## Routes

### `GET /api/worker/check`

Tests the key and writes nothing.

```bash
curl -s -H "x-worker-key: $GST_WORKER_KEY" "$GARAGESALE_BASE_URL/api/worker/check"
```

- `200 {"ok": true}`: the key works on every write route.
- `401` with a `reason`: `server-has-no-key`, `no-key-sent` or `key-does-not-match`. See `docs/SCOUT.md` under "Worker key".

### `POST /api/surplus`

Replaces the stored surplus scan. Body: `{ "lots": [ ... ], "comp_sets"?: { ... } }`, at most 100 lots.

One lot. Only `id` is needed (letters, digits and hyphens; a lot without one is dropped). Send `title` and `url` too. Every other field is optional, and a missing value shows as "unknown". Never guess one.

```json
{
  "id": "ps-4123518",
  "auction_id": "4123518",
  "source_site": "Public Surplus",
  "title": "8 Zebra TC700K-02B24B0-US handhelds",
  "url": "https://www.publicsurplus.com/sms/all,tx/auction/view?auc=4123518",
  "seller": "City of Schertz",
  "city": "Schertz, TX",
  "pickup_address": "1400 Schertz Pkwy Bldg 9, Schertz, TX",
  "miles_from_home": 16,
  "miles_approximate": true,
  "photo_url": "https://...",
  "current_bid": 10,
  "bid_count": 1,
  "closes_at": "2026-11-18T02:00:00.000Z",
  "premium_pct": 8.5,
  "premium_min": 1,
  "tax_rate": 0.0825,
  "tax_basis": "assumption",
  "quantity": 8,
  "fee_rate": 0.136,
  "fee_fixed": 0.4,
  "fee_basis": "stated",
  "shipping": 25,
  "shipping_basis": "assumption",
  "comps": [
    {
      "marketplace": "eBay",
      "type": "sold",
      "price": 40,
      "title": "5 Zebra TC700K-02B24B0-US, parts only, no batteries",
      "url": "https://www.ebay.com/itm/128064350319",
      "sold_on": "Oct 19, 2026",
      "lot_size": 5,
      "lot_price": 200,
      "battery": "none"
    }
  ]
}
```

What matters most:

- **`closes_at`** in ISO time. A lot past it drops off the Market once PR 32 is merged.
- **`pickup_address`**, a street address. Without it the lot gets no drive time and cannot be a Buy. A city alone is not routed.
- **`comps`** with `"type": "sold"` and a `url`. A sold comp with no link can't set the resale price. An asking price is `"type": "asking"` and is never counted as resale.
- **Rates.** `premium_pct` is a percent (`8.5`). `tax_rate` and `fee_rate` are fractions (`0.0825`, `0.136`). A `tax_rate` or `fee_rate` of 1 or more is refused with a `400` such as `lot 0 (gd-1988-19): tax_rate 8.25 reads as 825%. Send rates as fractions, like 0.0825 for 8.25%.` The dry run catches it first.
- Lots that share comps can name a set once: `"comp_sets": { "s20": [ ... ] }` and `"comp_set": "s20"` on each lot.

```bash
curl -s -X POST "$GARAGESALE_BASE_URL/api/surplus?dry_run=1" \
  -H "x-worker-key: $GST_WORKER_KEY" -H "content-type: application/json" \
  --data @surplus.json
```

Answer: the scored scan, the same shape as `GET /api/surplus`. `400 {"error": ...}` names what is wrong.

### `POST /api/deals`

Replaces the stored local listings. Body: `{ "area": "New Braunfels, TX", "deals": [ ... ] }`.

One listing. Only `source` and `url` are needed; a listing without both is dropped. Send `title` and `ask` too, or its profit is unknown.

```json
{
  "source": "fb",
  "url": "https://www.facebook.com/marketplace/item/123/",
  "title": "Canon EOS R body",
  "ask": 40,
  "category": "cameras",
  "condition": "Used",
  "model": "EOS R",
  "area": "New Braunfels",
  "distance_mi": 8,
  "distance_from": "New Braunfels",
  "lat": 29.70,
  "lng": -98.12,
  "photo_url": "https://...",
  "risk_note": "Seller says the shutter count is unknown.",
  "comps": [
    { "url": "https://www.ebay.com/itm/...", "price": 220, "shipping": 10, "sold": true, "title": "Canon EOS R body", "condition": "Used", "model": "EOS R", "sold_at": "2026-10-01" }
  ]
}
```

- `source` is one of `fb`, `craigslist`, `ebay`, `offerup`.
- **`lat` and `lng`** give the listing its drive time. Without them it cannot be a Buy.
- A comp counts as resale only with `"sold": true` and a `url`.

```bash
curl -s -X POST "$GARAGESALE_BASE_URL/api/deals?dry_run=1" \
  -H "x-worker-key: $GST_WORKER_KEY" -H "content-type: application/json" \
  --data @deals.json
```

### `POST /api/drive/refresh`

Looks up round-trip drive times from New Braunfels for every stored pickup address and listing that has none. Up to 20 a call, 300 a day across all callers. No body.

```bash
curl -s -X POST -H "x-worker-key: $GST_WORKER_KEY" "$GARAGESALE_BASE_URL/api/drive/refresh"
```

Answer: `{ "places": 12, "known": 10, "unknown": 2, "note": "..." }`. A place that can't be routed is tried again after a day. `503` means the routing key is not set on the site; tell Adam.

### `PUT /api/scout/config`

Stores where the scout looks: `sites`, `areas`, `fees`, `run_hours`. Adam's rule numbers come from `web/config/rules.js` and can't be changed here. A rule field in the body is listed under `ignored`.

```bash
curl -s -X PUT "$GARAGESALE_BASE_URL/api/scout/config?dry_run=1" \
  -H "x-worker-key: $GST_WORKER_KEY" -H "content-type: application/json" \
  --data '{"sites":["fb","craigslist","ebay","offerup"]}'
```

## Public reads (no key)

- `GET /api/feed`: the Market feed, scored, best first. Once PR 32 is merged, closed lots and listings feeds over 7 days old are hidden and counted under `hidden`.
- `GET /api/surplus`: the stored surplus scan, scored.
- `GET /api/deals`: the stored listings as posted.
- `GET /api/scout/config`: the rules and where the scout looks.
- `GET /api/bankroll`: the current bankroll and max buy. The only ledger number that is public.
