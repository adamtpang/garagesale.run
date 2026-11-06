import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { cleanComp, cleanDeal, buildFeed } from './deals.js';
import { cleanConfig, emptyConfig, filtersReady, SOURCES } from './scoutConfig.js';
import { scoutFreshness, STALE_MS } from './ago.js';

const seed = JSON.parse(fs.readFileSync(new URL('../config/scout-config.seed.json', import.meta.url), 'utf8'));

function confirmFees(fees) {
  return Object.fromEntries(Object.entries(fees).map(([k, v]) => [k, { ...v, confirmed: true }]));
}
function ready(over = {}) {
  const fees = Object.prototype.hasOwnProperty.call(over, 'fees') ? over.fees : confirmFees(seed.fees);
  return cleanConfig({ ...seed, ...over, fees, areas: over.areas || seed.areas });
}

const ebayComp = (price, extra = {}) => ({ url: 'https://www.ebay.com/itm/1234567890', price, shipping: 10, title: 'Sold camera', sold: true, ...extra });
const fbDeal = (extra = {}) => ({
  source: 'fb', url: 'https://www.facebook.com/marketplace/item/999/', title: 'Camera',
  ask: 50, distance_mi: 10, distance_from: 'New Braunfels', area: 'New Braunfels', seller_name: 'should drop', comps: [ebayComp(200)], ...extra,
});
const matched = (price, i) => ({
  url: `https://www.ebay.com/itm/90000000020${i}`, price, shipping: 10, sold: true,
  title: 'Canon EOS R body', condition: 'Used', model: 'EOS R', sold_at: '2026-10-01',
});
function buyable(extra = {}) {
  const comps = [210, 220, 230, 240].map((price, i) => matched(price, i));
  return {
    source: 'fb', url: 'https://www.facebook.com/marketplace/item/321/', title: 'Canon EOS R body',
    ask: 40, distance_mi: 8, distance_from: 'New Braunfels', area: 'New Braunfels',
    category: 'cameras', condition: 'Used', model: 'EOS R', ...extra, comps: extra.comps || comps,
  };
}

test('seed config has the owner values, including the gas estimate', () => {
  assert.equal(seed.max_per_flip, 100);
  assert.equal(seed.bankroll, 100);
  assert.equal(seed.min_profit, 100);
  assert.equal(seed.max_pickup_miles, 15);
  assert.deepEqual(seed.categories, ['electronics', 'game consoles', 'tools', 'furniture', 'bikes', 'cameras']);
  assert.deepEqual(seed.sites, ['fb', 'craigslist', 'ebay', 'offerup']);
  assert.equal(seed.run_hours, 'daily daytime');
  assert.deepEqual(seed.areas.map((a) => a.name), ['New Braunfels', 'San Marcos', 'Austin']);
  assert.equal(seed.gas_per_mile, 0.18);
  assert.match(seed.gas_per_mile_note, /^estimate:/);
  assert.equal(seed.fees.offerup.rate, 0);
  assert.equal(seed.fees.ebay.rate, 0.1325);
  assert.equal(seed.fees.ebay.plus_shipping, true);
  assert.equal(seed.fees.fb.confirmed, false);
  const cfg = cleanConfig(seed);
  assert.equal(filtersReady(cfg), true);
  assert.equal(cfg.gas_per_mile, 0.18);
  assert.deepEqual(SOURCES, ['fb', 'craigslist', 'ebay', 'offerup']);
});

test('config defaults are null, and a missing required filter leaves deals unranked', () => {
  const empty = emptyConfig();
  for (const k of Object.keys(empty)) assert.equal(empty[k], null);
  assert.equal(filtersReady(empty), false);
  const feed = buildFeed([fbDeal()], empty);
  assert.equal(feed.filters_set, false);
  assert.equal(feed.deals.length, 1);
  assert.equal(feed.deals[0].ranked, false);
  assert.equal(feed.deals[0].rank, null);
  const partial = buildFeed([fbDeal()], ready({ min_profit: null }));
  assert.equal(partial.filters_set, false);
  assert.equal(partial.deals[0].ranked, false);
  // 200 resale, 50 ask, eBay fee 26.50, shipping 10, gas 3.60. Buy source does not set the fee.
  assert.equal(partial.deals[0].profit, 109.9);
  assert.equal(partial.deals[0].resale_venue, 'ebay');
});

