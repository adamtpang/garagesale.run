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
   > Set up a routine named "Garage Sale worker" with a webhook trigger and no schedule. When it runs, the request body has job_id, kind, event and payload. Follow "The worker routine" and "The work, by event" in your instructions for that job.
5. **Check the routine has no schedule.** A scheduled run spends usage every time. The webhook is the only trigger.
6. **Give Garry a computer and browser** if it doesn't have one. It needs its own browser to sign in to Facebook and to post.

## Part 2: test it on yourself (about 15 minutes)

Use a second Garage Sale account for this, so your own items stay separate.

1. Open `https://garagesale.run/connect`, expand **For the owner**, and press **Make an invite code**. Paste your owner key when asked.
2. In Garry's chat, say: `Set me up on Garage Sale. My invite code is inv-...`
3. Follow Garry through the steps. Watch for each of these:
   - It registers and saves `GARRY_KEY` as a secret, without printing it.
   - It asks you for the routine's **POST to** and **key**, and reports the webhook is set.
   - It sends a sign-in link. Open it and press **Sign in**. The nav should show your name.
   - It asks you to sign in to Facebook in its browser.
4. Open `garagesale.run/sell` while signed in and take a photo of one item.
5. **What should happen:** within about a minute the job page shows Garry identifying, pricing and drafting. Then it stops at "Your approval".
6. Press **Approve & post**. Garry should post the listing from the Facebook account in its browser and mark the job live.

If the job never moves after two minutes, tell Garry: `check Garage Sale`. That makes it read `/api/pending` and pick up anything that has waited over two minutes. If that works but the automatic wake-up didn't, the webhook values were wrong: redo step 4 of Garry's onboarding.

**Fix the instructions as you go.** This is the first time a real Grok Bot has followed them. Change `docs/GARRY.md` by pull request and paste the new version into the bot.

## Part 3: publish the template

1. Click Garry's name at the top of the chat to open its details. Choose **Share**, then **Create a copy**. Garry builds a template and posts it in the chat.
2. **Before publishing, check the template has no secrets and no personal details**: no `GARRY_KEY`, no webhook key, nothing from your own test run in its memories.
3. Choose **Publish** on the template card, then **Copy link**. A new template link is public: anyone with it can add their own Garry.
4. Send beta testers two things: the template link, and an invite code from `garagesale.run/connect`.

To change Garry later, edit the bot, then use **Share**, **Update template** to push the change to the shared copy.

## Not checked from outside Grok Bot

- Whether an installed copy's routine keeps its webhook trigger and gets its own **POST to** and **key**. The docs say templates include routines, but not this detail. If a copy arrives without the trigger, Garry's onboarding step 4 tells it to add one.
- Whether a bot can read its own routine's webhook values. The guide assumes it can't, and asks the person to copy them.
- How the routine receives the request body. The prompt above assumes it can read `job_id`, `kind`, `event` and `payload` from it, as your hackathon worker did.

## What each tester costs you

Nothing on Vercel beyond normal traffic: there's no build per tester. Each tester's Garry runs on their own Grok Bot usage, not yours.
