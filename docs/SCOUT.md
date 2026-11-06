# Scout contract

The scheduled scout is a Grok Bot routine. It is not code in this repo. Garage Sale only stores what the routine posts.

The scout reads listings and sold comps. It does not contact sellers, make offers, or post anything.

## Env

The routine and the seed script need:

- `GST_WORKER_KEY` — sent as the `x-worker-key` header. Same check as `workerOk` in `web/lib/store.js`.
- `GARAGESALE_BASE_URL` — site origin, no trailing path. Example: `https://garagesale.run`.

`GS_LEDGER_KEY` is for the ledger API, not the scout.

## Config

`GET /api/scout/config` is public. `PUT /api/scout/config` replaces the config and requires `x-worker-key`.

Stored as versioned Blob JSON under `scout-config/`. With no `BLOB_READ_WRITE_TOKEN`, the app uses `web/.data/scout-config.json`.

Every field defaults to null. The owner's seed is `web/config/scout-config.seed.json`. Load it with:

```bash
GST_WORKER_KEY=... GARAGESALE_BASE_URL=https://garagesale.run node scripts/seed-scout-config.mjs
```

| Field | Seed | Role |
| --- | --- | --- |
| `max_per_flip` | 100 | Skip asks above this |
| `bankroll` | 100 | Cash the routine should stay inside |
| `min_profit` | 100 | Minimum profit after fee, shipping, and gas |
| `max_pickup_miles` | 15 | One-way miles |
| `categories` | electronics, game consoles, tools, furniture, bikes, cameras | What to search |
| `sites` | `fb`, `craigslist`, `ebay`, `offerup` | Allowed sources |
| `run_hours` | `daily daytime` | When the routine runs |
| `areas` | New Braunfels, San Marcos, Austin, each with `lat` and `lng` | Where a run may search. Pickup is still 15 miles from New Braunfels only. Austin and San Marcos are not home origins |
| `gas_per_mile` | 0.18 | Round-trip gas uses `2 * distance_mi * gas_per_mile` |
| `gas_per_mile_note` | `estimate: ~20 MPG, $3.50/gal premium` | Estimate flag. Change the rate when the guess changes |
| `fees` | fb 0, craigslist 0, offerup local 0, ebay 0.1325 plus shipping | Each fee is `confirmed: false` until checked |

Fee rates are defaults to be confirmed, not measured take-rates. OfferUp local pickup is 0%. eBay is 13.25% of the resale price, and shipping is subtracted on its own.

If `min_profit`, `max_pickup_miles`, `sites`, or a fee rate for one of those sites is null, deals are stored and left unranked. The deals page and Top flips say `Filters not set`.

If `gas_per_mile` is null, gas stays null and the net stays null. It is not treated as 0. The seed sets 0.18.

## POST /api/deals

```http
POST /api/deals
x-worker-key: <GST_WORKER_KEY>
content-type: application/json
```

```json
{
  "area": "Austin",
  "deals": [
    {
      "source": "fb",
      "url": "https://www.facebook.com/marketplace/item/123/",
      "title": "Mirrorless camera body",
      "photo_url": "https://example.com/photo.jpg",
      "ask": 80,
      "distance_mi": 12,
      "distance_from": "New Braunfels",
      "area": "New Braunfels",
      "category": "cameras",
      "condition": "Used",
      "model": "Example body",
      "risk_note": "Shutter count unknown",
      "comps": [
        {
          "url": "https://www.ebay.com/itm/1234567890",
          "title": "Same camera body",
          "price": 220,
          "shipping": 12,
          "sold": true,
          "condition": "Used",
          "model": "Example body",
          "sold_at": "2026-10-01"
        }
      ]
    }
  ]
}
```

`source` is `fb`, `craigslist`, `ebay`, or `offerup`. `title` is optional display text. Anything else on the deal, including a seller name or a client-supplied profit, is dropped.

The server computes:

```text
net = resale - ask - fee(resale venue) - shipping - 2 * miles_from_new_braunfels * gas_per_mile
```

`fee` is `rate * resale` for the venue the sold comps came from, plus any flat amount. Shipping is the median shipping on the comps that have it. If any priced comp used in the estimate has no shipping, shipping is null and the net is null. Unknown shipping is not stored as 0.

Miles come from listing coordinates measured against New Braunfels, or from `distance_mi` when `distance_from` is New Braunfels. A listing area of Austin or San Marcos is not a home pickup. Deals that pass every buy rule are ranked by net, high first. An unconfirmed fee rate does not rank as a buy.

## Comp rules

A comp is kept only when it is explicitly marked sold (`sold: true` or `status: "sold"`) and it has a URL.

An eBay item URL, `/itm/<id>`, is not sold evidence by itself. The dashboard also ignores a stored `sold: true` that has no `sold_evidence: "marked"` from this check, so an older inferred flag is not reused.

These are dropped even if someone marks them sold:

- search URLs (`/sch/`, `/search`)
- price guides (Swappa)
- retail (Amazon, Walmart, Best Buy, Target, Newegg)
- Craigslist
- active listings (`sold: false`, `status: "active"`)

With no comps left, `resale` is null, the net is null, and the deal is not a buy. The UI shows resale as `unknown`.

One or two priced comps still set a provisional resale (their median) and stay off the buy list. Three or more use the sold-comp estimate in `web/lib/pricing.js`, which drops outliers and will not invent a price when the remaining set is too thin.
