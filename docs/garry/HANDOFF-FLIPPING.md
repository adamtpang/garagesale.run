# Handoff to Flipping: build the Garry bot

From Claude Code, Nov 25, 2026. For Flipping, Adam's Grok Bot. Adam asked for this in chat.

## What changed since you last worked here

- garagesale.run was rolled back to the hackathon version (snap a photo, price it, post to Facebook Marketplace). The Market tier list, surplus scans and the old worker API are saved on the branch `flipping-market` and are **not live**.
- These routes no longer exist: `/api/surplus`, `/api/feed`, `/api/worker/check`, `/api/drive/refresh`, `/api/scout/config`, `/api/bankroll`. `docs/FLIPPING-DAILY.md` and `docs/WORKER-API.md` are gone from `main` too.
- The site now has accounts. Each person brings their own Grok Bot, named **Garry**, which signs them in and posts from their own Facebook.

## Your job

Build one new bot named **Garry** from the files in this repo, so Adam can test it and publish it as a template. You are building the bot. You are not using it, testing it or publishing it.

Read these two files first, from `main`:

1. `https://raw.githubusercontent.com/adamtpang/garagesale.run/main/docs/GARRY.md`: Garry's full instructions.
2. `https://raw.githubusercontent.com/adamtpang/garagesale.run/main/docs/garry/SETUP.md`: Adam's build, test and publish guide. Part 1 is the part you are doing.

## Steps

1. **Create a new bot.**
   - Name: `Garry`
   - Description: `Garry sells your stuff. Snap a photo on garagesale.run and Garry identifies it, finds real prices, drafts the listing, and posts it from your own Facebook Marketplace once you approve.`
2. **Instructions.** Set Garry's instructions to the full text of `docs/GARRY.md`, word for word. Don't summarize it, shorten it or add to it. If it won't fit, stop and tell Adam how much fits.
3. **Worker routine.** Give Garry one routine:
   - Name: `Garage Sale worker`
   - Trigger: **webhook only. No schedule.** Every scheduled run spends usage.
   - Prompt: `The request body has job_id, kind, event, key and payload. Follow "The worker routine" and "The work, by event" in your instructions for that one job. Claim it first, and stop if claimed is false.`
4. **Computer and browser.** Make sure Garry has its own computer with a browser. It needs one to sign in to Facebook and to post.
5. **Keep it clean.** Garry must start with no secrets, no memories and no files from you or from Adam: no worker key, no ledger key, no Facebook session, nothing from your own chats. Each person's Garry registers for its own key. A template copies a bot's memories, so anything you leave in Garry goes to every tester.
6. **Check your own routines.** List any routine of yours that still calls a garagesale.run route from the "no longer exist" list above. Don't change them. Tell Adam which ones they are and ask whether to pause them.

## Do not

- Do not publish Garry, share it, or create a template link. Adam does that after he tests it.
- Do not register Garry with garagesale.run, make an invite, or ask Adam for the owner key.
- Do not run Garry's onboarding or its routine.
- Do not sign Garry's browser in to any Facebook account.
- Do not put any key, token or password in Garry, in a chat or in a file.
- Do not edit this repo. If something in `docs/GARRY.md` looks wrong or can't be done in Grok Bot, say so in your report and leave the file alone.

## Report back to Adam

One short message:

- **Built:** the bot's name, that the instructions are the full `docs/GARRY.md` (and its length), the routine's name and trigger, and whether it has a computer and browser.
- **Could not do:** anything Grok Bot would not let you do, in its own words.
- **Answers to three questions Claude could not check from outside Grok Bot:**
  1. Can a bot read its own routine's webhook URL and key, or must a person copy them from the routine's Webhook section?
  2. When a routine runs from a webhook, how does it see the request body (`job_id`, `kind`, `event`, `key`, `payload`)?
  3. Does a template copy keep a routine's webhook trigger, and does each copy get its own URL and key?
- **Your old routines:** the ones that call routes that no longer exist.

Adam then does Part 2 (test on himself) and Part 3 (publish) of `docs/garry/SETUP.md`.
