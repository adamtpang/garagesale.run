// Buy / skip math for one listing. No network and no disk.
// Expected net stays null until ask, sold-comp resale, fee, shipping, and gas are all known.
// An eBay /itm URL is not sold evidence. The comp has to be explicitly marked sold.
import { estimate } from './pricing.js';

export const HOME = { name: 'New Braunfels', lat: 29.703, lng: -98.1245 };
export const SOURCES = ['fb', 'craigslist', 'ebay', 'offerup'];
export const SOURCE_LABEL = {
  fb: 'Facebook Marketplace',
  craigslist: 'Craigslist',
  ebay: 'eBay',
  offerup: 'OfferUp',
};
export const CATEGORIES = ['electronics', 'consoles', 'tools', 'furniture', 'bikes', 'cameras'];
export const CATEGORY_LABEL = {
  electronics: 'Electronics',
  consoles: 'Consoles',
  tools: 'Tools',
  furniture: 'Furniture',
  bikes: 'Bikes',
  cameras: 'Cameras',
};
export const HOME_RULE = 'Pickup is measured from New Braunfels only. Austin and San Marcos are not home origins.';

const NOT_HOME = new Set(['austin', 'austin tx', 'san marcos', 'san marcos tx']);
const REASON_ORDER = [
  'no-sold-comps', 'no-matching-comps', 'source-unknown', 'category-not-allowed', 'site-not-allowed', 'ask-unknown',
  'over-cap', 'over-bankroll', 'not-home', 'too-far', 'origin-unknown', 'shipping-unknown',
  'gas-unknown', 'venue-mixed', 'fee-unknown', 'resale-unknown', 'category-unknown',
  'filters-not-set', 'fee-unconfirmed', 'thin-comps', 'match-unconfirmed', 'under-min',
];
const SKIP = new Set([
  'category-not-allowed', 'site-not-allowed', 'over-cap', 'over-bankroll', 'not-home', 'too-far', 'under-min',
]);

export function money(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
export const round2 = (n) => Math.round(Number(n) * 100) / 100;

export function moneyText(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  const n = Number(v);
  const body = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-$' : '$') + body;
}

function str(v, n) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, n) : null;
}
function coord(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1e6) / 1e6;
}
function place(v) {
  return String(v || '').toLowerCase().replace(/\./g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
}
function httpUrl(v, httpsOnly) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > 1000) return null;
  let u;
  try { u = new URL(s); } catch (e) { return null; }
  if (u.username || u.password) return null;
  if (httpsOnly) { if (u.protocol !== 'https:') return null; }
  else if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  return u.toString();
}
function hostOf(url) {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
}
export function ebayItemId(url) {
  try {
    const u = new URL(url);
    if (hostOf(url) !== 'ebay.com') return null;
    const m = u.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{6,})\/?$/);
    return m ? m[1] : null;
  } catch (e) { return null; }
}
function isSearch(url) {
  const u = new URL(url);
  const p = u.pathname.toLowerCase();
  const h = hostOf(url);
  if (p.includes('/sch/') || p.includes('/search') || p === '/s' || p.startsWith('/s/')) return true;
  if (h === 'google.com' || h.endsWith('.google.com')) return true;
  return false;
}
function isPriceGuide(h) {
  return h === 'swappa.com' || h.endsWith('.swappa.com') || h.includes('pricecharting') || h.includes('camelcamelcamel');
}
function isRetail(h) {
  return ['amazon.com', 'walmart.com', 'bestbuy.com', 'target.com', 'newegg.com'].some((d) => h === d || h.endsWith('.' + d));
}
function isCraigslist(h) {
  return h === 'craigslist.org' || h.endsWith('.craigslist.org');
}
function badUrlReason(url) {
  let h;
  try { h = hostOf(url); } catch (e) { return 'Unusable comp URL'; }
  if (isSearch(url)) return 'Search page, not a sold listing';
  if (isPriceGuide(h)) return 'Price guide, not a sold listing';
  if (isRetail(h)) return 'Retail page, not a sold comp';
  if (isCraigslist(h)) return 'Craigslist is not sold evidence';
  return null;
}
function explicitlyActive(c) {
  if (c.sold === false) return true;
  const status = String(c.status || c.listing_status || '').toLowerCase();
  if (['active', 'for sale', 'unsold', 'available'].includes(status)) return true;
  if (/active/i.test(String(c.source || ''))) return true;
  return false;
}

