import test from 'node:test';
import assert from 'node:assert/strict';
import { activeRules } from './rules.js';
import { cleanDrive, driveCosts, driveText, geocode, lookUpDrive, placeKey, routeRoundTrip, HOME_POINT, MIN_GEOCODE_CONFIDENCE } from './drive.js';
import { drivesFor, cachedDrives, BATCH_BUDGET_MS, DAILY_LOOKUP_CAP } from './driveStore.js';
import fs from 'fs';
import { assessLot, BUY_STATUS } from './surplus.js';
import { withDrives } from './surplusStore.js';
import { fromDeal } from './feed.js';
import { cleanDeal } from './decision.js';
import { withRules } from './scoutConfig.js';

// Drive time on its own: work time is tested in workTime.test.mjs.
const RULES = activeRules({ work_minutes_per_unit: 0 });
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
// A fake routing service. It records each call so the test can read the URL, the header and the body.
function fakeOrs({ confidence = 0.95, meters = 16093.44, seconds = 900 } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/pelias/v1/search')) return ok({ features: [{ geometry: { coordinates: [-98.27, 29.56] }, properties: { confidence, label: '1400 Schertz Pkwy, Schertz, TX, USA' } }] });
    return ok({ routes: [{ summary: { distance: meters, duration: seconds } }] });
  };
  return { fetch, calls, deps: { fetch, key: 'test-key-not-real' } };
}

test('drive cost is gas on the routed miles plus time at the hourly rate', () => {
  assert.equal(RULES.hourly_rate, 20);
  assert.equal(RULES.max_drive_minutes, 60);
  const c = driveCosts({ minutes_round_trip: 40, miles_round_trip: 31.6 }, RULES);
  // 31.6 miles at $0.18 is $5.69. 40 minutes at $20 an hour is $13.33.
  assert.deepEqual(c, { minutes: 40, miles: 31.6, gas: 5.69, time_cost: 13.33 });
  assert.deepEqual(driveCosts(null, RULES), { minutes: null, miles: null, gas: null, time_cost: null });
  assert.equal(driveText({ minutes_round_trip: 40, miles_round_trip: 31.6 }), '40 min round trip, 31.6 mi');
  assert.equal(driveText(null), 'unknown');
  for (const bad of [{ minutes_round_trip: -1, miles_round_trip: 5 }, { minutes_round_trip: 'soon', miles_round_trip: 5 }, { minutes_round_trip: 30 }, { minutes_round_trip: 99999, miles_round_trip: 5 }, 'x']) assert.equal(cleanDrive(bad), null);
});

test('a place key uses coordinates first and ignores an address too short to mean anything', () => {
  assert.equal(placeKey({ lat: 29.56, lng: -98.27, address: 'x' }), 'p:29.5600,-98.2700');
  assert.equal(placeKey({ address: ' 1400 Schertz Pkwy, Bldg 9, Schertz, TX ' }), 'a:1400 schertz pkwy bldg 9 schertz tx');
  assert.equal(placeKey({ address: 'TX' }), null);
  assert.equal(placeKey(null), null);
});

test('the routing calls send the key in a header, never in the URL, and double the one-way trip', async () => {
  const ors = fakeOrs();
  const drive = await lookUpDrive({ address: '1400 Schertz Pkwy Bldg 9, Schertz, TX' }, ors.deps);
  // 10 miles and 15 minutes one way.
  assert.deepEqual([drive.minutes_round_trip, drive.miles_round_trip, drive.source], [30, 20, 'openrouteservice']);
  assert.equal(ors.calls.length, 2);
  const [geo, route] = ors.calls;
  assert.match(geo.url, /^https:\/\/api\.heigit\.org\/pelias\/v1\/search\?/);
  assert.match(geo.url, /boundary\.country=US/);
  assert.match(route.url, /^https:\/\/api\.heigit\.org\/openrouteservice\/v2\/directions\/driving-car\/json$/);
  for (const c of ors.calls) {
    assert.equal(c.init.headers.Authorization, 'test-key-not-real');
    assert.equal(c.url.includes('test-key-not-real'), false);
  }
  // Longitude first, home first.
  assert.deepEqual(JSON.parse(route.init.body).coordinates, [[HOME_POINT.lng, HOME_POINT.lat], [-98.27, 29.56]]);
  // Coordinates skip the geocoder.
  const direct = fakeOrs();
  await lookUpDrive({ lat: 29.56, lng: -98.27 }, direct.deps);
  assert.equal(direct.calls.length, 1);
});

