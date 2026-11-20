import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RULES_CONFIG } from '../config/rules.js';
import { activeRules, DEFAULT_RULES, rulesAsConfig, workCost } from './rules.js';
import { assessLot, assessSnapshot } from './surplus.js';
import { buildDailyFeed, fromDeal } from './feed.js';
import { cardFor } from './dealCard.js';
import { cleanDeal } from './decision.js';
import { withRules } from './scoutConfig.js';
import Market from '../components/Market.js';

const NOW = Date.parse('2026-11-16T18:00:00.000Z');
const NO_WORK = activeRules({ work_minutes_per_unit: 0 });
const seed = (({ lots, ...rest }) => ({ ...rest, lots: lots.map(({ listing_plan, ...lot }) => lot) }))(JSON.parse(fs.readFileSync(new URL('../config/surplus-scan-2026-11-15.json', import.meta.url), 'utf8')));
const confirmed = () => { const c = withRules(null); c.fees = Object.fromEntries(Object.entries(c.fees).map(([k, v]) => [k, { ...v, confirmed: true }])); return c; };
const sold = (price, i) => ({ url: `https://www.ebay.com/itm/90000000040${i}`, price, shipping: 10, sold: true, title: 'Canon EOS R body', condition: 'Used', model: 'EOS R', sold_at: '2026-10-01' });
const camera = () => ({ drive: { minutes_round_trip: 0, miles_round_trip: 16, source: 'fixture' }, ...cleanDeal({
  source: 'fb', url: 'https://www.facebook.com/marketplace/item/777/', title: 'Canon EOS R body', ask: 40, distance_mi: 8, distance_from: 'New Braunfels',
  area: 'New Braunfels', category: 'cameras', condition: 'Used', model: 'EOS R', comps: [210, 220, 230, 240].map(sold),
}) });

test('Adam set 30 minutes of work a unit on Nov 20, and it costs $10 a unit at $20 an hour', () => {
  assert.equal(RULES_CONFIG.work_minutes_per_unit, 30);
  assert.equal(DEFAULT_RULES.work_minutes_per_unit, 30);
  assert.equal(workCost(1), 10);
  assert.equal(workCost(8), 80);
  assert.equal(workCost(null), null);
  assert.equal(workCost(0), null);
  assert.equal(workCost(3, NO_WORK), 0);
  // The rules view the scout and the pages read carries it, and a posted config can't store a different one.
  assert.equal(rulesAsConfig().work_minutes_per_unit, 30);
  assert.equal(withRules({ work_minutes_per_unit: 5 }).work_minutes_per_unit, 30);
});

test('a lot counts work on every unit against profit, not against the cash it costs', () => {
  const lot = { ...seed.lots[0] };
  const withWork = assessLot(lot, NOW);
  const without = assessLot(lot, NOW, NO_WORK);
  assert.deepEqual([withWork.work_cost, withWork.work_minutes], [80, 240]);
  assert.equal(without.work_cost, 0);
  // The cash cost is the same; the profit at the current bid drops by the $80 of work.
  assert.equal(withWork.all_in, without.all_in);
  const mid = (v) => v.cases.find((c) => c.name === 'middle').profit_at_current_bid;
  assert.equal(Math.round((mid(without) - mid(withWork)) * 100) / 100, 80);
});

test('work time lowers the max bid: the Zebra lot goes from $79 to $11, because the low case must not lose money', () => {
  assert.equal(assessLot(seed.lots[0], NOW, NO_WORK).max_bid, 79);
  assert.equal(assessLot(seed.lots[0], NOW).max_bid, 11);
});

test('a listing counts 30 minutes of work, and the card says so', () => {
  const without = fromDeal(camera(), confirmed(), NO_WORK);
  const item = fromDeal(camera(), confirmed());
  assert.equal(item.costs.work, 10);
  assert.equal(item.costs.work_minutes, 30);
  assert.equal(Math.round((without.profit.middle - item.profit.middle) * 100) / 100, 10);
  assert.match(cardFor(item, NOW).basis, /Counts 30 min of your work \(\$10\.00\)\./);
});

test('a lot card says the hours, and the Market rules line names the work time', () => {
  const feed = buildDailyFeed({ surplus: { ...assessSnapshot(seed, NOW), source: 'seed', updated_at: null }, deals: { updated_at: '2026-11-16T12:00:00.000Z', deals: [camera()] }, config: confirmed(), nowMs: NOW });
  const zebra = feed.items.find((it) => it.id === 'ps-4123518');
  assert.deepEqual([zebra.costs.work, zebra.costs.work_minutes], [80, 240]);
  assert.match(cardFor(zebra, NOW).basis, /Counts 4 h of your work \(\$80\.00\)\./);
  assert.equal(feed.rules.work_minutes_per_unit, 30);
  const html = renderToStaticMarkup(React.createElement(Market, { feed, now: NOW }));
  assert.match(html, /time at \$20 an hour, 30 minutes of your work per item\./);
});
