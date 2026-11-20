import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { assessSnapshot } from '../lib/surplus.js';
import { buildDailyFeed } from '../lib/feed.js';
import { cardFor, sortCards, countdown } from '../lib/dealCard.js';
import { cleanDeal } from '../lib/decision.js';
import { withRules } from '../lib/scoutConfig.js';
import DealFeed from './DealFeed.js';
import { activeRules } from '../lib/rules.js';
// Adam's real rules with work time set to 0, so these tests keep checking how the numbers are shown.
// Work time is tested on its own in lib/workTime.test.mjs.
const NO_WORK = activeRules({ work_minutes_per_unit: 0 });

// These tests pin the comp math, so they read the scan without Adam's listing plan for the Zebra lot.
// lib/listingPlan.test.mjs covers the plan.
const seed = (({ lots, ...rest }) => ({ ...rest, lots: lots.map(({ listing_plan, ...lot }) => lot) }))(JSON.parse(fs.readFileSync(new URL('../config/surplus-scan-2026-11-15.json', import.meta.url), 'utf8')));
const NOW = Date.parse('2026-11-16T18:00:00.000Z');
const e = React.createElement;
const confirmed = () => { const c = withRules(null); c.fees = Object.fromEntries(Object.entries(c.fees).map(([k, v]) => [k, { ...v, confirmed: true }])); return c; };
const sold = (price, i) => ({ url: `https://www.ebay.com/itm/90000000020${i}`, price, shipping: 10, sold: true, title: 'Canon EOS R body', condition: 'Used', model: 'EOS R', sold_at: '2026-10-01' });
const camera = (drive) => ({
  drive,
  ...cleanDeal({
    source: 'fb', url: 'https://www.facebook.com/marketplace/item/321/', title: 'Canon EOS R body', ask: 40, photo_url: 'https://example.com/camera.jpg',
    distance_mi: 8, distance_from: 'New Braunfels', area: 'New Braunfels', category: 'cameras', condition: 'Used', model: 'EOS R',
    comps: [210, 220, 230, 240].map(sold),
  }),
});
const feedWith = (deals) => buildDailyFeed({
  surplus: { ...assessSnapshot(seed, NOW, NO_WORK), source: 'seed', updated_at: null },
  deals: { updated_at: '2026-11-16T12:00:00.000Z', deals }, config: confirmed(), nowMs: NOW, rules: NO_WORK,
});

test('a listing card says the profit in plain words, with the costs under it', () => {
  const feed = feedWith([camera({ minutes_round_trip: 30, miles_round_trip: 16 })]);
  const item = feed.items.find((it) => it.kind === 'listing');
  const card = cardFor(item, NOW);
  assert.equal(card.label, 'Buy');
  assert.equal(card.headline, 'You make about');
  // The headline number is the feed's own middle profit, rounded to a dollar.
  assert.equal(card.amount, `$${Math.round(item.profit.middle)}`);
  assert.equal(card.profit, item.profit.confirmed);
  assert.match(card.basis, /At the \$40\.00 asking price\. Confirmed/);
  assert.deepEqual(card.costs.map((c) => c.key), ['price', 'fees', 'gas', 'drive']);
  const cost = Object.fromEntries(card.costs.map((c) => [c.key, c]));
  assert.equal(cost.price.value, '$40.00');
  // Fees are the selling fee plus shipping. A private sale has no buyer's premium or tax.
  assert.equal(cost.fees.value, `$${(item.costs.fee + item.costs.shipping).toFixed(2)}`);
  assert.equal(cost.gas.value, `$${item.costs.gas.toFixed(2)}`);
  assert.deepEqual([cost.drive.value, cost.drive.note], ['30 min', '$10.00 of your time']);
  // The parts add up: price, fees, gas and time off the middle resale leave the profit shown.
  const left = item.resale.middle - item.price.current - item.costs.fee - item.costs.shipping - item.costs.gas - item.costs.time;
  assert.equal(Math.round(left * 100) / 100, card.profit);
  assert.deepEqual(card.cases.map((c) => c.name), ['low', 'middle', 'high']);
  assert.equal(card.cases[1].value, `$${item.profit.middle.toFixed(2)}`);
  assert.equal(card.comps.length, 3);
  assert.equal(card.comps_more, 1);
  assert.match(card.comps[0].text, /^Sold \$\d+\.\d\d, 2026-10-01$/);
  assert.equal(card.listing_url, 'https://www.facebook.com/marketplace/item/321/');
  assert.equal(card.photo_url, 'https://example.com/camera.jpg');
  assert.equal(card.countdown, null);
});

