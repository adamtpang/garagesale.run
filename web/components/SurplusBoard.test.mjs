import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { assessSnapshot } from '../lib/surplus.js';
import SurplusBoard from './SurplusBoard.js';

const seed = JSON.parse(fs.readFileSync(new URL('../config/surplus-scan-2026-11-15.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-11-16T18:00:00.000Z');
const e = React.createElement;

test('the board shows buy and sell side by side and keeps unknown resale unknown', () => {
  const view = { ...assessSnapshot(seed, NOW), source: 'seed' };
  const html = renderToStaticMarkup(e(SurplusBoard, { view, loading: false, failed: false }));
  assert.match(html, /Surplus arbitrage/);
  assert.match(html, /does not place bids/);
  assert.match(html, /Nov 15, 2026 scan snapshot/);
  assert.match(html, /Not a sample/);
  assert.match(html, /data-sides="buy-sell"/);
  assert.match(html, /md:grid-cols-2/);
  assert.match(html, /data-side="buy"/);
  assert.match(html, /data-side="sell"/);
  assert.match(html, /asking, not sold/);
  assert.match(html, /Lower confidence/);
  assert.match(html, /data-field="resale-unit"/);
  assert.match(html, /data-field="net"/);
  assert.match(html, />unknown</);
  assert.match(html, /Unknown shipping is not treated as \$0/);
  assert.match(html, /seller says tax added, rate not stated/);
  assert.match(html, /1d 8h 0m/);
  assert.match(html, /Tue, Nov 17, 2026, 8:00 PM CT/);
  assert.match(html, /Combine trips/);
  // The Schertz lots share one pickup address, so one haul covers them.
  assert.match(html, /One round trip is \$5\.76/);
  // Sold comps are clickable, and the estimate is labeled as an estimate.
  assert.match(html, /href="https:\/\/www\.ebay\.com\/itm\/128064350319"/);
  assert.match(html, /Used for resale/);
  // The Zebra lot shows three cases and a max bid, with profit at the max bid.
  assert.match(html, /data-field="cases"/);
  assert.match(html, /data-case="low"/);
  assert.match(html, /data-case="middle"/);
  assert.match(html, /data-case="high"/);
  assert.match(html, /data-field="max-bid"/);
  assert.match(html, /Profit at the \$79\.00 max bid/);
  assert.match(html, /data-field="profit-max-low">\$0\.40</);
  assert.match(html, /data-field="profit-max-middle">\$152\.53</);
  assert.match(html, /Lot of 5 for \$200\.00/);
  assert.match(html, /No battery/);
  assert.match(html, /Battery included/);
  assert.match(html, /Single unit/);
  // Phone lots fold their 35 comps behind a count, and carry the fleet lock flag.
  assert.match(html, /data-field="comps-fold"/);
  assert.match(html, /35 sold comps \(24 working, 11 for parts\)\. Show all 35\./);
  assert.match(html, /data-field="lock-flag"/);
  assert.match(html, /For parts/);
  assert.match(html, /Estimate, not confirmed/);
  assert.match(html, /Minimum \$1\.00 per auction/);
  const noBid = renderToStaticMarkup(e(SurplusBoard, {
    view: { ...view, lots: view.lots.filter((lot) => lot.id === 'ps-4123530'), trips: [] },
    loading: false,
    failed: false,
  }));
  assert.match(noBid, /8\.5%/);
  assert.match(noBid, /Minimum \$1\.00 per auction/);
  assert.equal(noBid.includes('Premium dollars'), false);
  assert.equal(html.includes('Place bid'), false);
  assert.equal(html.includes('<form'), false);
  assert.equal((html.match(/data-lot=/g) || []).length, 13);
  assert.equal(html.includes('data-status="buy candidate (needs Adam yes)"'), false);
  // Every lot in this scan is past the 15-mile radius, so every lot is a skip with its reason shown.
  assert.equal((html.match(/data-status="skip"/g) || []).length, 13);
  assert.match(html, /Skipped by rule\. About 16 mi from New Braunfels, TX is past the 15-mile pickup limit/);
  assert.match(html, /data-field="rule-checks"/);
  assert.match(html, /data-rule="radius" data-result="fail"/);
  assert.match(html, />Fail</);
  // The rules strip reads from the config.
  assert.match(html, /Max buy per flip/);
  assert.match(html, /Starting bankroll of \$100\.00/);
  assert.match(html, /\$100\.00 after fees and gas/);
  assert.match(html, /15 mi from New Braunfels, TX/);
  assert.match(html, /\$114\.98/);
  assert.match(html, /data-lot="ps-4123518"/);
  // The strip never says no bid works when the max bid is only unknown.
  assert.equal(html.includes('No bid fits the rules'), false);
  for (const lot of view.lots.filter((l) => l.max_bid == null)) {
    const one = renderToStaticMarkup(e(SurplusBoard, { view: { ...view, lots: [lot], trips: [] }, loading: false, failed: false }));
    const unknown = !/^No bid works/.test(lot.max_bid_note);
    assert.equal(lot.max_bid_text, unknown ? 'unknown' : 'none', lot.id);
    assert.match(one, unknown ? /data-field="key-max-bid">unknown</ : /data-field="key-max-bid">none</, lot.id);
    // The cases block uses the same word as the strip.
    assert.equal(/Max bid<\/span><span[^>]*>(none|unknown)</.exec(one)?.[1] ?? lot.max_bid_text, lot.max_bid_text, lot.id);
  }
  assert.ok(view.lots.some((l) => l.max_bid == null && /^Max bid is unknown/.test(l.max_bid_note)));
});
