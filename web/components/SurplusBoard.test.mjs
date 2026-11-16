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
  assert.match(html, /needs preview/);
  assert.match(html, /Combine trips/);
  // The Schertz lots share one pickup address, so one haul covers them.
  assert.match(html, /One round trip is \$5\.76/);
  // Sold comps are clickable, and the estimate is labeled as an estimate.
  assert.match(html, /href="https:\/\/www\.ebay\.com\/itm\/128064350319"/);
  assert.match(html, /Used for resale/);
  assert.match(html, /data-field="net-estimate"/);
  assert.match(html, /Estimate, not confirmed/);
  assert.match(html, /Minimum \$1 per auction/);
  assert.equal(html.includes('Place bid'), false);
  assert.equal(html.includes('<form'), false);
  assert.equal((html.match(/data-lot=/g) || []).length, 13);
  assert.equal(html.includes('data-status="buy candidate (needs Adam yes)"'), false);
  assert.match(html, /data-status="needs preview"/);
  assert.match(html, /\$114\.98/);
  assert.match(html, /data-lot="ps-4123518"/);
});
