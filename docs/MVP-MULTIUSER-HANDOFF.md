# Multi-user MVP handoff

For Fable (Claude Code). Docs only. Do not merge or deploy this PR: every merge to `main` deploys to production.

**Repo:** https://github.com/adamtpang/garagesale.run  
**App:** `web/` on `main` at `26a819d` (PR #64, pay-for-items). Live site: https://garagesale.run  
**Goal:** any new person can use selling, buying, and conversations with their own account, their own Facebook, and their own Garry bot. Today a signed-out visitor sees Adam's Facebook Marketplace activity.

This handoff is from a code audit of `main` and an incognito new-user test on 27 Nov 2026 (America/Chicago). Supporting notes (not in this PR): `/workspace/garagesale-audit/CODE-AUDIT.md` and `/workspace/garagesale-usertest/USERTEST-FINDINGS.md`.

Do not include secrets in any follow-up PR. Kanban cards and commit messages should stay free of contact details and buyer message text.

---

## Executive summary

Garage Sale already has the beginnings of accounts: a Garry bot can register, send a 10-minute sign-in link, and attach a per-account webhook. Signed-in jobs are tagged `job.owner` and stored under `account-index/<id>/`. Approve and reply routes already know how to scope an account's jobs.

That work is not what a new visitor gets. If there is no session, `GET /api/jobs?recent=1` returns the site owner's pre-accounts jobs, and `GET /api/deals` returns the owner's Austin scout feed. `/dashboard`, `/conversations`, `/sell`, and `/buy` all consume those APIs with no auth gate. An incognito test on 27 Nov 2026 showed the owner's money totals, live listings, scouted deals, a Messages badge, and a real buyer conversation, including an offer and a drafted counter-reply. The `/connect` page also shows an owner-only invite form to signed-out visitors. The invite API itself is keyed, but clicking the button prompts a stranger for the site owner key.

A second problem, separate from the leak: Garry today does the whole workflow (identify, price, draft, scout, post, and message). Adam's direction is that **garagesale.run is the product and the source of truth**. The app should handle accounts, photos, identify, price, drafts, listings, deals, and the inbox. **Garry is only the Facebook hands**: a per-user worker on a job queue. That is a design change, not a small bug fix. It should follow the privacy gates, not precede them.

Ship in this spirit:

1. Stop showing anyone else's data. Gate the app, scope every feed to the signed-in account, and give signed-out users empty or example states.
2. Make sign-in durable with OAuth (Sign in with X, Google as backup). Link each person's Garry to that account. Do not make a magic link the only way back in.
3. Move identify, price, drafts, deal search, and inbox drafting into the app. Leave Garry three jobs, each only after the user approves in the app: `post_listing`, `sync_messages`, `send_reply`.
4. Make the site installable on a phone (PWA first, Capacitor later), with camera-first sell and web push for "new buyer message" and "approve this post."

---

## Ranked problems

Blockers first. Each item has the URL or `file:line` on `main` at `26a819d`, the problem, the fix, and acceptance criteria. Privacy leaks are first.

### B1. Public `/dashboard` shows the owner's listings, totals, and deals

**Where:** https://garagesale.run/dashboard  
`web/app/dashboard/page.js:49-53, 56-59, 75, 80`  
`web/app/api/jobs/route.js:11-16` (`GET /api/jobs?recent=1` calls `recentJobs(15, null)` when there is no session)  
`web/lib/store.js:13-16, 54-67` (`owner = null` reads the global `jobs-index/`, "the site owner's own jobs")  
`web/app/api/deals/route.js:3-13` (`GET /api/deals` is public; `POST` is the owner worker; default area is `Austin, TX`)

**Problem:** An incognito visitor sees a "Money on the table" total around $28,000, the owner's sell listings and photos, a card labeled "Austin flipper," and a buy column of scouted Marketplace deals, last scouted in Austin, TX. The page never checks `/api/me`. CORS on JSON responses is `*` (`web/lib/store.js:240-241`), so any website can read the same owner feed.

**Fix:** If there is no session, `GET /api/jobs?recent=1` returns `{ jobs: [] }`. Do not use `owner = null` as the public default. Stop serving the owner deals feed to anonymous browsers. The signed-out dashboard is an empty or "Connect and sign in" state, not the owner's workspace. Keep `jobs-index/` as the owner's private index, reachable only with an owner session or the owner key.

**Accept:** Incognito `/dashboard` shows no owner listings, no owner deals, no owner totals, and no "Austin flipper" identity. A signed-in tester sees only their own jobs. `curl` of `/api/jobs?recent=1` and `/api/deals` without a cookie does not return owner data.

### B2. Public `/conversations` shows a real buyer thread

**Where:** https://garagesale.run/conversations  
`web/app/conversations/page.js:40-48, 75-95`  
`web/app/api/jobs/[id]/route.js:3-7` (`GET` returns the full job, including `inquiries`, with no auth)  
`web/components/NavMsgs.js:11-22` (unread badge and "New message from {buyer}" toast)

**Problem:** The incognito inbox loaded the owner's listings and a real buyer conversation: the buyer's name, an offer, a drafted counter-reply, and a pickup place. The Messages nav badge showed unread count "1" to a signed-out visitor. This is personal Facebook inbox data. Do not paste that message text into tickets or later docs.

**Fix:** Require a session that owns the job, or a Garry principal that `canWork`s it, on `GET /api/jobs/:id`. Return 404 to everyone else. Conversations and NavMsgs render nothing, and no badge, until the browser is signed in. If a public listing preview is needed later, add a redacted payload (title, price, photos only). New job and inquiry blobs should not be public Vercel objects (`web/lib/store.js:35, 127-128`).

**Accept:** Incognito `/conversations` is a sign-in empty state with no names, messages, offers, or listing strip from the owner. The nav badge is 0 or hidden. A signed-in tester sees only their own threads. `curl` of a known owner job id without a cookie does not return `inquiries`.

### B3. Public `/sell` and `/buy` show the owner's live listings and scouted deals, unlabeled

**Where:** https://garagesale.run/sell and https://garagesale.run/buy  
`web/components/ModeFeed.js:12-30`  
`web/app/sell/page.js` and `web/app/buy/page.js` (they only render `Home` with a mode)  
`web/app/page.js:16-22, 86, 217` (the home hero, by contrast, falls back to labeled "Example" tiles)

**Problem:** `/sell` "Live now" lists the owner's live Marketplace items. `/buy` "Top flips" lists the owner's scouted deals. Neither labels them as examples. A new person can take this as their own inventory or as a public marketplace.

**Fix:** On signed-out `/sell` and `/buy`, use the labeled example catalog only, or an empty state. Once signed in, those rails are that account's jobs. Never use the owner feed as a stand-in.

**Accept:** Incognito `/sell` and `/buy` show no owner photos, titles, or prices, or they show clearly labeled examples that are not live owner listings. A signed-in tester sees only their own live items and their own deal results.

### B4. No auth gate, and an unsigned upload or search is queued to Adam's bot

**Where:** https://garagesale.run/sell, https://garagesale.run/buy, and the nav  
`web/app/layout.js:16-17` (Dashboard and Messages always in the nav)  
No `web/middleware.js`  
`web/app/page.js:121-157` (sell and buy POST with no `/api/me` check)  
`web/app/api/jobs/route.js:18-23, 53-58` (no session means no `job.owner`; then `fireWebhook` uses the single env `GST_WEBHOOK_URL`, the site owner's bot)

**Problem:** A stranger who taps "Take photo" or "Find deals" does not get a sign-in error. The job is created with no owner, appears in the public owner feed, and is woken on Adam's Garry. If later approved with the owner key, it would be posted from Adam's Facebook. The `/sell` upload card does not say this.

**Fix:** Reject `POST /api/jobs` with 401 unless there is a session. Signed-out `/sell` and `/buy` explain sign-in and refuse to create a job. Hide Dashboard and Messages in the nav until signed in. Do not invent a guest index that still hits the owner webhook.

**Accept:** Signed-out POST `/api/jobs` returns 401 and creates no job. Signed-out sell/buy do not upload. After sign-in, a new job has `owner` set to that account and wakes that account's Garry, never `GST_WEBHOOK_URL`.

### B5. Approve, answer, and send-reply controls appear on leaked owner jobs, and they ask for the owner key

**Where:**  
`web/app/conversations/page.js:50-54, 92-94`  
`web/app/job/[id]/page.js:139-144, 167-173, 217-226, 239-241`  
`web/lib/ownerKey.js:8-20` (on a 401 whose reason matches `/owner-key/`, the browser `prompt`s for the owner key and stores it in `sessionStorage`)  
`web/app/api/jobs/[id]/answer/route.js:7-8` (owner-less jobs "stay open": no session and no owner key required)

**Problem:** The leaked UI is not read-only. A visitor can be prompted for `GS_OWNER_KEY`. Anyone can answer a question on an owner-less job, and that answer is queued to Adam's worker. Test jobs also skip approve/reply auth (`web/app/api/jobs/[id]/approve/route.js:10`).

**Fix:** Render approve, answer, and send-reply only when `/api/me` says this session owns the job. Require a session (or the owner key, only for Adam's leftover owner jobs, and only from a hidden owner tool) on the answer route. Keep `ownerFetch` off every public page. Auth test jobs the same way, or refuse mutations on them.

**Accept:** Incognito job and inbox pages have no approve, answer, or send controls, and no owner-key prompt. POSTing those routes without a session returns 401 or 404. A signed-in user can act only on their own jobs.

### B6. The `/connect` owner invite form is visible to everyone

**Where:** https://garagesale.run/connect  
`web/app/connect/ConnectScreen.js:64-73` (`<details data-field="owner-tools">` renders when `me === null`)  
`web/app/api/invites/route.js:5-8` (this POST is **not** unauthenticated: it uses `ownerGate`)  
`web/lib/ownerKey.js:16` (a 401 still prompts "Owner key needed to approve. Paste it here:")

**Problem:** The incognito Connect page exposes "For the owner: reserve a spot with an invite." The API is owner-key gated. The risk is social engineering: any visitor can open the form and be asked to paste `GS_OWNER_KEY`. A correct paste would mint a real invite.

**Fix:** Remove owner tools from the public Connect page. Put invite minting behind an owner-only route that is already server-gated, or behind a session flagged as the site owner. Do not `prompt()` for the owner key on a public URL.

**Accept:** Incognito `/connect` has no invite form and no owner-key prompt. `POST /api/invites` without the owner key still fails. Adam can still mint an invite from a hidden, gated tool.

### H1. Accounts have no location, Facebook status, or buy preferences

**Where:** `web/lib/accounts.js:107` (an account is `{ id, name, created_at, invite_note, joined }`)  
`web/app/dashboard/page.js:75, 80`, `web/app/job/[id]/page.js:99`, `web/app/page.js:80`, `web/app/layout.js:22`, `web/app/api/deals/route.js:11` (hardcoded Austin / "Austin flipper")  
`web/app/api/garry/me/route.js:7-10` (returns webhook and item packs, not Facebook sign-in)  
`docs/GARRY.md:120, 142` (tells Garry to search "near your person," but the app never stores a place)

**Fix:** Add profile fields (ZIP or city, drive radius, sell/buy focus) and a Garry-reported `facebook: { signed_in, checked_at }`. Drive listing copy and deal search from those fields. Replace "Austin flipper" with the signed-in name or a generic empty state. Refuse Approve & post until Garry reports Facebook is signed in for that person. See Auth and onboarding.

**Accept:** A second user with a different ZIP does not see Austin as their home. `/connect` shows whether Garry's browser is signed in to Facebook. Approve & post is disabled until that flag is true.

### H2. Conversations exist, but they are not a complete per-user feature

**Where:** `web/app/page.js:165, 231-232` (How-it-works promises conversations; a "Coming soon" card says views, conversations, and price changes are not built)  
`web/app/conversations/page.js` (the inbox is already built)  
`docs/GARRY.md:94-96, 135-138` (Garry must not poll on a schedule; it only files inquiries if it happens to see them)

**Fix:** Split the copy: the approve-to-send inbox is in scope; views and suggested price changes are later. In the target design, the app holds the inbox. Garry only runs `sync_messages` and `send_reply` after the user approves those jobs in the app. Hide `/conversations` until the user is signed in.

**Accept:** Signed-out users do not see the owner's inbox. A signed-in user can refresh messages only by approving a sync, and can send a reply only by approving `send_reply`. The landing page no longer contradicts the inbox.

### H3. Batches are unauthenticated, and a batch page can assemble other people's jobs

**Where:** `web/app/api/batches/route.js:4-10`, `web/app/api/batches/[id]/route.js:4-15`, `web/app/page.js:126-143`

**Fix:** Require a session. Only allow job ids owned by that account.

**Accept:** Signed-out POST `/api/batches` fails. `GET /api/batches/:id` does not return another account's images, titles, or listing URLs.

### M1. In-page helper and copy issues (not a leak, but they confuse testers)

- The Garry chat widget falls back to docs with the note "no live model connected" when `XAI_API_KEY` is missing (`web/app/api/assist/route.js:20-35`). Suggestion chips fill the input but do not send (`web/components/Assistant.js:20, 26`).
- GitHub links still point at `https://github.com/adamtpang/grokbothackathon` (`web/app/layout.js:23`, `web/app/page.js:246`, `web/app/about/page.js:13`). Point them at this repo.
- Job, account, pending, and hook records are written as `access: 'public'` blobs (`web/lib/kv.js:15`, `web/lib/store.js:35`). Use private storage for account and job JSON.
- The session secret can be derived from `GST_WORKER_KEY` (`web/lib/accounts.js:53-58`). Require a dedicated `GS_SESSION_SECRET` in production.
- `web/lib/store.js:44` hides one hardcoded job id in the global feed. Drop owner leftovers from the multi-user path.
- Root `README.md` is still the old "Pokédex for people" writeup, not this product. Out of scope for the first build PR if time is tight; do not let it block the leak fixes.

---

## Architecture

Adam's note: it is weird to use an AI bot as the main workflow of a Facebook tool. This section is the intended design. It is **not** how the code works today.

### The rule

**garagesale.run is the product and the source of truth.** The app itself handles each user's account, photos, identify, price, drafts, listings, deals, and inbox. There is no Garry in that path.

**Garry is only the Facebook hands:** a per-user worker on a job queue.

- Its jobs are `post_listing`, `sync_messages`, and `send_reply`.
- Each job runs only after the user approves it in the app.
- Garry claims the job from the app's API and writes results back: the listing URL, the status, and new messages.
- Deal search runs in the app. Garry scans Marketplace only when a logged-in Facebook session is needed. That scan, if it exists, is still a queued job the user has approved, not an implicit side effect of typing a query. Whether it is a fourth job type is an open question below.
- Each user's Garry runs on their own Grok Bot plan. The app's identify, price, and draft work is billed to Garage Sale (or whatever model path Adam chooses), not to a hidden run of the owner's bot.

The in-page "Garry" chat bubble on the site is a docs helper (`web/components/Assistant.js`). It is not the person's worker and must not be able to post, price, or see their Facebook.

### Target flows

**Sell.** The signed-in user takes a photo in the app. The app identifies the item, researches comps, and drafts a listing. The user edits and presses Approve & post. The app enqueues `post_listing` for that user's Garry. Garry, already signed in to that person's Facebook in its own browser, creates the Marketplace listing and writes back `listing_url` and `stage: live` (or an error, such as Facebook needs a sign-in). The app shows the live link. Nothing is posted without that approval.

**Conversations.** The user approves a `sync_messages` job (a one-tap "Check messages," or a saved permission: that is an open question). Garry reads the Marketplace inbox for that person's listings and writes new message records into the app. The app holds the thread and drafts a reply. The user approves the reply in the app. The app enqueues `send_reply`. Garry sends exactly that text and writes back sent status. Garry never sends a message it drafted on its own.

**Buy.** The signed-in user types a query and a max price, with a ZIP or city and drive radius already on their profile. The app searches and scores deals (public web and sold-comp sources that do not need a Facebook session). If a result set requires a logged-in Marketplace view, the app asks the user to approve a scan job, Garry runs that scan, and the app stores and displays the deals. Garry never contacts a seller.

### What Garry reads and writes today

Today's worker is specified in `docs/GARRY.md` and wired through the job events `created`, `answered`, `approved`, and `reply_approved`. Garry is in the main path.

Garry **reads:**

- `POST /api/garry/register`, `GET /api/garry/me`, `POST /api/garry/login-link`, `POST /api/garry/webhook`
- `GET /api/jobs/:id` (the full job, including photos, drafts, and inquiries)
- `GET /api/pending` and `GET /api/stalled` (that account's queue, or the owner's queue when called with `GST_WORKER_KEY`)
- `job.image_url` and `job.images`
- Facebook Marketplace in its own browser, for comps, buy scouting, posting, and inbox

Garry **writes:**

- `POST /api/jobs/:id/dispatched` (claim) and `POST /api/jobs/:id/done`
- `POST /api/jobs/:id/events` with `log`, `stage`, `result`, `question`, `inquiry`, and `inquiry_sent` (this is how identification, comps, prices, listing drafts, deals, and buyer threads enter the app)
- `POST /api/jobs/:id/snapshot` (screenshots of the Facebook session)

The app **wakes** Garry with a POST to the registered webhook: `{ job_id, kind, event, key, payload }` for `created`, `answered`, `approved`, and `reply_approved` (`web/lib/wake.js:62-75`). Owner-less jobs instead call the single env webhook (`web/lib/store.js:100-113`).

On sell `created`, `docs/GARRY.md:115-122` tells Garry to identify, research local Marketplace and eBay comps, write the listing, and stop at `awaiting_approval`. On buy `created`, `docs/GARRY.md:140-144` tells Garry to scout Marketplace and post `deals[]`. That work moves into the app in the target design.

### What Garry should read and write instead

Garry **reads** only the Facebook job it claimed, and only for its account:

- A queue endpoint of jobs typed `post_listing`, `sync_messages`, or `send_reply` (and maybe a Marketplace scan, if Adam adds it)
- For `post_listing`: the approved title, price, photos, description, category, condition, and pickup
- For `send_reply`: `inquiry_id` and the approved text
- For `sync_messages`: which listings to check
- `GET /api/garry/me` for webhook, Facebook status, and whether the account is ready

Garry **writes** only results of those jobs:

- `post_listing`: `listing_url`, `stage` (`live` or an error such as `facebook_login_required`)
- `sync_messages`: new message records (buyer display name, text, listing, timestamps). Not a drafted reply, unless Adam decides the app should accept an optional draft hint
- `send_reply`: `sent` status and timestamp
- Logs that the person can see, and optional snapshots of the Facebook UI

Garry does **not** write identification, comps, prices, listing drafts, or deals. The app does that, then shows Approve.

### Per-user endpoints and schema to add or change

Keep the existing account, hashed `garry_key`, and sealed webhook records. Change or add:

- **Auth-scoped reads.** `GET /api/jobs?recent=1`, `GET /api/jobs/:id`, `GET /api/deals`, `GET /api/batches/:id` only return the signed-in account's data. No session, empty or 401/404.
- **Auth-scoped writes.** `POST /api/jobs`, approve, answer, reply, and batches require that session.
- **Account profile.** ZIP or city, drive radius, sell/buy focus, OAuth provider ids, `facebook: { signed_in, checked_at }`, `garry: { online, webhook_set, last_seen_at }`.
- **A Facebook job queue** distinct from identify/price work. Records: `type`, `job` or `inquiry` id, `status` (`queued`, `claimed`, `done`, `error`), `approved_at`, `result`. Endpoints for Garry to claim, complete, and fail, with the same "claim first, send the key, stop if `claimed` is false" rule that `docs/GARRY.md` already uses.
- **App-side identify, price, and draft.** New server work, not a Garry event. Likely an xAI call from the app (today the only model key in the app is `XAI_API_KEY` on the public help widget).
- **Inbox records** stored on the account, not only as a field hanging off a public job JSON.
- **Pairing.** A one-time code that attaches a `garry_key` to an existing OAuth account, and a way for a signed-in user to revoke and replace a Garry.
- **Facebook status write.** Garry reports signed-in / signed-out after it checks Marketplace, without ever sending the password (that rule in `docs/GARRY.md:22` stays).

Rewrite `docs/GARRY.md` and `docs/garry/SETUP.md` in the same build as the queue change, so every installed Garry that re-reads the file on `main` picks up the new job types. Until then, do not publish a template that still teaches Garry to price and draft.

---

## Garry and app two-way protocol

The app is the source of truth and Garry is a worker that claims jobs from it. The app is always up and Garry is not, so the app keeps the record and Garry checks in.

### Jobs table (per user)
`jobs(id, account_id, kind, state, approved_at, attempts, lease_expires_at, payload, result, created_at, updated_at)`. States: `queued`, `claimed`, `running`, `done`, `failed`. Every Facebook action (`post_listing`, `send_reply`, and any logged-in scan) requires `approved_at` set by the user in the app before it can be queued.

### App to Garry (doorbell)
On approval the app inserts a job, then POSTs to that user's stored Garry routine webhook URL with `Authorization: Bearer <that user's webhook key>` and body `{ "job_id": "...", "kind": "..." }`. The ping carries no data, so a duplicate or missed ping is harmless.

### Garry to app (data)
HTTPS with a per-user bot token issued at connect time, stored hashed, revocable from the app.
- `POST /api/garry/jobs/:id/claim`: atomic; returns `{ claimed: true|false, job }` and sets `lease_expires_at` (for example now + 5 min).
- `POST /api/garry/jobs/:id/heartbeat`: extends the lease during long Facebook steps.
- `POST /api/garry/jobs/:id/complete` and `/fail`: result (listing URL, status, new messages) or error.
- `POST /api/garry/events`: unsolicited pushes, for example new buyer messages found during a sync, keyed by an idempotency key.
- `GET /api/garry/jobs?status=queued`: catch up on missed jobs.
Every request updates `garry_last_seen` on the account.

### Reliability
- Every call is idempotent, keyed by `job_id` or an idempotency key; repeating complete or an event is a no-op.
- A job whose lease expires returns to `queued`; after N attempts (for example 3) it goes to `failed` and the user sees it.
- A fallback poll routine on Garry (every 15 to 30 minutes) calls the catch-up endpoint, so a lost doorbell only delays work.
- The app shows Garry as online, offline, or "needs Facebook sign-in" from `garry_last_seen` and the last error.
- The app rejects any Facebook job without a recorded approval, even if Garry asks to run it.

### Connect
Garry registers its own webhook URL and key with the app (`POST /api/garry/webhook`), reading the key from `$ROUTINE_WEBHOOK_SECRET_<routine id>` in its shell so the key is never displayed or pasted. It receives its bot token through the sign-in link pairing step (see Auth and onboarding).

### How this differs from today
Today `/api/jobs` serves a global owner dataset, unsigned requests fall back to the owner, and owner actions go through `ownerFetch` with a single `GS_OWNER_KEY`. The new design replaces the shared owner key with per-user sessions (OAuth) for people and per-user bot tokens for Garry, adds leases and states, and makes the webhook a payload-free doorbell.

### GARRY.md changes needed (describe only; do not edit in this PR)
- Drop identify, price and draft from Garry's job list; those run in the app.
- Replace the worker steps with claim, heartbeat, complete or fail against the endpoints above, and stop if `claimed` is false.
- Add self-registration of the webhook using the env var instead of asking the person to copy the key.
- Add the fallback catch-up routine.
- Never act on a Facebook job without the app's recorded approval.

## Auth and onboarding

Adam wants OAuth sign-in, not a magic link as the only way into the app.

### Is there a public "Sign in with Grok"?

**Not as a third-party identity provider for a site like garagesale.run.** I did not find official xAI docs that let a third-party website register an OAuth client and offer "Sign in with Grok" the way you offer Sign in with X or Google.

What does exist, and should not be confused with that:

- `auth.x.ai` is documented as OAuth2/OIDC for **Grok Build CLI login** (`grok login`), so a person can use their Grok subscription in the official CLI. Source: [Grok Build enterprise authentication](https://docs.x.ai/build/enterprise).
- Grok Bot has a "Sign in with Grok" choice when access comes from a self-serve Grok Business seat. That is sign-in to Grok Bot itself, not a login button for other products. Source: [Grok Bot get started](https://docs.x.ai/grok-bot/get-started).
- Some third-party tools advertise "Sign in with Grok" by reusing the official Grok CLI's public client id to mint API tokens. That is not a documented program for site identity, and Garage Sale should not use it.

xAI may add a real third-party "Sign in with Grok" later. Until it is documented as a product we can register an app for, treat it as unavailable.

### Recommendation

Use **Sign in with X (X OAuth 2.0)** as the primary button, and **Google** as a backup, through **Auth.js (NextAuth)** on the existing Next.js 14 app in `web/`.

- Auth.js Twitter/X provider, OAuth 2.0 by default: [Auth.js Twitter/X](https://authjs.dev/getting-started/providers/twitter). Callback path `/api/auth/callback/twitter`. Env names `AUTH_TWITTER_ID` and `AUTH_TWITTER_SECRET` (put these only in Vercel, never in the repo). Note: X OAuth 2.0 does not return email by default.
- Auth.js also has a Google provider for the backup button.
- Register the X app in the X Developer Portal and the Google client in Google Cloud, with exact callback URLs for production and local dev.
- Replace the current HMAC `gs_session` cookie (`web/lib/accounts.js:33-48, 166-176`) with an Auth.js session that maps to the same `accounts/<id>.json` record. Do not derive a session secret from `GST_WORKER_KEY`.

The 10-minute Garry sign-in link can stay as a **pairing** step (see below), not as the only way to come back tomorrow.

### How the Garry bot token links to the OAuth account

One Garage Sale account, two credentials:

- The **person** signs in with X or Google. The account record stores `auth.x` and/or `auth.google` (provider user id and handle or email). That is the durable login.
- **Garry** still holds a `garry_key`, shown once, stored only as a hash, sent as `x-garry-key`. That already maps `account-keys/<sha(key)>` to `account_id` (`web/lib/accounts.js:126-129`). After the change, that `account_id` is the same record as the OAuth user.

Linking, two entry paths:

1. **Site first (default for a new visitor).** The person presses Sign in with X on `/connect`. That creates or resumes their account and sets the browser session. The app then shows Install Garry plus a short one-time pairing code (or a "Connect Garry" action that mints one). Garry registers with that code and is attached to the existing account. It does not create a second account.
2. **Garry first (the onboarding script below).** The person installs Garry and talks to it first. Garry creates a pending account and sends a one-tap link. The link signs that browser in, then the app immediately asks them to add Sign in with X (or Google) so they can return without the link. If that X user already has an account, do not silently merge: stop and ask (open question).

Rules:

- One X account maps to at most one Garage Sale account. One Garage Sale account has at most one active `garry_key`.
- A signed-in person can revoke a lost Garry and pair a new one. The old key stops working.
- A `garry_key` never signs a browser in as someone else, and never unlocks another account's jobs.
- Garry still never prints its key or puts it in a URL (`docs/GARRY.md:23` stays).

### Onboarding script that Garry runs

Do the work in the bot. The person should only do what only they can do: press Sign in, sign in to Facebook in Garry's browser, and answer the three profile questions. Rewrite `docs/GARRY.md` to this script once the endpoints exist.

1. **Create the account and send a one-tap sign-in link.** If the person already has a pairing code from the site, attach to that account instead of opening a second one. The link should land on a page that also offers Sign in with X, so the OAuth account and this Garry are bound in one sitting.
2. **Self-register the worker webhook URL and key** with the app (`POST /api/garry/webhook`, as today). Read the routine's webhook values if the bot can; only ask the person if it cannot. No schedule on that routine.
3. **Open Facebook in Garry's own browser, hand over the screen once** for the person to sign in, then verify they are signed in (for example, Marketplace loads as that person). Report `facebook.signed_in` to the app. Never ask for, type, read, or store the Facebook password.
4. **Ask three questions and save the answers to the profile:** ZIP or city, drive radius, and whether they mainly sell, buy, or both (and a line on what). New authenticated profile write, not a free-form memory in the bot.
5. **Run a first test sell from one photo in chat.** The photo goes to the app. The app identifies, prices, and drafts only. Nothing is posted. Garry may summarize the draft in chat, but the source of truth is the job page in the app.
6. **Show the approve/skip controls and confirm the app shows Garry online** (webhook set, Facebook signed in, last seen). Approve on the test sell is skippable; skip must not enqueue `post_listing`.

Until steps 3 and 2 are done, the app should not offer Approve & post.

---

## Mobile

People will try this on a phone first. Do not wait on a store binary to make that usable.

PR #54 already specified an installable PWA as item 8 in `docs/RESELL-SPEC.md` (branch `cursor/resell-spec-a192`, not on `main`). That item is the starting point. Its user story: the person can install the site on their phone from the browser; a native App Store or Play Store app waits until there is demand. Its checks: add a web app manifest and a service worker so the browser can offer install; install does not weaken the hard rules (an installed icon still cannot publish, bid, or pay without approval); offline, if offered, shows the last saved result or an honest empty state and does not invent a price. It also notes that `web/app/layout.js` already sets `viewport` (`themeColor`, `width`, `initialScale`, `viewportFit`), which is not a manifest, and that `main` has no `manifest.webmanifest` and no service worker. Those gaps are still true on `main` at `26a819d`. The spec's open questions on icon files and offline pricing still apply. Stripe and accounts have landed since that draft, but the PWA item has not.

### Phase 1: PWA (now)

Build this as part of the multi-user MVP, once auth exists so push has an account to target.

- **Manifest and icons.** Add a web app manifest (name, start URL, display `standalone`, theme color, icon set). Today `web/` has `web/app/icon.svg`, `web/app/apple-icon.png`, and `web/app/favicon.ico`, plus hero and example photos in `web/public/`. That is not an install icon set. PR #54 already asked which icon file to use; design or export a small set (at least 192 and 512, plus an Apple touch icon) rather than reusing a listing photo.
- **Service worker for the offline shell.** Cache the app shell (chrome, signed-out or signed-in empty states, core CSS and JS). Network-first for jobs, deals, and inbox. If the network is down, show the last saved result or an honest "you're offline" state. Do not invent a price or a draft while offline, which is the same rule as PR #54 item 8.
- **Camera-first sell.** The sell page already uses a camera capture input and a separate multi-photo picker (`web/app/page.js:194-199`: `<input type="file" accept="image/*" capture="environment">` for "Take photo," and `multiple` for "Attach photos," up to 30 files in `sell()`). Keep that as the phone path. After the auth gate, the same inputs must refuse to upload until the user is signed in, then create jobs on that account. Tighten the camera-first layout for a standalone PWA (full-width shutter, clear multi-photo).
- **iOS Add to Home Screen prompt copy.** iOS will not show a native install banner the way Chrome does. Add a short, dismissible in-app tip (Safari share sheet, then Add to Home Screen) when the user is on iPhone Safari and is not already in standalone mode. Do not nag every visit.
- **Web push for Garry events.** When the app records a new buyer message, or when a listing draft is ready to approve, send a web push: "New buyer message" or "Approve this post." Subscribe only after sign-in, with a clear permission prompt. iOS supports web push for Home Screen web apps from iOS 16.4 on; document that the user must add the app to the Home Screen and allow notifications. Store subscriptions per account. Send the push from the app when Garry writes results back, not from the bot itself.

### Phase 2: Capacitor wrapper for the App Store

When there is demand for a store listing, wrap the same Next.js app with Capacitor. Reuse the web screens and APIs. Add the native camera, native push, and the share sheet (for a listing link or a later share card). This is the "native app waits until there is demand" step from PR #54 item 8. It is not in the first multi-user build. Do not start store listings, store review prompts, or a second product UI in Phase 1.

---

## Build order

Do not merge or deploy any of these until Adam says yes. Each can be its own PR. Stop the leak before you rebuild Garry.

1. **Auth and gating.** Auth.js with Sign in with X and Google. Signed-out reads return empty or 401/404. Nav hides Dashboard and Messages. `POST /api/jobs` requires a session. Remove the public owner invite form and the owner-key prompt from `/connect`. Lock CORS down.
2. **Per-user scoping.** Every jobs, deals, batches, and inbox read is filtered by the signed-in account. `GET /api/jobs/:id` is not public. Private blobs for account and job JSON. Owner-less historical jobs stay out of everyone else's feeds (hide, or migrate only Adam's into his OAuth account, after he chooses).
3. **Empty states.** Signed-out `/dashboard`, `/conversations`, `/sell`, and `/buy` are clean: sign-in or labeled examples, never owner data. Signed-in empty states tell you to snap a photo, run a search, or connect Garry, not "no messages" on top of someone else's count.
4. **Sell in the app.** Photo, identify, price, and draft run in the app. Approve & post enqueues `post_listing` only if Facebook is signed in. Camera-first inputs stay. Test jobs never bypass auth.
5. **Buy in the app.** Deal search uses the profile's ZIP or city, radius, and max price. Results are stored on that account. No global owner feed. A Marketplace-login scan, if needed, is an approved Garry job.
6. **Conversations.** Inbox is per-account. `sync_messages` and `send_reply` only after in-app approval. Landing copy matches the product.
7. **Garry connect.** Pairing code, onboarding script above, webhook self-register, Facebook handoff and verify, profile questions, test sell that does not post, "Garry online" in the app. Rewrite `docs/GARRY.md`.
8. **PWA (Mobile phase 1).** Manifest, icons, offline shell, iOS Home Screen copy, web push for approve and new messages. Capacitor stays phase 2.

---

## New-user test checklist

Run this in a fresh incognito window, and again on an iPhone, as a person who is not Adam. Use a second Garage Sale account. Do not post to Facebook, message a buyer or seller, or spend money unless Adam has said yes on that exact item.

**Leak checks (must pass before calling the site safe to show people):**

- [ ] Incognito `/` does not show the owner's live listings as if they were the visitor's. Example tiles, if any, are labeled.
- [ ] Incognito `/dashboard` has no owner totals, listings, deals, or "Austin flipper" card.
- [ ] Incognito `/conversations` has no buyer names, messages, offers, or listing strip. Messages badge is hidden or 0.
- [ ] Incognito `/sell` and `/buy` do not show the owner's live items or scouted deals unlabeled.
- [ ] Incognito `/connect` has no owner invite form and never prompts for an owner key.
- [ ] `GET /api/jobs?recent=1`, `GET /api/deals`, and `GET /api/jobs/<an owner id>` without a cookie do not return owner data or inquiries.
- [ ] Signed-out "Take photo" / "Find deals" do not create a job and do not wake the owner webhook.

**Sign-in and pairing:**

- [ ] Sign in with X creates a session and shows the person's name, not "Austin flipper."
- [ ] Google sign-in works as a backup (if shipped in the same PR).
- [ ] A second browser can sign in with the same X account and see the same jobs.
- [ ] Installing Garry and pairing it attaches to this account, not a second one.
- [ ] Revoking Garry and pairing a new one retires the old key.

**Onboarding script:**

- [ ] Garry sends a one-tap link (or uses the pairing code) and does not print its `garry_key`.
- [ ] Webhook registers without the person having to understand it, or asks once for the two webhook values.
- [ ] Facebook: Garry hands over the screen once, the person signs in, Garry verifies, the app shows Facebook connected. Password never appears in chat or logs.
- [ ] ZIP or city, drive radius, and sell/buy focus are saved to the profile and visible in the app.
- [ ] A test photo in chat produces a draft and a price in the app, and does not post.
- [ ] Approve/skip are visible. Skip does not enqueue `post_listing`. The app shows Garry online.

**Sell, buy, conversations (signed in, second account):**

- [ ] A photo on `/sell` becomes this account's job, with identify, price, and draft from the app.
- [ ] Approve & post is disabled until Facebook is connected. With Adam's yes on a specific test item, `post_listing` posts from the tester's Facebook, not Adam's, and the listing URL comes back.
- [ ] A buy search uses the tester's ZIP or city and does not return the owner's deal feed.
- [ ] `/conversations` is empty until this account has messages. An approved sync writes new messages into the app. An approved send matches the approved text only.

**Mobile:**

- [ ] On Android Chrome, the browser can install the PWA. Icons and the standalone shell look correct.
- [ ] On iPhone Safari, the Add to Home Screen copy appears once and is accurate. After install, the app opens standalone.
- [ ] "Take photo" opens the rear camera. Multi-photo attach still works. A signed-out phone cannot upload.
- [ ] Offline, the shell loads and does not invent a price.
- [ ] After permission, a new buyer message or an "approve this post" event delivers a web push on a Home Screen install (iOS 16.4 or later for iPhone).

**Owner safety:**

- [ ] Adam's existing owner jobs are not visible to the tester.
- [ ] The tester cannot prompt or guess their way into the owner key.

---

## Open questions for Adam

1. **Identify, price, and draft compute.** Once that work leaves Garry, who pays? A Garage Sale xAI key (app bill), or some other path that still uses the person's plan? This is the cost question behind "maybe we can make their Garry work in terms of the compute cost."
2. **Marketplace scan job.** Deal search runs in the app, and Garry scans Marketplace only when a logged-in session is needed. Is that a fourth approved job type (for example `scan_marketplace`), or should buy stay app-only until a later phase?
3. **`sync_messages` permission.** Is it a manual "Check messages" each time, a per-listing toggle, or a one-time "watch my inbox" approval?
4. **Who drafts buyer replies?** The architecture says the inbox lives in the app, so the app should draft. Confirm Garry only delivers and sends.
5. **When is Garry required?** Can a person sign in with X, snap a photo, and get a draft before installing Garry, with Garry needed only for Facebook post and inbox? That matches "the app is the product."
6. **Sign in with X only, or Google on day one?** X OAuth 2.0 does not return email by default. Is a handle enough, or do we need Google (or an email) for support and receipts?
7. **If xAI later ships a real third-party "Sign in with Grok,"** should we add it as a third button, or stay on X and Google?
8. **Account collisions.** If someone starts in Garry (pending account plus link) and then signs in with an X user that already has a Garage Sale account, do we ask them to choose, or always prefer the OAuth account?
9. **Adam's existing owner jobs and the global deals feed.** Hide them from everyone else, migrate them into Adam's OAuth account, or delete them from the public indexes? The leak cannot be called fixed while `jobs-index/` is the signed-out default, even if we only "hide" them later.
10. **Test-sell photo in chat.** After the architecture change, Garry should send the photo to the app and the app should draft. Confirm it should not post, even if the person says "looks good" in chat. Posting stays on the Approve & post button in the app.
11. **PWA now, Capacitor when?** Phase 1 (manifest, icons, offline shell, iOS Home Screen copy, web push) is in this MVP. Confirm Capacitor / App Store waits until there is demand, as in [PR #54](https://github.com/adamtpang/garagesale.run/pull/54) item 8, and that we should not start a store listing in this work.
12. **App icon.** PR #54 left the icon file open. Today there is `web/app/icon.svg` and `web/app/apple-icon.png`, but no install set. Does Adam want a new mark, or should Fable derive a set from the existing "G" logo?

---

## Out of scope for this PR

- Merging or deploying.
- Code changes. This branch is the handoff only.
- Publishing or re-teaching the Garry template before `docs/GARRY.md` is rewritten and the queue exists.
- Native App Store or Play Store listings, Capacitor, or store review prompts.
- Refunds, a receipt page, or other billing work beyond what already shipped in PR #64.
