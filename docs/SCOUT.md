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
| `areas` | New Braunfels, San Marcos, Austin, each with `lat` and `lng` | Where to search |
| `gas_per_mile` | 0.18 | Round-trip gas uses `2 * distance_mi * gas_per_mile` |
| `gas_per_mile_note` | `estimate: ~20 MPG, $3.50/gal premium` | Estimate flag. Change the rate when the guess changes |
| `fees` | fb 0, craigslist 0, offerup local 0, ebay 0.1325 plus shipping | Each fee is `confirmed: false` until checked |

Fee rates are defaults to be confirmed, not measured take-rates. OfferUp local pickup is 0%. eBay is 13.25% of the resale price, and shipping is subtracted on its own.

If `min_profit`, `max_pickup_miles`, `sites`, or a fee rate for one of those sites is null, deals are stored and left unranked. The deals page and Top flips say `Filters not set`.

If `gas_per_mile` is null, gas is treated as 0 and the deal is flagged `gas not included`. Ranking still runs. The seed sets 0.18, so that flag stays off until the rate is cleared.

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
      "area": "San Marcos",
      "risk_note": "Shutter count unknown",
      "comps": [
        {
          "url": "https://www.ebay.com/itm/1234567890",
          "title": "Same camera body",
          "price": 220,
          "shipping": 12
        }
      ]
    }
  ]
}
```

`source` is `fb`, `craigslist`, `ebay`, or `offerup`. `title` is optional display text. Anything else on the deal, including a seller name or a client-supplied profit, is dropped.

The server computes:

```text
profit = resale - ask - fee(platform) - shipping - 2 * distance_mi * gas_per_mile
```

`fee(platform)` is `rate * resale`. Shipping is the median shipping on the comps that have it, otherwise 0. Deals that pass the filters are ranked by profit, high first.

## Comp rules

A comp is kept only when:

- the URL is an eBay item, `/itm/<id>`, and it is not marked active or unsold, or
- it is explicitly marked sold (`sold: true` or `status: "sold"`) and has a URL

These are dropped even if someone marks them sold:

- search URLs (`/sch/`, `/search`)
- price guides (Swappa)
- retail (Amazon, Walmart, Best Buy, Target, Newegg)
- Craigslist
- active listings (`sold: false`, `status: "active"`)

With no comps left, `resale` is null, profit is null, and the deal is unranked. The UI shows resale as `unknown`.

One or two priced comps still set a resale (their median). Three or more use the sold-comp estimate in `web/lib/pricing.js`, which drops outliers and will not invent a price when the remaining set is too thin.
