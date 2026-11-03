# Buy side audit

Written 2026-11-03, before any buy-side code changed. Paths are relative to `web/` unless noted.

## How a buy request flows today

1. `/buy` renders `app/page.js` with `mode="buy"` (`app/buy/page.js`).
2. Submitting the form calls `buy()` in `app/page.js:134`, which POSTs `{kind:'buy', query, max_price}` to `/api/jobs`.
3. `app/api/jobs/route.js` saves a job to Vercel Blob and writes a `pending/` marker (`lib/store.js` `markPending`, `indexPending`).
4. `relay/relay.py` (repo root) polls `/api/pending` on `grokbothackathon.vercel.app` and wakes a remote Grok Bot worker through a webhook. Its secrets live in `/workspace/gst/` on the Grok Bot machine, not on this PC.
5. The worker searches Marketplace in its own browser and POSTs `results.deals` back to `/api/jobs/[id]/events`.
6. `/job/[id]` (`app/job/[id]/page.js:158`) shows the deals as `DealCard`s.

None of the search, pricing or ranking logic is in this repo. It all lives in the remote worker's prompt.

## Real

| What | Where | Notes |
| --- | --- | --- |
| Custom search box and max price box | `app/page.js:179-184` | Submits and creates a real job. |
| Job queue, relay and worker wake-up | `app/api/jobs/route.js`, `lib/store.js:566-607`, `relay/relay.py` | Worked at the hackathon. Example: job `766aab1d1cfc` ("honda car", Oct 20) has real FB links. |
| Scout feed | `app/api/deals/route.js` | Real FB listings, posted by a 30-minute scout routine. |
| Image proxy | `app/api/img/route.js` | Proxies fbcdn, eBay and Amazon images. |
| Deal detail page | `app/deal/[src]/[idx]/page.js` | Shows buy, resell and comps for one deal. |

## Stubbed or missing

| What | Where | Notes |
| --- | --- | --- |
| Presets do not search | `app/page.js:185` | Clicking one only fills the box (`setQ`). "under $500" is never parsed into a max price. |
| No location or radius input | `app/page.js:179-186` | Austin is hard-coded in copy and docs (`lib/docs.js`). |
| No time-listed field | everywhere | Neither the worker schema nor the UI has it. |
| No confidence or "not enough comps" | `components/DealCard.js`, `app/deal/[src]/[idx]/page.js` | Every deal shows a confident profit number. |
| No opener draft for sellers | none | The deal page says "Message the seller" and leaves it to Adam. |
| No saved deals or deal status | none | The dashboard can't save a deal, set a target price, or mark one messaged, bought or resold. |
| Search, pricing and ranking logic | remote worker | Not versioned here, so it can't be tested or reviewed. |

## Mocked or labeled examples

| What | Where | Notes |
| --- | --- | --- |
| Home hero tiles | `app/page.js:16-22` | Labeled "Example", fine. |
| Hero feed text | `app/page.js:20` | "Comparing with eBay sold" and similar lines cycle on a timer. Decoration, not a real status. |

## Broken or misleading

| What | Where | Notes |
| --- | --- | --- |
| "Top flips" can hang on "Loading..." | `components/ModeFeed.js:8-23` | No timeout. If `/api/deals` stalls, it stays on "Loading..." forever. Today (Nov 3) it loaded in about 0.2s, so the hang is intermittent. |
| "Top flips" data is stale | `/api/deals` | Last scout run was 2026-10-24. The page shows no age, so 10-day-old listings look current. Several may be sold. |
| Comps cite searches, not listings | live data, job `766aab1d1cfc` | The resale "comp" is a Craigslist search URL described as "marked SOLD at $4,800", which can't be checked. |
| Ranking hides honest results | `app/job/[id]/page.js:158`, `app/dashboard/page.js:296` | Deals without positive profit are dropped, so a search with no flips looks empty instead of showing matches with "not enough comps". |
| Relay points at the old URL | `relay/relay.py:7` | `BASE = "https://grokbothackathon.vercel.app"`. It still works because both domains are the same project. |
| Local dev has no storage | `lib/store.js` | Every route needs `BLOB_READ_WRITE_TOKEN`. Without it, jobs and the deal feed fail locally. |
| Nav says Messages, route is `/conversations` | `components/NavMsgs.js:28` | No `/messages` route exists. The page only handles sell-side buyer replies. |

## Hosting

- Vercel project `grokbothackathon` (`prj_KBgBZZE06QYZsYSm7tZO0r7URsc9`, team `team_94z2L2r0X8hywHS0hi2ahkW7`) serves `garagesale.run`, `www.garagesale.run` (308 to apex) and `grokbothackathon.vercel.app`. Root directory is `web/`, framework Next.js 14.
- `web/.vercel/project.json` now links this folder to that project (gitignored).
- The GitHub repo is still `adamtpang/grokbothackathon`. Renaming it to `garagesale.run` (and the Vercel project to match the one-to-one rule) is Adam's call.
