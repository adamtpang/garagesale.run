# Transfer market spec

Written Nov 19, 2026 by Claude Code from Adam's brief. **Draft until Adam approves this PR.** Nothing below changes a rule value.

## The brief

Turn garagesale.run into an app that works like a game's transfer market, but for flipping. Adam should see the deals and the profit at a glance, the way a player scans a market for underpriced cards. The look stays original: no game names, logos, fonts, card art, colors or words borrowed from any game.

## What we borrow, and what we don't

We borrow the **ideas**, which are common to trading games and to real markets:

- A market you scan by filter, with the margin on every tile.
- A watch list of items you're tracking.
- A list of what you're selling and how long it has sat.
- A coin balance that is always on screen.
- A sell tax that every margin is worked out after.

We don't borrow names, art or layout details. Words used in the app:

| Idea | Our word |
| --- | --- |
| The market | **Market** |
| Watch list | **Targets** |
| Things you're selling | **Selling** |
| Coin balance | **Bankroll** |
| Sell tax | **Fees** |
| Bid or buy now | **Max bid** (the app never bids) |

## The look

Garage Sale keeps one design language (`docs/design-language.md`): the dark page from before the Price Tag reskin. The transfer market is a new layout inside that look, not a second one. Rules 8 to 10 (verdict first, no box in a box, profit as a sentence) still apply. The Price Tag rules (white page, red marker, hard shadows) do not.

New rule for this spec:

11. **The tile is the unit.** The Market is a grid of same-size tiles. A tile shows only what decides the deal. Everything else is one tap away on the item page.

## Who uses it

- **Adam** scans the Market on his phone, opens a tile, and decides. He bids, buys and messages himself, off the site.
- **Flipping** (the Grok bot) posts lots and listings through the worker API every day and runs the drive refresh.
- **The app** never bids, buys, offers, messages or posts.

## Remaining problems, high priority first

These come first, before any new screen. Each is one small PR.

| # | Problem | What I found (Nov 19) | Fix | Done when |
| --- | --- | --- | --- | --- |
| 1 | Stale and closed lots still showing | 10 Schertz lots closed Nov 17 and still showed. The listings feed is from Oct 24. | PR 32: closed lots and listings feeds over 7 days old are hidden and counted. | No tile shows a lot past its close time. The page says how many were hidden. |
| 2 | Wrong home page and nav | `/` is the old marketing page. Its example tiles show made-up asks and resale prices. The nav leads with Buy and Sell tools, not deals. | `/` becomes the Market. Nav: Market, Targets, Selling, Bankroll. Buy, Sell, Messages and About move to the footer. The made-up example prices are removed. | Opening garagesale.run shows live tiles or an honest empty state. No price on the page comes from anywhere but the feed. |
| 3 | Unreadable cards | A deal card runs to most of a phone screen. The costs, cases and reasons all sit on the card. | The Market tile (below). The long card moves to the item page. | Six tiles fit on one desktop screen and two on a phone screen without scrolling inside a tile. |
| 4 | Missing drive times | Every drive time is unknown. The routing key is set, but nothing has called the drive refresh, which needs the worker key. 2 of the 13 scan lots have no pickup address, and listings without coordinates can't be routed. | No code change needed for the refresh itself: Flipping calls `POST /api/drive/refresh` after posting. The tile shows "Drive unknown" with the reason (no refresh yet, no address, no coordinates). | After Flipping's first refresh, every lot with an address shows minutes and miles. A lot without one says why. |
| 5 | Zebra pricing mismatch | The board prices the 8 scanners at $40 each, $320 resale, and $233 middle profit. The listing draft (`docs/listings/zebra-tc700k-lot.md`) asks $280 with a $200 floor. The board's profit assumes a price the listing won't ask. | When a listing draft exists, its asking price is the middle case and its floor is the low case. The comp-based number is shown beside it as "comps say". | The board, the tile and the draft show the same middle and low prices for the Zebra lot. A test pins it. |
| 6 | Write API for Flipping | The routes exist and the key works (`/api/worker/check`). Flipping has never posted: surplus is still the Nov 15 file and listings are from Oct 24. There is no dry run, so a first post goes straight to the live site. | One doc, `docs/WORKER-API.md`, with each request shape and a copy-ready `curl`. Add `?dry_run=1` to the write routes: check and score the body, return what would be saved, save nothing. | Flipping can test a post without changing the site, then post for real. The doc has one working example per route. |

## Screens

