import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildLadder, chartPoints } from '../lib/ladder.js';
import { bankrollFrom } from '../lib/bankroll.js';
import { cleanItem, cleanDecision, emptyLedger, totals } from '../lib/ledger.js';
import Ladder from './Ladder.js';

function ledger() {
  const doc = emptyLedger();
  // Entered out of date order on purpose.
  doc.items.push(cleanItem({ item: 'Drill', date_bought: '2026-11-20', buy_price: 60, status: 'on_hand' }, 'a2'));
  doc.items.push(cleanItem({ item: 'Camera', date_bought: '2026-11-18', buy_price: 40, costs: { gas: 5 }, status: 'sold', sell_price: 120, sell_date: '2026-11-22', platform: 'ebay' }, 'a1'));
  doc.items.push(cleanItem({ item: 'Lamp', buy_price: 10, status: 'on_hand' }, 'a3'));
  return doc;
}

test('the ladder starts at $100 and walks every buy and sale in date order', () => {
  const l = buildLadder(ledger());
  assert.deepEqual([l.start, l.start_source], [100, 'rules file']);
  assert.deepEqual(l.steps.map((s) => [s.kind, s.item, s.date, s.change, s.bankroll_after]), [
    ['buy', 'Camera', '2026-11-18', -45, 55],
    ['buy', 'Drill', '2026-11-20', -60, -5],
    ['sell', 'Camera', '2026-11-22', 120, 115],
    // No date, so it goes last.
    ['buy', 'Lamp', null, -10, 105],
  ]);
  // Camera: 120 - 40 - 5 gas.
  assert.equal(l.steps[2].profit, 75);
  assert.deepEqual([l.now, l.growth, l.growth_pct, l.realized_profit, l.undated], [105, 5, 5, 75, 1]);
  assert.deepEqual([l.on_hand_count, l.on_hand_value], [2, 70]);
});

test('the last rung equals the ledger total and the public bankroll number', () => {
  const doc = ledger();
  assert.equal(buildLadder(doc).now, totals({ ...doc, starting_bankroll: 100 }).bankroll);
  assert.equal(buildLadder(doc).max_buy, bankrollFrom(doc).bankroll);
  // The sums repeated in the browser file match the ledger's own totals.
  const t = totals({ ...doc, starting_bankroll: 100 });
  const lad = buildLadder(doc);
  assert.deepEqual([lad.realized_profit, lad.on_hand_count, lad.on_hand_value, lad.committed, lad.open_approvals], [t.realized_profit, t.on_hand_count, t.on_hand_value, t.committed, t.open_approvals]);
  // An open approval lowers the max buy, not the bankroll.
  doc.decisions.push(cleanDecision({ title: 'Lot', decision: 'approved', max_bid: 30, outcome: 'pending' }, 'd1'));
  const l = buildLadder(doc);
  assert.deepEqual([l.now, l.max_buy, l.committed, l.open_approvals], [105, 75, 30, 1]);
  assert.equal(l.max_buy, bankrollFrom(doc).bankroll);
  // The ledger's own starting number wins.
  assert.deepEqual([buildLadder({ ...doc, starting_bankroll: 200 }).start, buildLadder({ ...doc, starting_bankroll: 200 }).now], [200, 205]);
});

test('an empty ledger is one rung at the starting bankroll', () => {
  for (const doc of [null, emptyLedger()]) {
    const l = buildLadder(doc);
    assert.deepEqual([l.start, l.now, l.growth, l.steps.length, l.max_buy], [100, 100, 0, 0, 100]);
  }
  const html = renderToStaticMarkup(React.createElement(Ladder, { doc: emptyLedger() }));
  assert.match(html, /No buys or sales in the ledger yet/);
  assert.equal(html.includes('data-field="ladder-line"'), false);
});

test('the chart is a step line with one corner per step', () => {
  const l = buildLadder(ledger());
  const c = chartPoints(l);
  assert.equal(c.count, 5);
  assert.equal((c.path.match(/ H /g) || []).length, 4);
  assert.equal((c.path.match(/ V /g) || []).length, 4);
  // The bankroll dipped to -$5, so the chart's floor is below zero.
  assert.equal(c.lo, -5);
  assert.equal(c.hi, 115);
});

test('the page shows the four totals, the chart and one row per step', () => {
  const html = renderToStaticMarkup(React.createElement(Ladder, { doc: ledger() }));
  assert.match(html, /Started with/);
  assert.match(html, /\$100\.00/);
  assert.match(html, /Bankroll now/);
  assert.match(html, /\$105\.00/);
  assert.match(html, /Grown by/);
  assert.match(html, /5% up from the start/);
  assert.match(html, /Max buy right now/);
  assert.match(html, /Profit on sold items: \$75\.00/);
  assert.match(html, /2 items bought and not sold yet, \$70\.00 tied up/);
  assert.match(html, /data-field="ladder-line"/);
  assert.equal((html.match(/data-step="buy"/g) || []).length, 3);
  assert.equal((html.match(/data-step="sell"/g) || []).length, 1);
  assert.match(html, /\+\$120\.00/);
  assert.match(html, /-\$45\.00/);
  assert.match(html, /Profit \$75\.00/);
  assert.match(html, /Bankroll \$115\.00/);
  assert.match(html, /1 step has no date in the ledger and is listed last/);
  assert.equal(html.includes('<form'), false);
});