// Boolean true, or status exactly "sold". Never inferred from the URL.
export function markedSold(c) {
  if (!c || typeof c !== 'object') return false;
  if (c.sold === true) return true;
  return String(c.status || '').toLowerCase() === 'sold';
}

export function canonicalCategory(v) {
  const s = place(v);
  if (!s) return null;
  if (['game consoles', 'game console', 'consoles', 'console'].includes(s)) return 'consoles';
  if (['electronics', 'electronic'].includes(s)) return 'electronics';
  if (['tools', 'tool'].includes(s)) return 'tools';
  if (s === 'furniture') return 'furniture';
  if (['bikes', 'bike', 'bicycles', 'bicycle'].includes(s)) return 'bikes';
  if (['cameras', 'camera'].includes(s)) return 'cameras';
  return null;
}

export function haversineMiles(aLat, aLng, bLat, bLng) {
  const R = 3958.7613;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return round2(R * 2 * Math.atan2(Math.sqrt(Math.max(0, s)), Math.sqrt(Math.max(0, 1 - s))));
}

function notHomeName(v) {
  return NOT_HOME.has(place(v));
}
function isHomeName(v) {
  const p = place(v);
  return p === 'new braunfels' || p === 'new braunfels tx';
}

// { comp, rejected }. Rejected rows never carry a price.
export function reviewComp(c) {
  if (!c || typeof c !== 'object') return { comp: null, rejected: null };
  const url = httpUrl(c.url || c.link, false);
  if (!url) return { comp: null, rejected: null };
  const why = badUrlReason(url);
  if (why) return { comp: null, rejected: { url, reason: why } };
  if (explicitlyActive(c)) return { comp: null, rejected: { url, reason: 'Marked active, not sold' } };
  const ebay = ebayItemId(url);
  if (!markedSold(c)) {
    return {
      comp: null,
      rejected: {
        url,
        reason: ebay
          ? 'eBay item URL is not sold evidence. An /itm link is not a sold comp.'
          : 'Not marked sold',
      },
    };
  }
  return {
    comp: {
      url,
      price: money(c.price ?? c.sold_price),
      title: str(c.title, 160),
      shipping: money(c.shipping ?? c.shipping_cost),
      sold: true,
      sold_evidence: 'marked',
      source: ebay ? 'ebay' : str(c.source, 40),
      condition: str(c.condition, 80),
      model: str(c.model, 120),
      sold_at: str(c.sold_at || c.sold_date || c.date || c.ended, 40),
    },
    rejected: null,
  };
}

export function cleanComp(c) {
  return reviewComp(c).comp;
}

export function cleanDeal(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const source = SOURCES.includes(raw.source) ? raw.source : null;
  const url = httpUrl(raw.url || raw.link || raw.fb_url || raw.source_url, false);
  if (!source || !url) return null;
  const reviewed = (Array.isArray(raw.comps) ? raw.comps : []).slice(0, 24).map(reviewComp);
  const lat = coord(raw.lat);
  const lng = coord(raw.lng);
  return {
    source,
    url,
    photo_url: httpUrl(raw.photo_url || raw.image_url, true),
    ask: money(raw.ask ?? raw.ask_price ?? raw.price ?? raw.buy_price),
    distance_mi: money(raw.distance_mi),
    distance_from: str(raw.distance_from, 80),
    lat: lat != null && lat >= -90 && lat <= 90 ? lat : null,
    lng: lng != null && lng >= -180 && lng <= 180 ? lng : null,
    area: str(raw.area, 80),
    category: str(raw.category, 40),
    condition: str(raw.condition, 80),
    model: str(raw.model, 120),
    risk_note: str(raw.risk_note, 300),
    title: str(raw.title, 200),
    comps: reviewed.map((r) => r.comp).filter(Boolean).slice(0, 12),
    rejected_comps: reviewed.map((r) => r.rejected).filter(Boolean).slice(0, 12),
  };
}

export function rulesFrom(config) {
  const c = config && typeof config === 'object' ? config : {};
  const fees = c.fees && typeof c.fees === 'object' && !Array.isArray(c.fees) ? c.fees : null;
  const sites = Array.isArray(c.sites) ? c.sites.filter((s) => SOURCES.includes(s)) : null;
  const filtersReady = c.min_profit != null && c.max_pickup_miles != null && !!sites && sites.length > 0
    && !!fees && sites.every((s) => fees[s] && fees[s].rate != null);
  return {
    bankroll: money(c.bankroll),
    maxPerFlip: money(c.max_per_flip),
    minProfit: money(c.min_profit),
    maxMiles: money(c.max_pickup_miles),
    gasPerMile: money(c.gas_per_mile),
    gasNote: str(c.gas_per_mile_note, 200),
    sites,
    fees,
    filtersReady,
    home: HOME.name,
  };
}