test('a weak address match or a broken answer leaves the drive unknown', async () => {
  const weak = fakeOrs({ confidence: MIN_GEOCODE_CONFIDENCE - 0.1 });
  assert.equal(await geocode('Main St', weak.deps), null);
  assert.equal(await lookUpDrive({ address: 'Main St' }, weak.deps), null);
  assert.equal(weak.calls.length, 2);
  const empty = { fetch: async () => ok({ routes: [] }), key: 'k' };
  assert.equal(await routeRoundTrip({ lat: 1, lng: 2 }, empty), null);
  const down = { fetch: async () => ({ ok: false, status: 429, json: async () => ({}) }), key: 'k' };
  await assert.rejects(() => routeRoundTrip({ lat: 1, lng: 2 }, down), /429/);
});

test('each place is looked up once, lookups are capped, and no key means no lookup', async () => {
  let saved = null;
  const mem = {};
  const store = { load: async () => mem, save: async (e) => { saved = e; } };
  const ors = fakeOrs();
  const places = [{ lat: 29.5, lng: -98.2 }, { lat: 29.5, lng: -98.2 }, { lat: 29.6, lng: -98.3 }, { lat: 29.7, lng: -98.4 }];
  const first = await drivesFor(places, { max: 2, deps: ors.deps, store });
  // Three different places, two lookups allowed.
  assert.equal(ors.calls.length, 2);
  assert.equal([...first.values()].filter(Boolean).length, 2);
  assert.equal(Object.keys(saved).filter((k) => !k.startsWith('_')).length, 2);
  // The key is not in what is stored.
  assert.equal(JSON.stringify(saved).includes('test-key-not-real'), false);
  await drivesFor(places, { max: 2, deps: ors.deps, store });
  // Only the one place still missing is looked up the second time.
  assert.equal(ors.calls.length, 3);
  const none = fakeOrs();
  const out = await drivesFor([{ lat: 30, lng: -97 }], { deps: { fetch: none.fetch, key: null }, store: { load: async () => ({}), save: async () => {} } });
  assert.equal(none.calls.length, 0);
  assert.equal(out.get('p:30.0000,-97.0000'), null);
  // A service that is down is a miss, not a crash, and is not retried for a day.
  const fail = { fetch: async () => { throw new Error('down'); }, key: 'k' };
  const m2 = {};
  const st2 = { load: async () => m2, save: async () => {} };
  assert.equal((await drivesFor([{ lat: 31, lng: -97 }], { deps: fail, store: st2 })).get('p:31.0000,-97.0000'), null);
  assert.ok(m2['p:31.0000,-97.0000'].failed_at);
  let again = 0;
  await drivesFor([{ lat: 31, lng: -97 }], { deps: { fetch: async () => { again += 1; throw new Error('down'); }, key: 'k' }, store: st2 });
  assert.equal(again, 0);
});

const lot = (extra = {}) => ({
  id: 'd-1', title: 'Widget', source_site: 'Public Surplus', status: BUY_STATUS, current_bid: 10, bid_count: 1, premium_pct: 0,
  tax_basis: 'stated', tax_rate: 0, miles_from_home: 10, miles_approximate: false, quantity: 5, fee_rate: 0.1, fee_basis: 'stated',
  shipping: 0, shipping_basis: 'stated', pickup_address: '1 Main St, Schertz, TX',
  comps: [{ type: 'sold', price: 40, url: 'https://www.ebay.com/itm/123456789012', title: 'Sold widget', marketplace: 'eBay' }],
  ...extra,
});
const ruleOf = (view, name) => view.rule_checks.find((c) => c.rule === name);

test('a lot counts drive time against profit, uses routed miles for gas, and keeps time out of the cash cost', () => {
  const view = assessLot(lot({ drive: { minutes_round_trip: 30, miles_round_trip: 24, source: 'openrouteservice' } }), null, RULES);
  // Gas: 24 routed miles at $0.18 is $4.32, not 20 stated miles. All-in: $10 + $4.32.
  assert.deepEqual([view.haul_cost, view.haul_basis, view.all_in], [4.32, 'routed', 14.32]);
  // Time: 30 minutes at $20 is $10. Gross $200, fee $20, so net is 200 - 20 - 14.32 - 10.
  assert.deepEqual([view.time_cost, view.net], [10, 155.68]);
  assert.equal(ruleOf(view, 'drive_time').result, 'pass');
  assert.equal(view.status, BUY_STATUS);
  assert.equal(view.drive_text, '30 min round trip, 24 mi');
});