test('Craigslist, Swappa, search, retail and active comps are rejected', () => {
  assert.equal(cleanComp({ url: 'https://austin.craigslist.org/for/d/bike/123.html', price: 40, sold: true, source: 'craigslist' }), null);
  assert.equal(cleanComp({ url: 'https://swappa.com/buy/apple-iphone-13', price: 400, sold: true }), null);
  assert.equal(cleanComp({ url: 'https://www.ebay.com/sch/i.html?_nkw=camera', price: 200, sold: true }), null);
  assert.equal(cleanComp({ url: 'https://www.amazon.com/dp/B000000', price: 200, sold: true }), null);
  assert.equal(cleanComp({ url: 'https://www.ebay.com/itm/1234567890', price: 200, sold: false }), null);
  assert.equal(cleanComp({ url: 'https://www.ebay.com/itm/1234567890', price: 200, status: 'active' }), null);
  assert.equal(cleanComp({ url: 'https://www.ebay.com/itm/1234567890', price: 200, shipping: 10 }), null);
  const kept = cleanComp(ebayComp(200));
  assert.equal(kept.source, 'ebay');
  assert.equal(kept.sold, true);
  assert.equal(kept.sold_evidence, 'marked');
  const marked = cleanComp({ url: 'https://www.mercari.com/transaction/m123', price: 80, sold: true, source: 'mercari' });
  assert.equal(marked.price, 80);
});

test('no comps left means resale is null and the deal is unranked', () => {
  const feed = buildFeed([fbDeal({ comps: [
    { url: 'https://austin.craigslist.org/for/d/x/1.html', price: 180, sold: true },
    { url: 'https://swappa.com/guide/cameras', price: 220, sold: true },
  ] })], ready());
  const d = feed.deals[0];
  assert.equal(d.resale, null);
  assert.equal(d.profit, null);
  assert.equal(d.ranked, false);
  assert.match(d.unranked_reason, /sold comps/i);
  assert.equal(d.seller_name, undefined);
  assert.equal(d.title, 'Camera');
});

test('profit is resale minus ask, the resale-venue fee, shipping and the round trip for gas', () => {
  const ebay = buildFeed([fbDeal({ source: 'ebay', url: 'https://www.ebay.com/itm/555' })], ready());
  const d = ebay.deals[0];
  // One sold comp at 200. Fee follows the comp venue (eBay), not a silent zero.
  // 200 - 50 ask - 26.50 fee - 10 shipping - 3.60 gas.
  assert.equal(d.fee, 26.5);
  assert.equal(d.gas, 3.6);
  assert.equal(d.shipping, 10);
  assert.equal(d.profit, 109.9);
  assert.equal(d.ranked, false);
  assert.ok(d.decision_reasons.includes('thin-comps'));

  const local = buildFeed([fbDeal({ source: 'offerup', url: 'https://offerup.com/item/detail/1' })], ready());
  assert.equal(local.deals[0].resale_venue, 'ebay');
  assert.equal(local.deals[0].fee, 26.5);
  assert.equal(local.deals[0].profit, 109.9);

  const noGas = buildFeed([fbDeal()], ready({ gas_per_mile: null }));
  assert.equal(noGas.deals[0].gas, null);
  assert.equal(noGas.deals[0].profit, null);
  assert.ok(noGas.deals[0].flags.includes('gas rate unknown'));
  assert.equal(noGas.deals[0].ranked, false);

  const noShip = buildFeed([fbDeal({ comps: [ebayComp(200, { shipping: undefined })] })], ready());
  assert.equal(noShip.deals[0].shipping, null);
  assert.equal(noShip.deals[0].profit, null);
  assert.ok(noShip.deals[0].flags.includes('shipping unknown'));

  const buy = buildFeed([buyable()], ready());
  assert.equal(buy.deals[0].profit, 142.31);
  assert.equal(buy.deals[0].decision, 'buy');
  assert.equal(buy.deals[0].ranked, true);
  assert.equal(buy.deals[0].rank, 1);
});

