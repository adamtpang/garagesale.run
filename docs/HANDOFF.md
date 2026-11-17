# Garage Sale handoff

Start here next: docs/REVIEW-2026-11-16.md (review of PRs #6 to #12 and the build plan).

Plain status for the next session. Nov 16, 2026. No secrets in this file. Env var names only. Never print key values.

Repo: [adamtpang/garagesale.run](https://github.com/adamtpang/garagesale.run). App is Next.js in `web/`. Live site is the Vercel project `grokbothackathon`.

## Goal

Make real money flipping used items near New Braunfels, TX. San Marcos and Austin are search areas. They are not the pickup home.

Two plays:

1. **Local listing flips.** Facebook Marketplace, Craigslist, eBay, OfferUp.
2. **Surplus arbitrage.** New. From a Kerner Office podcast (JV, about $15K/mo). Buy cheap local lots on government surplus auctions. Sell the units on another market.

Surplus sources to use first: Public Surplus, GovDeals, B-Stock. Costco and other liquidation pallets come later.

Sell-side markets: eBay, Facebook Marketplace, niche Facebook groups (teacher groups and similar), Saturday garage sales, recyclers.

Lessons from that podcast:

- Prefer lots with one bid or no bids.
- Buy by the lot. Sell by the unit.
- Niche demand can beat an eBay comp.
- Books can ship Media Mail.
- A Marketplace garage-sale post can say "comment for the address."
- Buy with math. A story is not a price.

## Adam's rules

Do not bid, buy, offer, message a seller, or publish a listing unless Adam says yes on that specific item. Do not spend money. Open PRs only. Do not merge or deploy unless he asks. Do not invent prices or comps. Cite the source. If a number was not stated, say unknown.

### Flip rules (Nov 3, 2026)

These are the rules he set. The seed file is `web/config/scout-config.seed.json`. Production config is not this file. See State.

- Max $100 per flip.
- $100 bankroll.
- $100 minimum profit after fees and gas.
- 15-mile pickup radius from New Braunfels. Do not measure that radius from Austin or San Marcos.
- Categories: electronics, consoles, tools, furniture, bikes, cameras.
- Gas $0.18 per mile. That rate is an unconfirmed estimate (`estimate: ~20 MPG, $3.50/gal premium`).

### Proposed for surplus lots, not approved

Ask Adam before using these. They are not in the app.

- Judge a lot by profit and ROI. Example shape: max $100 per lot, and about 3x expected return.
- 60-mile radius for surplus pickup.

## State as of Nov 15, 2026

Merged: PRs #1 through #5.

- #1 scout config, deal ranking, keyed ledger.
- #2 ledger encrypted at rest.
- #3 README links.
- #4 relay reads env vars.
- #5 deal dashboard. Buy, or a reason to skip. Asking and active comps are not sold comps.

Open: [PR #6](https://github.com/adamtpang/garagesale.run/pull/6), branch `cursor/surplus-arbitrage-d69e`. Surplus board at `/surplus`. `GET /api/surplus` is public. `POST /api/surplus` needs header `x-worker-key` (`GST_WORKER_KEY`). Seed snapshot: `web/config/surplus-scan-2026-11-15.json`. The board does not place bids. No lot in that seed is a buy. Resale is unknown because the comps are asking prices.

Deal feed: last real write Oct 23, 2026. 21 legacy deals.

`GET /api/scout/config` on production is all null. The Nov 3 numbers live in the seed file only. They were not stored. The `GST_WORKER_KEY` the Grok Bot had was rejected with 401 twice, so config and deals cannot be written until a key is set that matches production. Read the value from the Vercel project `grokbothackathon` env vars. Do not paste it into the repo, a PR, or chat.

eBay sold-comp searches hit a captcha or a sign-in wall in a cloud browser.

The Grok Bot scout and the worker routines ("Flipping bot") are paused. They never ran. The old Wealth copies are paused too. `relay/relay.py` polls `/api/pending` and would need to point at a new worker webhook. Ledger encryption needs `GS_LEDGER_KEY`. A missing ledger key is 503. A wrong key is 401.

## Nov 15 surplus scan

Read-only. Public Surplus. Adam created a Public Surplus account that day. No bids were placed.

Lot URL pattern: `https://www.publicsurplus.com/sms/all,tx/auction/view?auc=ID`

Comps found were asking prices, not sold. eBay asking about $114.98 for a used Zebra TC700K with cradle. Flipify asking tracker for a Galaxy S20 FE: median $147, typical asking about $115–$205. Those are not resale. Profit stays unknown until a sold comp is cited (eBay sold or Terapeak).

GovDeals search pages are JavaScript-only and need a browser. B-Stock needs a sign-in before fees are visible.

### City of Schertz, about 16 miles

Electronics closing Tue Nov 17, 2026, 8:00 PM CT.

Pickup the scan recorded for this seller: appointment only, weekdays 9:00 AM–4:00 PM, 10 business days, no loading help, 8.5% buyer's premium. On the board, the street address (1400 Schertz Pkwy Bldg 9) and the 8.5% premium are stored on the Zebra lot only. Other Schertz lots leave premium, street address, and (for the cash registers) close time unknown.

| Lot | Auc | Bid in the scan | Notes |
| --- | --- | --- | --- |
| 8 Zebra TC700K-02B24B0-US handhelds | 4123518 | $10, 1 bid | All-in on the board about $17.51 with assumed 8.25% tax and the $0.18 haul. Lowest all-in in the scan. Not a buy. |
| Samsung Galaxy S20 FE, six auctions | 4123530, 4123522, 4123523, 4123524, 4123526, 4123528 | $5–$5.50 as a group. 4123530 had no bids. Per-auction bids were not recorded | FRP / carrier lock risk. One photo was an SM-G781V (Verizon). The scan did not say which auction. |
| Samsung Galaxy S10e | 4123532 | $1, 2 bids | Resale unknown |
| SAM4S ER-180TB cash register | 4123508 | No bids. $10 is the opening price | Resale unknown |
| Nadex CR360 cash register | 4123506 | No bids. $10 is the opening price | Resale unknown |

Tax on these lots: seller says tax is added. The rate was not stated. The board labels 8.25% as that assumption.

#### Schertz refresh, Nov 15, 2026, 8 PM CT (Claude Code)

Read-only. No bids, no seller messages. The board seed now holds this.

- Bids: Zebra $10 (1 bid). S20 FE auctions 4123522, 4123523, 4123524, 4123526 at $5 (1 bid each), 4123528 at $5.50 (2 bids), 4123530 no bids ($5 opening). S10e $1 (2 bids).
- Close: Tue Nov 17, 2026, 8:00 PM CT (the page says 7:00 PM MST) and "might extend."
- All eight lots list the same pickup: 1400 Schertz Pkwy Bldg 9. One trip covers them.
- Premium is 8.5% with a $1 minimum per auction. The board math used to miss the minimum.
- Zebra photos: 8 units, every battery bay is empty, no chargers or cradles. They cannot be powered on at preview.
- Each S20 FE auction is one phone, not a group. Back labels read at full size on 4123524 and 4123530: SM-G781V (Verizon), 128GB. The other four have the same style of label and were not read. Lock and power state are unknown.
- eBay sold comps were read through Adam's own Helium browser. Cloud scrapers are blocked.
  - Zebra TC700K, as-is or for parts: about $30 to $44 a unit. A lot of 5 of the same model number sold for $200 on Oct 19, 2026 (item 128064350319). A tested unit with a battery sold for $17.99 at auction.
  - SM-G781V 128GB working: 24 sold, $59 to $149.99, median $89.99. For parts: 11 sold, $37.50 to $80. No sold listing named a Google-locked unit, so that price is unknown.
- eBay fee: 13.6% plus $0.40 per order, from eBay's selling fees page on Nov 15, 2026.
- Still assumptions: 8.25% tax, 16 miles, shipping ($25 for the Zebra box, $6 a phone).
- Rule check: Schertz is about 16 miles and the flip rule is 15. One phone alone cannot reach $100 profit. Adam has not approved a bid on any lot.

### TFC, east Austin

Lot 13, auc 4124526. 6506 Bolm Road, Austin 78721, about 52 miles. 4 DVRs, 2 money counters, 4 monitors, 2 tablets. $127.50, 6 bids. Closes Fri Nov 20, 2026, 3:00 PM CT. Preview Thu Nov 19, 8:30 AM–4:00 PM. Removal Nov 23–Dec 7, weekdays. 6% premium. Status on the board: needs preview. Resale unknown.

Skip TFC Lots 1–12. A coin-op license is required.

### Hallettsville ISD, about 73 miles

| Lot | Auc | Price in the scan | Closes |
| --- | --- | --- | --- |
| 42 inch LG Plasma, listed working | 4128212 | $5. 10.5% premium. Bid count not recorded | Thu Dec 3, 2026, 3:00 PM CT |
| 70 inch Vizio, listed working, no stand, remote, or cord | 4128202 | $50 opening. Current bid not recorded. Premium not restated | Close time was not in the scan |

Resale unknown on both.

#### Cash registers, read Nov 16, 2026 (Claude Code)

Read from the two auction pages. No bids, no seller messages.

- Auctions 4123508 and 4123506 end Nov 17, 2026, 7:00 PM MST, which is 8:00 PM CT, and may extend.
- No bids on either. The opening price is $10 and the increment is $0.50. The board used to show $10 as a current bid. It was never a bid.
- Buyer's premium 8.5% with a $1 minimum, the same pickup address as the other Schertz lots, and tax shown only at bidding.
- Resale is still unknown. No sold comp has been looked up for either model.

## How work lands (from Nov 16, 2026)

- One small PR per fix. Open it, wait for Bugbot, and fix or answer every finding.
- Adam merges. No agent merges.
- Every merge to `main` that touches `web/` deploys to production. A PR body says so. It never says "not deployed."
- Every page a PR changes gets a desktop and a phone screenshot in the PR.
- Screenshots live in `docs/screens/`.

## Vercel builds

Set Nov 15, 2026. Builds cost money, so `web/vercel.json` holds an ignore command. It overrides the Ignored Build Step in the Vercel project settings.

- Preview branches never build.
- A production build is skipped when nothing under `web/` changed since the last deployed commit. A docs-only merge to `main` is free.
- If the comparison cannot run, it builds.

To check, open the deployment in Vercel. A skipped one shows "Canceled by Ignored Build Step".

## Next

1. Get sold comps (eBay sold, Terapeak) for the Schertz lots before the Tue Nov 17 close.
2. Ask Adam for a yes and a max bid on any specific lot. Do not bid without that.
3. Set alert categories on Public Surplus.
4. Scan GovDeals, Purple Wave, and Rene Bates for New Braunfels city surplus.
5. Fix `GST_WORKER_KEY` so it matches the Vercel project `grokbothackathon`. Then the Nov 3 seed can be stored. Do not invent a key.
6. Merge PR #6 only when Adam says so.
