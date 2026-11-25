# Resell spec

Written Nov 25, 2026. Docs only. This file does not change a rule, a route, or a screen.

Read against `main` at `a1fee88acac9d534d7bc945cc14c5ee9c31415a5`. [PR #53](https://github.com/adamtpang/garagesale.run/pull/53) (`cursor/restore-pre-reskin-design-0fff`) was open when this was written. It restores the pre-reskin dark design. This spec does not branch from it, does not restyle anything, and does not wait on it to be true. If that PR merges, class names and colors can change. Routes, rule numbers, and the hard rules below stay the ones in this file.

## Where the idea comes from

Adam's brief describes Resell Pal as a solo founder's photo-to-resale-price app that makes about $8K a month. That revenue figure is from the brief. It is not verified here, and it is not a Garage Sale number.

Garage Sale already prices flips from sold comps, fees, and gas. This spec is the pocket version of that: one photo, a price, a buy check, a draft, and a lot scan. Items 1 to 4 are the build. Items 5 to 8 wait. Item 9 is a growth note, not code.

## Hard rules

These apply to every item below.

1. Never invent a price or a comp. No sold comps with source links means the price line is the word `unknown`. A missing fee, a missing shipping cost, or a missing gas rate stays unknown. It is never stored or shown as zero.
2. Drafts only. A scan can write a title, a price, and photos into a draft. Nothing in this spec publishes a listing, sends a seller message, places a bid, makes an offer, or buys anything.
3. No buy, bid, offer, or seller message without Adam's explicit yes on that item. A yes on one item does not cover the next item. The app still does not send the message or place the bid. Adam does that himself, off the site, the way `docs/HANDOFF.md` already says.
4. Do not spend money. No live charge in this phase. Stripe through Anchor Marianas is later, and it is not in this repo today.
5. Do not commit secrets, keys, or `.env` files.

`docs/TRANSFER-MARKET-SPEC.md` ends on the same kind of rule: the app never bids, buys, offers, messages, or posts.

## Figures in this spec

Every number below is tagged. If a figure is not in this list, it is not a requirement.

| Figure | What it is | Source |
| --- | --- | --- |
| About $8K a month | Resell Pal revenue, as told in the brief | Adam's brief. Not verified. Not a Garage Sale figure. |
| About $45 a year | What the brief says Resell Pal charges | Adam's brief. Not verified. Not the price this app will charge. |
| About 30% monthly churn | Planning assumption for retention math | Adam's brief. Not a measured Garage Sale rate. |
| 1 free scan, then a paywall | Product rule for item 5 | Adam's brief. |
| Review ask after 5 good scans | Product rule for item 6 | Adam's brief. |
| Free month for 3 referrals | Product rule for item 6 | Adam's brief. |
| Under 10 seconds | Target from shutter or file chosen to a result on screen | Adam's brief. Not a measured time. |
| Rule numbers in the next section | Flip rules already in the app | `web/config/rules.js` |

This app's own monthly price and annual price are not in the brief, except that the monthly price is the high anchor, the annual plan is the default pick, and there is no lifetime plan. Dollar amounts for our plans are an open question. Do not invent them.

## Rules this spec does not change

They live in `web/config/rules.js`. `web/lib/rules.js` applies them. `GET /api/scout/config` returns them. Nothing in an API body can overwrite them (`docs/SCOUT.md`).

| Rule | Value in `web/config/rules.js` | Note in that file |
| --- | --- | --- |
| Home | New Braunfels, TX | Pickup is measured from here. Austin and San Marcos are search areas. |
| Starting bankroll | 100 | Max buy is the current bankroll (this number, plus sales, minus buys and open approvals). `max_per_flip` is null. |
| Minimum profit | 100 | After fees, gas, and drive time, per the file comment. |
| Hourly rate | 20 | Drive time. Work time uses the same rate. |
| Work per unit | 30 minutes | Test, photograph, list, and pack. Comes off profit, not off the bankroll. |
| Drive cap | 60 minutes round trip | |
| Pickup radius | 20 miles | |
| Gas | 0.18 per mile | `gas_per_mile_confirmed` is false. The file says: "Estimate: about 20 MPG at $3.50 a gallon. Adam has not confirmed it." |
| Tax assumption | 0.0825 | Used only when a seller says tax is added and gives no rate. |
| Facebook fee | rate 0, flat null | `confirmed: false`. Note: local pickup, default, to be confirmed. |
| Craigslist fee | rate 0, flat null | `confirmed: false`. |
| OfferUp fee | rate 0, flat null | `confirmed: false`. Local pickup. |
| eBay fee | rate 0.136, flat 0.40, plus shipping | `confirmed: false`. Note: eBay selling fees page, most categories, 13.6% plus $0.40 per order, read Nov 15, 2026. |
| Lot return | off | Proposed `min_roi` 3. `optional.lot_roi.enabled` is false. |
| Surplus radius | off | Proposed 60 miles. `optional.surplus_radius.enabled` is false. |

`docs/SCOUT.md` still has a fee table that says eBay is 0.1325. The rules file says 0.136. This spec uses the rules file.

Two profit formulas already exist. Use the one that matches the object.

- One listing with an ask: `assessDeal` in `web/lib/decision.js`. Net is resale minus ask minus fee minus shipping minus gas. Gas is `2 * miles * gas_per_mile` when the miles from New Braunfels are known. Net stays null until resale, ask, fee, shipping, and gas are all known. Drive-time dollars are not inside this net.
- A surplus lot: `assessLot` in `web/lib/surplus.js`. Haul is round-trip miles times `gas_per_mile` (routed miles when known, otherwise twice the stated miles). Drive time at the hourly rate, and work at 30 minutes a unit, come off profit. They are not part of all-in cash. Max bid is the highest whole-dollar bid where all-in stays inside the max cost, the middle case still makes the minimum profit, and the low case does not lose money. Missing inputs leave max bid unknown, or `none` when the code has already shown that even a $1 bid fails.

Sold comps: a comp counts only when it is marked sold and has a URL (`docs/SCOUT.md`, `web/lib/decision.js`). An eBay `/itm` link is not sold evidence by itself. Search URLs, price guides, and retail pages (Amazon, Walmart, Best Buy, Target, Newegg) are dropped. With no comps left, resale is null and the UI says unknown. One or two priced comps set a thin median in `resaleFrom` and stay off the buy list. Three or more go through `estimate` in `web/lib/pricing.js`, which returns null when fewer than three prices remain after the outlier cut.

Sell speed, when the scout posted it, is `fast`, `medium`, `slow`, or `unknown` (`web/lib/tiers.js`). There is no days-to-sell number in the app. This spec does not add one.

## What is already on main

| Surface | Path | What it does today |
| --- | --- | --- |
| Market home | `web/app/page.js`, `web/app/MarketHome.js` | `/` is the deals feed (`web/app/dashboard/DealFeedScreen.js`) plus Adam's own sell jobs. |
| Old dashboard URL | `web/app/dashboard/page.js` | Redirects to `/`. |
| Deals board | `web/app/deals/page.js`, `web/components/DealBoard.js` | Stored scout feed, rule strip, sample layout. |
| One deal | `web/app/deal/[src]/[idx]/page.js` | Loads a feed row or a job row and runs `assessDeal`. |
| Item page | `web/app/item/page.js`, `web/app/item/ItemScreen.js` | Query `?id=`. Shows sell speed when the feed item has it. |
| Surplus board | `web/app/surplus/page.js`, `web/app/surplus/screen.js`, `web/components/SurplusBoard.js` | `GET /api/surplus`. Verdict, max bid, cases, rule checks. |
| Buy search | `web/app/buy/page.js`, `web/components/BuySearch.js` | Typed query. Not a photo. |
| Sell upload | `web/app/sell/page.js`, `web/components/SellHome.js` | Drop, attach, or `capture="environment"`. `POST /api/jobs`. Up to 30 photos become a batch. |
| Job | `web/app/job/[id]/page.js` | Listing draft, comps, and an "Approve & post" button. |
| Approve | `web/app/api/jobs/[id]/approve/route.js` | Sets the job to `approved` and queues a post. |
| Batch | `web/app/batch/[id]/page.js` | One row per photo in a multi-photo sell. |
| Targets | `web/app/targets/page.js`, `web/app/targets/TargetsScreen.js` | Starred tiles. |
| Selling | `web/app/selling/page.js`, `web/lib/selling.js` | Ledger rows. Slow flag at 14 days, a display flag, not a flip rule. |
| Bankroll pill | `web/components/BankrollPill.js` | `GET /api/bankroll`. Links to `/ladder`. |
| Ladder | `web/app/ladder/page.js`, `web/components/Ladder.js`, `web/lib/ladder.js` | Buys and sales in order. Ledger key in `sessionStorage` (`gs_ledger_key`). |
| Ledger | `web/app/ledger/page.js`, `web/lib/ledger.js` | AES-256-GCM. Routes: `/api/ledger`, `/api/ledger/[id]`, `/api/ledger/decisions/[id]`. |
| Nav | `web/app/layout.js` | Market, Targets, Selling, Bankroll. Footer: Surplus, Ledger, Buy, Sell, Messages, About. |
| Messages | `web/app/conversations/page.js`, `web/components/NavMsgs.js` | Buyer replies. Sending a reply is an approve call. Out of this spec. |
| About | `web/app/about/page.js` | Says the site was built in 2.5 hours with Grok Bot at the Grok Bot Hackathon. |
| Scout write | `POST /api/deals`, `POST /api/surplus`, `POST /api/drive/refresh` | Worker key. Described in `docs/SCOUT.md` and `docs/WORKER-API.md`. |
| Photos | `web/components/Photo.js`, `web/app/api/img/route.js` | Image display and proxy. |
| Saved deals | `web/components/SavedDeals.js`, `web/app/api/saved/route.js` | Saved scout rows. Not a scan history. |
| PWA, paywall, Stripe, share card | none | No web manifest, no service worker, no Stripe, no review prompt, no referral. |

The Lot Packs addendum is [Addendum: Lot Packs (the bronze pack method)](TRANSFER-MARKET-SPEC.md#addendum-lot-packs-the-bronze-pack-method). It was not on `main` before this change. Item 4 follows that section. This spec does not invent a pack price, pack odds, or a bankroll-gate share.

## Build order

1. One photo, one price.
2. Buy-side profit check.
3. Draft a listing from a scan.
4. Lot and pallet scan, with the Guadalupe County laptop lot as the first test case.

Ship 1 to 4 before any of the rest. Each of those four can be its own PR. Adam merges. This document does not merge or deploy anything.

Then, after 1 to 4 are in:

5. Paywall and pricing. No live charge in that PR either, until Adam asks for payments.
6. Retention.
7. Shareable result card.
8. Installable PWA.

9. Growth appendix. Not a code PR.

## 1. One photo, one price

### User story

Adam opens the site and the first thing on screen is snap or upload. He takes one photo, or chooses one file. In under 10 seconds (the target in the brief, not a measured time) he sees an estimated resale price, the best place to sell, the typical time to sell, and the sold comps that number came from, each with a source link. If there are no sold comps, the price is `unknown`.

### Acceptance criteria

- `/` shows snap and upload before any deal list. The control can be the file input already in `web/components/SellHome.js` (`accept="image/*"` and `capture="environment"`). This screen sends one image. It does not use the 30-photo batch path.
- The result shows four lines: resale, best place to sell, time to sell, and the comps.
- Resale comes from sold comps with URLs, through `resaleFrom` / `estimate`. Zero sold comps: the line is the word `unknown` and no other number is shown as the price.
- One or two comps: show the thin median the code already computes, name it thin, and list the links. It is not a buy. Three or more: show the `estimate` value, or `unknown` when `estimate` returns null.
- Each comp row is a link to its source URL. A row with no URL is not shown as evidence.
- Best place to sell is a table over the four venues in `web/config/rules.js` (`fb`, `craigslist`, `ebay`, `offerup`). A venue with no sold comps from that venue is `unknown`. Fee math is `feeAmount` in `web/lib/decision.js`. Every fee in the rules file is `confirmed: false`, so the "best place" line stays `unknown` until a fee is confirmed. The table can still show a calculated net with the words "unconfirmed fee".
- Time to sell uses `sell_speed` from `web/lib/tiers.js` when a scout record has it: `fast`, `medium`, `slow`, plus the evidence string if there is one. Otherwise the line is `unknown`. Do not convert that into a day count.
- The result is on screen within 10 seconds of the shutter or the file choice. If comps are not back by then, the price line is `unknown`. The screen does not wait and then fill in a guess.
- The result is not a sell job. It does not call `POST /api/jobs/[id]/approve`. It does not enter `posting` or `live`.
- Asking comps, retail pages, and search pages stay out of the price, matching `docs/SCOUT.md`.

### Existing pieces

- Home today: `web/app/page.js`, `web/app/MarketHome.js`. The Market has to move off `/` and stay one tap away. The nav link in `web/app/layout.js` that says Market currently points at `/`.
- Photo capture today: `web/app/sell/page.js`, `web/components/SellHome.js`. That page posts to `POST /api/jobs` and lands on `/job/[id]` or `/batch/[id]`, which is the listing pipeline. Item 1 needs a price result, so it does not reuse that post as-is.
- Comp and price math: `web/lib/decision.js`, `web/lib/pricing.js`, `docs/SCOUT.md`.
- A single deal already rendered with comps: `web/app/deal/[src]/[idx]/page.js`, `web/components/DealFacts.js`.
- Sell speed already rendered when the feed has it: `web/app/item/ItemScreen.js`, `web/lib/tiers.js`.

New: a one-photo price result that is not a listing job. A home screen whose only job is that photo.

### Open questions

- Which path the Market moves to. `/deals` already renders `DealBoard`, which is a different screen from `MarketHome`.
- Whether a thin one-comp or two-comp median is allowed on this consumer screen, or whether anything under three comps should say `unknown`. Current scout code shows the thin median and refuses the buy.
- Which sold-comp source a phone scan is allowed to call. The scout is a worker with `GST_WORKER_KEY`. A visitor scan cannot use that key. No public comp API exists in `web/app/api/`.
- Whether "best place" may name a venue while its fee is still unconfirmed. This spec says no.

## 2. Buy-side profit check

### User story

Adam is in a thrift store, at a garage sale, or looking at a Marketplace listing. He snaps the item, types the asking price, and sees profit after fees and gas. The same rules the deal scout already uses. He does not message the seller from the app.

### Acceptance criteria

- The screen takes one photo and a typed asking price. Empty ask: profit is `unknown`.
- Profit uses `assessDeal`: resale, minus ask, minus fee, minus shipping, minus gas. Gas is `2 * miles from New Braunfels * gas_per_mile` when those miles are known. Unknown miles: gas is `unknown` and profit is `unknown`. Gas is never filled in as zero.
- The gas line shows the rules-file note that $0.18 a mile is an unconfirmed estimate (about 20 MPG at $3.50 a gallon).
- Shipping comes from the comps, the way `resaleFrom` already does. If any priced comp used in the estimate has no shipping, shipping is `unknown` and profit is `unknown`.
- Fee uses the venue of the sold comps. Unconfirmed fee: show the calculated net the way the deals board already does, and do not call it a buy (`fee-unconfirmed` in `assessDeal`).
- Drive time and work time, when known, show as their own lines from `web/config/rules.js` (60 minute cap, $20 an hour, 30 minutes of work a unit). They are not folded into the headline profit number. That headline matches `assessDeal`, which does not subtract them. The surplus formula in `assessLot` stays on lots (item 4).
- No comps: resale `unknown`, profit `unknown`.
- No button that messages a seller, makes an offer, or records a buy. The opener text in `web/lib/pricing.js` (`openers`) is not shown on this screen.
- The typed ask is the only price Adam enters. The screen does not invent an ask from the photo.

### Existing pieces

- Deal scout math: `assessDeal` in `web/lib/decision.js`, rules from `GET /api/scout/config`, board at `web/app/deals/page.js` and `web/components/DealBoard.js`.
- Buy page today: `web/app/buy/page.js`, `web/components/BuySearch.js`, `web/components/ModeFeed.js`. It takes a typed search (`POST /api/buy/search` exists) and is not a photo at a store.
- Deal card copy already says profit is after fees and gas: `web/components/DealFacts.js`, `web/components/DealFeed.js`.
- Miles and drive: `web/lib/drive.js`, `POST /api/drive/refresh` (worker key only). A public page does not call the routing service.

New: a photo-plus-ask screen. A way to know miles from New Braunfels for a spot Adam is standing in, without a worker key. That distance source does not exist yet.

### Open questions

- How miles are entered when there is no listing coordinate: type a city, use the phone's location, or leave gas unknown. This spec requires unknown until miles exist. It does not pick the input.
- Whether the headline should also subtract drive time, matching the minimum-profit comment in `web/config/rules.js` ("after fees, gas and drive time"). Item 2's headline follows `assessDeal` (fees, shipping, gas) because that is the listing function. Drive time stays a separate line.
- Whether a thrift item outside the six categories (electronics, game consoles, tools, furniture, bikes, cameras) is still priced. `assessDeal` marks other categories not allowed. The brief does not limit the pocket scan to those six.

## 3. Draft a listing from a scan

### User story

From a price result or a profit check, one tap builds an eBay draft or a Marketplace draft: title, price, photos. It stays a draft until Adam says yes on that item. Nothing posts by itself.

### Acceptance criteria

- One tap, on a result that has a price, writes a draft with title, price, and the scan photo. Two targets: eBay, or Facebook Marketplace. The tap asks which one.
- If the price line is `unknown`, the tap does not invent a list price. The draft can still hold the title and the photo, and the price field stays empty.
- The draft is stored. It is not sent to eBay or Marketplace.
- The tap does not call `POST /api/jobs/[id]/approve`. That route queues a post today. The job page button "Approve & post" is the old path. This action is not that button.
- A draft has no path to `posting` or `live` in this phase. Adam's yes on that item is recorded on the draft. Publishing stays a later step, and it is not built here.
- A yes is per item. Approving one draft does not approve another photo in a batch (`web/app/batch/[id]/page.js` already treats each photo as its own job).
- Buyer-message approve (`POST /api/jobs/[id]/replies/[inq]/approve`) is unchanged and is not part of this tap.

### Existing pieces

- Upload and the listing panel: `web/components/SellHome.js`, `web/app/job/[id]/page.js` (the `Listing` block: title, price, condition, category, description, photo).
- Stages today include `awaiting_approval`, `approved`, `posting`, `live` (`web/app/job/[id]/page.js`). `approved` currently continues toward a live post.
- Worker queue: `web/app/api/jobs/[id]/approve/route.js` calls `queue(job, 'approved', ...)`.

New: a draft state that stops. A choice of eBay or Marketplace on the draft. eBay draft text is not generated anywhere today. The current listing panel is a Marketplace-shaped preview ("Listed just now in Austin, TX" is hardcoded in that component).

### Open questions

- Where the draft is stored: a job that is forbidden from leaving `awaiting_approval`, or a ledger row. The ledger already has `list_price`, `platform`, and status `on_hand` / `listed` / `sold` (`web/lib/ledger.js`, `web/lib/selling.js`). `listed` today means Adam listed it himself.
- Whether the hardcoded "Austin, TX" line on the job listing preview is replaced with New Braunfels when a draft is shown. The preview is existing copy. This spec does not rewrite it until that screen is touched.
- Who writes the title when identification confidence is low. The job page already asks for a detail when confidence is under 60 (`web/app/job/[id]/page.js`). That threshold is existing UI, not a new rule.

## 4. Lot and pallet scan

### User story

Adam uploads one lot photo, or pastes a GovDeals link. He gets a per-item breakdown, a max bid, and the risk. The first test case is the Guadalupe County laptop lot, GovDeals 1988-19.

The scan follows the [Lot Packs addendum](TRANSFER-MARKET-SPEC.md#addendum-lot-packs-the-bronze-pack-method): a Lot Pack card, pull odds, labor and space, a bankroll gate, and pack results after a buy. This item does not create a pack, price a pack, or sell a pack. The bankroll-gate share in that addendum stays unset until Adam decides.

### Acceptance criteria

- Two inputs: one lot photo, or a pasted `govdeals.com` URL. Anything else is refused with a plain message.
- Output: one row per item the source actually names, plus lot-level max bid and risk. Each row is labeled `known`, `guessed`, or `unknown`, as the addendum requires. `known` means a sold comp with a source link set the price.
- The low case uses only sold-comp-priced items. Unpriced or unverified items count as $0 in that case, which is the addendum's rule, not a resale estimate. They do not receive a guessed dollar value.
- A lot with an incomplete manifest never shows a Buy verdict from guessed items alone.
- The bankroll-gate share stays unset until Adam decides. `web/config/rules.js` has no such share today (`optional` is only the off lot-return rule and the off 60 mile surplus radius). This spec does not add one. The lock line "Unlocks at $X bankroll" is not shown with a made-up X while the share is unset.
- Rows the source does not identify say `unknown` for model and for resale. The screen does not fill unnamed units with a typical laptop price.
- Max bid and risk use `assessLot` in `web/lib/surplus.js` once the lot has a quantity, a bid or ask, fees, and sold comps with URLs. Missing inputs: max bid is `unknown`, or `none` when the existing function has shown that no bid works. Risk is the rule checks and the caveat strings that function already returns. No new risk score. A max bid built from guessed rows is not a Buy.
- The optional lot-return rule stays off (`optional.lot_roi.enabled` is false) unless Adam turns it on in `web/config/rules.js`.
- The wider 60 mile surplus radius stays off the same way.
- Nothing bids. The flip plan already says every bid is Adam's to place (`docs/flips/toughbook-lot-1988-19.md`). Buying the lot, and the addendum's Inventory tracking after a buy, wait for Adam's yes on that lot. There is no Inventory route today. The ledger (`web/app/ledger/page.js`) is the existing record.
- A result can be saved as a Lot Pack card. It does not become a purchased pack in this item. Pack price and pack odds are not in the addendum, and this spec does not invent them.

First test case, from `docs/flips/toughbook-lot-1988-19.md` (written Nov 20, 2026). These are facts in that file, not new bids:

- GovDeals 1988-19. Link in that file: `https://www.govdeals.com/en/asset/19/1988`.
- 12 laptops: 8 Panasonic Toughbooks and 4 other laptops. Hard drives removed. Models not stated on the lot.
- Pickup in that file: 215 S Milam St, Seguin, TX. The file says about 15 miles from New Braunfels, and a later route of 54 minutes and 31.26 miles round trip, inside the 60 minute cap.
- Closes, in that file: Thu Dec 4, 2026, 3:00 PM Central.
- Buyer's premium in that file: 12.5%. Sales tax called out as added at payment, rate not stated, 8.25% assumed there. The app's tax assumption is 0.0825 only when tax is added and no rate is given (`web/config/rules.js`).

Pasting that URL is the test. The breakdown may use sold comps that have URLs. It must not copy the flip plan's assumed resale cases (the file labels those as assumptions: low $30, middle $60, high $100 per Toughbook, and $0 for the other four laptops) unless the same cited sales are attached as comps. Where the page does not name a model, the row says `unknown`.

### Existing pieces

- Surplus math and board: `web/lib/surplus.js`, `web/components/SurplusBoard.js`, `web/app/surplus/screen.js`, `GET` and `POST /api/surplus`.
- The lot write-up: `docs/flips/toughbook-lot-1988-19.md`. A second lot draft lives at `docs/listings/zebra-tc700k-lot.md` and is not this test case.
- Worker post shape: `docs/SCOUT.md`, `docs/WORKER-API.md`.
- Transfer market spec: [Addendum: Lot Packs (the bronze pack method)](TRANSFER-MARKET-SPEC.md#addendum-lot-packs-the-bronze-pack-method).

New: photo-to-items, a GovDeals URL paste, the Lot Pack card, and the pull-odds labels. The board today shows lots the worker already posted. It does not accept a photo or a link from the browser. The addendum's text is in the transfer market spec. The card, the gate, and Inventory tracking are not built yet.

### Open questions

- The bankroll-gate share. The addendum leaves it unset until Adam decides. Do not guess a fraction or an unlock dollar amount.
- Whether a GovDeals paste is fetched in the browser, by a new route, or only accepted after the worker has posted the same lot to `POST /api/surplus`. Fetching the auction page is new.
- How a lot photo is split into items. No vision splitter exists in `web/`. Until an item is named by the page or by Adam, it stays `unknown`.
- The flip plan's max-bid table is a hand plan with stated assumptions. Confirming which of those rows, if any, the app should match is Adam's call. This spec requires the app to show its own cited comps or `unknown`, not to reprint that table as if it were measured output.

## 5. Paywall and pricing

Build after items 1 to 4. No live payment in this phase.

### User story

The first scan is free. The next scan hits a paywall. The monthly price is the high anchor. A cheaper annual plan is the selected choice. There is no lifetime plan.

### Acceptance criteria

- The first completed scan (item 1, 2, or 4) returns a full result with no account charge.
- The next scan shows a paywall instead of a new result. Item 3 drafts from a scan he already has, so opening a draft does not count as another scan.
- The paywall offers a monthly plan and an annual plan. The annual plan is the one selected on arrival. There is no lifetime SKU and no lifetime copy.
- Prices on that screen are whatever Adam has written down by then. The brief's "about $45 a year" is Resell Pal's price, from the brief, not verified, and it is not copied onto our button unless Adam says to use that number.
- No Stripe call, no charge, and no Anchor Marianas request. Those names are not in the repo. The paywall can be a static gate.

### Existing pieces

None. No paywall, no account plan, no Stripe package under `web/`.

### Open questions

- The dollar amounts.
- Whether a profit check and a lot scan share the one free scan, or each has its own. This spec counts them together as one free scan, because the brief says "one free scan".
- What happens to a result already on screen when the paywall appears. The spec says the next scan is gated. It does not hide a result already shown.

## 6. Retention

### User story

After 5 good scans, ask Adam for a review. Three referrals earn a free month. Scan history stays on the bankroll ledger, next to the buys and sales.

### Acceptance criteria

- A review ask renders only after 5 scans marked good. It does not render on scan 4. "Good" is not defined in the brief. Do not ship a guessed definition. See the open question.
- A referral count of 3 records one free month on the account. It does not charge a card and does not call Stripe. With no live payments, the free month is a stored credit.
- Each scan writes a ledger record: time, kind (price, profit check, or lot), and the result ids. The record goes through the existing ledger key (`gs_ledger_key`, AES-256-GCM in `web/lib/ledger.js`). It is not a public blob.
- The public bankroll pill keeps showing the one public number from `GET /api/bankroll`. Scan prices do not appear on the pill.
- The ladder (`web/lib/ladder.js`) keeps building from buys and sales. A scan is not a buy and does not move the bankroll.
- About 30% monthly churn is a planning assumption from the brief. It is not a measured rate, not a code constant, and not a target to engineer toward.

### Existing pieces

- Ledger and ladder, listed above.
- Saved deals (`web/app/api/saved/route.js`) are not the ledger and are not scan history.

New: review prompt, referral count, scan rows on the ledger document.

### Open questions

- What "good" means. Candidates that already exist in the code, none of them chosen: a result with at least one sold comp, a result Adam starred, a result he drafted. Pick one before building item 6.
- Where a review is asked (in-page prompt, or a store listing). There is no store app in this phase (item 8 is a PWA, and the native store is later).
- How a referral is attributed. No account system exists yet (item 5 is the first gate).

## 7. Shareable result card

### User story

From a price result or a profit check, Adam gets an image that says "found for $X, worth $Y", and he can share that image.

### Acceptance criteria

- X is the asking price he typed, or the listing ask on a deal that already has one. Y is the resale from item 1.
- If X or Y is null, the image is not rendered with a made-up number. The control says the card needs both numbers, and the missing one is `unknown`.
- The image includes the word `unknown` nowhere as a stand-in dollar amount. It is simply not offered.
- The card does not add a fee, a profit, or a comp that was not on the result.
- Saving or sharing the image does not publish a listing.

### Existing pieces

- Link-preview images exist for the site (`web/app/layout.js` points at `app/opengraph-image.png` and `app/twitter-image.png`). Those are the Market, not a per-scan card.
- `web/components/Photo.js` shows item photos. It does not draw a share card.

New: the card renderer.

### Open questions

- Image size and whether the comps' source names are printed on the card. The brief only specifies the sentence "found for $X, worth $Y".
- Whether a thin one-comp median is allowed as Y. Same open question as item 1.

## 8. Installable PWA

### User story

Adam can install the site on his phone from the browser. A native App Store or Play Store app waits until there is demand.

### Acceptance criteria

- A web app manifest and a service worker are added so the browser can offer install. No store binary, no store listing, no store review ask that depends on a store.
- Install does not change the hard rules. An installed icon still cannot publish, bid, or pay.
- Offline behavior, if any, shows the last saved result or an honest empty state. It does not invent a price while offline.

### Existing pieces

- `web/app/layout.js` sets `viewport` (`themeColor`, `width`, `initialScale`, `viewportFit`). That is not a manifest.
- No `manifest.webmanifest` and no service worker in the repo.

New: both of those.

### Open questions

- Which icon file. `web/public/` has item photos and `garage-hero.jpg`, not an app icon set.
- How much of a scan must work offline. Comp lookup needs a network. Offline price lookup is out of scope. The offline screen says it cannot price without a connection.

## 9. Growth appendix

Not code. No PR beyond this document needs to implement this section.

Pitch local news, with Adam's Grok Bot Hackathon win as the hook. The win is from the brief. The repo does not record a win. `web/app/about/page.js` says the site was built in 2.5 hours with Grok Bot at the Grok Bot Hackathon, and links the Luma event. Use that sentence as the on-site fact. Use the win only as the brief states it.

Outlets named in the brief:

- KSAT
- KXAN
- The San Marcos paper. The brief does not name the title.
- The New Braunfels paper. The brief does not name the title.

One thrift-store micro creator on a monthly retainer. The brief does not name the person or the amount. Do not invent either.

The about-30% monthly churn assumption from item 6 is the planning number for this appendix. It is not a forecast the app should display.

### Open questions

- The exact San Marcos and New Braunfels papers.
- The creator, the retainer amount, and who pays it. Paying is out of this spec (hard rule 4).

## Out of scope

- Merging or deploying this PR, or any later build PR, unless Adam asks.
- Branching from PR #53, or treating its dark theme as the design for these screens.
- Live Stripe, Anchor Marianas, a lifetime plan, a native app store.
- Inventing a pack price, pack odds, or a bankroll-gate share. The addendum is already in the transfer market spec. The share stays unset until Adam decides.
- Auto-publishing, seller messages, offers, bids, or buys.
- Changing any value in `web/config/rules.js`.
