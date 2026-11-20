import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { assessSnapshot } from '../lib/surplus.js';
import { buildDailyFeed } from '../lib/feed.js';
import { cardFor } from '../lib/dealCard.js';
import { cleanDeal } from '../lib/decision.js';
import { withRules } from '../lib/scoutConfig.js';
import { applyFilters, filtersToSearch, parseFilters, tileFor, DEFAULT_FILTERS, categoriesOf } from '../lib/market.js';
import Market from './Market.js';

const seed = JSON.parse(fs.readFileSync(new URL('../config/surplus-scan-2026-11-15.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-11-16T18:00:00.000Z');
const e = React.createElement;
const confirmed = () => { const c = withRules(null); c.fees = Object.fromEntries(Object.entries(c.fees).map(([k, v]) => [k, { ...v, confirmed: true }])); return c; };
const sold = (price, i) => ({ url: `https://www.ebay.com/itm/90000000030${i}`, price, shipping: 10, sold: true, title: 'Canon EOS R body', condition: 'Used', model: 'EOS R', sold_at: '2026-10-01' });
const camera = (extra = {}) => ({ drive: { minutes_round_trip: 20, miles_round_trip: 16, source: 'fixture' }, ...cleanDeal({
  source: 'fb', url: 'https://www.facebook.com/marketplace/item/555/', title: 'Canon EOS R body', ask: 40, distance_mi: 8, distance_from: 'New Braunfels',
  area: 'New Braunfels', category: 'cameras', condition: 'Used', model: 'EOS R', comps: [210, 220, 230, 240].map(sold), ...extra,
}) });
const feed = () => buildDailyFeed({ surplus: { ...assessSnapshot(seed, NOW), source: 'seed', updated_at: null }, deals: { updated_at: '2026-11-16T12:00:00.000Z', deals: [camera()] }, config: confirmed(), nowMs: NOW });
const pairsOf = (f) => f.items.map((item) => ({ item, card: cardFor(item, NOW) }));

test('filters round-trip through the address bar, and odd values fall back to the defaults', () => {
  const f = { verdict: 'buy', source: 'listing', category: 'cameras', maxPrice: 80, maxDrive: 45, sort: 'drive' };
  assert.equal(filtersToSearch(f), '?verdict=buy&source=listing&category=cameras&max_price=80&max_drive=45&sort=drive');
  assert.deepEqual(parseFilters(filtersToSearch(f)), f);
  assert.equal(filtersToSearch(DEFAULT_FILTERS), '');
  assert.deepEqual(parseFilters('?verdict=steal&source=x&max_price=-4&max_drive=abc&sort=random'), { ...DEFAULT_FILTERS });
});

test('each filter narrows the deals, and an unknown price or drive is kept and counted', () => {
  const pairs = pairsOf(feed());
  const all = applyFilters(pairs, DEFAULT_FILTERS).pairs;
  assert.equal(all.length, pairs.length);
  const buys = applyFilters(pairs, { ...DEFAULT_FILTERS, verdict: 'buy' }).pairs;
  assert.ok(buys.length >= 1);
  assert.ok(buys.every((p) => p.card.decision === 'buy'));
  const listings = applyFilters(pairs, { ...DEFAULT_FILTERS, source: 'listing' }).pairs;
  assert.deepEqual(listings.map((p) => p.item.kind), ['listing']);
  assert.deepEqual(applyFilters(pairs, { ...DEFAULT_FILTERS, category: 'cameras' }).pairs.map((p) => p.item.category), ['cameras']);
  // Max price $20: the $40 camera is out. Lots with a known bid over $20 are out, ones with no bid are kept and counted.
  const cheap = applyFilters(pairs, { ...DEFAULT_FILTERS, maxPrice: 20 });
  for (const p of cheap.pairs) assert.ok(p.item.price.current == null || p.item.price.current <= 20, p.item.id);
  assert.equal(cheap.pairs.some((p) => p.item.kind === 'listing'), false);
  // Max drive 10 min: the camera (20 min) is out, lots with no drive time are kept and counted.
  const near = applyFilters(pairs, { ...DEFAULT_FILTERS, maxDrive: 10 });
  assert.equal(near.pairs.some((p) => p.item.kind === 'listing'), false);
  assert.equal(near.unknownKept, near.pairs.length);
});

test('sort by profit, closing soonest or shortest drive', () => {
  const pairs = pairsOf(feed());
  const byProfit = applyFilters(pairs, DEFAULT_FILTERS).pairs.map((p) => p.card.profit);
  const known = byProfit.filter((p) => p != null);
  assert.deepEqual(known, [...known].sort((a, b) => b - a));
  assert.ok(byProfit.indexOf(null) === -1 || byProfit.slice(byProfit.indexOf(null)).every((p) => p == null));
  const closes = applyFilters(pairs, { ...DEFAULT_FILTERS, sort: 'closing' }).pairs.map((p) => Date.parse(p.item.price.closes_at || '') || null);
  const knownCloses = closes.filter((t) => t != null);
  assert.deepEqual(knownCloses, [...knownCloses].sort((a, b) => a - b));
  assert.equal(applyFilters(pairs, { ...DEFAULT_FILTERS, sort: 'drive' }).pairs[0].item.kind, 'listing');
});

test('a tile shows only the deciding lines, every number from the feed, and links to the item page', () => {
  const f = feed();
  const item = f.items.find((it) => it.kind === 'listing');
  const t = tileFor(item, cardFor(item, NOW));
  assert.equal(t.href, `/item?id=${encodeURIComponent('https://www.facebook.com/marketplace/item/555/')}`);
  assert.equal(t.label, 'Buy');
  assert.match(t.profit, /^\+\$\d/);
  assert.equal(t.price, 'Ask $40.00');
  assert.equal(t.max_bid, `Max offer $${item.max_bid.toFixed(2)}`);
  assert.equal(t.drive, '20 min round trip');
  const zebra = f.items.find((it) => it.id === 'ps-4123518');
  const z = tileFor(zebra, cardFor(zebra, NOW));
  assert.equal(z.price, `Bid $${zebra.price.current.toFixed(2)}`);
  assert.equal(z.drive, 'Drive unknown');
  assert.match(z.closes, /^Closes in/);
  // An unknown profit says so instead of a number.
  const noProfit = f.items.find((it) => cardFor(it, NOW).amount == null);
  if (noProfit) assert.equal(tileFor(noProfit, cardFor(noProfit, NOW)).profit, null);
});

test('the Market page draws one tile per deal, honors starting filters, and offers no way to bid', () => {
  const f = feed();
  const html = renderToStaticMarkup(e(Market, { feed: f, now: NOW, failed: false, refreshFailed: false, loading: false, initialFilters: DEFAULT_FILTERS }));
  assert.equal((html.match(/data-tile=/g) || []).length, f.items.length);
  assert.match(html, /href="\/item\?id=/);
  for (const word of ['Place bid', 'Buy now', 'Message seller', 'Make offer']) assert.equal(html.includes(word), false, word);
  const only = renderToStaticMarkup(e(Market, { feed: f, now: NOW, failed: false, refreshFailed: false, loading: false, initialFilters: { ...DEFAULT_FILTERS, source: 'listing' } }));
  assert.equal((only.match(/data-tile=/g) || []).length, 1);
  assert.match(only, /Clear filters/);
  const none = renderToStaticMarkup(e(Market, { feed: f, now: NOW, failed: false, refreshFailed: false, loading: false, initialFilters: { ...DEFAULT_FILTERS, category: 'bikes' } }));
  assert.match(none, /Nothing passes these filters/);
});

test('closing soonest puts open lots first, then unknown close times, then closed lots', () => {
  // Nov 17, 8:30 PM CT: the Schertz lots have just closed; TFC and the Hallettsville lots are still open.
  const later = Date.parse('2026-11-18T02:30:00.000Z');
  // The feed is built without a clock, so closed lots stay in it (the live feed hides them); the sort is
  // then checked against the later time.
  const f = buildDailyFeed({ surplus: { ...assessSnapshot(seed, later), source: 'seed', updated_at: null }, deals: null, config: confirmed(), nowMs: null });
  const pairs = f.items.map((item) => ({ item, card: cardFor(item, later) }));
  const order = applyFilters(pairs, { ...DEFAULT_FILTERS, sort: 'closing' }, later).pairs.map((p) => {
    const t = Date.parse(p.item.price.closes_at || '');
    return Number.isFinite(t) ? (t > later ? 'open' : 'closed') : 'unknown';
  });
  assert.ok(order.includes('open') && order.includes('closed'));
  const rank = { open: 0, unknown: 1, closed: 2 };
  assert.deepEqual(order, [...order].sort((a, b) => rank[a] - rank[b]));
  const open = applyFilters(pairs, { ...DEFAULT_FILTERS, sort: 'closing' }, later).pairs.filter((p) => Date.parse(p.item.price.closes_at || '') > later).map((p) => Date.parse(p.item.price.closes_at));
  assert.deepEqual(open, [...open].sort((a, b) => a - b));
});

test('a category alias never hides a deal, and the menu lists each category once', () => {
  const f = buildDailyFeed({ surplus: null, deals: { updated_at: '2026-11-16T12:00:00.000Z', deals: [camera({ category: 'consoles', title: 'PS5', url: 'https://www.facebook.com/marketplace/item/777/' })] }, config: confirmed(), nowMs: NOW });
  const pairs = pairsOf(f);
  for (const pick of ['game consoles', 'consoles', 'console']) assert.equal(applyFilters(pairs, { ...DEFAULT_FILTERS, category: pick }).pairs.length, 1, pick);
  const cats = categoriesOf(f.items, { categories: ['electronics', 'game consoles', 'tools'] });
  assert.deepEqual(cats, ['consoles', 'electronics', 'tools']);
});

test('the number boxes keep what is typed, so a decimal or a zero can be entered', () => {
  const src = fs.readFileSync(new URL('./Market.js', import.meta.url), 'utf8');
  assert.match(src, /value: shownText\('maxPrice'\)/);
  assert.match(src, /value: shownText\('maxDrive'\)/);
  assert.equal(/Number\(ev\.target\.value\)\) \|\| null/.test(src), false);
});

test('a category alias in a link selects the menu option it filters by', () => {
  for (const alias of ['game%20consoles', 'console', 'Consoles']) assert.equal(parseFilters(`?category=${alias}`).category, 'consoles', alias);
  assert.equal(parseFilters('?category=cameras').category, 'cameras');
  assert.equal(parseFilters('?category=').category, 'all');
});
