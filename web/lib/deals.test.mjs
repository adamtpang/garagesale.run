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

// One rules file.

test('the scout seed and the rules file agree, so there is one set of rule numbers', async () => {
  const { RULES_CONFIG } = await import('../config/rules.js');
  for (const key of ['bankroll', 'min_profit', 'max_pickup_miles', 'gas_per_mile', 'hourly_rate', 'max_drive_minutes']) assert.equal(seed[key], RULES_CONFIG[key], key);
  // No fixed cap is set, so the most one flip can cost is the bankroll.
  assert.equal(RULES_CONFIG.max_per_flip, null);
  assert.equal(seed.max_per_flip, RULES_CONFIG.bankroll);
  assert.deepEqual(seed.categories, [...RULES_CONFIG.categories]);
  assert.deepEqual(seed.sites, [...RULES_CONFIG.sites]);
  assert.deepEqual(seed.areas, RULES_CONFIG.areas.map((a) => ({ ...a })));
});

test('with nothing stored, the config is the rules file and deals can be ranked', async () => {
  const { withRules, RULES_SOURCE } = await import('./scoutConfig.js');
  const cfg = withRules(null);
  assert.equal(cfg.rules_source, RULES_SOURCE);
  assert.equal(cfg.max_per_flip, 100);
  assert.equal(cfg.min_profit, 100);
  assert.equal(cfg.max_pickup_miles, 15);
  assert.equal(cfg.gas_per_mile, 0.18);
  assert.equal(filtersReady(cfg), true);
  assert.equal(cfg.fees.ebay.rate, 0.136);
  assert.equal(cfg.fees.ebay.flat, 0.4);
  assert.equal(buildFeed([], cfg).filters_set, true);
});

test('a stored config cannot change a rule, only where to look and what sites charge', async () => {
  const { withRules, ignoredRuleFields } = await import('./scoutConfig.js');
  const cfg = withRules(cleanConfig({
    max_per_flip: 5000, bankroll: 5000, min_profit: 1, max_pickup_miles: 500, gas_per_mile: 0,
    sites: ['ebay'], fees: { ebay: { rate: 0.15 } }, run_hours: 'nights',
  }));
  assert.equal(cfg.max_per_flip, 100);
  assert.equal(cfg.bankroll, 100);
  assert.equal(cfg.min_profit, 100);
  assert.equal(cfg.max_pickup_miles, 15);
  assert.equal(cfg.gas_per_mile, 0.18);
  assert.deepEqual(cfg.sites, ['ebay']);
  assert.equal(cfg.fees.ebay.rate, 0.15);
  assert.equal(cfg.fees.fb.rate, 0);
  assert.equal(cfg.run_hours, 'nights');
  assert.deepEqual(ignoredRuleFields({ max_per_flip: 5000, min_profit: 100, max_pickup_miles: 60 }), ['max_per_flip', 'max_pickup_miles']);
  assert.deepEqual(ignoredRuleFields(seed), []);
});

test('PUT /api/scout/config stores the look settings and says which rule fields it ignored', async () => {
  const prevKey = process.env.GST_WORKER_KEY;
  const prevBlob = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  process.env.GST_WORKER_KEY = 'test-key';
  const { scoutConfigFile } = await import('./scoutConfig.js');
  const route = await import('../app/api/scout/config/route.js');
  fs.rmSync(scoutConfigFile, { force: true });
  try {
    const first = await (await route.GET()).json();
    assert.equal(first.min_profit, 100);
    assert.equal(first.rules_source, 'web/config/rules.js');
    const put = await route.PUT(new Request('http://localhost/api/scout/config', {
      method: 'PUT', headers: { 'content-type': 'application/json', 'x-worker-key': 'test-key' },
      body: JSON.stringify({ min_profit: 5, sites: ['fb', 'ebay'] }),
    }));
    assert.equal(put.status, 200);
    const body = await put.json();
    assert.equal(body.min_profit, 100);
    assert.deepEqual(body.sites, ['fb', 'ebay']);
    assert.deepEqual(body.ignored, ['min_profit']);
    assert.match(body.ignored_note, /Adam's rules/);
    const again = await (await route.GET()).json();
    assert.deepEqual(again.sites, ['fb', 'ebay']);
    assert.equal(again.min_profit, 100);
    assert.equal(JSON.parse(fs.readFileSync(scoutConfigFile, 'utf8')).min_profit, undefined);
  } finally {
    fs.rmSync(scoutConfigFile, { force: true });
    if (prevKey === undefined) delete process.env.GST_WORKER_KEY; else process.env.GST_WORKER_KEY = prevKey;
    if (prevBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = prevBlob;
  }
});

test('the buy search flags an ask over the max cost per flip', async () => {
  const { capFlags, HOME_CITY, HOME_RADIUS } = await import('./marketplace.js');
  assert.deepEqual(capFlags([{ ask: 100 }, { ask: 100.01 }, { ask: null }]).map((d) => d.over_cap), [false, true, false]);
  assert.equal(HOME_CITY, 'New Braunfels');
  assert.equal(HOME_RADIUS, 15);
});

test('a stored fee with only a rate keeps the default flat fee', async () => {
  const { withRules } = await import('./scoutConfig.js');
  // The seed sends an eBay rate and no flat fee. The 40 cents per order must survive.
  const cfg = withRules(cleanConfig(seed));
  assert.equal(cfg.fees.ebay.rate, 0.1325);
  assert.equal(cfg.fees.ebay.flat, 0.4);
  assert.equal(cfg.fees.ebay.plus_shipping, true);
  // A stored flat fee still wins when one is sent.
  assert.equal(withRules(cleanConfig({ fees: { ebay: { rate: 0.13, flat: 0.3 } } })).fees.ebay.flat, 0.3);
  // On a $200 resale the fee is 0.136 x 200 + 0.40 = 27.60, not 27.20.
  const { feeAmount } = await import('./decision.js');
  assert.equal(feeAmount(200, withRules(cleanConfig({ fees: { ebay: { rate: 0.136 } } })).fees.ebay), 27.6);
});

test('the wider surplus radius never widens a listing search', async () => {
  const { activeRules, rulesAsConfig } = await import('./rules.js');
  const wide = activeRules({ optional: { surplus_radius: { enabled: true } } });
  assert.equal(wide.pickup_miles, 60);
  assert.equal(rulesAsConfig(wide).max_pickup_miles, 15);
});
