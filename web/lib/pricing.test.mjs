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

test('a brand search prices each model only against that model', () => {
  const core = 'Herman Miller chair';
  const comps = [
    // Aeron dominates the pool, so it must still count as a model word.
    ...[700, 750, 800, 820].map((p) => sold('Herman Miller Aeron Chair Size B Fully Loaded', p)),
    ...[650, 900, 950, 980].map((p) => sold('Herman Miller Aeron Remastered Chair', p)),
    ...[300, 320, 350].map((p) => sold('Herman Miller Sayl Office Chair Black', p)),
    ...[200, 220].map((p) => sold('Herman Miller Mirra 2 Chair', p)),
    sold('Herman Miller Eames Lounge Chair', 4000),
  ];
  assert.deepEqual(compsFor({ title: 'Herman Miller Aeron Chair size B' }, comps, core).map((c) => c.price), [700, 750, 800, 820, 650, 900, 950, 980]);
  // A bare "Herman Miller chair" has no model words, so it keeps every comp except the "Mirra 2" version.
  assert.equal(compsFor({ title: 'Herman Miller chair' }, comps, core).length, comps.length - 2);
  assert.deepEqual(compsFor({ title: 'Herman Miller Sayl Office Chair' }, comps, core).map((c) => c.price), [300, 320, 350]);
  assert.equal(estimate(compsFor({ title: 'Authentic Vintage Herman Miller Eames Chairs' }, comps, core)).note, 'not enough comps');
  // Bundle extras after "with" do not narrow the comps.
  const sw = [140, 150, 160].map((p) => sold('Nintendo Switch Console', p)).concat([sold('Nintendo Switch Minecraft', 170), sold('Nintendo Switch Minecraft edition', 175)]);
  assert.equal(compsFor({ title: 'Nintendo switch one(With Minecraft!!!)' }, sw, 'Nintendo Switch').length, 5);
});

test('games and accessories sold for the item are not comps for the item', () => {
  // Real eBay sold titles from the Nov 8 "Nintendo Switch" search.
  const core = 'Nintendo Switch';
  const comps = [
    sold('Super Mario Party (Nintendo Switch, 2018)', 22), sold('Nintendo Switch Sports (Nintendo Switch, 2022) - Complete - Tested', 23.99),
    sold('Paper Mario: the Origami King - Nintendo Switch', 28.49), sold('Nintendo Super Mario RPG for Nintendo Switch, Super Mario Series, E, N', 20),
    sold('Donkey Kong Amino Super Mario Series Nintendo Switch EUC', 15.99), sold('Nintendo Tokyo Mirage Sessions #FE Encore Switch', 99),
    sold('Nintendo Switch 32GB Handheld System - Gray', 114.99), sold('Nintendo Switch Console Gray Joy-Con HAC-001', 140), sold('Nintendo Switch V2 Console Neon', 160),
  ];
  assert.deepEqual(compsFor({ title: 'Nintendo Switch' }, comps, core).map((c) => c.price), [114.99, 140, 160]);
  // "Pro Controller" in the extras does not make it a "Switch Pro".
  assert.deepEqual(compsFor({ title: 'Nintendo Switch Bundle - 5 Joy-Cons, Pro Controller, Dock' }, comps, core).map((c) => c.price), [114.99, 140, 160]);
  assert.equal(relevance('Nintendo Switch Power Cord', core).ok, false);
  assert.equal(relevance('Bramble: The Mountain King (Nintendo Switch)', core).ok, false);
  assert.equal(relevance('Authentic Eames Aluminum Management Chair by Herman Miller', 'Herman Miller chair').ok, true);
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
