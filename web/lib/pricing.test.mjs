// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequest, relevance, compsFor, estimate, rank, targetPrice, ageWeeks } from './pricing.js';

const sold = (title, price, condition = 'Pre-Owned') => ({ source: 'eBay sold', id: String(Math.random()).slice(2, 10), title, price, condition, sold_on: 'Nov 1, 2026', url: 'https://www.ebay.com/itm/1' });

test('parses a max price out of the request', () => {
  assert.deepEqual(parseRequest('Nintendo Switch under $200'), { core: 'Nintendo Switch', max: 200 });
  assert.deepEqual(parseRequest('Herman Miller chair to flip'), { core: 'Herman Miller chair', max: null });
  assert.equal(parseRequest('Road bike under $300', '250').max, 250);
});

test('flags accessories, games and wanted ads', () => {
  const core = 'Nintendo Switch';
  assert.equal(relevance('Nintendo switch', core).ok, true);
  assert.equal(relevance('Nintendo Switch with Case!!', core).ok, true);
  assert.equal(relevance('Nintendo switch 1. Extra controller and controller', core).ok, true);
  assert.equal(relevance('Joy cons for Nintendo switch', core).ok, false);
  assert.equal(relevance('Case Nintendo Switch', core).ok, false);
  assert.equal(relevance('Nintendo Switch Games', core).ok, false);
  assert.equal(relevance('Epic Mickey Rebrushed for the Nintendo Switch', core).ok, false);
  assert.equal(relevance('ISO Nintendo Switch', core).ok, false);
});

test('comps must agree on variant words', () => {
  const comps = [sold('Nintendo Switch OLED White', 210), sold('Nintendo Switch Lite Blue', 100), sold('Nintendo Switch Console V2', 150), sold('Nintendo Switch Joy-Con pair', 45)];
  assert.deepEqual(compsFor({ title: 'Nintendo Switch OLED' }, comps, 'Nintendo Switch').map((c) => c.price), [210]);
  assert.deepEqual(compsFor({ title: 'Nintendo switch' }, comps, 'Nintendo Switch').map((c) => c.price), [150]);
});

test('says not enough comps instead of guessing', () => {
  assert.equal(estimate([sold('a', 100), sold('b', 120)]).value, null);
  assert.equal(estimate([sold('a', 100), sold('b', 120)]).note, 'not enough comps');
  const e = estimate([100, 110, 120, 130, 140, 150, 160, 170].map((p) => sold('x', p)));
  assert.equal(e.value, 135); assert.equal(e.confidence, 'high');
});

test('ranks real discounts above too-cheap and no-comp listings', () => {
  const comps = Array.from({ length: 8 }, (_, i) => sold('Nintendo Switch console', 140 + i * 2));
  const ls = [
    { id: '1', title: 'Nintendo Switch', ask: 150 },
    { id: '2', title: 'Nintendo Switch', ask: 110 },
    { id: '3', title: 'Nintendo Switch Sports', ask: 40 },
    { id: '4', title: 'Nintendo Switch Games', ask: 30 },
  ];
  const r = rank(ls, comps, { core: 'Nintendo Switch', city: 'Austin' });
  assert.deepEqual(r.map((d) => d.id), ['2', '1', '3', '4']);
  assert.match(r[0].reason, /under the median of 8 eBay sold comps/);
  assert.match(r[2].reason, /Too cheap/);
});

test('target stays polite and never above asking', () => {
  assert.equal(targetPrice(200, 149), 140);
  assert.equal(targetPrice(120, 149), 110);
  assert.ok(targetPrice(5, null) <= 5);
});

test('reads listing age', () => {
  assert.equal(ageWeeks('Listed 13 weeks ago in Austin, TX'), 13);
  assert.equal(ageWeeks('Listed a week ago in Austin, TX'), 1);
  assert.equal(ageWeeks(null), null);
});