export function pickupFrom(deal, maxMiles) {
  const cap = maxMiles == null ? null : Number(maxMiles);
  const capText = cap == null ? 'the stored mile cap' : `${cap} mi`;
  if (deal.lat != null && deal.lng != null) {
    const miles = haversineMiles(HOME.lat, HOME.lng, deal.lat, deal.lng);
    const within = cap == null ? null : miles <= cap;
    return {
      miles, known: true, basis: 'coordinates', within,
      text: `${miles.toFixed(2)} mi from New Braunfels, from the listing coordinates.`,
    };
  }
  if (notHomeName(deal.area) || notHomeName(deal.distance_from)) {
    const where = deal.area || deal.distance_from;
    return {
      miles: null, known: false, basis: 'not-home', within: false, area: where,
      text: `${where} is not a pickup origin. The rule is ${capText} from New Braunfels. A stored distance is not treated as miles from home.`,
    };
  }
  if (isHomeName(deal.distance_from) && deal.distance_mi != null) {
    const miles = deal.distance_mi;
    return {
      miles, known: true, basis: 'distance_from', within: cap == null ? null : miles <= cap,
      text: `${miles} mi from New Braunfels.`,
    };
  }
  const stored = deal.distance_mi != null
    ? ` A stored distance of ${deal.distance_mi} mi is not used, because its origin is not New Braunfels.`
    : '';
  return {
    miles: null, known: false, basis: 'origin-unknown', within: null,
    text: `Miles from New Braunfels are not confirmed.${stored}`,
  };
}

function bucket(condition) {
  const n = place(condition);
  if (!n) return null;
  if (/\b(for parts|parts only|broken|not working|cracked|as is)\b/.test(n)) return 'parts';
  if (/\b(new|sealed|nib|open box)\b/.test(n)) return 'new';
  if (/\brefurb/.test(n)) return 'refurb';
  return 'used';
}
function sameModel(a, b) {
  const x = place(a);
  const y = place(b);
  if (!x || !y) return null;
  return x === y;
}
function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return null;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

function conditionBucketLabel(v) {
  return v || 'condition unknown';
}

function classifyComps(deal, comps) {
  const used = [];
  const unused = [];
  let matchUnconfirmed = !deal.model || !deal.condition;
  const listingBucket = bucket(deal.condition);
  for (const c of comps) {
    const model = sameModel(deal.model, c.model);
    const compBucket = bucket(c.condition);
    let note = null;
    let use = true;
    if (model === false) {
      use = false;
      note = 'Sold, but the model does not match the listing, so it is left out of the estimate.';
    } else if (listingBucket && compBucket && listingBucket !== compBucket) {
      use = false;
      note = 'Sold, but the condition does not match the listing, so it is left out of the estimate.';
    } else if (model == null || !listingBucket || !compBucket) {
      note = 'Sold comp counted in the estimate. Condition or model is not confirmed.';
      matchUnconfirmed = true;
    } else {
      note = 'Sold comp matches the listing model and condition.';
    }
    const row = {
      ...c,
      used: use,
      note,
      soldText: 'Sold',
      conditionText: conditionBucketLabel(c.condition),
      modelText: c.model || 'model unknown',
      dateText: c.sold_at || 'date unknown',
      priceText: c.price == null ? 'price unknown' : moneyText(c.price),
    };
    if (use) used.push(row);
    else unused.push(row);
  }
  return { used, unused, matchUnconfirmed };
}

function resaleFrom(used) {
  const priced = used.filter((c) => c.price != null && c.price > 0);
  const empty = { resale: null, low: null, high: null, confidence: 'none', n: priced.length, shipping: null, shippingKnown: false };
  if (!priced.length) return empty;
  let resale = null;
  let low = null;
  let high = null;
  let confidence = 'thin';
  if (priced.length >= 3) {
    const est = estimate(priced.map((c) => ({ price: c.price })));
    resale = est.value == null ? null : round2(est.value);
    low = est.low == null ? null : round2(est.low);
    high = est.high == null ? null : round2(est.high);
    confidence = est.value == null ? 'none' : est.confidence;
  } else {
    resale = round2(median(priced.map((c) => c.price)));
    confidence = 'thin';
  }
  const shippingKnown = priced.every((c) => c.shipping != null && c.shipping >= 0);
  const shipping = shippingKnown ? round2(median(priced.map((c) => c.shipping))) : null;
  return { resale, low, high, confidence, n: priced.length, shipping, shippingKnown };
}

