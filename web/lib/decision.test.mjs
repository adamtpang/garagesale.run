import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { assessDeal, cleanComp, cleanDeal, haversineMiles, HOME, moneyText, rulesFrom } from './decision.js';
import { filterViews, knownBuyNet, layoutForWidth, netLine, ruleSummary, shippingLine, verdictLabel, BOARD_REGIONS, HOME_LINE } from './dealPresenter.js';
import { SAMPLE_CONFIG, SAMPLE_DEALS } from './decision.sample.js';

const seed = JSON.parse(fs.readFileSync(new URL('../config/scout-config.seed.json', import.meta.url), 'utf8'));

function confirmFees(fees) {
  return Object.fromEntries(Object.entries(fees).map(([k, v]) => [k, { ...v, confirmed: true }]));
}
const confirmed = { ...seed, fees: confirmFees(seed.fees) };

const sold = (price, i, extra = {}) => ({
  url: `https://www.ebay.com/itm/90000000010${i}`,
  price,
  shipping: 10,
  title: 'Canon EOS R body',
  sold: true,
  condition: 'Used',
  model: 'EOS R',
  sold_at: '2026-10-01',
  ...extra,
});

function buyable(extra = {}) {
  const comps = [210, 220, 230, 240].map((price, i) => sold(price, i));
  return {
    source: 'fb',
    url: 'https://www.facebook.com/marketplace/item/999/',
    title: 'Canon EOS R body',
    ask: 40,
    distance_mi: 8,
    distance_from: 'New Braunfels',
    area: 'New Braunfels',
    category: 'cameras',
    condition: 'Used',
    model: 'EOS R',
    ...extra,
    comps: extra.comps || comps,
  };
}

test('an eBay /itm URL is not sold evidence unless the comp is marked sold', () => {
  const bare = cleanComp({ url: 'https://www.ebay.com/itm/1234567890', price: 200, shipping: 0, title: 'Camera' });
  assert.equal(bare, null);
  const active = cleanComp({ url: 'https://www.ebay.com/itm/1234567890', price: 200, sold: false });
  assert.equal(active, null);
  const marked = cleanComp({ url: 'https://www.ebay.com/itm/1234567890', price: 200, shipping: 10, status: 'sold', condition: 'Used', model: 'EOS R', sold_at: '2026-09-01' });
  assert.equal(marked.sold, true);
  assert.equal(marked.sold_evidence, 'marked');
  assert.equal(marked.sold_at, '2026-09-01');
  const retail = cleanComp({ url: 'https://www.amazon.com/dp/B000000', price: 200, sold: true });
  assert.equal(retail, null);
});

test('a complete New Braunfels deal has an expected net and a buy verdict', () => {
  const view = assessDeal(cleanDeal(buyable()), confirmed);
  assert.equal(view.verdict, 'buy');
  assert.equal(view.resale, 225);
  assert.equal(view.fee, 29.81);
  assert.equal(view.shipping, 10);
  assert.equal(view.gas, 2.88);
  assert.equal(view.net, 142.31);
  assert.equal(view.netLabel, 'Expected net');
  assert.equal(view.venue, 'ebay');
  assert.equal(view.sourceLabel, 'Facebook Marketplace');
  assert.equal(view.venueLabel, 'eBay');
  assert.equal(netLine(view).tone, 'buy');
  assert.equal(view.pickup.basis, 'distance_from');
  assert.equal(view.pickup.within, true);
  assert.match(view.uncertainty, /Low confidence/);
});

test('unknown shipping stays unknown and does not become zero', () => {
  const comps = [210, 220, 230, 240].map((price, i) => sold(price, i, { shipping: undefined }));
  const view = assessDeal(cleanDeal(buyable({ comps })), confirmed);
  assert.equal(view.shipping, null);
  assert.equal(view.shippingText, 'unknown');
  assert.equal(shippingLine(view), 'unknown');
  assert.equal(view.net, null);
  assert.equal(view.netText, 'unknown');
  assert.equal(view.verdict, 'incomplete');
  assert.ok(view.reasons.some((r) => r.code === 'shipping-unknown'));
  assert.match(view.reasonText, /not counted as \$0/);
  assert.notEqual(view.shipping, 0);
  assert.notEqual(view.gas, 0);
});

test('explicit zero shipping is kept and still produces a net', () => {
  const comps = [210, 220, 230, 240].map((price, i) => sold(price, i, { shipping: 0 }));
  const view = assessDeal(cleanDeal(buyable({ comps })), confirmed);
  assert.equal(view.shipping, 0);
  assert.equal(view.shippingText, '$0.00');
  assert.equal(view.net, 152.31);
  assert.equal(view.verdict, 'buy');
});

test('a missing gas rate is not treated as free', () => {
  const view = assessDeal(cleanDeal(buyable()), { ...confirmed, gas_per_mile: null });
  assert.equal(view.gas, null);
  assert.equal(view.gasText, 'unknown');
  assert.equal(view.net, null);
  assert.equal(view.verdict, 'incomplete');
  assert.ok(view.reasons.some((r) => r.code === 'gas-unknown'));
});

test('Austin and San Marcos are not home, even when the stored distance is short', () => {
  for (const area of ['Austin', 'San Marcos', 'Austin, TX']) {
    const view = assessDeal(cleanDeal(buyable({ area, distance_mi: 6, distance_from: null })), confirmed);
    assert.equal(view.verdict, 'skip', area);
    assert.equal(view.pickup.basis, 'not-home');
    assert.equal(view.pickup.known, false);
    assert.equal(view.gas, null);
    assert.equal(view.net, null);
    assert.match(view.reasonText, /New Braunfels/);
    assert.equal(view.pickup.within, false);
  }
  const rules = ruleSummary(rulesFrom(confirmed));
  assert.equal(rules.home, 'New Braunfels');
  assert.match(HOME_LINE, /New Braunfels/);
  assert.doesNotMatch(rules.maxMiles, /Austin|San Marcos/);
});

