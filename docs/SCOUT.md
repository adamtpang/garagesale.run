# Scout contract

The scheduled scout is a Grok Bot routine. It is not code in this repo. Garage Sale only stores what the routine posts.

The scout reads listings and sold comps. It does not contact sellers, make offers, or post anything.

## Env

The routine and the seed script need:

- `GST_WORKER_KEY`: the worker key. Send it as the `x-worker-key` header, or as `Authorization: Bearer <key>`.
- `GARAGESALE_BASE_URL`: site origin, no trailing path. Example: `https://garagesale.run`.

`GS_LEDGER_KEY` is for the ledger API, not the scout.

## Worker key

The key is a secret. It lives in the Vercel project `grokbothackathon` and in the worker's own secret store. It is never written in this repo, a PR, a log or a chat.

**Test a key without writing anything:**

```bash
curl -s -H "x-worker-key: $GST_WORKER_KEY" "$GARAGESALE_BASE_URL/api/worker/check"
```

- `200 {"ok": true}`: the key is accepted. `POST /api/deals`, `POST /api/surplus` and `PUT /api/scout/config` will accept it too.
- `401` with a `reason`:

| `reason` | What it means | Fix |
| --- | --- | --- |
| `server-has-no-key` | `GST_WORKER_KEY` is not set on the live deployment | Set it in Vercel, then redeploy |
| `no-key-sent` | The request carried no key | Send the header |
| `key-does-not-match` | The key sent is not the one on the live deployment | Use the current key. A key changed in Vercel only applies after a redeploy |

A write endpoint that refuses a key gives the same `reason`.

The check ignores spaces, a trailing newline or wrapping quotes around the stored key. Those get added when a key is pasted or piped, and they used to turn a correct key into a 401.

**Set or rotate the key (Adam does this):**

1. Make a new random key, 32 characters or more. Do not reuse an old one.
2. In the Vercel project, add it as `GST_WORKER_KEY_NEXT` for Production. Redeploy. Now both the old and the new key work.
3. Give the new key to the worker as a secret. Run the check above with it.
4. In Vercel, put the new key in `GST_WORKER_KEY` and delete `GST_WORKER_KEY_NEXT`. Redeploy. Now only the new key works.

If there is no working key at all, skip step 2: set `GST_WORKER_KEY` directly and redeploy.

An environment variable change does nothing until the next deployment. A docs-only merge does not deploy, so use Redeploy in Vercel.

## Config

Adam's rule numbers (max per flip, bankroll, minimum profit, pickup radius, categories, gas rate) live in one file, `web/config/rules.js`, and nothing sent to the API can change them. `GET /api/scout/config` is public and returns those rules plus where the scout looks. `PUT /api/scout/config` requires the `x-worker-key` header (`GST_WORKER_KEY`) and stores only `sites`, `areas`, `fees` and `run_hours`. If the body carries a rule field that differs from the rules file, the reply lists it under `ignored`.

Stored as versioned Blob JSON under `scout-config/`. With no `BLOB_READ_WRITE_TOKEN`, the app uses `web/.data/scout-config.json`.

With nothing stored, the config is the rules file with its default sites, areas and fees, so deals can be scored right away. The owner's seed is `web/config/scout-config.seed.json`. Loading it is optional now, and only its sites, areas, fees and run hours are stored:

```bash
GST_WORKER_KEY=... GARAGESALE_BASE_URL=https://garagesale.run node scripts/seed-scout-config.mjs
```

### The max buy follows the bankroll

The most one flip can cost is the current bankroll: the starting bankroll, plus sales, minus buys and open approvals in the ledger. `GET /api/bankroll` is public and returns only that number (`bankroll`, `start`, `source`, `max_buy`). `source` is `ledger` when the ledger was read and `start` when it could not be read or has no entries. Buys, sales and profit stay behind the ledger key. `GET /api/scout/config`, `/api/surplus` and `/api/feed` all score against this number.

### Drive time

Every surplus lot and every listing in `/api/feed` carries the round-trip drive from New Braunfels: `location.drive_minutes_round_trip`, `location.drive_miles_round_trip` and `costs.time`.

- **Time cost** is the round-trip minutes at `hourly_rate` ($20 an hour). It comes off every profit number. It is not cash, so it is not part of `all_in` or the max buy.
- **Gas** on a surplus lot uses the routed miles when there are any, and twice the stated miles when there are not.
- **Drive cap.** A round trip over `max_drive_minutes` (45) is a skip.
- **Unknown drive.** With no drive time, the time cost is left out, the item says so, and it cannot be a buy.

