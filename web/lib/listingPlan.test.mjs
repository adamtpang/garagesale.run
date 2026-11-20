import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { assessSnapshot, planCases } from './surplus.js';
import { buildDailyFeed } from './feed.js';
import { withRules } from './scoutConfig.js';
import { cardFor } from './dealCard.js';

const seed = JSON.parse(fs.readFileSync(new URL('../config/surplus-scan-2026-11-15.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-11-16T18:00:00.000Z');
const draft = fs.readFileSync(new URL('../../docs/listings/zebra-tc700k-lot.md', import.meta.url), 'utf8');

test('the Zebra lot is priced at the listing draft, and the board, feed and card agree', () => {
  // The draft's own numbers: Buy It Now $280 for the lot, lowest offer to take $200.
  assert.match(draft, /Buy It Now at \$280/);
  assert.match(draft, /Lowest offer to take \| \$200/);
  const plan = seed.lots.find((l) => l.id === 'ps-4123518').listing_plan;
  assert.deepEqual([plan.ask, plan.floor], [280, 200]);

  const lot = assessSnapshot(seed, NOW).lots.find((l) => l.id === 'ps-4123518');
  // 8 units: $280 is $35 a unit, $200 is $25 a unit.
  assert.deepEqual(lot.cases.map((c) => [c.name, c.unit]), [['low', 25], ['middle', 35], ['high', 35]]);
  assert.match(lot.cases[1].basis, /Buy It Now price in the listing draft: \$280\.00 for the lot/);
  // What the comps alone said is kept beside it.
  assert.deepEqual(lot.comps_say, { low: 17.99, middle: 40, high: 40 });
  assert.ok(lot.case_caveats.some((c) => /comps say \$40\.00 a unit/.test(c)));

  const feed = buildDailyFeed({ surplus: { ...assessSnapshot(seed, NOW), source: 'seed', updated_at: null }, deals: null, config: withRules(null), nowMs: NOW });
  const item = feed.items.find((it) => it.id === 'ps-4123518');
  assert.deepEqual([item.resale.low, item.resale.middle, item.resale.high], [25, 35, 35]);
  assert.deepEqual(item.listing_plan || item.resale.listing_plan, { ask: 280, floor: 200, source: 'docs/listings/zebra-tc700k-lot.md' });
  // The card's middle case is the same number the feed and board use.
  const card = cardFor(item, NOW);
  assert.equal(card.profit, item.profit.at_max_bid ? item.profit.at_max_bid.middle : item.profit.middle);
});

test('a plan never prices a lot that has no cited sales, and needs a quantity', () => {
  assert.equal(planCases(null, { ask: 100, floor: 50 }, 4), null);
  const resale = { cases: [{ name: 'low', unit: 10 }, { name: 'middle', unit: 20 }, { name: 'high', unit: 30 }], caveats: [] };
  assert.equal(planCases(resale, { ask: 100, floor: 50 }, null), resale);
  // With no floor, the low case is the comps' low, never above the asking price.
  const noFloor = planCases(resale, { ask: 32, floor: null }, 4);
  assert.deepEqual(noFloor.cases.map((c) => c.unit), [8, 8, 8]);
  const cheapComps = planCases({ ...resale, cases: [{ name: 'low', unit: 5 }, ...resale.cases.slice(1)] }, { ask: 100, floor: null }, 4);
  assert.equal(cheapComps.cases[0].unit, 5);
});

test('a plan in a posted scan is cleaned: a bad ask drops it, a floor above the ask is ignored', () => {
  const base = seed.lots.find((l) => l.id === 'ps-4123518');
  const run = (listing_plan) => assessSnapshot({ ...seed, lots: [{ ...base, listing_plan }] }, NOW).lots[0];
  assert.equal(run({ ask: -5, floor: 1 }).listing_plan, null);
  assert.equal(run('280').listing_plan, null);
  assert.deepEqual(run({ ask: 280, floor: 300 }).listing_plan, { ask: 280, floor: null, source: null });
});

test('the deal card says when the listing draft set the price', async () => {
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const DealFeed = (await import('../components/DealFeed.js')).default;
  const feed = buildDailyFeed({ surplus: { ...assessSnapshot(seed, NOW), source: 'seed', updated_at: null }, deals: null, config: withRules(null), nowMs: NOW });
  const card = cardFor(feed.items.find((it) => it.id === 'ps-4123518'), NOW);
  assert.equal(card.plan_note, 'Priced at your listing draft: $280.00 Buy It Now, $200.00 lowest offer. Comps say $40.00 a unit.');
  const html = renderToStaticMarkup(React.createElement(DealFeed, { feed, now: NOW, failed: false, refreshFailed: false, loading: false }));
  assert.equal((html.match(/data-field="plan-note"/g) || []).length, 1);
});

test('with a plan, the lot notes describe the draft, not the comp math', () => {
  const lot = assessSnapshot(seed, NOW).lots.find((l) => l.id === 'ps-4123518');
  assert.equal(lot.resale_note, 'Priced at your listing draft: $280.00 Buy It Now, $200.00 lowest offer for the lot. The comps alone said $40.00 a unit.');
  assert.equal(lot.battery_cost_note, 'The listing draft sets the cases, so no battery sale does.');
  // A lot without a plan keeps the scan's own notes.
  const plain = assessSnapshot({ ...seed, lots: seed.lots.map(({ listing_plan, ...l }) => l) }, NOW).lots.find((l) => l.id === 'ps-4123518');
  assert.match(plain.resale_note, /Priced from cited sales/);
});

test('a plan with no floor or source is never listed as unknown', () => {
  const base = seed.lots.find((l) => l.id === 'ps-4123518');
  const surplus = { ...assessSnapshot({ ...seed, lots: [{ ...base, listing_plan: { ask: 280 } }] }, NOW), source: 'seed', updated_at: null };
  const item = buildDailyFeed({ surplus, deals: null, config: withRules(null), nowMs: NOW }).items[0];
  assert.deepEqual(item.resale.listing_plan, { ask: 280, floor: null, source: null });
  assert.equal(item.unknown.some((u) => u.startsWith('resale.listing_plan') || u.startsWith('resale.comps_say')), false);
});

test('without a floor, the battery note is kept, since the low case still comes from the sales', () => {
  const base = seed.lots.find((l) => l.id === 'ps-4123518');
  const lot = assessSnapshot({ ...seed, lots: [{ ...base, listing_plan: { ask: 280 } }] }, NOW).lots[0];
  assert.equal(lot.battery_cost_note, base.battery_cost_note);
  assert.match(lot.resale_note, /^Priced at your listing draft: \$280\.00 Buy It Now for the lot\./);
});
