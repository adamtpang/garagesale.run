import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { assessLot, assessSnapshot, cleanSnapshot, formatClose, tripGroups, resaleCases, BUY_STATUS, MAX_COMPS } from './surplus.js';
import { activeRules, checkLot, DEFAULT_RULES } from './rules.js';
import { RULES_CONFIG } from '../config/rules.js';

// Rules wide enough to never trip. Tests about comps, fees and confirmation use these,
// so they check that logic alone. The rule tests below use Adam's real rules.
const LOOSE = activeRules({ min_profit: 0, max_pickup_miles: 100000, max_per_flip: 100000, bankroll: 100000 });

const seed = JSON.parse(fs.readFileSync(new URL('../config/surplus-scan-2026-11-15.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-11-16T18:00:00.000Z');

function confirmedLot(extra = {}) {
  return {
    id: 'sold-1',
    title: 'Widget',
    source_site: 'Public Surplus',
    current_bid: 10,
    bid_count: 1,
    premium_pct: 0,
    tax_basis: 'stated',
    tax_rate: 0,
    miles_from_home: 10,
    miles_approximate: false,
    quantity: 2,
    fee_rate: 0.1,
    fee_basis: 'stated',
    shipping: 0,
    shipping_basis: 'stated',
    pickup_address: '1 Main St, Schertz, TX',
    comps: [
      { type: 'sold', price: 40, url: 'https://www.ebay.com/itm/123456789012', title: 'Sold widget', marketplace: 'eBay' },
    ],
    status: BUY_STATUS,
    ...extra,
    comps: extra.comps || [
      { type: 'sold', price: 40, url: 'https://www.ebay.com/itm/123456789012', title: 'Sold widget', marketplace: 'eBay' },
    ],
  };
}

test('haul is round-trip miles times $0.18 and all-in adds premium and assumed tax', () => {
  const lot = assessLot(seed.lots[0], NOW);
  assert.equal(lot.round_trip_miles, 32);
  assert.equal(lot.haul_cost, 5.76);
  // City of Schertz states a $1 minimum premium per auction, which beats 8.5% of $10.
  assert.equal(lot.premium_amount, 1);
  assert.equal(lot.tax_amount, 0.91);
  assert.equal(lot.tax_rate, 0.0825);
  assert.equal(lot.tax_label, 'seller says tax added, rate not stated');
  assert.equal(lot.all_in, 17.67);
  assert.equal(lot.all_in_basis, 'assumption');
  assert.match(lot.all_in_note, /assumed 8.25% tax/);
});

test('a stated minimum premium applies only when it is higher than the percentage', () => {
  assert.equal(assessLot({ ...seed.lots[0], premium_min: null }).premium_amount, 0.85);
  assert.equal(assessLot({ ...seed.lots[0], current_bid: 5 }).premium_amount, 1);
  assert.equal(assessLot({ ...seed.lots[0], current_bid: 100 }).premium_amount, 8.5);
});

test('the premium minimum stays visible when there is no current bid', () => {
  const lot = assessLot(seed.lots.find((l) => l.id === 'ps-4123530'));
  assert.equal(lot.current_bid, null);
  assert.equal(lot.bid_count, 0);
  assert.equal(lot.premium_amount, null);
  assert.equal(lot.premium_text, '8.5%');
  assert.equal(lot.premium_note, 'Minimum $1.00 per auction.');
});

test('an estimate needs every input, is labeled, and never makes a lot a buy', () => {
  const lot = assessLot({ ...seed.lots[0], status: BUY_STATUS }, NOW, LOOSE);
  // Middle case: two battery-less lot sales at $40 a unit. 8 x $40 = $320, fee 13.6% + $0.40 = $43.92.
  assert.equal(lot.unit_resale, 40);
  assert.equal(lot.gross, 320);
  assert.equal(lot.fee_amount, 43.92);
  assert.equal(lot.shipping_text, '$25.00 assumption');
  assert.equal(lot.net, null);
  assert.equal(lot.profit_confidence, 'unknown');
  assert.equal(lot.net_estimate, 233.41);
  assert.match(lot.net_estimate_note, /Estimate, not confirmed/);
  assert.match(lot.net_estimate_note, /tax rate, miles, shipping/);
  assert.match(lot.net_estimate_note, /middle case at the current bid/);
  assert.match(lot.net_estimate_note, /every unit sells/);
  assert.equal(lot.status, 'watch');
  assert.match(lot.profit_reason, /shipping/);

  const noShip = assessLot({ ...seed.lots[0], shipping: null, shipping_basis: 'unknown' }, NOW);
  assert.equal(noShip.net_estimate, null);
  const confirmed = assessLot(confirmedLot(), NOW);
  assert.notEqual(confirmed.net, null);
  assert.equal(confirmed.net_estimate, null);
});

const ASKING_ONLY = [{ marketplace: 'eBay', type: 'asking', price: 114.98, title: 'Used Zebra TC700K with cradle', url: null }];

test('asking comps do not set resale, profit, ROI, or a buy mark', () => {
  const lot = assessLot({
    ...seed.lots[0],
    comps: ASKING_ONLY,
    net: 999,
    profit: 999,
    all_in: 1,
    unit_resale: 114.98,
    status: BUY_STATUS,
  }, NOW, LOOSE);
  assert.equal(lot.unit_resale, null);
  assert.equal(lot.resale_basis, 'unknown');
  assert.equal(lot.gross, null);
  assert.equal(lot.net, null);
  assert.equal(lot.roi, null);
  assert.equal(lot.net_text, 'unknown');
  assert.equal(lot.net_estimate, null);
  assert.equal(lot.roi_text, 'unknown');
  assert.equal(lot.profit_confidence, 'unknown');
  assert.equal(lot.status, 'watch');
  assert.match(lot.status_reason, /cannot be marked buy/);
  assert.match(lot.profit_reason, /not used as resale/);
  assert.equal(lot.comps[0].type_label, 'asking, not sold');
  assert.equal(lot.comps[0].confidence, 'lower');
  assert.equal(lot.comps[0].price, 114.98);
  assert.equal(lot.places_bids, false);
});

test('a scan bid range is not used as the lot bid', () => {
  const lot = assessLot({
    ...seed.lots.find((l) => l.id === 'ps-4123530'),
    bid_scan_low: 5,
    bid_scan_high: 5.5,
    bid_scan_note: 'A range across six auctions, not this auction\'s bid.',
  }, NOW);
  assert.equal(lot.opening_bid, 5);
  assert.equal(lot.net_estimate, null);
  assert.equal(lot.bid_count, 0);
  assert.equal(lot.current_bid, null);
  assert.equal(lot.current_bid_text, 'unknown');
  assert.equal(lot.bid_scan_text, '$5.00–$5.50');
  assert.equal(lot.all_in, null);
  assert.equal(lot.haul_cost, 5.76);
});

test('confirmed profit uses sold comps only and ROI is net divided by all-in', () => {
  const lot = assessLot(confirmedLot({
    comps: [
      { type: 'sold', price: 40, url: 'https://www.ebay.com/itm/123456789012', title: 'Sold widget', marketplace: 'eBay' },
      { type: 'asking', price: 5, url: 'https://www.ebay.com/itm/123456789013', title: 'Cheap ask', marketplace: 'eBay' },
      { type: 'sold', price: 50, url: 'https://www.ebay.com/itm/123456789014', title: 'Other sold', marketplace: 'eBay' },
    ],
  }), NOW, LOOSE);
  assert.equal(lot.unit_resale, 45);
  assert.equal(lot.resale_basis, 'sold');
  assert.equal(lot.gross, 90);
  assert.equal(lot.fee_amount, 9);
  assert.equal(lot.haul_cost, 3.6);
  assert.equal(lot.all_in, 13.6);
  assert.equal(lot.all_in_basis, 'stated');
  assert.equal(lot.net, 67.4);
  assert.equal(lot.roi, 4.9559);
  assert.equal(lot.roi_text, '495.59%');
  assert.equal(lot.profit_confidence, 'confirmed');
  assert.equal(lot.status, BUY_STATUS);
  assert.equal(lot.shipping_text, '$0.00');
});

test('missing shipping, an assumed fee, assumed tax, or a sold comp without a URL blocks confirmation', () => {
  const noShip = assessLot(confirmedLot({ shipping: null, shipping_basis: 'unknown' }), null, LOOSE);
  assert.equal(noShip.shipping_text, 'unknown');
  assert.equal(noShip.net, null);
  assert.equal(noShip.status, 'watch');
  assert.match(noShip.profit_reason, /shipping/);
  assert.match(noShip.profit_reason, /not treated as zero/);

  const assumedFee = assessLot(confirmedLot({ fee_basis: 'assumption' }));
  assert.match(assumedFee.fee_text, /assumption/);
  assert.equal(assumedFee.net, null);
  assert.equal(assumedFee.profit_confidence, 'unknown');

  const assumedTax = assessLot(confirmedLot({ tax_basis: 'assumption', tax_rate: 0.0825 }), null, LOOSE);
  assert.equal(assumedTax.tax_amount, 0.83);
  assert.equal(assumedTax.all_in_basis, 'assumption');
  assert.notEqual(assumedTax.all_in, null);
  assert.equal(assumedTax.net, null);
  assert.equal(assumedTax.status, 'watch');

  const approxMiles = assessLot(confirmedLot({ miles_approximate: true }));
  assert.equal(approxMiles.all_in_basis, 'assumption');
  assert.equal(approxMiles.net, null);

  const noUrl = assessLot(confirmedLot({
    comps: [{ type: 'sold', price: 40, url: null, title: 'Sold with no link', marketplace: 'eBay' }],
  }), null, LOOSE);
  assert.equal(noUrl.unit_resale, null);
  assert.match(noUrl.profit_reason, /no URL/);
  assert.equal(noUrl.status, 'watch');
});

test('omitted shipping stays unknown and a confirmed loss is skipped', () => {
  const omitted = assessLot(confirmedLot({ shipping: undefined, shipping_basis: undefined }));
  assert.equal(omitted.shipping, null);
  assert.equal(omitted.net, null);

  const loser = assessLot(confirmedLot({
    current_bid: 100,
    comps: [{ type: 'sold', price: 20, url: 'https://www.ebay.com/itm/123456789012', title: 'Sold', marketplace: 'eBay' }],
  }), null, LOOSE);
  assert.ok(loser.net < 0);
  assert.equal(loser.profit_confidence, 'confirmed');
  assert.equal(loser.status, 'skip');
  assert.match(loser.status_reason, /Confirmed profit -?\$?-?[\d.]+ is under the \$0\.00 minimum/);
});

test('needs preview and skip are kept when resale is unknown', () => {
  assert.equal(assessLot({ ...seed.lots[0], comps: ASKING_ONLY, status: 'needs preview' }, null, LOOSE).status, 'needs preview');
  assert.equal(assessLot({ ...seed.lots[0], comps: ASKING_ONLY, status: 'skip' }, null, LOOSE).status, 'skip');
  assert.equal(assessLot({ ...seed.lots[0], comps: ASKING_ONLY, status: 'buy now' }, null, LOOSE).status, 'watch');
});

test('same pickup address shares one haul and unknown addresses do not', () => {
  const a = assessLot({ ...confirmedLot(), id: 'a', title: 'A', miles_from_home: 16, miles_approximate: true });
  const b = assessLot({ ...confirmedLot(), id: 'b', title: 'B', miles_from_home: 16, miles_approximate: true });
  const other = assessLot({ ...confirmedLot(), id: 'c', title: 'C', pickup_address: '9 Other Rd', miles_from_home: 16 });
  const blank = assessLot({ ...confirmedLot(), id: 'd', title: 'D', pickup_address: null });
  const shared = tripGroups([a, b, other, blank]);
  assert.equal(shared.length, 1);
  assert.deepEqual(shared[0].lot_ids, ['a', 'b']);
  assert.equal(shared[0].shared_haul, 5.76);
  assert.equal(shared[0].separate_haul, 11.52);
  assert.equal(shared[0].saved, 5.76);
  assert.match(shared[0].hint, /One round trip is \$5\.76/);

  const mismatch = tripGroups([
    a,
    assessLot({ ...confirmedLot(), id: 'e', title: 'E', miles_from_home: 10, miles_approximate: false }),
  ]);
  assert.equal(mismatch[0].shared_haul, null);
  assert.match(mismatch[0].hint, /not combined/);
  assert.equal(tripGroups([blank, assessLot({ ...confirmedLot(), id: 'f', pickup_address: '' })]).length, 0);
});

test('close time is 12-hour Central time with a countdown', () => {
  const open = formatClose('2026-11-18T02:00:00.000Z', NOW);
  assert.equal(open.close_text, 'Tue, Nov 17, 2026, 8:00 PM CT');
  assert.equal(open.countdown, '1d 8h 0m');
  assert.equal(open.closed, false);
  assert.equal(formatClose('2026-11-18T02:00:00.000Z', Date.parse('2026-11-18T02:00:00.000Z')).countdown, 'closed');
  assert.equal(formatClose(null, NOW).close_text, 'unknown');
  const friday = formatClose('2026-11-20T21:00:00.000Z', NOW);
  assert.equal(friday.close_text, 'Fri, Nov 20, 2026, 3:00 PM CT');
});

test('the Nov 15 2026 snapshot is real scan data, marks nothing a buy, and every lot breaks a rule', () => {
  assert.equal(seed.sample, false);
  assert.equal(seed.scanned_on, '2026-11-15');
  assert.match(seed.label, /Nov 15, 2026 scan snapshot/);
  assert.match(seed.label, /Not a sample/);
  const view = assessSnapshot(seed, NOW);
  assert.equal(view.sample, false);
  assert.equal(view.places_bids, false);
  assert.equal(view.lots.length, 13);
  assert.equal(view.scanned_on_text, 'Nov 15, 2026');
  const byId = Object.fromEntries(view.lots.map((lot) => [lot.id, lot]));
  assert.deepEqual(Object.keys(byId).sort(), [
    'ps-4123506', 'ps-4123508', 'ps-4123518', 'ps-4123522', 'ps-4123523', 'ps-4123524',
    'ps-4123526', 'ps-4123528', 'ps-4123530', 'ps-4123532', 'ps-4124526', 'ps-4128202', 'ps-4128212',
  ].sort());
  const schertzWithComps = ['ps-4123518', 'ps-4123522', 'ps-4123523', 'ps-4123524', 'ps-4123526', 'ps-4123528', 'ps-4123530'];
  for (const lot of view.lots) {
    // Nothing is confirmed: the tax rate, miles, and shipping are still assumptions.
    assert.equal(lot.net, null);
    assert.equal(lot.roi, null);
    assert.notEqual(lot.status, BUY_STATUS);
    assert.equal(lot.places_bids, false);
    // Every sold comp is a cited eBay listing. Lots without research stay unknown.
    for (const c of lot.comps.filter((x) => x.type === 'sold')) assert.match(c.url, /^https:\/\/www\.ebay\.com\/itm\/\d+$/);
    if (!schertzWithComps.includes(lot.id)) {
      assert.equal(lot.unit_resale, null);
      assert.equal(lot.net_estimate, null);
    }
  }
  // Under Adam's rules every lot in this scan is past the 15-mile radius: Schertz is about 16 miles,
  // TFC about 52 and Hallettsville about 73.
  for (const lot of view.lots) {
    assert.equal(lot.status, 'skip', lot.id);
    assert.match(lot.status_reason, /Skipped by rule\..*past the 15-mile pickup limit/, lot.id);
  }
  assert.match(byId['ps-4124526'].status_reason, /About 52 mi/);
  assert.match(byId['ps-4124526'].status_reason, /All-in cost \$165\.02 is over the \$100\.00 max per flip/);
  assert.match(byId['ps-4128212'].status_reason, /About 73 mi/);
  assert.equal(view.rules.max_cost, 100);
  assert.equal(view.rules.min_profit, 100);
  assert.equal(view.rules.pickup_miles, 15);
  assert.equal(byId['ps-4123518'].quantity, 8);
  assert.equal(byId['ps-4123518'].unit_resale, 40);
  assert.equal(byId['ps-4123524'].quantity, 1);
  assert.equal(byId['ps-4123524'].current_bid, 5);
  assert.equal(byId['ps-4123524'].premium_amount, 1);
  assert.equal(byId['ps-4123524'].all_in, 12.26);
  assert.equal(byId['ps-4123528'].current_bid, 5.5);
  assert.equal(byId['ps-4123530'].current_bid, null);
  assert.equal(byId['ps-4123530'].net_estimate, null);
  assert.equal(byId['ps-4124526'].all_in, 165.02);
  assert.equal(byId['ps-4124526'].close_text, 'Fri, Nov 20, 2026, 3:00 PM CT');
  assert.equal(byId['ps-4128212'].all_in, 32.27);
  assert.equal(byId['ps-4128212'].premium_text, '10.5%');
  assert.equal(byId['ps-4128202'].current_bid, null);
  assert.equal(byId['ps-4128202'].opening_bid, 50);
  assert.equal(byId['ps-4128202'].all_in, null);
  assert.equal(byId['ps-4128202'].close_text, 'unknown');
  assert.equal(byId['ps-4123532'].current_bid, 1);
  assert.equal(byId['ps-4123532'].all_in, 7.93);
  assert.equal(byId['ps-4123532'].unit_resale, null);
  assert.equal(byId['ps-4123508'].bid_count, 0);
  assert.equal(byId['ps-4123506'].bid_count, 0);
  // All ten Schertz lots share one pickup address: the Zebra lot, six S20 FE phones, the S10e and two cash registers.
  assert.equal(view.trips.length, 1);
  assert.equal(view.trips[0].lot_ids.length, 10);
  // The registers have no bids. $10 is the opening price, so there is no current bid and no all-in cost yet.
  for (const id of ['ps-4123508', 'ps-4123506']) {
    assert.equal(byId[id].current_bid, null, id);
    assert.equal(byId[id].opening_bid, 10, id);
    assert.equal(byId[id].all_in, null, id);
    assert.equal(byId[id].close_text, 'Tue, Nov 17, 2026, 8:00 PM CT', id);
    assert.equal(byId[id].premium_text, '8.5%', id);
    assert.equal(byId[id].premium_note, 'Minimum $1.00 per auction.', id);
    assert.equal(byId[id].pickup_address, '1400 Schertz Pkwy Bldg 9, Schertz, TX', id);
    assert.equal(byId[id].unit_resale, null, id);
  }
  assert.equal(view.trips[0].shared_haul, 5.76);
});

test('GET is public, POST requires the worker key, and a local write does not change the seed', async () => {
  const prevKey = process.env.GST_WORKER_KEY;
  const prevBlob = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  process.env.GST_WORKER_KEY = 'test-key';
  const { readSurplus, writeSurplus, surplusFile } = await import('./surplusStore.js');
  const surplus = await import('../app/api/surplus/route.js');
  fs.rmSync(surplusFile, { force: true });
  try {
    const got = await surplus.GET();
    assert.equal(got.status, 200);
    const body = await got.json();
    assert.equal(body.source, 'seed');
    assert.equal(body.sample, false);
    assert.equal(body.places_bids, false);
    assert.equal(body.lots.length, 13);
    assert.equal(body.lots.find((l) => l.id === 'ps-4123518').all_in, 17.67);

    const denied = await surplus.POST(new Request('http://localhost/api/surplus', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-worker-key': 'nope' },
      body: JSON.stringify({ lots: [] }),
    }));
    assert.equal(denied.status, 401);

    const missing = await surplus.POST(new Request('http://localhost/api/surplus', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-worker-key': 'test-key' },
      body: '{',
    }));
    assert.equal(missing.status, 400);

    const written = await writeSurplus({
      scanned_on: '2026-11-15',
      label: 'stored',
      places_bids: true,
      lots: [confirmedLot({ id: 'stored-1' })],
    }, NOW);
    assert.equal(written.source, 'stored');
    assert.equal(written.places_bids, false);
    // A write goes through the same rules. $58.40 is under the $100 minimum, so the incoming buy mark does not stick.
    assert.equal(written.lots[0].net, 58.4);
    assert.equal(written.lots[0].status, 'skip');
    assert.match(written.lots[0].status_reason, /under the \$100\.00 minimum/);
    const again = await readSurplus(NOW);
    assert.equal(again.source, 'stored');
    assert.equal(again.lots[0].id, 'stored-1');
    const seedAgain = JSON.parse(fs.readFileSync(new URL('../config/surplus-scan-2026-11-15.json', import.meta.url), 'utf8'));
    assert.equal(seedAgain.lots.length, 13);
    assert.equal(seedAgain.sample, false);
  } finally {
    fs.rmSync(surplusFile, { force: true });
    if (prevKey === undefined) delete process.env.GST_WORKER_KEY; else process.env.GST_WORKER_KEY = prevKey;
    if (prevBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = prevBlob;
  }
});

// Adam's rules, from config/rules.js.

function ruleLot(extra = {}) {
  // 10 units at a $40 sold comp, 10 miles out, $10 bid: confirmed net is $346.40.
  return confirmedLot({ quantity: 10, ...extra });
}
const ruleOf = (lot, name) => lot.rule_checks.find((c) => c.rule === name);

test('the rules config holds the Nov 3 numbers and the proposed rules are off', () => {
  assert.equal(RULES_CONFIG.max_per_flip, 100);
  assert.equal(RULES_CONFIG.bankroll, 100);
  assert.equal(RULES_CONFIG.min_profit, 100);
  assert.equal(RULES_CONFIG.max_pickup_miles, 15);
  assert.equal(RULES_CONFIG.gas_per_mile, 0.18);
  assert.equal(RULES_CONFIG.gas_per_mile_confirmed, false);
  assert.equal(RULES_CONFIG.home, 'New Braunfels, TX');
  assert.equal(RULES_CONFIG.optional.lot_roi.enabled, false);
  assert.equal(RULES_CONFIG.optional.surplus_radius.enabled, false);
  assert.equal(DEFAULT_RULES.pickup_miles, 15);
  assert.equal(DEFAULT_RULES.max_cost, 100);
});

test('a lot that passes every rule with confirmed profit keeps its buy mark', () => {
  const lot = assessLot(ruleLot(), NOW);
  assert.equal(lot.net, 346.4);
  assert.equal(lot.status, BUY_STATUS);
  assert.equal(lot.rules_pass, true);
  assert.deepEqual(lot.rule_checks.map((c) => [c.rule, c.result]), [['radius', 'pass'], ['max_cost', 'pass'], ['min_profit', 'pass']]);
});

test('past the pickup radius is a skip, at the limit is not', () => {
  const far = assessLot(ruleLot({ miles_from_home: 15.1 }), NOW);
  assert.equal(far.status, 'skip');
  assert.equal(ruleOf(far, 'radius').result, 'fail');
  assert.match(far.status_reason, /15\.1 mi from New Braunfels, TX is past the 15-mile pickup limit/);
  const edge = assessLot(ruleLot({ miles_from_home: 15 }), NOW);
  assert.equal(ruleOf(edge, 'radius').result, 'pass');
  assert.equal(edge.status, BUY_STATUS);
  // A watch lot is skipped too. The rule does not depend on the status that came in.
  assert.equal(assessLot(ruleLot({ miles_from_home: 52, status: 'needs preview' }), NOW).status, 'skip');
});

test('an unknown distance is not a pass and cannot be a buy', () => {
  const lot = assessLot(ruleLot({ miles_from_home: null }), NOW);
  assert.equal(ruleOf(lot, 'radius').result, 'unknown');
  assert.notEqual(lot.status, BUY_STATUS);
  assert.notEqual(lot.status, 'skip');
});

test('all-in cost over $100 is a skip, and exactly $100 is not', () => {
  // Bid $96.40 with no premium or tax, plus $3.60 gas, is $100.00 all-in.
  const edge = assessLot(ruleLot({ current_bid: 96.4, quantity: 20 }), NOW);
  assert.equal(edge.all_in, 100);
  assert.equal(ruleOf(edge, 'max_cost').result, 'pass');
  const over = assessLot(ruleLot({ current_bid: 96.41, quantity: 20 }), NOW);
  assert.equal(over.all_in, 100.01);
  assert.equal(over.status, 'skip');
  assert.match(over.status_reason, /All-in cost \$100\.01 is over the \$100\.00 max per flip/);
  // The bankroll caps cost too when it is the smaller number.
  assert.equal(activeRules({ bankroll: 60 }).max_cost, 60);
});

test('a bid over the cap is a skip even when the all-in cost is unknown', () => {
  const lot = assessLot(ruleLot({ current_bid: 127.5, premium_pct: null }), NOW);
  assert.equal(lot.all_in, null);
  assert.equal(lot.status, 'skip');
  assert.match(lot.status_reason, /The bid alone, \$127\.50, is over/);
  const opening = assessLot(ruleLot({ current_bid: null, opening_bid: 150 }), NOW);
  assert.equal(opening.status, 'skip');
  const unknown = assessLot(ruleLot({ current_bid: null }), NOW);
  assert.equal(ruleOf(unknown, 'max_cost').result, 'unknown');
  assert.notEqual(unknown.status, 'skip');
});

test('profit under $100 is a skip, confirmed or estimated, and exactly $100 passes', () => {
  // 2 units at $40: gross $80, fee $8, all-in $13.60, net $58.40.
  const low = assessLot(confirmedLot(), NOW);
  assert.equal(low.net, 58.4);
  assert.equal(low.status, 'skip');
  assert.match(low.status_reason, /Confirmed profit \$58\.40 is under the \$100\.00 minimum/);
  const estLow = assessLot(confirmedLot({ fee_basis: 'assumption' }), NOW);
  assert.equal(estLow.net, null);
  assert.equal(estLow.net_estimate, 58.4);
  assert.equal(estLow.status, 'skip');
  assert.match(estLow.status_reason, /Even the high case, \$58\.40 at the current bid, is under the \$100\.00 minimum/);
  // Bid $10, gas $3.60, no fee: 3 units at $37.87 is $113.61 gross and $100.01 net; at $37.86 it is $99.98.
  const comp = (price) => [{ type: 'sold', price, url: 'https://www.ebay.com/itm/123456789012', title: 'Sold', marketplace: 'eBay' }];
  const pass = assessLot(confirmedLot({ quantity: 3, fee_rate: 0, comps: comp(37.87) }), NOW);
  assert.equal(pass.net, 100.01);
  assert.equal(ruleOf(pass, 'min_profit').result, 'pass');
  const fail = assessLot(confirmedLot({ quantity: 3, fee_rate: 0, comps: comp(37.86) }), NOW);
  assert.equal(fail.net, 99.98);
  assert.equal(ruleOf(fail, 'min_profit').result, 'fail');
});

test('an estimate that clears $100 stays unknown, and unknown profit is not a skip', () => {
  const est = assessLot(ruleLot({ fee_basis: 'assumption' }), NOW);
  assert.equal(est.net, null);
  assert.equal(ruleOf(est, 'min_profit').result, 'unknown');
  assert.equal(est.status, 'watch');
  const none = assessLot(ruleLot({ comps: ASKING_ONLY, status: 'needs preview' }), NOW);
  assert.equal(ruleOf(none, 'min_profit').result, 'unknown');
  assert.equal(none.status, 'needs preview');
});

test('several broken rules are all named', () => {
  const lot = assessLot(confirmedLot({ miles_from_home: 52, current_bid: 127.5 }), NOW);
  assert.equal(lot.status, 'skip');
  assert.deepEqual(lot.rule_checks.filter((c) => c.result === 'fail').map((c) => c.rule), ['radius', 'max_cost', 'min_profit']);
});

test('the proposed rules do nothing until they are switched on', () => {
  const at40 = ruleLot({ miles_from_home: 40 });
  assert.equal(assessLot(at40, NOW).status, 'skip');
  const wide = activeRules({ optional: { surplus_radius: { enabled: true } } });
  assert.equal(wide.pickup_miles, 60);
  assert.equal(ruleOf(assessLot(at40, NOW, wide), 'radius').result, 'pass');
  // "enabled" has to be exactly true.
  assert.equal(activeRules({ optional: { surplus_radius: { enabled: 'yes' } } }).pickup_miles, 15);

  assert.equal(ruleOf(assessLot(ruleLot(), NOW), 'lot_roi'), undefined);
  const roiOn = activeRules({ optional: { lot_roi: { enabled: true } } });
  // $80 bid, 10 units at $40: all-in $83.60, net $276.40, return about 3.31x.
  assert.equal(ruleOf(assessLot(ruleLot({ current_bid: 80 }), NOW, roiOn), 'lot_roi').result, 'pass');
  // $90 bid: all-in $93.60, net $266.40, return about 2.85x.
  const thin = assessLot(ruleLot({ current_bid: 90 }), NOW, roiOn);
  assert.equal(ruleOf(thin, 'lot_roi').result, 'fail');
  assert.equal(thin.status, 'skip');
});

test('the gas rate comes from the rules', () => {
  assert.equal(assessLot(ruleLot(), NOW).haul_cost, 3.6);
  assert.equal(assessLot(ruleLot(), NOW, activeRules({ gas_per_mile: 0.5 })).haul_cost, 10);
  assert.equal(checkLot({}, DEFAULT_RULES).all_pass, false);
});

// Resale cases and the max bid.

const sale = (price, extra = {}) => ({ type: 'sold', price, url: `https://www.ebay.com/itm/${100000000000 + Math.round(price * 100)}`, title: 'Sold', marketplace: 'eBay', ...extra });
const caseOf = (lot, name) => lot.cases.find((c) => c.name === name);

test('the Zebra lot shows low, middle and high cases priced from battery-less sales', () => {
  const lot = assessLot(seed.lots[0], NOW);
  assert.equal(lot.batteries, 'none');
  assert.equal(lot.batteries_text, 'No batteries');
  assert.equal(lot.comps_lot_sales, 3);
  assert.equal(lot.comps_single_sales, 3);
  // Low: the lowest cited sale of any kind, $17.99, a tested unit that had a battery.
  // 8 x $17.99 = $143.92. Fee 13.6% + $0.40 = $19.97. Shipping $25. Left over: $98.95.
  assert.deepEqual([caseOf(lot, 'low').unit, caseOf(lot, 'low').gross, caseOf(lot, 'low').proceeds], [17.99, 143.92, 98.95]);
  assert.match(caseOf(lot, 'low').basis, /Lowest cited sale of any kind \(has battery\)/);
  // Middle and high: the two lot sales that state no batteries, both $40 a unit.
  // 8 x $40 = $320. Fee $43.92. Shipping $25. Left over: $251.08.
  assert.deepEqual([caseOf(lot, 'middle').unit, caseOf(lot, 'middle').gross, caseOf(lot, 'middle').proceeds], [40, 320, 251.08]);
  assert.match(caseOf(lot, 'middle').basis, /Median of 2 lot sales without batteries/);
  assert.equal(caseOf(lot, 'high').unit, 40);
  // The lot of 3 ($33.33, battery not stated) and the $29.99 single (not re-read) do not set the middle case.
  assert.match(lot.case_caveats.join(' '), /biggest cited lot sale was 5 units\. This lot is 8/);
});

test('the Zebra max bid is $79, and profit is shown at that bid, not only at today\'s bid', () => {
  const lot = assessLot(seed.lots[0], NOW);
  // At $79: premium 8.5% = $6.72 (rounded), tax 8.25% of $85.72 = $7.07, gas $5.76. All-in $98.55.
  assert.equal(lot.max_bid, 79);
  assert.equal(lot.max_bid_all_in, 98.55);
  assert.equal(caseOf(lot, 'low').profit_at_max_bid, 0.4);
  assert.equal(caseOf(lot, 'middle').profit_at_max_bid, 152.53);
  // At today's $10 bid the all-in is $17.67.
  assert.equal(caseOf(lot, 'low').profit_at_current_bid, 81.28);
  assert.equal(caseOf(lot, 'middle').profit_at_current_bid, 233.41);
  // One dollar more and the low case loses money: all-in at $80 is $99.71, over the $98.95 left in the low case.
  assert.ok(98.95 - 99.71 < 0);
  assert.match(lot.max_bid_note, /low case does not lose money/);
  assert.match(lot.max_bid_note, /never bids/);
  assert.equal(lot.bid_past_max, false);
  assert.equal(assessLot({ ...seed.lots[0], current_bid: 85 }, NOW).bid_past_max, true);
  // The profit rule sees the range: the low case is under $100, so it is not a pass.
  const profit = lot.rule_checks.find((c) => c.rule === 'min_profit');
  assert.equal(profit.result, 'unknown');
  assert.match(profit.text, /runs from \$81\.28 \(low case\) to \$233\.41 \(high case\)/);
});

test('with no batteries, a sale that had a battery is lowered by a cited battery cost or left to the low case', () => {
  const lot = { batteries: 'none', battery_cost: null, quantity: 4 };
  const withBattery = resaleCases(lot, [sale(30, { battery: 'none' }), sale(50, { battery: 'included' })].map((c) => ({ lot_size: null, ...c })));
  // The $50 sale had a battery, so it does not set the middle or high case.
  assert.deepEqual(withBattery.cases.map((c) => c.unit), [30, 30, 30]);
  const cheapWithBattery = resaleCases(lot, [sale(30, { battery: 'none' }), sale(12, { battery: 'included' })].map((c) => ({ lot_size: null, ...c })));
  // A cheaper sale that had a battery still pulls the low case down.
  assert.deepEqual(cheapWithBattery.cases.map((c) => c.unit), [12, 30, 30]);
  const adjusted = resaleCases({ ...lot, battery_cost: 15 }, [sale(30, { battery: 'none' }), sale(50, { battery: 'included' })].map((c) => ({ lot_size: null, ...c })));
  // With a cited $15 battery, the $50 sale counts as $35.
  assert.deepEqual(adjusted.cases.map((c) => c.unit), [30, 32.5, 35]);
  const noneKnown = resaleCases(lot, [sale(50, { battery: 'unknown' })].map((c) => ({ lot_size: null, ...c })));
  assert.match(noneKnown.caveats.join(' '), /likely too high/);
});

test('lot sales set the middle case and single sales stay apart', () => {
  const lot = { batteries: 'unknown', battery_cost: null, quantity: 6 };
  const mixed = resaleCases(lot, [
    { ...sale(20), lot_size: 4, battery: 'unknown' },
    { ...sale(30), lot_size: 2, battery: 'unknown' },
    { ...sale(60), lot_size: null, battery: 'unknown' },
    { ...sale(10), lot_size: null, battery: 'unknown' },
  ]);
  assert.deepEqual(mixed.cases.map((c) => c.unit), [10, 25, 30]);
  assert.equal(mixed.lot_sales, 2);
  assert.equal(mixed.single_sales, 2);
  const singles = resaleCases(lot, [{ ...sale(20), lot_size: null, battery: 'unknown' }, { ...sale(40), lot_size: null, battery: 'unknown' }]);
  assert.deepEqual(singles.cases.map((c) => c.unit), [20, 30, 40]);
  assert.match(singles.caveats.join(' '), /A lot usually sells for less a unit/);
});

test('the max bid respects the cost cap, the minimum profit and the low case', () => {
  // 10 units at $40, no fee or tax surprises: left over $360. Gas $3.60. The cost cap is what binds: $96 + $3.60 = $99.60.
  const capped = assessLot(confirmedLot({ quantity: 10 }), NOW);
  assert.equal(capped.max_bid, 96);
  assert.equal(capped.max_bid_all_in, 99.6);
  // 3 units at $40: left over $108. The $100 minimum binds: all-in must be $8 or less, so the bid is $4.
  const thin = assessLot(confirmedLot({ quantity: 3 }), NOW);
  assert.equal(thin.max_bid, 4);
  assert.equal(caseOf(thin, 'middle').profit_at_max_bid, 100.4);
  // 2 units at $40: left over $72. No bid can make $100.
  const none = assessLot(confirmedLot(), NOW);
  assert.equal(none.max_bid, null);
  assert.equal(none.max_bid_text, 'none');
  assert.match(none.max_bid_note, /No bid works\. Even at a \$1 bid the middle case makes \$67\.40/);
  // No bid on the lot yet: the max bid does not need one.
  const noBid = assessLot(confirmedLot({ quantity: 10, current_bid: null }), NOW);
  assert.equal(noBid.max_bid, 96);
  assert.equal(caseOf(noBid, 'middle').profit_at_current_bid, null);
  // Unknown shipping or premium: the max bid stays unknown.
  assert.equal(assessLot(confirmedLot({ quantity: 10, shipping: null, shipping_basis: 'unknown' }), NOW).max_bid, null);
  assert.match(assessLot(confirmedLot({ quantity: 10, premium_pct: null }), NOW).max_bid_note, /unknown until the buyer's premium/);
});

test('a phone lot cannot reach $100 in any case, so it has no max bid', () => {
  const phone = assessSnapshot(seed, NOW).lots.find((l) => l.id === 'ps-4123524');
  assert.equal(phone.cases.length, 3);
  assert.equal(phone.max_bid, null);
  assert.match(phone.max_bid_note, /No bid works/);
  // High case: a working phone at $89.99. Fee 13.6% + $0.40 = $12.64, shipping $6, all-in $12.26. Profit $59.09.
  assert.match(phone.status_reason, /Even the high case, \$59\.09 at the current bid, is under the \$100\.00 minimum/);
});

test('the S20 FE lots use all 35 sold comps, with working and for-parts sales kept apart', () => {
  assert.equal(seed.comp_sets['sm-g781v-128gb'].length, 35);
  const view = assessSnapshot(seed, NOW);
  const phones = view.lots.filter((l) => /S20 FE/.test(l.title));
  assert.equal(phones.length, 6);
  for (const phone of phones) {
    assert.equal(phone.comps.length, 35, phone.id);
    assert.equal(phone.comps_working_sales, 24);
    assert.equal(phone.comps_parts_sales, 11);
    assert.equal(phone.comps_dropped, 0);
    assert.equal(phone.condition, 'unknown');
    // Condition unknown: low and middle come from for-parts sales, high from working sales. Nothing is blended.
    assert.deepEqual(phone.cases.map((c) => c.unit), [37.5, 69.99, 89.99]);
    assert.match(phone.cases[1].basis, /Median of 11 for-parts sales\. The condition is unknown/);
    assert.match(phone.cases[2].basis, /Median of 24 working sales\. Only if it powers on and is not locked/);
    assert.match(phone.lock_flag, /Fleet device\. A device-management, Google account or carrier lock is likely/);
    assert.match(phone.case_caveats.join(' '), /No cited sale is of a locked unit/);
    for (const c of phone.comps) assert.match(c.url, /^https:\/\/www\.ebay\.com\/itm\/\d+$/);
  }
  // The old number was $68: a median across 7 working and 5 for-parts sales picked from the 35.
  assert.notEqual(phones[0].unit_resale, 68);
});

test('a known condition picks its own sales, and a missing kind is said out loud', () => {
  const working = { ...sale(90), lot_size: null, battery: 'unknown', condition: 'working' };
  const working2 = { ...sale(110), lot_size: null, battery: 'unknown', condition: 'working' };
  const parts = { ...sale(40), lot_size: null, battery: 'unknown', condition: 'parts' };
  const base = { batteries: 'unknown', battery_cost: null, quantity: 1, fleet_device: false };
  assert.deepEqual(resaleCases({ ...base, condition: 'working' }, [working, working2, parts]).cases.map((c) => c.unit), [90, 100, 110]);
  assert.deepEqual(resaleCases({ ...base, condition: 'parts' }, [working, working2, parts]).cases.map((c) => c.unit), [40, 40, 40]);
  assert.deepEqual(resaleCases({ ...base, condition: 'unknown' }, [working, working2, parts]).cases.map((c) => c.unit), [40, 40, 100]);
  const onlyWorking = resaleCases({ ...base, condition: 'unknown' }, [working, working2]);
  assert.match(onlyWorking.caveats.join(' '), /Every cited sale is working\. The condition of this lot is unknown/);
  assert.equal(resaleCases({ ...base, condition: 'unknown', fleet_device: false }, [working, parts]).caveats.length, 0);
});

test('a comp set is shared by name, and a missing set is an error', () => {
  const doc = cleanSnapshot({
    comp_sets: { widgets: [sale(40), sale(50)] },
    lots: [{ id: 'a', comp_set: 'widgets' }, { id: 'b', comp_set: 'widgets', comps: [sale(60)] }, { id: 'c' }],
  });
  assert.deepEqual(doc.lots.map((l) => l.comps.length), [2, 3, 0]);
  assert.throws(() => cleanSnapshot({ lots: [{ id: 'a', comp_set: 'nope' }] }), /names comp set nope/);
});

test('comps past the cap are counted, not dropped in silence', () => {
  const many = Array.from({ length: MAX_COMPS + 5 }, (_, i) => sale(10 + i));
  const lot = assessLot(confirmedLot({ comps: many }), NOW);
  assert.equal(lot.comps.length, MAX_COMPS);
  assert.equal(lot.comps_dropped, 5);
  assert.match(lot.comps_note, /5 more comps were sent than the 80 this board keeps/);
  assert.equal(assessLot(confirmedLot(), NOW).comps_note, null);
});