The times come from OpenRouteService. They are typical times with no live traffic. The way back is taken to be the same as the way there.

To switch it on, Adam does this once. No agent sees the key.

1. Sign up at openrouteservice.org and create an API key (free plan).
2. In Vercel, project `grokbothackathon`, add the environment variable `ORS_API_KEY` for Production.
3. Redeploy.

Until that is done every drive time is unknown.

**Who can spend the key.** Only calls that carry the worker key look up a drive time: `POST /api/surplus`, `POST /api/deals`, and `POST /api/drive/refresh`. The public pages and `GET /api/feed` and `GET /api/surplus` read the cache and never call the routing service, so a visitor cannot use up the quota. A place that is not in the cache yet shows an unknown drive.

**The bot's daily step.** After posting, call `POST /api/drive/refresh` with the `x-worker-key` header. It looks up every pickup address and listing that has no drive time yet, up to 20 a call, and answers with `{ places, known, unknown }`. Call it again while `unknown` is above zero. This is also how the Nov 15 scan file gets its drive times, since it was never posted.

Each place is looked up once and kept under `drive-cache/` in Blob storage. One call makes at most 8 new lookups (20 for the refresh), and all callers together make at most 300 a day. A lot is found by its pickup address. A lot with only a city has no drive time, because the middle of a city is not the pickup point. A batch of lookups stops starting new ones after 12 seconds and saves what it found. A listing is found by its `lat` and `lng`, so a listing with no coordinates has no drive time. The bot may also post its own `drive: { minutes_round_trip, miles_round_trip }` on a lot, and that is used as posted.

Not yet tested against the live service: the code follows the official client's request format, but no real key was available to try it.

| Field | Seed | Role |
| --- | --- | --- |
| `bankroll` | 100 | Starting bankroll. The API returns the current bankroll here |
| `max_per_flip` | the current bankroll | Skip asks above this. There is no fixed cap |
| `min_profit` | 100 | Minimum profit after fee, shipping, gas and drive time |
| `hourly_rate` | 20 | Dollars an hour of driving costs. Set by Adam on Nov 17, 2026 |
| `max_drive_minutes` | 45 | Longest round-trip drive for one deal. Set by Adam on Nov 17, 2026 |
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

## POST /api/surplus

Replaces the surplus board's feed with one scan. `GET /api/surplus` is public and returns the same lots with the math and the rule checks filled in.

```http
POST /api/surplus
x-worker-key: <GST_WORKER_KEY>
content-type: application/json
```

```json
{
  "scanned_on": "2026-11-16",
  "label": "Nov 16, 2026 scan. Public Surplus and GovDeals.",
  "notice": "Numbers that were not in the scan are null and show as unknown.",
  "comp_sets": {
    "sm-g781v-128gb": [
      { "type": "sold", "marketplace": "eBay", "price": 69.99, "title": "Galaxy S20 FE 5G SM-G781V 128GB, for parts", "url": "https://www.ebay.com/itm/840100700591", "condition": "parts", "sold_on": "Nov 14, 2026" }
    ]
  },
  "lots": [
    {
      "id": "ps-4123518",
      "auction_id": "4123518",
      "source_site": "Public Surplus",
      "title": "8 Zebra TC700K-02B24B0-US handhelds",
      "seller": "City of Schertz",
      "city": "Schertz, TX",
      "url": "https://www.publicsurplus.com/sms/all,tx/auction/view?auc=4123518",
      "photo_url": "https://example.com/photo.jpg",
      "miles_from_home": 16,
      "miles_approximate": true,
      "current_bid": 10,
      "bid_count": 1,
      "closes_at": "2026-11-18T02:00:00.000Z",
      "premium_pct": 8.5,
      "premium_min": 1,
      "tax_basis": "assumption",
      "tax_rate": 0.0825,
      "pickup_address": "1400 Schertz Pkwy Bldg 9, Schertz, TX",
      "quantity": 8,
      "batteries": "none",
      "fleet_device": true,
      "marketplaces": ["eBay"],
      "fee_basis": "stated",
      "fee_rate": 0.136,
      "fee_fixed": 0.4,
      "shipping_basis": "assumption",
      "shipping": 25,
      "status": "watch",
      "risks": ["No batteries."],
      "comps": [
        { "type": "sold", "marketplace": "eBay", "price": 40, "title": "5 Zebra TC700K, parts only, no batteries", "url": "https://www.ebay.com/itm/128064350319", "lot_size": 5, "lot_price": 200, "battery": "none", "sold_on": "Oct 19, 2026" }
      ]
    }
  ]
}
```