### Header (every page)

- Brand on the left. **Bankroll** on the right as one number, read from `GET /api/bankroll`, the only ledger number that is public.
- Nav: Market, Targets, Selling, Bankroll.

Done when: the bankroll shows on every page on desktop and phone, and matches `/api/bankroll`.

### Market (`/`)

- **Filter bar**: verdict (Buy, Watch, Skip), category, source (surplus or listing), max price, max drive minutes. Sort: profit (default), closing soonest, drive time.
- **Tile grid**: one tile per deal from `GET /api/feed`.
- **Stale strip**: the feed's stale notes, one line each.
- Empty state says why: nothing posted, everything closed, or nothing passes the filters.

The tile, top to bottom:

1. Photo, or the first letter of the title on a gray well.
2. Verdict stamp: Buy, Watch or Skip.
3. **Profit in marker**: "+$132" or "Profit unknown". Middle case.
4. One line: price or current bid, and the max bid.
5. One line: closes in, and drive minutes round trip.
6. One line: the main reason or risk.

Done when:

- Every number on a tile comes from the feed. An unknown shows as "unknown", never a guess.
- Filters and sort work without a reload, and the chosen filters survive a refresh (stored in the URL).
- A tile is a link to the item page. Keyboard focus is visible.
- No horizontal scroll at 390px.

### Item page (`/item/[id]`)

The long deal card, moved off the Market:

- Verdict, reason and profit sentence first (rule 8).
- Cost stack: price, buyer premium, tax, fees, shipping, gas, your time, all-in.
- Low, middle and high cases, each with its basis.
- Sold comps with links and dates. Asking comps, if any, kept apart and labeled.
- Links: the listing, the sold-comp search.
- Risks, close time, pickup place and drive.
- **Add to Targets** button.

Done when: every field in the feed item appears on the page or is listed as unknown, and the page has a link back to the Market with its filters kept.

### Targets (`/targets`)

- The tiles Adam starred, same tile as the Market.
- A target that closed or left the feed shows as "Gone" with its last known numbers, not silently removed.
- Stored in the browser for now (one viewer: Adam). Moving it into the ledger is a later decision.

Done when: starring a tile on the Market or item page adds it here, unstarring removes it, and it survives a reload.

### Selling (`/selling`)

- Items Adam bought and has listed, read from the ledger (needs the ledger key, like `/ledger`).
- Each row: what it is, paid, list price, days listed, the low case as the floor, and profit if it sold at the list price.
- A row past 14 days listed is flagged "Slow". The 14 days is a display flag, not a rule. Adam sets it.

Done when: a ledger buy with a listing shows here with the right days listed, and nothing on the page is public without the key.

### Bankroll (`/ladder`, already built)

Kept as is. Linked from the header number.

## Build order

One small PR each. Each waits for Bugbot, answers every finding, and attaches desktop and 390px phone screenshots of every changed screen. Adam merges; every merge deploys.

1. **This spec.** Adam approves or edits it.
2. **Closed lots** (PR 32, open).
3. **Home and nav**: `/` shows the current deals page as a stopgap, nav changes, made-up prices removed. Problem 2.
4. **Worker API doc and dry run.** Problem 6. Unblocks Flipping, which unblocks problems 1 and 4 for real.
5. **Zebra price source.** Problem 5.
6. **Market tiles and filters**, replacing the stopgap on `/`. Problem 3.
7. **Item page.**
8. **Header bankroll.**
9. **Drive time reasons on tiles.** Problem 4.
10. **Targets.**
11. **Selling.**

## Rules not changed

These stay exactly as they are in `web/config/rules.js` until Adam says otherwise in chat:

- $20 an hour for drive time.
- Gas at $0.18 a mile.
- Max buy per flip. The code uses the **full** current bankroll, as Adam set on Nov 17. The brief mentions half the bankroll. That change waits for Adam's yes.

Changed since, at Adam's word in chat:

- Pickup radius: 20 miles from New Braunfels, up from 15 (Nov 20, 2026).
- Drive cap: 60 minutes round trip, up from 45 (Nov 20, 2026). The first routed drive times showed Seguin, inside the 20-mile radius, at 54 minutes. Schertz, about 16 miles, was the only nearby surplus seller with open lots, and every one was skipped at 15.

## Hard rules

Never bid, buy, offer, message anyone or post a listing. Never spend money. Never invent prices or comps; say "unknown". Never commit secrets or contact details. PRs only; Adam merges.