test('config filters drop far, thin, off-site and over-cap deals from the ranking', () => {
  const cfg = ready();
  assert.match(buildFeed([buyable({ distance_mi: 20 })], cfg).deals[0].unranked_reason, /outside the 15 mi pickup/);
  assert.match(buildFeed([buyable({ ask: 120 })], cfg).deals[0].unranked_reason, /item cap/);
  assert.match(buildFeed([buyable()], ready({ min_profit: 200 })).deals[0].unranked_reason, /minimum/);
  assert.match(buildFeed([buyable()], ready({ sites: ['ebay'] })).deals[0].unranked_reason, /not in the stored source list/);
  assert.match(buildFeed([buyable({ area: 'Austin', distance_from: null, distance_mi: 8 })], cfg).deals[0].unranked_reason, /not a pickup origin/);
  const ranked = buildFeed([
    buyable({ url: 'https://www.facebook.com/marketplace/item/1/', ask: 40, title: 'Better' }),
    buyable({ url: 'https://www.facebook.com/marketplace/item/2/', ask: 70, title: 'Ok' }),
  ], cfg);
  assert.deepEqual(ranked.deals.filter((d) => d.ranked).map((d) => d.title), ['Better', 'Ok']);
  assert.deepEqual(ranked.deals.filter((d) => d.ranked).map((d) => d.rank), [1, 2]);
  assert.ok(ranked.deals[0].profit > ranked.deals[1].profit);
});

test('a clean deal keeps only the whitelist fields', () => {
  const d = cleanDeal(fbDeal({ photo_url: 'https://images.example/a.jpg', risk_note: 'check the shutter', est_profit: 999, comps: [ebayComp(200)] }));
  assert.deepEqual(Object.keys(d).sort(), ['area', 'ask', 'category', 'comps', 'condition', 'distance_from', 'distance_mi', 'lat', 'lng', 'model', 'photo_url', 'rejected_comps', 'risk_note', 'source', 'title', 'url']);
  assert.equal(d.photo_url, 'https://images.example/a.jpg');
  assert.equal(d.risk_note, 'check the shutter');
});

test('scout freshness goes stale after two hours', () => {
  const t = Date.parse('2026-11-03T12:00:00Z');
  assert.equal(scoutFreshness('2026-11-03T11:00:00Z', t).label, '1 hour ago');
  assert.equal(scoutFreshness('2026-11-03T11:00:00Z', t).stale, false);
  assert.equal(scoutFreshness(new Date(t - STALE_MS).toISOString(), t).stale, false);
  assert.equal(scoutFreshness(new Date(t - STALE_MS - 1).toISOString(), t).stale, true);
  assert.equal(scoutFreshness(null).label, null);
});

test('scout config PUT and deals POST require the worker key', async () => {
  const prev = process.env.GST_WORKER_KEY;
  delete process.env.GST_WORKER_KEY;
  try {
    const config = await import('../app/api/scout/config/route.js');
    const deals = await import('../app/api/deals/route.js');
    const put = await config.PUT(new Request('http://localhost/api/scout/config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}' }));
    assert.equal(put.status, 401);
    const post = await deals.POST(new Request('http://localhost/api/deals', { method: 'POST', headers: { 'content-type': 'application/json', 'x-worker-key': 'nope' }, body: JSON.stringify({ deals: [] }) }));
    assert.equal(post.status, 401);
  } finally {
    if (prev === undefined) delete process.env.GST_WORKER_KEY; else process.env.GST_WORKER_KEY = prev;
  }
});