test('a surplus card uses the max bid, counts the buyer fees, and never shows an unknown as $0', () => {
  const feed = feedWith([]);
  const zebra = feed.items.find((it) => it.id === 'ps-4123518');
  const card = cardFor(zebra, NOW);
  assert.equal(card.label, 'Watch');
  assert.equal(card.headline, 'You make about');
  assert.equal(card.amount, '$153');
  assert.match(card.basis, /If you win at your \$79\.00 max bid\. Middle case\. An estimate, not confirmed\. Drive time is not counted yet\./);
  const cost = Object.fromEntries(card.costs.map((c) => [c.key, c]));
  assert.deepEqual([cost.price.label, cost.price.value, cost.price.note], ['Your max bid', '$79.00', 'Bid now $10.00']);
  // Buyer's premium and tax at $79, plus the selling fee and shipping.
  const buyFees = Math.round((zebra.costs.all_in_at_max_bid - 79 - zebra.costs.gas) * 100) / 100;
  assert.equal(cost.fees.value, `$${(buyFees + zebra.costs.fee + zebra.costs.shipping).toFixed(2)}`);
  assert.deepEqual([cost.drive.value, cost.drive.note], ['unknown', 'Not counted in profit yet: not looked up yet']);
  assert.equal(cost.gas.note, 'About 32 mi round trip, from the stated miles');
  assert.deepEqual(card.cases.map((c) => c.value), ['$0.40', '$152.53', '$152.53']);
  assert.match(card.reason, /^Drive time: .*is unknown, so the 45-minute cap cannot be checked\./);
  assert.match(card.risk, /./);
  assert.equal(card.countdown, 'Closes in 1d 8h');
  // A lot with no resale has no profit number, and its fees are unknown, not $0.
  const blank = cardFor(feed.items.find((it) => it.profit.middle == null && it.kind === 'surplus'), NOW);
  assert.deepEqual([blank.headline, blank.amount, blank.profit], ['Profit unknown', null, null]);
  assert.equal(blank.costs.find((c) => c.key === 'fees').value, 'unknown');
  assert.equal(blank.cases.every((c) => c.value === 'unknown'), true);
});

test('cards sort by profit, best first, with unknown profit last', () => {
  const cards = sortCards([{ id: 'a', profit: 5 }, { id: 'b', profit: null }, { id: 'c', profit: 152.5 }, { id: 'd', profit: -20 }, { id: 'e', profit: null }]);
  assert.deepEqual(cards.map((c) => c.id), ['c', 'a', 'd', 'b', 'e']);
  const feed = feedWith([camera({ minutes_round_trip: 30, miles_round_trip: 16 })]);
  const sorted = sortCards(feed.items.map((it) => cardFor(it, NOW)));
  const known = sorted.filter((c) => c.profit != null).map((c) => c.profit);
  assert.deepEqual(known, [...known].sort((x, y) => y - x));
  assert.equal(sorted.findIndex((c) => c.profit == null) > known.length - 1, true);
});

