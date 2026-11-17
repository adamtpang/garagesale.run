import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { assessSnapshot } from './surplus.js';
import { buildDailyFeed, fromDeal } from './feed.js';
import { withRules } from './scoutConfig.js';
import { cleanDeal } from './decision.js';

const seed = JSON.parse(fs.readFileSync(new URL('../config/surplus-scan-2026-11-15.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-11-16T18:00:00.000Z');
// The rules file, with the fee sign-off a buy needs. Adam has not given it in the real config.
const confirmed = () => { const c = withRules(null); c.fees = Object.fromEntries(Object.entries(c.fees).map(([k, v]) => [k, { ...v, confirmed: true }])); return c; };
const sold = (price, i) => ({ url: `https://www.ebay.com/itm/90000000020${i}`, price, shipping: 10, sold: true, title: 'Canon EOS R body', condition: 'Used', model: 'EOS R', sold_at: '2026-10-01' });
// The fixture drive takes no time, so the older tests keep their numbers. Drive time is tested in drive.test.mjs.
const camera = ({ drive = { minutes_round_trip: 0, miles_round_trip: 16, source: 'fixture' }, ...extra } = {}) => ({ drive, ...cleanDeal({
  source: 'fb', url: 'https://www.facebook.com/marketplace/item/321/', title: 'Canon EOS R body', ask: 40,
  distance_mi: 8, distance_from: 'New Braunfels', area: 'New Braunfels', category: 'cameras', condition: 'Used', model: 'EOS R',
  comps: [210, 220, 230, 240].map(sold), ...extra,
}) });
const surplus = () => ({ ...assessSnapshot(seed, NOW), source: 'seed', updated_at: null });
const feed = (deals = [], config = confirmed()) => buildDailyFeed({ surplus: surplus(), deals: { updated_at: '2026-11-16T12:00:00.000Z', deals }, config, nowMs: NOW });

test('a listing carries its costs, three resale cases, profit, ROI and the most to offer', () => {
  const item = fromDeal(camera(), confirmed());
  // Resale $225 (middle of four sold comps). eBay fee 13.6% + $0.40 = $31.00. Shipping $10. Gas 8 mi x 2 x $0.18 = $2.88.
  assert.deepEqual([item.resale.low, item.resale.middle, item.resale.high], [220, 225, 230]);
  assert.deepEqual([item.costs.fee, item.costs.shipping, item.costs.gas, item.costs.all_in], [31, 10, 2.88, 42.88]);
  // 225 - 31 - 10 - 42.88 = 141.12. Low: 220 - 30.32 - 10 - 42.88 = 136.80. High: 230 - 31.68 - 10 - 42.88 = 145.44.
  assert.deepEqual([item.profit.low, item.profit.middle, item.profit.high], [136.8, 141.12, 145.44]);
  assert.equal(item.roi, 3.291);
  // Most to offer: 225 - 31 - 10 - 2.88 - 100 = 81.12, so $81. The $100 cap would allow $97.
  assert.equal(item.max_bid, 81);
  assert.match(item.max_bid_note, /Nothing here contacts a seller/);
  assert.equal(item.decision.value, 'buy');
  assert.equal(item.decision.needs_adam_yes, true);
  assert.equal(item.source.url, 'https://www.facebook.com/marketplace/item/321/');
  assert.equal(item.location.miles, 8);
  for (const c of item.comps) { assert.match(c.url, /^https:\/\/www\.ebay\.com\/itm\//); assert.equal(c.sold_on, '2026-10-01'); }
});

test('a listing that breaks a rule is a skip with the reason, and unknown values stay null', () => {
  const far = fromDeal(camera({ area: 'Austin', distance_from: 'Austin' }), confirmed());
  assert.equal(far.decision.value, 'skip');
  assert.match(far.decision.reasons.join(' '), /Austin is not a pickup origin/);
  assert.equal(far.location.miles, null);
  assert.equal(far.costs.gas, null);
  assert.equal(far.costs.all_in, null);
  assert.equal(far.max_bid, null);
  assert.ok(far.unknown.includes('location.miles'));
  assert.ok(far.unknown.includes('costs.all_in'));
  const pricey = fromDeal(camera({ ask: 150 }), confirmed());
  assert.equal(pricey.decision.value, 'skip');
  // With the real config the fee is unconfirmed, so nothing is a buy.
  assert.notEqual(fromDeal(camera(), withRules(null)).decision.value, 'buy');
});

test('a surplus lot carries the same fields, with each sold comp link and date', () => {
  const z = feed().items.find((i) => i.id === 'ps-4123518');
  assert.equal(z.kind, 'surplus');
  assert.equal(z.source.site, 'Public Surplus');
  assert.match(z.source.url, /auc=4123518$/);
  assert.deepEqual([z.location.place, z.location.miles, z.location.miles_approximate], ['Schertz, TX', 16, true]);
  assert.deepEqual([z.price.kind, z.price.current, z.price.bid_count, z.price.closes_at], ['bid', 10, 1, '2026-11-18T02:00:00.000Z']);
  assert.equal(z.price.closes_text, 'Tue, Nov 17, 2026, 8:00 PM CT');
  assert.deepEqual([z.costs.premium, z.costs.tax, z.costs.gas, z.costs.all_in, z.costs.shipping], [1, 0.91, 5.76, 17.67, 25]);
  assert.equal(z.costs.tax_basis, 'assumption');
  assert.deepEqual([z.resale.low, z.resale.middle, z.resale.high, z.resale.units], [17.99, 40, 40, 8]);
  assert.deepEqual([z.profit.low, z.profit.middle, z.profit.high], [81.28, 233.41, 233.41]);
  assert.equal(z.profit.confirmed, null);
  assert.deepEqual(z.profit.at_max_bid, { low: 0.4, middle: 152.53, high: 152.53 });
  assert.equal(z.max_bid, 79);
  assert.equal(z.roi_basis, 'middle case estimate');
  assert.equal(z.decision.value, 'skip');
  assert.match(z.decision.reasons.join(' '), /past the 15-mile pickup limit/);
  assert.ok(z.risks.some((r) => /Fleet device/.test(r)));
  const soldComps = z.comps.filter((c) => c.type === 'sold');
  assert.equal(soldComps.length, 6);
  for (const c of soldComps) { assert.match(c.url, /^https:\/\/www\.ebay\.com\/itm\/\d+$/); assert.match(c.sold_on, /2026$/); }
  // An asking comp is passed through labeled, with no sale date.
  assert.equal(z.comps.find((c) => c.type === 'asking').sold_on, null);
});

test('unknown values on a lot are null and listed, never zero', () => {
  const tv = feed().items.find((i) => i.id === 'ps-4128202');
  assert.equal(tv.price.current, null);
  assert.equal(tv.price.closes_at, null);
  assert.equal(tv.price.closes_text, null);
  assert.equal(tv.costs.all_in, null);
  assert.equal(tv.resale.middle, null);
  assert.equal(tv.profit.middle, null);
  assert.equal(tv.roi, null);
  assert.equal(tv.max_bid, null);
  for (const key of ['price.current', 'price.closes_at', 'costs.all_in', 'resale.middle', 'profit.middle', 'roi', 'max_bid']) assert.ok(tv.unknown.includes(key), key);
});

test('the feed puts buys first, counts each decision, and says when its data is old', () => {
  const f = feed([camera(), camera({ url: 'https://www.facebook.com/marketplace/item/322/', area: 'Austin', distance_from: 'Austin' })]);
  assert.equal(f.kind, 'daily-deals-feed');
  assert.equal(f.places_bids, false);
  assert.equal(f.contacts_sellers, false);
  assert.deepEqual(f.counts, { buy: 1, watch: 0, skip: 14 });
  assert.equal(f.items[0].decision.value, 'buy');
  assert.equal(f.items[0].kind, 'listing');
  // Among the skips, the best estimate comes first and unknown profit comes last.
  assert.equal(f.items[1].id, 'ps-4123518');
  assert.equal(f.items[f.items.length - 1].profit.middle, null);
  assert.deepEqual([f.rules.max_cost, f.rules.min_profit, f.rules.pickup_miles], [100, 100, 15]);
  assert.match(f.stale.join(' '), /No surplus scan has been posted/);
  const old = buildDailyFeed({ surplus: surplus(), deals: { updated_at: '2026-10-23T12:00:00.000Z', deals: [] }, config: confirmed(), nowMs: NOW });
  assert.match(old.stale.join(' '), /The listings feed is 24 days old/);
  const none = buildDailyFeed({ surplus: surplus(), deals: null, config: confirmed(), nowMs: NOW });
  assert.equal(none.sources.listings.deals, 0);
  assert.equal(none.items.length, 13);
  // A missing listings feed is said out loud, whether it was never posted or could not be read.
  assert.match(none.stale.join(' '), /No listings feed was found/);
  assert.match(buildDailyFeed({ surplus: surplus(), deals: { deals: [] }, config: confirmed(), nowMs: NOW }).stale.join(' '), /No listings feed was found/);
  assert.equal(/No listings feed/.test(feed().stale.join(' ')), false);
});

test('GET /api/feed is public, read-only and returns the feed', async () => {
  const prevBlob = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try {
    const route = await import('../app/api/feed/route.js');
    assert.deepEqual(Object.keys(route).filter((k) => /^[A-Z]+$/.test(k)), ['GET']);
    const res = await route.GET();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.kind, 'daily-deals-feed');
    // Another test file may be writing a stored scan at the same moment, so the count is not pinned here.
    assert.ok(Array.isArray(body.items));
    assert.equal(body.counts.buy + body.counts.watch + body.counts.skip, body.items.length);
    assert.equal(body.places_bids, false);
  } finally {
    if (prevBlob !== undefined) process.env.BLOB_READ_WRITE_TOKEN = prevBlob;
  }
});

test('a listing is never a buy while its ask is above its own max offer', () => {
  // Ask $99 fits the $100 cap alone. With 8 miles of gas ($2.88) the cost is $101.88, which does not.
  const comps = [410, 420, 430, 440].map((price, i) => sold(price, i));
  const near = fromDeal(camera({ ask: 99, comps }), confirmed());
  assert.equal(near.costs.all_in, 101.88);
  assert.equal(near.decision.value, 'skip');
  assert.match(near.decision.reasons.join(' '), /Ask plus gas is \$101\.88, over the \$100\.00 max per flip/);
  assert.equal(near.max_bid, 97);
  // One that fits with gas stays a buy, and its ask is inside its max offer.
  const fits = fromDeal(camera({ ask: 97, comps }), confirmed());
  assert.equal(fits.costs.all_in, 99.88);
  assert.equal(fits.decision.value, 'buy');
  assert.ok(fits.price.current <= fits.max_bid);
  // Across a spread of asks, a buy never sits above its max offer.
  for (let ask = 1; ask <= 120; ask += 1) {
    const it = fromDeal(camera({ ask, comps }), confirmed());
    if (it.decision.value === 'buy') assert.ok(it.max_bid != null && ask <= it.max_bid, `ask ${ask}`);
  }
  // The same holds to the cent. The max offer is whole dollars, but an ask that fits is never above it.
  // $97.05 plus $2.88 gas is $99.93, inside the cap, while the whole-dollar ceiling is $97.
  const cents = fromDeal(camera({ ask: 97.05, comps }), confirmed());
  assert.equal(cents.decision.value, 'buy');
  assert.equal(cents.max_bid, 97.05);
  // $97.13 plus gas is $100.01, over the cap: a skip, and the ceiling stays at whole dollars.
  const over = fromDeal(camera({ ask: 97.13, comps }), confirmed());
  assert.equal(over.decision.value, 'skip');
  assert.equal(over.max_bid, 97);
  let buys = 0;
  for (let c = 9000; c <= 10100; c += 1) {
    const it = fromDeal(camera({ ask: c / 100, comps }), confirmed());
    if (it.decision.value === 'buy') { buys += 1; assert.ok(it.max_bid != null && c / 100 <= it.max_bid, `ask ${c / 100}`); }
  }
  assert.ok(buys > 100);
  // The minimum-profit side, to the cent: with $225 resale the exact ceiling is $81.12.
  let thin = 0;
  for (let c = 7900; c <= 8300; c += 1) {
    const it = fromDeal(camera({ ask: c / 100 }), confirmed());
    if (it.decision.value === 'buy') { thin += 1; assert.ok(c / 100 <= it.max_bid, `ask ${c / 100}`); }
  }
  assert.ok(thin > 100);
});