function venueOf(used) {
  const sources = [...new Set(used.map((c) => c.source).filter(Boolean))];
  if (sources.length === 1) return sources[0];
  if (!sources.length) return null;
  return 'mixed';
}

export function feeAmount(resale, spec) {
  if (resale == null || !spec || spec.rate == null || !Number.isFinite(Number(spec.rate))) return null;
  return round2(resale * Number(spec.rate) + (Number(spec.flat) || 0));
}

function feeSpecFor(rules, venue) {
  if (!venue || venue === 'mixed' || !rules.fees) return null;
  return rules.fees[venue] || null;
}

function push(reasons, code, text) {
  reasons.push({ code, text });
}

function uncertaintyText({ confidence, n, low, high, matchUnconfirmed }) {
  if (!n) return 'No sold-comp estimate.';
  if (confidence === 'thin') return `Thin estimate from ${n} sold comp${n === 1 ? '' : 's'}. A buy needs at least 3.`;
  if (confidence === 'none') return 'The sold prices are too spread out to estimate a resale price.';
  const band = low != null && high != null ? ` Middle sold prices are ${moneyText(low)}–${moneyText(high)}.` : '';
  const match = matchUnconfirmed ? ' Condition or model is not fully confirmed.' : '';
  return `${confidence[0].toUpperCase()}${confidence.slice(1)} confidence from ${n} sold comps.${band}${match}`;
}

// Trust sold_evidence only. A stored sold:true without that field was often inferred from /itm.
function storedComp(c) {
  if (!c || c.sold_evidence !== 'marked' || c.sold !== true) return null;
  const url = httpUrl(c.url || c.link, false);
  if (!url || badUrlReason(url)) return null;
  return {
    url,
    price: money(c.price),
    title: str(c.title, 160),
    shipping: c.shipping == null ? null : money(c.shipping),
    sold: true,
    sold_evidence: 'marked',
    source: str(c.source, 40),
    condition: str(c.condition, 80),
    model: str(c.model, 120),
    sold_at: str(c.sold_at, 40),
  };
}

function readDeal(raw) {
  const source = SOURCES.includes(raw && raw.source) ? raw.source : null;
  const url = httpUrl((raw && (raw.url || raw.link || raw.fb_url || raw.source_url)) || '', false);
  const lat = coord(raw && raw.lat);
  const lng = coord(raw && raw.lng);
  const kept = [];
  const unverified = [];
  for (const c of (raw && Array.isArray(raw.comps) ? raw.comps : [])) {
    const row = storedComp(c);
    if (row) kept.push(row);
    else if (c && typeof c === 'object') {
      const compUrl = httpUrl(c.url || c.link, false);
      if (!compUrl) continue;
      const ebay = ebayItemId(compUrl);
      unverified.push({
        url: compUrl,
        reason: ebay
          ? 'eBay item URL is not sold evidence. An /itm link is not a sold comp.'
          : 'Sold mark is missing, so this comp is not used.',
      });
    }
  }
  const rejected = [
    ...(Array.isArray(raw && raw.rejected_comps) ? raw.rejected_comps : []),
    ...unverified,
  ].filter((r) => r && r.url).slice(0, 12);
  return {
    source,
    url,
    title: str(raw && raw.title, 200) || 'Untitled listing',
    ask: money(raw && (raw.ask ?? raw.ask_price ?? raw.price ?? raw.buy_price)),
    distance_mi: money(raw && raw.distance_mi),
    distance_from: str(raw && raw.distance_from, 80),
    lat: lat != null && lat >= -90 && lat <= 90 ? lat : null,
    lng: lng != null && lng >= -180 && lng <= 180 ? lng : null,
    area: str(raw && raw.area, 80),
    category: str(raw && raw.category, 40),
    condition: str(raw && raw.condition, 80),
    model: str(raw && raw.model, 120),
    risk_note: str(raw && raw.risk_note, 300),
    comps: kept.slice(0, 12),
    rejected,
  };
}

