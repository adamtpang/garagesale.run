# Design language: Price Tag

Decided Nov 15, 2026. Adam picked Price Tag from four options, then asked the same day for white as the main color and red as the accent. The first version used a poster-yellow page, and he found it ugly.

## The project

- **Subject:** a tool for finding cheap used stuff and flipping it.
- **Audience:** Adam, checking deals on a phone or laptop.
- **Primary job:** see at a glance whether a lot or listing is worth buying.

Shape: an app. About nine kinds of widget (buttons, inputs, tabs, badges, cards, a table, a select, progress, avatars), two data boards, one marketing page, no long reading.

## Decision

- **Component library:** keep shadcn/ui. It was already installed, and every color, corner and font goes through tokens. No library was added.
- **Design language:** Price Tag, in white and red.

## Where it comes from

- A white price sticker with a red hand-written number.
- A yard-sale sign: black marker outlines, nothing subtle.
- A cardboard box flap: hard edges and hard shadows, nothing soft.

## Rules

Each one can be checked on a screenshot.

1. The page is white. Cards are white too, and are told apart by their border and shadow, not by a fill.
2. Every card, button, input and chip has a 2px ink border. No hairlines, no translucent borders.
3. Raised things (cards, buttons) cast a hard 4px offset shadow in ink. No blur, no glow.
4. Corners are tight: 8px on cards, 6px on controls and chips. Nothing is a pill.
5. Red is the only accent. It marks the main action on a screen, the active filter, and prices. Text on red is white.
6. Prices that matter are written in marker, in red. Everything else is DM Sans.
7. Status is a solid pastel fill plus a word (green sold, amber waiting, red problem). Color is never the only cue.

## Tokens

Source of truth: `web/app/shadcn.css` (shadcn tokens) and the first line of `web/app/globals.css` (older pages).

| Layer | Token | Value | May change? |
| --- | --- | --- | --- |
| Neutral | background, card | `#ffffff` | No |
| Neutral | foreground, border | `#141414` marker ink | No |
| Neutral | secondary | `#f5f5f4` quiet gray | No |
| Neutral | muted text | `#545454` | No |
| Semantic | success | `#0b7a3b`, chip fill `#9be8b8` | No |
| Semantic | warning chip | `#ffd08a` | No |
| Semantic | danger chip | `#ffb4a8` | No |
| Brand | brand, price | `#dc2626` red | Yes, per season or event |
| Brand | link | `#b91c1c` darker red for small text | Yes, with brand |
| Brand | accent tint | `#fee2e2` hover and highlight | Yes, with brand |

There is one theme. Dark mode was removed on purpose.

## Type

- **DM Sans** carries names, labels, text and figures. It is friendly and reads well small.
- **Permanent Marker** is only for headline prices, like a hand-written sticker. Never for sentences.

Both load through `next/font/google` in `web/app/layout.js`.

## Signature element

The marker price. Use the `font-marker text-price` classes (or `.price-tag` on older pages). Keep it to the one or two prices that matter on a screen.

## Icons

`web/app/icon.svg`, `favicon.ico` and `apple-icon.png` are a white price tag on a red tile. They are drawn from the same shape, so change all three together.

## How it was built

- Tokens and Tailwind scale: `web/app/shadcn.css`, `web/tailwind.config.js` (2px default border, small radii, `shadow-tag`).
- Nine shared components in `web/components/ui/`.
- The older stylesheet `web/app/globals.css` was recolored in place, with Price Tag blocks at the end.
- The garage illustration was recolored from night to day.

## Sweep, Nov 15, 2026

A pass over every page, using the review order from the adapted ai-design-skills policy in `shapeable.art/reference/ai-design-skills-adoption.md`: broken tasks first, then unclear actions, then evidence, then hierarchy and mobile, then feedback states.

Fixed:

- The inactive Buy or Sell tab had no visible label.
- The deal page showed an empty bordered strip when a deal had no photo.
- A photo that failed to load left a blank white hole. It is a gray well with the item's first letter now.
- The job stepper wrapped into two uneven rows. It is one row on desktop and two even rows on a phone.
- The home page showed three-week-old deals tagged "Real". Deals older than 7 days are not shown as real. Labeled examples show instead.
- Buy-result cards were too narrow to read the buy and sell prices.
- The approve form's price box had no label, and its pickup fields were cut off at 170px.
- The phone approve bar was a dark glass strip.
- The dashboard opened with five "not stored" tiles and a repeated warning. It is one notice now when no rule is stored.
- Dashboard rows repeated up to six sentences of explanation. Each row shows the first one, and the others open from an "N more" toggle.

Fixed in a follow-up the same day:

- The About link dropped off the nav on phones. Under 600px the six links now sit on their own row under the logo.
- The agent log on a job page was long and technical. It is a fold that starts closed once the job is done.
- Old scout-feed photos were dead links, because Facebook image links expire. A feed write now keeps one copy of each photo in Blob storage (`web/lib/dealPhotos.js`). Photos on deals stored before this cannot be recovered.

## Checked

- Every page at 1280px and 390px wide, with a script that measures text contrast and looks for leftover dark surfaces: home, buy, sell, dashboard, surplus, messages, about, ledger, a live sell job, a job awaiting approval, a buy job, and a deal.
- All text passes 4.5:1 (3:1 for large text). No sideways scroll at phone width.
- Screenshots are in `docs/design/`.
- Not checked by eye: the batch page with real data, and the messages page with a real buyer thread.

## Options considered

| Option | Verdict |
| --- | --- |
| Midnight (the old look) | Polished, but looked like any dark app. |
| Price Tag on poster yellow | Built first. Adam found it ugly on the real site. |
| Lot Ticket (auction receipt) | Best for dense numbers. Adam found Price Tag more fun. |
| Trading Desk (price board) | Good for scanning. Too close to the old look. |
| neobrutalism.dev components | MIT licensed (checked Nov 15, 2026), but the author has posted that he stopped working on it. The style was copied by hand instead of adding the dependency. |

## Revisit when

- The site gets real outside users.
- A dark mode is asked for.
- The board grows past what a card layout can show and needs a denser table style.
