import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { assessLot, assessSnapshot, formatClose, tripGroups, BUY_STATUS } from './surplus.js';

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

test('an estimate needs every input, is labeled, and never makes a lot a buy', () => {
  const lot = assessLot({ ...seed.lots[0], status: BUY_STATUS }, NOW);
  assert.equal(lot.unit_resale, 36.67);
  assert.equal(lot.gross, 293.36);
  assert.equal(lot.fee_amount, 40.3);
  assert.equal(lot.shipping_text, '$25.00 assumption');
  assert.equal(lot.net, null);
  assert.equal(lot.profit_confidence, 'unknown');
  assert.equal(lot.net_estimate, 210.39);
  assert.match(lot.net_estimate_note, /Estimate, not confirmed/);
  assert.match(lot.net_estimate_note, /tax rate, miles, shipping/);
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
  }, NOW);
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
  }), NOW);
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
  const noShip = assessLot(confirmedLot({ shipping: null, shipping_basis: 'unknown' }));
  assert.equal(noShip.shipping_text, 'unknown');
  assert.equal(noShip.net, null);
  assert.equal(noShip.status, 'watch');
  assert.match(noShip.profit_reason, /shipping/);
  assert.match(noShip.profit_reason, /not treated as zero/);

  const assumedFee = assessLot(confirmedLot({ fee_basis: 'assumption' }));
  assert.match(assumedFee.fee_text, /assumption/);
  assert.equal(assumedFee.net, null);
  assert.equal(assumedFee.profit_confidence, 'unknown');

  const assumedTax = assessLot(confirmedLot({ tax_basis: 'assumption', tax_rate: 0.0825 }));
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
  }));
  assert.equal(noUrl.unit_resale, null);
  assert.match(noUrl.profit_reason, /no URL/);
  assert.equal(noUrl.status, 'watch');
});

test('omitted shipping stays unknown and a non-positive confirmed net is not a buy', () => {
  const omitted = assessLot(confirmedLot({ shipping: undefined, shipping_basis: undefined }));
  assert.equal(omitted.shipping, null);
  assert.equal(omitted.net, null);

  const loser = assessLot(confirmedLot({
    current_bid: 100,
    comps: [{ type: 'sold', price: 20, url: 'https://www.ebay.com/itm/123456789012', title: 'Sold', marketplace: 'eBay' }],
  }));
  assert.ok(loser.net < 0);
  assert.equal(loser.profit_confidence, 'confirmed');
  assert.equal(loser.status, 'watch');
  assert.match(loser.status_reason, /not above zero/);
});

test('needs preview and skip are kept when resale is unknown', () => {
  assert.equal(assessLot({ ...seed.lots[0], comps: ASKING_ONLY, status: 'needs preview' }).status, 'needs preview');
  assert.equal(assessLot({ ...seed.lots[0], comps: ASKING_ONLY, status: 'skip' }).status, 'skip');
  assert.equal(assessLot({ ...seed.lots[0], comps: ASKING_ONLY, status: 'buy now' }).status, 'watch');
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

test('the Nov 15 2026 snapshot is real scan data and marks nothing a buy', () => {
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
  assert.equal(byId['ps-4123518'].status, 'watch');
  assert.equal(byId['ps-4123518'].quantity, 8);
  assert.equal(byId['ps-4123518'].unit_resale, 36.67);
  assert.equal(byId['ps-4123524'].quantity, 1);
  assert.equal(byId['ps-4123524'].current_bid, 5);
  assert.equal(byId['ps-4123524'].premium_amount, 1);
  assert.equal(byId['ps-4123524'].all_in, 12.26);
  assert.equal(byId['ps-4123528'].current_bid, 5.5);
  assert.equal(byId['ps-4123530'].current_bid, null);
  assert.equal(byId['ps-4123530'].net_estimate, null);
  assert.equal(byId['ps-4124526'].status, 'needs preview');
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
  // The Zebra lot, six S20 FE phones, and the S10e share the Schertz pickup address.
  assert.equal(view.trips.length, 1);
  assert.equal(view.trips[0].lot_ids.length, 8);
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
    assert.equal(written.lots[0].status, BUY_STATUS);
    assert.equal(written.lots[0].net, 58.4);
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