export function assessDeal(raw, config) {
  const rules = rulesFrom(config);
  const deal = readDeal(raw || {});
  const { used, unused, matchUnconfirmed } = classifyComps(deal, deal.comps);
  const priced = resaleFrom(used);
  const venue = venueOf(used.filter((c) => c.price != null && c.price > 0));
  const spec = feeSpecFor(rules, venue);
  const fee = feeAmount(priced.resale, spec);
  const pickup = pickupFrom(deal, rules.maxMiles);
  let gas = null;
  if (rules.gasPerMile != null && pickup.known) gas = round2(2 * pickup.miles * rules.gasPerMile);
  const shipping = priced.shippingKnown ? priced.shipping : null;
  let net = null;
  if (priced.resale != null && deal.ask != null && fee != null && shipping != null && gas != null) {
    net = round2(priced.resale - deal.ask - fee - shipping - gas);
  }

  const reasons = [];
  if (!priced.n && !unused.length) push(reasons, 'no-sold-comps', 'No sold comps with a price. An eBay /itm link is not treated as sold.');
  else if (!priced.n && unused.length) push(reasons, 'no-matching-comps', 'Sold comps are on file, but none match the listing model and condition.');
  if (!deal.source) push(reasons, 'source-unknown', 'Buy source is missing. It is not assumed to be Facebook.');
  else if (rules.sites && rules.sites.length && !rules.sites.includes(deal.source)) {
    push(reasons, 'site-not-allowed', `${SOURCE_LABEL[deal.source] || deal.source} is not in the stored source list.`);
  }
  const categoryId = canonicalCategory(deal.category);
  if (deal.category && !categoryId) {
    push(reasons, 'category-not-allowed', `"${deal.category}" is outside electronics, consoles, tools, furniture, bikes, and cameras.`);
  }
  if (deal.ask == null) push(reasons, 'ask-unknown', 'Asking price is missing.');
  else {
    if (rules.maxPerFlip != null && deal.ask > rules.maxPerFlip) {
      push(reasons, 'over-cap', `Ask ${moneyText(deal.ask)} is over the ${moneyText(rules.maxPerFlip)} item cap.`);
    }
    if (rules.bankroll != null && deal.ask > rules.bankroll) {
      push(reasons, 'over-bankroll', `Ask ${moneyText(deal.ask)} is over the ${moneyText(rules.bankroll)} bankroll.`);
    }
  }
  if (pickup.basis === 'not-home') push(reasons, 'not-home', pickup.text);
  else if (pickup.known && rules.maxMiles != null && pickup.miles > rules.maxMiles) {
    push(reasons, 'too-far', `${pickup.miles} mi from New Braunfels is outside the ${rules.maxMiles} mi pickup.`);
  } else if (!pickup.known) push(reasons, 'origin-unknown', pickup.text);

  if (priced.n && !priced.shippingKnown) {
    push(reasons, 'shipping-unknown', 'Shipping is unknown. It is not counted as $0.');
  }
  if (rules.gasPerMile == null) push(reasons, 'gas-unknown', 'Gas rate is not stored, so gas is not counted as $0.');
  if (venue === 'mixed') push(reasons, 'venue-mixed', 'Sold comps come from more than one venue, so the resale fee is unknown.');
  else if (priced.resale != null && fee == null) {
    push(reasons, 'fee-unknown', `No fee rate is stored for ${venue ? (SOURCE_LABEL[venue] || venue) : 'the resale venue'}.`);
  }
  if (priced.n >= 3 && priced.resale == null) {
    push(reasons, 'resale-unknown', 'Sold prices are too spread out to estimate a resale price.');
  }
  if (!categoryId && !(deal.category && !categoryId)) {
    push(reasons, 'category-unknown', 'Category is missing, so it cannot be checked against the six allowed categories.');
  }
  if (!rules.filtersReady) push(reasons, 'filters-not-set', 'Stored filters are incomplete, so this is not a buy.');
  if (fee != null && spec && spec.confirmed !== true) {
    push(reasons, 'fee-unconfirmed', `The ${SOURCE_LABEL[venue] || venue} fee rate is an unconfirmed default, so this is not a buy.`);
  }
  if (priced.resale != null && priced.n > 0 && priced.n < 3) {
    push(reasons, 'thin-comps', `Only ${priced.n} matching sold comp${priced.n === 1 ? '' : 's'}. A buy needs at least 3.`);
  }
  if (priced.resale != null && matchUnconfirmed) {
    push(reasons, 'match-unconfirmed', 'Condition or model is not confirmed on the listing and the sold comps.');
  }
  const feeConfirmed = !!(spec && spec.confirmed === true && fee != null);
  if (net != null && feeConfirmed && rules.minProfit != null && net < rules.minProfit) {
    push(reasons, 'under-min', `Calculated net ${moneyText(net)} is under the ${moneyText(rules.minProfit)} minimum.`);
  }

  reasons.sort((a, b) => REASON_ORDER.indexOf(a.code) - REASON_ORDER.indexOf(b.code));
  const codes = new Set(reasons.map((r) => r.code));
  let verdict = 'buy';
  if ([...codes].some((c) => SKIP.has(c))) verdict = 'skip';
  else if (reasons.length) verdict = 'incomplete';

  const flags = [];
  if (codes.has('fee-unconfirmed')) flags.push('fee unconfirmed');
  if (codes.has('shipping-unknown')) flags.push('shipping unknown');
  if (codes.has('gas-unknown')) flags.push('gas rate unknown');
  if (codes.has('thin-comps')) flags.push('thin comps');
  if (codes.has('match-unconfirmed')) flags.push('model or condition not confirmed');
  if (net != null && !feeConfirmed && rules.minProfit != null && net < rules.minProfit) {
    flags.push(`calculated net is under ${moneyText(rules.minProfit)} if the unconfirmed fee holds`);
  }

  const venueLabel = venue === 'mixed' ? 'Mixed venues' : venue ? (SOURCE_LABEL[venue] || venue) : 'Not set';
  const rateNote = spec && spec.rate != null ? `${Math.round(Number(spec.rate) * 10000) / 100}% of resale` : null;
  let feeNote = null;
  if (fee != null && spec && spec.confirmed !== true) feeNote = 'Unconfirmed default rate. Shipping is separate and is not included in this fee.';
  else if (fee != null) feeNote = 'Shipping is separate and is not included in this fee.';
  if (spec && spec.note && feeNote) feeNote = `${feeNote} ${spec.note}`;

  const storedDistanceText = deal.distance_mi == null
    ? null
    : pickup.basis === 'distance_from'
      ? null
      : `Stored distance ${deal.distance_mi} mi${deal.distance_from ? ` from ${deal.distance_from}` : ''}. ${pickup.known ? 'Pickup uses the coordinates instead.' : 'Not used for gas or the mile cap.'}`;

  return {
    verdict,
    reasons,
    reasonText: reasons.map((r) => r.text).join(' '),
    flags,
    title: deal.title,
    source: deal.source,
    sourceLabel: deal.source ? (SOURCE_LABEL[deal.source] || deal.source) : 'Source unknown',
    ask: deal.ask,
    askText: deal.ask == null ? 'unknown' : moneyText(deal.ask),
    buyUrl: deal.url,
    categoryId,
    categoryText: categoryId ? CATEGORY_LABEL[categoryId] : (deal.category ? deal.category : 'unknown'),
    conditionText: deal.condition || 'condition unknown',
    modelText: deal.model || 'model unknown',
    venue,
    venueLabel,
    resale: priced.resale,
    resaleText: priced.resale == null ? 'unknown' : moneyText(priced.resale),
    resaleLow: priced.low,
    resaleHigh: priced.high,
    confidence: priced.confidence,
    uncertainty: uncertaintyText({ ...priced, matchUnconfirmed }),
    compCount: priced.n,
    fee,
    feeText: fee == null ? 'unknown' : moneyText(fee),
    feeNote: [rateNote, feeNote].filter(Boolean).join(' · ') || null,
    shipping,
    shippingText: shipping == null ? 'unknown' : moneyText(shipping),
    gas,
    gasText: gas == null ? 'unknown' : moneyText(gas),
    gasNote: rules.gasPerMile == null
      ? 'Gas rate is not stored.'
      : `Round trip is 2 × miles × ${moneyText(rules.gasPerMile)}.${rules.gasNote ? ' ' + rules.gasNote : ''}`,
    net,
    netText: net == null ? 'unknown' : moneyText(net),
    netLabel: verdict === 'buy' ? 'Expected net' : 'Calculated net',
    pickup,
    storedDistanceText,
    comps: [...used, ...unused],
    rejected: deal.rejected,
    riskNote: deal.risk_note,
    area: deal.area,
  };
}
