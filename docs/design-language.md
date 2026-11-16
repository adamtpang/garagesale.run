# Design language: Price Tag

Decided Nov 15, 2026. Adam picked it from four options shown on the real Zebra lot card.

## The project

- **Subject:** a tool for finding cheap used stuff and flipping it.
- **Audience:** Adam, checking deals on a phone or laptop.
- **Primary job:** see at a glance whether a lot or listing is worth buying.

Shape: an app. About nine kinds of widget (buttons, inputs, tabs, badges, cards, a table, a select, progress, avatars), two data boards, one marketing page, no long reading.

## Decision

- **Component library:** keep shadcn/ui. It was already installed, and every color, corner and font goes through tokens. No library was added.
- **Design language:** Price Tag.

## Where it comes from

- A neon poster-board yard-sale sign: flat yellow, black marker outlines.
- A price sticker: a hand-written number, slightly off-square.
- A cardboard box flap: hard edges and hard shadows, nothing soft.

## Rules

Each one can be checked on a screenshot.

1. The page is poster-board yellow. Content sits on paper-white cards. Body text never sits on orange.
2. Every card, button, input and chip has a 2px ink border. No hairlines, no translucent borders.
3. Raised things (cards, buttons) cast a hard 4px offset shadow in ink. No blur, no glow.
4. Corners are tight: 8px on cards, 6px on controls and chips. Nothing is a pill.
5. Prices that matter are written in marker, in sticker red. Everything else is DM Sans.
6. Status is a solid fill plus a word (green sold, amber waiting, red problem). Color is never the only cue.

## Tokens

Source of truth: `web/app/shadcn.css` (shadcn tokens) and the `:root` line of `web/app/globals.css` (older pages).

| Layer | Token | Value | May change? |
| --- | --- | --- | --- |
| Neutral | background | `#ffd84a` poster yellow | No |
| Neutral | card | `#fffdf6` paper | No |
| Neutral | foreground, border | `#141414` marker ink | No |
| Neutral | secondary | `#fff2c2` pale yellow | No |
| Semantic | success | `#0b7a3b`, chip fill `#9be8b8` | No |
| Semantic | warning chip | `#ffd08a` | No |
| Semantic | danger | `#d6321a`, chip fill `#ffb4a8` | No |
| Brand | brand | `#ff5a36` sticker orange | Yes, per season or event |
| Brand | price | `#d6321a` | Yes, with brand |
| Brand | link | `#a52a14` | Yes, with brand |

There is one theme. Dark mode was removed on purpose: a yard-sale sign has no night version.

## Type

- **DM Sans** carries names, labels, text and figures. It is friendly and reads well small.
- **Permanent Marker** is only for headline prices, like a hand-written sticker. Never for sentences.

Both load through `next/font/google` in `web/app/layout.js`.

## Signature element

The marker price. Use the `font-marker text-price` classes (or `.price-tag` on older pages). Keep it to the one or two prices that matter on a screen.

## How it was built

- Tokens and Tailwind scale: `web/app/shadcn.css`, `web/tailwind.config.js` (2px default border, small radii, `shadow-tag`).
- Nine shared components in `web/components/ui/`.
- The older stylesheet `web/app/globals.css` was recolored in place, with a Price Tag block at the end.
- The garage illustration was recolored from night to day.

## Checked

- Every page at 1280px and 390px wide, with a script that measures text contrast and looks for leftover dark surfaces: home, buy, sell, dashboard, surplus, messages, about, ledger, a live sell job, a job awaiting approval, a buy job, and a deal.
- All text passes 4.5:1 (3:1 for large text). No sideways scroll at phone width.
- Screenshots are in `docs/design/`.
- Not checked by eye: the batch page with real data, and the messages page with a real buyer thread.

## Options considered

| Option | Verdict |
| --- | --- |
| Midnight (the old look) | Polished, but looked like any dark app. |
| Lot Ticket (auction receipt) | Best for dense numbers. Adam found Price Tag more fun. |
| Trading Desk (price board) | Good for scanning. Too close to the old look. |
| neobrutalism.dev components | MIT licensed (checked Nov 15, 2026), but the author has posted that he stopped working on it. The style was copied by hand instead of adding the dependency. |

## Revisit when

- The site gets real outside users and yellow tests badly with them.
- A dark mode is asked for.
- The board grows past what a card layout can show and needs a denser table style.