test('a lot with no drive time is never a buy, and says time was left out', () => {
  const view = assessLot(lot(), null, RULES);
  assert.equal(ruleOf(view, 'drive_time').result, 'unknown');
  assert.equal(view.net, null);
  assert.equal(view.time_cost, null);
  assert.notEqual(view.status, BUY_STATUS);
  assert.match(view.time_note, /left out/);
  assert.match(view.net_estimate_note, /drive time left out/);
});

test('a drive over the cap is a skip, and exactly at the cap passes', () => {
  const over = assessLot(lot({ drive: { minutes_round_trip: 61, miles_round_trip: 20 } }), null, RULES);
  assert.equal(ruleOf(over, 'drive_time').result, 'fail');
  assert.equal(over.status, 'skip');
  assert.match(over.status_reason, /61-minute round trip is over the 60-minute drive cap/);
  assert.equal(ruleOf(assessLot(lot({ drive: { minutes_round_trip: 60, miles_round_trip: 20 } }), null, RULES), 'drive_time').result, 'pass');
});

test('time cost lowers the max bid', () => {
  // Three units: left over after the sale is $108. Without time the $100 minimum allows an $8 all-in.
  const base = { quantity: 3 };
  const free = assessLot(lot({ ...base, drive: { minutes_round_trip: 0, miles_round_trip: 20 } }), null, RULES);
  const timed = assessLot(lot({ ...base, drive: { minutes_round_trip: 6, miles_round_trip: 20 } }), null, RULES);
  // Six minutes is $2 of time, so the bid drops by $2.
  assert.equal(free.max_bid - timed.max_bid, 2);
});

test('the store adds a drive to lots that have a place and keeps a posted one', async () => {
  // Lot c has a city and no pickup address. The middle of a city is not a pickup point, so it is not routed.
  const doc = { lots: [lot({ id: 'a' }), lot({ id: 'b', drive: { minutes_round_trip: 12, miles_round_trip: 8 } }), lot({ id: 'c', pickup_address: null, city: 'Schertz, TX' })] };
  const seen = [];
  const out = await withDrives(doc, async (places) => { seen.push(...places); return new Map(places.map((p) => [placeKey(p), { minutes_round_trip: 30, miles_round_trip: 24, source: 'openrouteservice' }])); });
  assert.deepEqual(seen, [{ address: '1 Main St, Schertz, TX' }]);
  assert.equal(out.lots[0].drive.minutes_round_trip, 30);
  assert.equal(out.lots[1].drive.minutes_round_trip, 12);
  assert.equal(out.lots[2].drive, undefined);
  // A lookup that throws leaves the document as it was.
  assert.equal(await withDrives(doc, async () => { throw new Error('down'); }), doc);
});

test('a listing takes drive time off profit, and is not a buy when the drive is unknown or too long', () => {
  const sold = (price, i) => ({ url: `https://www.ebay.com/itm/90000000020${i}`, price, shipping: 10, sold: true, title: 'Canon EOS R body', condition: 'Used', model: 'EOS R', sold_at: '2026-10-01' });
  const deal = cleanDeal({ source: 'fb', url: 'https://www.facebook.com/marketplace/item/321/', title: 'Canon EOS R body', ask: 40, distance_mi: 8, distance_from: 'New Braunfels', area: 'New Braunfels', category: 'cameras', condition: 'Used', model: 'EOS R', comps: [210, 220, 230, 240].map(sold) });
  const config = withRules(null);
  config.fees = Object.fromEntries(Object.entries(config.fees).map(([k, v]) => [k, { ...v, confirmed: true }]));
  const free = fromDeal({ ...deal, drive: { minutes_round_trip: 0, miles_round_trip: 16 } }, config);
  const timed = fromDeal({ ...deal, drive: { minutes_round_trip: 30, miles_round_trip: 16 } }, config);
  assert.equal(free.decision.value, 'buy');
  // Thirty minutes is $10 off every case.
  assert.equal(Math.round((free.profit.middle - timed.profit.middle) * 100) / 100, 10);
  assert.equal(Math.round((free.profit.low - timed.profit.low) * 100) / 100, 10);
  assert.deepEqual([timed.costs.time, timed.location.drive_minutes_round_trip], [10, 30]);
  const unknown = fromDeal(deal, config);
  assert.equal(unknown.decision.value, 'watch');
  // The max offer was worked out without time, and it says so. With a known drive it does not.
  assert.match(unknown.max_bid_note, /Drive time is unknown and is left out, so the real max offer is lower/);
  assert.equal(/left out/.test(timed.max_bid_note), false);
  assert.ok(unknown.unknown.includes('costs.time'));
  assert.match(unknown.decision.reasons.join(' '), /drive time is unknown/);
  const far = fromDeal({ ...deal, drive: { minutes_round_trip: 65, miles_round_trip: 16 } }, config);
  assert.equal(far.decision.value, 'skip');
  assert.match(far.decision.reasons.join(' '), /65-minute round trip is over the 60-minute drive cap/);
});