Rules for the body:

- `lots` is required, 100 at most. Each lot needs an `id` of letters, digits and hyphens. Ids must be unique.
- **Leave out what you do not know.** A missing number shows as "unknown." Never send 0 for an unknown cost, and never send a guess as a fact.
- `current_bid` is a real bid. If nobody has bid, leave it out and send `opening_bid`.
- `miles_from_home` is measured from New Braunfels. Send `miles_approximate: false` only for a measured distance.
- `*_basis` fields say where a number came from: `stated` (on the page), `assumption` (a labeled guess) or leave it out for unknown. Profit is only "confirmed" when every input is `stated`.
- `premium_pct` is a percent (8.5). `tax_rate` and `fee_rate` are fractions (0.0825). A `tax_rate` or `fee_rate` of 1 or more reads as a percent, and the whole post is refused with a `400` that names the lot.
- A comp is `type: "sold"` or `"asking"`. Asking comps are shown but never used for resale. **A sold comp must carry its `url`.** One sold comp without a URL blocks resale for the whole lot.
- `price` on a comp is always per unit. For a lot sale also send `lot_size` and `lot_price`.
- `battery` on a comp is `none`, `included` or left out. `condition` is `working`, `parts` or left out. `sold_on` is the sale date as text.
- `batteries` on a lot is `none`, `included` or left out. `condition` on a lot is `working`, `parts` or left out. `fleet_device: true` flags a likely lock.
- Lots that share comps can name a set with `comp_set` instead of repeating the rows. A lot keeps 80 comps at most, and the reply says how many were left out.
- `status` is `watch`, `needs preview`, `buy candidate (needs Adam yes)` or `skip`. It is only a starting point. Adam's rules are applied on top, and a lot that breaks one becomes `skip` with the reason. A `buy candidate` mark does not stick unless profit is confirmed and every rule passes.
- Nothing in the body can place a bid, and `places_bids` is always false in the reply.

The reply is the stored scan as the board shows it: each lot with `all_in`, `cases`, `max_bid`, `rule_checks`, `status` and `status_reason`.

- `400` with an `error` message when the body is not usable.
- `401` with a `reason` when the key is refused.

## GET /api/feed

The daily deals feed. Public and read-only. It takes the stored surplus scan and the stored listings, scores them again against today's rules, and returns them in one shape, best first.

```bash
curl -s "$GARAGESALE_BASE_URL/api/feed"
```

Top level:

| Field | What it is |
| --- | --- |
| `rules` | The rules in force: max cost, minimum profit, pickup radius, gas rate |
| `sources` | When each side was last posted, and how many days old it is |
| `stale` | Plain sentences when the data is old or was never posted. Empty when it is fresh |
| `counts` | How many items are `buy`, `watch` and `skip` |
| `items` | The deals. Buys first, then watches, then skips. Inside each group, best profit first and unknown profit last |

Each item:

| Field | What it is |
| --- | --- |
| `kind` | `surplus` (an auction lot) or `listing` (a local listing) |
| `source` | `site` and `url` of the lot or listing |
| `location` | `place`, `miles` from New Braunfels, and whether the miles are approximate |
| `price` | `current` bid or ask, `opening` bid, `bid_count`, `closes_at` |
| `costs` | `premium`, `tax`, `gas`, `fee`, `shipping`, and the `all_in` cost, each with where it came from |
| `resale` | `low`, `middle` and `high`, how each was worked out, and any caveats |
| `comps` | Every comp with its `url`, `price` and `sold_on` date. Asking comps are labeled and have no sale date |
| `profit` | `low`, `middle` and `high` at the current price, `confirmed` when every input is stated, and `at_max_bid` for a lot |
| `roi` | Profit divided by the all-in cost, and whether it is confirmed |
| `max_bid` | The highest bid or offer that still fits the rules, in whole dollars, or null |
| `risks` | What could go wrong |
| `decision` | `buy`, `watch` or `skip`, with the reasons. `needs_adam_yes` is always true |
| `unknown` | The names of every value above that is null |

- A value that is not known is `null`. It is never 0 and never a guess.
- `buy` means the math and the rules pass. It is not a go-ahead. Every bid, purchase, offer and message needs Adam's yes on that item.
- The feed is as fresh as the last `POST /api/surplus` and `POST /api/deals`. Read `stale` before trusting it.
