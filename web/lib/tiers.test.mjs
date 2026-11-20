import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { cleanSpeed, speedText, tierFor, MIN_SOLD_FOR_B } from './tiers.js';
import { assessSnapshot } from './surplus.js';
import { buildDailyFeed } from './feed.js';
import { withRules } from './scoutConfig.js';
import { DEFAULT_RULES } from './rules.js';

const NOW = Date.parse('2026-11-16T18:00:00.000Z');
const soldComp = (i) => ({ type: 'sold', url: `https://www.ebay.com/itm/9100000000${i}`, price: 60 });
const watchItem = (extra = {}) => ({
  decision: { value: 'watch', reasons: ['Profit is not confirmed. Missing or unconfirmed: shipping.'] },
  comps: [0, 1, 2].map(soldComp),
  profit: { middle: null },
  sell_speed: { label: 'fast', evidence: '6 sold since Oct 21', sold_90d: 13, active_competitors: 32 },
  ...extra,
});

test('a Buy is tier A and a Skip stays Skip, whatever the evidence', () => {
  assert.equal(tierFor({ decision: { value: 'buy', reasons: [] }, comps: [] }, DEFAULT_RULES).value, 'A');
  const skip = tierFor({ decision: { value: 'skip', reasons: ['All-in cost $123.57 is over the $100.00 max per flip.'] }, comps: [0, 1, 2, 3].map(soldComp), sell_speed: { label: 'fast' } }, DEFAULT_RULES);
  assert.deepEqual([skip.value, skip.label, skip.why], ['skip', 'Skip', 'All-in cost $123.57 is over the $100.00 max per flip.']);
});

test('a Watch with enough sold proof that sells fast or medium is tier B, and says why it is not a Buy', () => {
  const b = tierFor(watchItem(), DEFAULT_RULES);
  assert.equal(b.value, 'B');
  assert.equal(b.label, 'Strong watch');
  assert.equal(b.why, '3 sold comps, sells fast. Not a Buy yet: Profit is not confirmed. Missing or unconfirmed: shipping.');
  assert.equal(tierFor(watchItem({ sell_speed: { label: 'medium' } }), DEFAULT_RULES).value, 'B');
});

test('thin proof, a slow or unknown sell speed, or a middle case under the minimum makes a Watch tier C', () => {
  assert.equal(MIN_SOLD_FOR_B, 3);
  const thin = tierFor(watchItem({ comps: [soldComp(0)] }), DEFAULT_RULES);
  assert.deepEqual([thin.value, thin.why], ['C', 'Only 1 sold comp.']);
  assert.equal(tierFor(watchItem({ comps: [] }), DEFAULT_RULES).why, 'No sold comps.');
  assert.equal(tierFor(watchItem({ sell_speed: { label: 'slow' } }), DEFAULT_RULES).why, 'Sells slowly.');
  assert.equal(tierFor(watchItem({ sell_speed: null }), DEFAULT_RULES).why, 'Sell speed unknown.');
  assert.equal(tierFor(watchItem({ profit: { middle: 40 } }), DEFAULT_RULES).why, 'Middle case $40 is under the $100 minimum.');
  // A sold comp without a link is not proof.
  assert.equal(tierFor(watchItem({ comps: [0, 1, 2].map((i) => ({ ...soldComp(i), url: null })) }), DEFAULT_RULES).value, 'C');
  // Asking prices are not proof either.
  assert.equal(tierFor(watchItem({ comps: [0, 1, 2].map((i) => ({ ...soldComp(i), type: 'asking' })) }), DEFAULT_RULES).value, 'C');
});

test('sell speed is cleaned, and an odd label reads as unknown', () => {
  assert.equal(cleanSpeed(null), null);
  assert.deepEqual(cleanSpeed({ label: 'blazing', evidence: '  x  ', sold_90d: -2, active_competitors: '7' }), { label: 'unknown', evidence: 'x', sold_90d: null, active_competitors: 7 });
  assert.equal(speedText({ label: 'fast', sold_90d: 13 }), 'Sells fast · 13 sold in 90 days');
  assert.equal(speedText({ label: 'slow', sold_90d: null }), 'Sells slow');
  assert.equal(speedText(null), 'Sell speed unknown');
});

test('a posted scan carries sell speed, watchers and caveats to the feed, and every item gets a tier', () => {
  const lot = {
    id: 'gd-1988-19', title: 'Lot of 12 Laptops', source_site: 'GovDeals', url: 'https://www.govdeals.com/en/asset/19/1988',
    city: 'Seguin, TX', pickup_address: '215 S Milam St, Seguin, TX 78155', miles_from_home: 15, miles_approximate: true,
    current_bid: 10, closes_at: '2026-12-04T21:00:00.000Z', premium_pct: 12.5, tax_rate: 0.0825, tax_basis: 'assumption', quantity: 8,
    comps: [0, 1, 2, 3].map((i) => ({ marketplace: 'eBay', ...soldComp(i), sold_on: 'Oct 2026' })),
    sell_speed: { label: 'fast', evidence: '13 confirmed sold since Aug 26', sold_90d: 13, active_competitors: 32 },
    watchers: 3,
    caveats: 'Hard drives removed. Models not stated.',
  };
  const f = buildDailyFeed({ surplus: { ...assessSnapshot({ lots: [lot] }, NOW), source: 'stored', updated_at: '2026-11-16T12:00:00.000Z' }, deals: { updated_at: '2026-11-16T12:00:00.000Z', deals: [] }, config: withRules(null), nowMs: NOW });
  const item = f.items[0];
  assert.deepEqual(item.sell_speed, { label: 'fast', evidence: '13 confirmed sold since Aug 26', sold_90d: 13, active_competitors: 32 });
  assert.equal(item.price.watchers, 3);
  assert.equal(item.caveats, 'Hard drives removed. Models not stated.');
  assert.equal(item.tier.value, 'B');
  assert.deepEqual(f.tiers, { A: 0, B: 1, C: 0, skip: 0 });
  // Watchers are left out when the page doesn't show them, so they are never listed as a missing number.
  assert.equal(item.unknown.includes('price.watchers'), false);
});
