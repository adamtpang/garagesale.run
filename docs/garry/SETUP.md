# Building and publishing Garry

For Adam. How to build the Garry bot in Grok Bot once, test it on yourself, and publish it as a template that anyone can install. Written Nov 25, 2026 from the Grok Bot docs. Where a step couldn't be checked from outside Grok Bot, it says so.

## What a template carries

A Grok Bot template is a recipe, not a clone. It packages the bot's instructions, skills, routines and plugins. Each person who installs it gets their own copy on their own account.

It does **not** carry your secrets. That's what we want: every Garry registers for its own key with its person's invite code.

## Part 1: build Garry (about 10 minutes)

1. **Create a new bot** in Grok Bot. Name it `Garry`.
2. **Description** (shows on the template page):
   > Garry sells your stuff. Snap a photo on garagesale.run and Garry identifies it, finds real prices, drafts the listing, and posts it from your own Facebook Marketplace once you approve.
3. **Instructions.** Paste the whole of `docs/GARRY.md` as the bot's instructions. Copy it from:
   `https://raw.githubusercontent.com/adamtpang/garagesale.run/main/docs/GARRY.md`
4. **The worker routine.** In Garry's chat, send:
   > Set up a routine named "Garage Sale worker" with a webhook trigger and no schedule. When it runs, the request body has job_id, kind, event, key and payload. Follow "The worker routine" and "The work, by event" in your instructions for that job.
5. **Check the routine has no schedule.** A scheduled run spends usage every time. The webhook is the only trigger.
6. **Give Garry a computer and browser** if it doesn't have one. It needs its own browser to sign in to Facebook and to post.

## Part 2: test it on yourself (about 15 minutes)

Use a second Garage Sale account for this, so your own items stay separate.

1. In Garry's chat, say: `Set me up on Garage Sale.` You don't need an invite code. Garry registers itself while beta seats are open (25 by default; set `GS_BETA_SEATS` in Vercel to change it, or `0` to require invites).
2. Garry's first message should already have your sign-in link. Watch for each of these:
   - It registered and saved `GARRY_KEY` as a secret, without printing it and without asking you for anything.
   - It connected its worker routine on its own, or asked once for the routine's **POST to** and **key**.
   - Opening the link and pressing **Sign in** signs you in. The nav should show your name.
   - It asks you to sign in to Facebook in its browser.
3. Ask Garry: `Are you fully set up?` It should check `/api/garry/me` and Facebook, and fix anything missing.
4. Open `garagesale.run/sell` while signed in and take a photo of one item.
5. **What should happen:** within about a minute the job page shows Garry identifying, pricing and drafting. Then it stops at "Your approval".
6. Press **Approve & post**. Garry should post the listing from the Facebook account in its browser and mark the job live.

If the job never moves after two minutes, tell Garry: `check Garage Sale`. That makes it read `/api/pending` and pick up anything that has waited over two minutes. It also reads `/api/stalled`, which lists work a run claimed over ten minutes ago and never finished, and checks Facebook before redoing any of it. If that works but the automatic wake-up didn't, the webhook values were wrong: redo step 4 of Garry's onboarding.

**Fix the instructions as you go.** This is the first time a real Grok Bot has followed them. Change `docs/GARRY.md` by pull request and paste the new version into the bot.

## Part 3: publish the template

1. Click Garry's name at the top of the chat to open its details. Choose **Share**, then **Create a copy**. Garry builds a template and posts it in the chat.
2. **Before publishing, check the template has no secrets and no personal details**: no `GARRY_KEY`, no webhook key, nothing from your own test run in its memories.
3. Choose **Publish** on the template card, then **Copy link**. A new template link is public: anyone with it can add their own Garry.
4. Send beta testers the template link: `https://x.ai/bot/TWS8hV9MoECMV1-JApMox`. That's all they need. The same link is the **Install Garry** button on `garagesale.run/connect` (it lives in `web/lib/garry.js`; change it there if you republish). An invite code from `garagesale.run/connect` is only for reserving a spot once the open seats are full.

To change Garry later, edit the bot, then use **Share**, **Update template** to push the change to the shared copy.

## Not checked from outside Grok Bot

- Whether an installed copy's routine keeps its webhook trigger and gets its own **POST to** and **key**. The docs say templates include routines, but not this detail. If a copy arrives without the trigger, Garry's onboarding step 4 tells it to add one.
- Whether a bot can read its own routine's webhook values. The guide assumes it can't, and asks the person to copy them.
- How the routine receives the request body. The prompt above assumes it can read `job_id`, `kind`, `event` and `payload` from it, as your hackathon worker did.

## What each tester costs you

Nothing on Vercel beyond normal traffic: there's no build per tester. Each tester's Garry runs on their own Grok Bot usage, not yours.

## Changing Garry on the fly

Garry reads `docs/GARRY.md` from `main` at the start of every chat and every routine run, and the newest version wins. So to change how every Garry behaves:

1. Edit `docs/GARRY.md` and merge it. It's docs only, so there's no paid build.
2. Every installed Garry picks the change up on its next chat or run. Nobody reinstalls anything.

Two cautions. Anyone who can merge to `main` can change what every tester's Garry does, so keep that to you. And a bot built before this section existed needs one nudge: tell it "Re-read your instructions from the link in your Stay current section", or paste the new `docs/GARRY.md` into it once.

## Taking payment (Stripe)

After 10 free items, an account buys 100 more for $10. The numbers live in `web/lib/pack.js`. Until both keys below are set in Vercel, the **Buy 100 items for $10** button answers "Paying isn't switched on yet." and nothing can be charged.

You do these yourself. Keys go into Vercel only: never into a chat, a file in this repo, or Garry.

1. **Try it in test mode first.** In the Stripe dashboard, switch to a sandbox (test mode).
2. **Add the webhook.** Developers, Webhooks, Add destination:
   - Endpoint URL: `https://garagesale.run/api/billing/webhook`
   - Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
   - Copy the signing secret (starts with `whsec_`).
3. **Add two variables in Vercel**, project `garagesale.run`, Production:
   - `STRIPE_SECRET_KEY`: the secret key (starts with `sk_test_` in test mode)
   - `STRIPE_WEBHOOK_SECRET`: the signing secret from step 2
4. **Redeploy** so the site picks them up.
5. **Test.** Signed in as a test account with its free items used, press **Buy 100 items for $10** and pay with Stripe's test card `4242 4242 4242 4242`, any future date, any code. Within a minute `garagesale.run/connect` should show 100 paid items.
6. **Go live.** Repeat steps 2 to 4 in live mode with the live key (`sk_live_`) and the live webhook's signing secret.

What it does not do yet: refunds do not take items back, and there is no receipt page beyond Stripe's own email.
