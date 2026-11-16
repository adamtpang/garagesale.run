# Buy side: 10-minute hand test

For Adam. Screenshots from the first real pass (Nov 3, 2026) are in `docs/buy-test/`.

## Before you start (1 min)

1. Open Helium and make sure you are logged in to Facebook.
2. Check that remote debugging is on: `chrome://inspect/#remote-debugging` in Helium, "Allow remote debugging" ticked.
3. Start the app:

```bash
npm --prefix C:/Users/adamp/Aether/garagesale.run/web run dev -- -p 3100
```

4. Open http://localhost:3100/buy

Live search only works this way, on your computer. On a Vercel preview or production it shows a "Helium is not reachable" message and offers the old Grok Bot worker instead. That is expected.

## 1. Ask (1 min)

- [ ] You see a search box, Max $, City (Austin), a radius dropdown (Within 20 mi) and **Find deals**. Compare `docs/buy-test/1-ask.jpg`.
- [ ] Click the preset **Nintendo Switch under $200**. It starts searching right away.
- [ ] A progress bar shows steps ("Opening Marketplace in your Helium browser", then "Checking eBay sold prices", and so on) with a seconds counter.
- [ ] **If Helium shows an Allow popup, click Allow.** It appears once per dev server start.
- [ ] Watch Helium: background tabs open and close on their own (Marketplace search, eBay sold, then up to 6 listings). Nothing gets typed or clicked in them.

Expect one to two minutes.

## 2. Find (1 min)

- [ ] A heading like "18 matches for "Nintendo Switch" under $200" appears, followed by a line saying the area, how many eBay sold listings were used, and the search time. Compare `2-results.jpg`.
- [ ] Each card has a photo, title, asking price, city, how long ago it was listed (top 6 only; the rest say "Age not checked") and condition.
- [ ] Click a title. It opens the real Facebook listing in a new tab.

## 3. Price it (2 min)

- [ ] Each card says "Worth about $X", a confidence badge (high, medium, low) and the % under or over.
- [ ] Click **Price evidence** on #1. You see the median, the middle-half price range, and the actual eBay sold listings with condition, sold date and price. Compare `3-evidence.jpg`.
- [ ] Click one comp. It opens that sold listing on eBay.
- [ ] Click the preset **Herman Miller chair to flip**. Each model is priced only against sales of that model: Aerons against Aeron sales. Models with fewer than 3 matching sales (Setu, Sayl, Mirra, a vintage Eames set) say **Not enough comps** instead of a value. Verified Nov 8: Aeron about $639 from 6 comps.

## 4. Rank (1 min)

- [ ] Real discounts come first. Each card has a one-line reason. Compare `4-ranked.jpg`.
- [ ] Anything far under market (like a $45 "Switch Sports" game) sits near the bottom with a **Too cheap to trust** badge.
- [ ] At the bottom, "Show N listings that are not a match" lists accessories and games, each with the reason it was left out.

## 5. Draft the opener (2 min)

- [ ] On #1, click **Draft opener**. You get a message asking if it is still available.
- [ ] Click **Make an offer**. The message now names the target price (about 10% under asking, never under 70% of it). Compare `5-opener.jpg`.
- [ ] Change the Target $ box. The message updates. Edit the text by hand. Your edits stay.
- [ ] **Copy message** copies it. **Open listing to send** opens Facebook. Garage Sale never sends anything itself. If you want to try it for real, you paste and send.
- [ ] Click **Save deal with this draft**. The card shows "Saved · saved".

## 6. Track (2 min)

- [ ] Scroll down on /buy. **Top flips** now shows the saved deal with its discount and target. Compare `7-top-flips.jpg`. With nothing saved it says "No saved deals yet", never a spinner that never ends.
- [ ] Open **Dashboard**. Under Buy, **Saved deals** lists it with Ask, Target and a status dropdown. Compare `6-dashboard.jpg`.
- [ ] Change the status to **messaged**, then reload. It stays messaged. Change the target and click away, then reload. It stays.
- [ ] **Remove** deletes it from the list.

## If something fails

Send me (in chat):

1. The step number and checkbox that failed.
2. A screenshot of the page.
3. The last 20 lines of the dev server terminal.
4. The search you typed, with max price, city and radius.

Common causes:

- **Nothing happens on the very first page load after starting the server** (no progress bar, "Top flips" says "Loading..."): the dev server is still compiling. Reload the page once.

- **"Could not reach Helium" or "did not allow the connection":** remote debugging is off, or the Allow popup was missed. Turn it on, restart the dev server, search again, and click Allow.
- **"Facebook is asking you to log in":** log in to Facebook in Helium yourself, then search again. The app never logs in for you.
- **The same results come back instantly with "(cached)":** what was read is cached for 15 minutes to keep page loads low (prices are recalculated on every request). Change the radius or max price to force a fresh read.
- **Values look off for a whole search:** open "eBay sold search" from the results header. If eBay's sold page is mostly accessories or games, comps get thin and confidence drops. That is expected; the search excludes words like "game" and "cartridge" to keep it down.

Saved deals are stored in `web/.data/saved-deals.json` on your computer (gitignored).