test('a loss reads as a loss, and the countdown reads in days, hours or minutes', () => {
  const feed = feedWith([camera({ minutes_round_trip: 30, miles_round_trip: 16 })]);
  const item = feed.items.find((it) => it.kind === 'listing');
  const losing = cardFor({ ...item, profit: { ...item.profit, confirmed: -12.4, middle: -12.4 } }, NOW);
  assert.deepEqual([losing.headline, losing.amount, losing.loss], ['You lose about', '$12', true]);
  assert.equal(countdown('2026-11-16T18:45:00.000Z', NOW), 'Closes in 45m');
  assert.equal(countdown('2026-11-16T21:05:00.000Z', NOW), 'Closes in 3h 5m');
  assert.equal(countdown('2026-11-16T17:00:00.000Z', NOW), 'Closed');
  assert.equal(countdown(null, NOW), null);
  assert.equal(countdown('2026-11-18T02:00:00.000Z', null), null);
});

test('the page shows one card per deal with a label, costs, cases, links and no way to act', () => {
  const feed = feedWith([camera({ minutes_round_trip: 30, miles_round_trip: 16 })]);
  const html = renderToStaticMarkup(e(DealFeed, { feed, now: NOW, failed: false, loading: false }));
  assert.equal((html.match(/data-card=/g) || []).length, feed.items.length);
  assert.equal((html.match(/data-field="label"/g) || []).length, feed.items.length);
  // The first card is the best profit.
  const first = /data-card="([^"]+)"/.exec(html)[1];
  assert.equal(first, sortCards(feed.items.map((it) => cardFor(it, NOW)))[0].id);
  assert.match(html, /You make about/);
  assert.match(html, /data-field="amount">\$153</);
  assert.match(html, /data-cost="price"/);
  assert.match(html, /data-cost="fees"/);
  assert.match(html, /data-cost="gas"/);
  assert.match(html, /data-cost="drive"/);
  assert.match(html, /data-case="low"/);
  assert.match(html, /data-case="high"/);
  assert.match(html, /Open the auction/);
  assert.match(html, /Open the listing/);
  assert.match(html, /href="https:\/\/www\.ebay\.com\/itm\/128064350319"/);
  assert.match(html, /Closes in 1d 8h/);
  assert.match(html, /Main risk: /);
  assert.match(html, /All 14/);
  assert.match(html, /Buy 1/);
  assert.match(html, /Watch 5/);
  assert.match(html, /Skip 8/);
  assert.match(html, /max buy \$100 \(starting bankroll\), at least \$100 profit, within 20 miles and 45 minutes round trip of New Braunfels, time at \$20 an hour/);
  assert.match(html, /The surplus scan is|No surplus scan has been posted/);
  assert.equal(html.includes('<form'), false);
  assert.equal(/Place bid|Buy now|Send offer|Message seller/i.test(html), false);
  const empty = renderToStaticMarkup(e(DealFeed, { feed: { items: [], stale: [], rules: feed.rules }, now: NOW, failed: false, loading: false }));
  assert.match(empty, /No deals in the feed yet/);
  assert.match(renderToStaticMarkup(e(DealFeed, { feed: null, now: NOW, failed: true, loading: false })), /Could not load the deals feed/);
});

test('the gas note shows the miles the gas cost was worked out on', () => {
  const feed = feedWith([camera({ minutes_round_trip: 30, miles_round_trip: 22 })]);
  const item = feed.items.find((it) => it.kind === 'listing');
  // The listing's gas comes from its stated 8 miles each way, not from the 22 routed miles.
  assert.deepEqual([item.costs.gas, item.costs.gas_miles, item.costs.gas_miles_basis], [2.88, 16, 'stated miles']);
  const gas = cardFor(item, NOW).costs.find((c) => c.key === 'gas');
  assert.equal(gas.note, '16 mi round trip, from the stated miles');
  assert.equal(Math.round(16 * 0.18 * 100) / 100, item.costs.gas);
  // A surplus lot with a routed drive pays gas on the routed miles, and the note says so.
  const routed = buildDailyFeed({
    surplus: { ...assessSnapshot({ ...seed, lots: seed.lots.map((l) => ({ ...l, drive: { minutes_round_trip: 40, miles_round_trip: 30.4, source: 'openrouteservice' } })) }, NOW), source: 'seed', updated_at: null },
    deals: null, config: confirmed(), nowMs: NOW, rules: NO_WORK,
  }).items.find((it) => it.id === 'ps-4123518');
  const g = cardFor(routed, NOW).costs.find((c) => c.key === 'gas');
  assert.deepEqual([routed.costs.gas_miles, g.value, g.note], [30.4, '$5.47', '30.4 mi round trip, routed']);
  assert.equal(feed.items.every((it) => !it.unknown.includes('costs.gas_miles')), true);
});