test('a slow batch stops starting lookups, keeps what it found, and saves it', async () => {
  let saved = null;
  const store = { load: async () => ({}), save: async (e) => { saved = e; } };
  const ors = fakeOrs();
  // A clock that jumps past the budget after the first lookup has started.
  let t = 0;
  const clock = () => { const now = t; t += BATCH_BUDGET_MS; return now; };
  const places = [{ lat: 29.5, lng: -98.2 }, { lat: 29.6, lng: -98.3 }, { lat: 29.7, lng: -98.4 }];
  const out = await drivesFor(places, { deps: ors.deps, store, clock });
  assert.equal(ors.calls.length, 1);
  assert.equal([...out.values()].filter(Boolean).length, 1);
  assert.equal(out.size, 3);
  assert.equal(Object.keys(saved).filter((k) => !k.startsWith('_')).length, 1);
});

test('a public read never calls the routing service, even with a key and an empty cache', async () => {
  const ors = fakeOrs();
  let saved = 0;
  const store = { load: async () => ({ 'p:29.5000,-98.2000': { drive: { minutes_round_trip: 20, miles_round_trip: 12, source: 'openrouteservice' } } }), save: async () => { saved += 1; } };
  const out = await cachedDrives([{ lat: 29.5, lng: -98.2 }, { lat: 29.6, lng: -98.3 }], { deps: ors.deps, store });
  assert.equal(ors.calls.length, 0);
  assert.equal(saved, 0);
  // The cached place is served. The other stays unknown until a call with the worker key looks it up.
  assert.equal(out.get('p:29.5000,-98.2000').minutes_round_trip, 20);
  assert.equal(out.get('p:29.6000,-98.3000'), null);
  // The public routes use the cache-only reader. Only the worker-key routes import the one that looks up.
  const src = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  assert.equal(/\bdrivesFor\b/.test(src('../app/api/feed/route.js')), false);
  assert.match(src('./surplusStore.js'), /readSurplus\(nowMs = null, rules = undefined, find = cachedDrives\)/);
  for (const p of ['../app/api/deals/route.js', '../app/api/drive/refresh/route.js']) {
    const text = src(p);
    assert.ok(text.indexOf('workerCheck(req)') > -1 && text.indexOf('workerCheck(req)') < text.indexOf('drivesFor('), p);
  }
});

test('lookups stop at the daily cap and start again the next day', async () => {
  const mem = { _day: { day: '2026-11-17', count: DAILY_LOOKUP_CAP - 1 } };
  const store = { load: async () => mem, save: async () => {} };
  const ors = fakeOrs();
  const noon = Date.parse('2026-11-17T12:00:00Z');
  const out = await drivesFor([{ lat: 29.5, lng: -98.2 }, { lat: 29.6, lng: -98.3 }], { deps: ors.deps, store, nowMs: noon });
  // One lookup was left for the day.
  assert.equal(ors.calls.length, 1);
  assert.equal([...out.values()].filter(Boolean).length, 1);
  assert.equal(mem._day.count, DAILY_LOOKUP_CAP);
  await drivesFor([{ lat: 29.7, lng: -98.4 }], { deps: ors.deps, store, nowMs: noon });
  assert.equal(ors.calls.length, 1);
  await drivesFor([{ lat: 29.7, lng: -98.4 }], { deps: ors.deps, store, nowMs: noon + 24 * 3600 * 1000 });
  assert.equal(ors.calls.length, 2);
  assert.deepEqual(mem._day, { day: '2026-11-18', count: 1 });
});