test('coordinates near New Braunfels win over an Austin label and a bogus stored distance', () => {
  const near = assessDeal(cleanDeal(buyable({
    area: 'Austin',
    distance_from: 'Austin',
    distance_mi: 4,
    lat: 29.761,
    lng: -98.1245,
  })), confirmed);
  assert.equal(near.pickup.basis, 'coordinates');
  assert.equal(near.pickup.within, true);
  assert.ok(near.pickup.miles < 15);
  assert.ok(near.pickup.miles > 3);
  assert.equal(near.verdict, 'buy');
  const austin = haversineMiles(HOME.lat, HOME.lng, 30.2672, -97.7431);
  assert.ok(austin > 15);
  const far = assessDeal(cleanDeal(buyable({ lat: 30.2672, lng: -97.7431, area: 'Austin' })), confirmed);
  assert.equal(far.verdict, 'skip');
  assert.ok(far.reasons.some((r) => r.code === 'too-far'));
  assert.equal(far.pickup.known, true);
});

test('unconfirmed fee, thin comps, low net, and a high ask do not become buys', () => {
  const unconfirmed = assessDeal(cleanDeal(buyable()), seed);
  assert.equal(unconfirmed.verdict, 'incomplete');
  assert.equal(unconfirmed.netLabel, 'Calculated net');
  assert.equal(unconfirmed.net, 142.31);
  assert.ok(unconfirmed.reasons.some((r) => r.code === 'fee-unconfirmed'));
  assert.equal(netLine(unconfirmed).tone, 'calculated');

  const thin = assessDeal(cleanDeal(buyable({ comps: [sold(200, 1)] })), confirmed);
  assert.equal(thin.verdict, 'incomplete');
  assert.equal(thin.resale, 200);
  assert.ok(thin.reasons.some((r) => r.code === 'thin-comps'));
  assert.match(thin.uncertainty, /Thin estimate/);

  const low = assessDeal(cleanDeal(buyable({ ask: 90 })), confirmed);
  assert.equal(low.verdict, 'skip');
  assert.ok(low.reasons.some((r) => r.code === 'under-min'));
  assert.ok(low.net < 100);

  const expensive = assessDeal(cleanDeal(buyable({ ask: 120 })), confirmed);
  assert.equal(expensive.verdict, 'skip');
  assert.ok(expensive.reasons.some((r) => r.code === 'over-cap'));
  assert.equal(expensive.net, 62.31);
  assert.equal(expensive.netLabel, 'Calculated net');
});

test('a stored sold flag without sold evidence is not reused', () => {
  const stored = {
    source: 'fb',
    url: 'https://www.facebook.com/marketplace/item/1/',
    title: 'Camera',
    ask: 40,
    category: 'cameras',
    condition: 'Used',
    model: 'EOS R',
    distance_from: 'New Braunfels',
    distance_mi: 8,
    comps: [{
      url: 'https://www.ebay.com/itm/1234567890',
      price: 220,
      shipping: 10,
      sold: true,
      source: 'ebay',
      title: 'Inferred from the item URL',
    }],
  };
  const view = assessDeal(stored, confirmed);
  assert.equal(view.compCount, 0);
  assert.equal(view.resale, null);
  assert.equal(view.net, null);
  assert.equal(view.verdict, 'incomplete');
  assert.equal(view.rejected.length, 1);
  assert.match(view.rejected[0].reason, /not sold evidence/);
  assert.equal(view.rejected[0].price, undefined);
});

test('sample fixtures stay labeled and do not use the unconfirmed seed fees', () => {
  assert.equal(seed.fees.ebay.confirmed, false);
  assert.equal(SAMPLE_CONFIG.fees.ebay.confirmed, true);
  assert.deepEqual(SAMPLE_CONFIG.areas.map((a) => a.name), ['New Braunfels']);
  const views = SAMPLE_DEALS.map((d) => assessDeal(cleanDeal(d), SAMPLE_CONFIG));
  assert.equal(views.length, 6);
  assert.ok(SAMPLE_DEALS.every((d) => d.sample === true && d.title.startsWith('SAMPLE')));
  assert.equal(views[0].verdict, 'buy');
  assert.equal(views[1].verdict, 'skip');
  assert.match(views[1].reasonText, /Austin/);
  assert.equal(views[2].shipping, null);
  assert.equal(views[2].net, null);
  assert.equal(views[3].compCount, 0);
  assert.match(views[3].reasonText, /itm/);
  assert.equal(views[4].verdict, 'incomplete');
  assert.equal(views[5].verdict, 'skip');
  assert.equal(verdictLabel(views[0], true), 'Sample · Buy');
  assert.equal(knownBuyNet(views), views[0].net);
  assert.equal(knownBuyNet(views.filter((v) => v.verdict !== 'buy')), null);
  const skipped = filterViews(views, { verdict: 'skip' });
  assert.ok(skipped.every((v) => v.verdict === 'skip'));
  assert.equal(moneyText(null), null);
});

test('the board is cards under 768px and a table at desktop width', () => {
  assert.equal(layoutForWidth(390), 'cards');
  assert.equal(layoutForWidth(767), 'cards');
  assert.equal(layoutForWidth(768), 'table');
  assert.equal(layoutForWidth(1280), 'table');
  assert.equal(layoutForWidth(undefined), 'cards');
  assert.match(BOARD_REGIONS.cards, /md:hidden/);
  assert.match(BOARD_REGIONS.table, /hidden/);
  assert.match(BOARD_REGIONS.table, /md:block/);
});