test('once the bid is over the max bid, the card shows profit at the bid, not at a price that is gone', () => {
  const zebra = feedWith([]).items.find((it) => it.id === 'ps-4123518');
  // The same lot with the bid pushed to $95, past the $79 max bid. The feed's own numbers for that bid are used.
  const bidUp = buildDailyFeed({
    surplus: { ...assessSnapshot({ ...seed, lots: seed.lots.map((l) => (l.id === 'ps-4123518' ? { ...l, current_bid: 95 } : l)) }, NOW, NO_WORK), source: 'seed', updated_at: null },
    deals: null, config: confirmed(), nowMs: NOW, rules: NO_WORK,
  }).items.find((it) => it.id === 'ps-4123518');
  assert.equal(bidUp.max_bid, zebra.max_bid);
  const card = cardFor(bidUp, NOW);
  assert.equal(card.profit, bidUp.profit.middle);
  assert.ok(card.profit < cardFor(zebra, NOW).profit);
  assert.match(card.basis, /At today's \$95\.00 bid, which is already over your \$79\.00 max bid\./);
  const price = card.costs.find((c) => c.key === 'price');
  assert.deepEqual([price.label, price.value, price.note], ['Current bid', '$95.00', 'Over your $79.00 max bid']);
  assert.deepEqual(card.cases.map((c) => c.value), ['low', 'middle', 'high'].map((n) => `${bidUp.profit[n] < 0 ? '-' : ''}$${Math.abs(bidUp.profit[n]).toFixed(2)}`));
  // A bid exactly at the max bid can still win there.
  const atMax = buildDailyFeed({
    surplus: { ...assessSnapshot({ ...seed, lots: seed.lots.map((l) => (l.id === 'ps-4123518' ? { ...l, current_bid: 79 } : l)) }, NOW, NO_WORK), source: 'seed', updated_at: null },
    deals: null, config: confirmed(), nowMs: NOW, rules: NO_WORK,
  }).items.find((it) => it.id === 'ps-4123518');
  assert.match(cardFor(atMax, NOW).basis, /If you win at your \$79\.00 max bid/);
});

test('a failed refresh keeps the deals on screen and says so', () => {
  const feed = feedWith([]);
  const html = renderToStaticMarkup(e(DealFeed, { feed, now: NOW, failed: false, refreshFailed: true, loading: false }));
  assert.match(html, /data-field="refresh-failed"/);
  assert.match(html, /The last refresh failed, so these are the deals as of/);
  assert.equal((html.match(/data-card=/g) || []).length, feed.items.length);
  assert.equal(html.includes('Could not load the deals feed'), false);
  assert.equal(renderToStaticMarkup(e(DealFeed, { feed, now: NOW, failed: false, refreshFailed: false, loading: false })).includes('refresh-failed'), false);
});

test('with every lot closed, the deals page says so instead of showing closed lots', () => {
  const later = Date.parse('2026-11-19T12:00:00.000Z');
  const onlyClosed = { ...seed, lots: seed.lots.filter((l) => l.closes_at && Date.parse(l.closes_at) <= later) };
  const f = buildDailyFeed({ surplus: { ...assessSnapshot(onlyClosed, later), source: 'seed', updated_at: null }, deals: null, config: confirmed(), nowMs: later, rules: NO_WORK });
  assert.equal(f.items.length, 0);
  const html = renderToStaticMarkup(e(DealFeed, { feed: f, now: later, failed: false, refreshFailed: false, loading: false }));
  assert.match(html, /No open deals right now/);
  assert.equal((html.match(/data-card=/g) || []).length, 0);
});
