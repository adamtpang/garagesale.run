# Design language

The site uses the look from before the Nov 15, 2026 Price Tag reskin: a black page, system type, blue accent, green for money that came out ahead, soft cards. Adam judged the white-and-red reskin worse than that earlier build, so the reskin's palette, type, hard borders and offset shadows are gone. Later screens (Market, Targets, Selling, bankroll, ledger) keep their information and use this look.

Price Tag (white paper, marker-red prices, 2px ink borders, hard offset shadows, DM Sans and Permanent Marker) was the look from Nov 15 until this restore. It is not the current design.

## The project

- **Subject:** a tool for finding cheap used stuff and flipping it.
- **Audience:** Adam, checking deals on a phone or laptop.
- **Primary job:** see at a glance whether a lot or listing is worth buying.

Shape: an app. About nine kinds of widget (buttons, inputs, tabs, badges, cards, a table, a select, progress, avatars), two data boards, one marketing page, no long reading.

## Decision

- **Component library:** keep shadcn/ui. It was already installed, and every color, corner and font goes through tokens. No library was added.
- **Design language:** the pre-reskin dark UI. Blue `#0866FF` for actions and links, green `#31d158` for profit, system type, 1px borders, soft shadows, pill controls.

## Rules

Each one can be checked on a screenshot.

1. The page is black. Cards are a slightly lifted gray (`#141416`), separated by a hairline, not by a heavy outline.
2. Borders are 1px and quiet. No 2px ink frames.
3. Raised cards use a soft shadow. No hard offset shadow.
4. Corners are generous. Primary controls and filter chips are pills.
5. Blue is the accent for the main action, the active filter, and links. Text on blue is white.
6. Type is the system face (SF Pro on Apple devices). Prices are the same face, bold. Profit figures are green. No marker font.
7. Status is a tinted chip plus a word (green buy or sold, amber watch, red skip). Color is never the only cue.

## Tokens

Source of truth: `web/app/shadcn.css` (shadcn tokens, including `.dark`) and the first line of `web/app/globals.css` (older pages).

| Layer | Token | Value |
| --- | --- | --- |
| Neutral | background | `#000000` |
| Neutral | card | `#141416` |
| Neutral | foreground | `#fafafa` |
| Neutral | muted text | `#b0b3b8` |
| Brand | brand, link | `#0866FF` / `#2b7fff` |
| Semantic | success, price | `#31d158` |
| Radius | cards | `0.9rem`, pills for controls |

## Type

System UI: `-apple-system`, SF Pro, Segoe UI, Helvetica, Arial. No webfont.

## Icons

`web/app/icon.svg`, `favicon.ico` and `apple-icon.png` are a white price-tag glyph on a blue tile, the mark from before the reskin.

## How the pages are built

- Tokens and Tailwind scale: `web/app/shadcn.css`, `web/tailwind.config.js`.
- Nine shared components in `web/components/ui/` use the pre-reskin button, card, and input styles.
- `web/app/globals.css` is the pre-reskin stylesheet, plus the phone nav and the folding agent log.
- The garage illustration is the night scene.

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

## Verdict first, Nov 16, 2026

Adam said the design was still off. The look was fine, the order was wrong: a lot card ran about 1,500px tall and the answer sat in a small chip.

Two rules were added. Both can be checked on a screenshot.

8. The verdict and the deciding numbers come first. A lot card opens with the verdict word, the reason, and one strip of four numbers: current bid, max bid, profit range, time left. The max bid is the bold figure.
9. No box inside a box. A card may hold an ink-line grid or a quiet gray well, never a second bordered card. Fine print and long lists sit behind a fold with a count or a plain name on it.

Changed:

- Surplus lot cards follow rule 8. Costs, resale and comps fold shut on skipped lots and open on the rest.
- The six rule tiles on Surplus and five on Deals are one strip each. The fine print and the trip list fold.
- Notices are a left-edge bar, not a full yellow card. Yellow cards are kept for a risk on a single lot.
- Filter names are capitalized the same way on both boards.
- The nav leads with Deals and Surplus, and the Deals link is named after its page.
- Buttons and inputs use the page font. They were falling back to the system font.

Screenshots are in `docs/screens/verdict-first/`. Not changed in this pass: home, buy, sell, ledger, messages, a job page.

## Deal cards, Nov 17, 2026

The Deals page is one card per deal, best profit first (`web/components/DealFeed.js`, words from `web/lib/dealCard.js`). It follows rule 8 one step further:

10. A deal card says the profit as a sentence: "You make about $153". The dollar figure is bold green, and it is the figure the card is built around. One line under it says what the number assumes.

Card order, top to bottom: label, title, profit sentence, the four costs (price, fees, gas, drive time), low, middle and high, why, main risk, links. On a phone the photo sits on top. From 768px it sits on the left.

Screenshots are in `docs/screens/deal-cards/`.

## Checked

- Every page at 1280px and 390px wide, with a script that measures text contrast and looks for leftover dark surfaces: home, buy, sell, dashboard, surplus, messages, about, ledger, a live sell job, a job awaiting approval, a buy job, and a deal.
- All text passes 4.5:1 (3:1 for large text). No sideways scroll at phone width.
- Screenshots are in `docs/design/`.
- Not checked by eye: the batch page with real data, and the messages page with a real buyer thread.

## Options considered

| Option | Verdict |
| --- | --- |
| Midnight (the old look) | Set aside on Nov 15. Restored after the white-and-red reskin looked worse. |
| Price Tag on poster yellow | Built first. Adam found it ugly on the real site. |
| Lot Ticket (auction receipt) | Best for dense numbers. Adam found Price Tag more fun. |
| Trading Desk (price board) | Good for scanning. Too close to the old look. |
| neobrutalism.dev components | MIT licensed (checked Nov 15, 2026), but the author has posted that he stopped working on it. The style was copied by hand instead of adding the dependency. |

## Revisit when

- The site gets real outside users.
- A dark mode is asked for.
- The board grows past what a card layout can show and needs a denser table style.
