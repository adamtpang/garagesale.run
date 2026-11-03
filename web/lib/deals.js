// Strict scout ingest. Comps that are not sold evidence are dropped, then profit is
// resale - ask - fee(platform) - shipping - 2 * distance_mi * gas_per_mile.
import { estimate } from './pricing.js';
import { SOURCES, emptyConfig, filtersReady } from './scoutConfig.js';

const money = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
};
const round2 = (n) => Math.round(n * 100) / 100;
function str(v, n) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, n) : null;
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

function ebayItemId(url) {
  const u = new URL(url);
  if (hostOf(url) !== 'ebay.com') return null;
  const m = u.pathname.match(/\/itm\/(?:[^/]+\/)?(\d+)\/?$/);
  return m ? m[1] : null;
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

function explicitlyActive(c) {
  if (c.sold === false) return true;
  const status = String(c.status || c.listing_status || '').toLowerCase();
  if (['active', 'for sale', 'unsold', 'available'].includes(status)) return true;
  if (/active/i.test(String(c.source || ''))) return true;
  return false;
}
function markedSold(c) {
  if (c.sold === true) return true;
  return String(c.status || c.sold || '').toLowerCase() === 'sold';
}

// A comp stays only when it is an eBay sold /itm/<id> URL, or it is explicitly
// marked sold and its URL is not a search, a price guide, retail, or Craigslist.
export function cleanComp(c) {
  if (!c || typeof c !== 'object') return null;
  const url = httpUrl(c.url || c.link, false);
  if (!url) return null;
  let h;
  try { h = hostOf(url); } catch (e) { return null; }
  if (isSearch(url) || isPriceGuide(h) || isRetail(h) || isCraigslist(h)) return null;
  if (explicitlyActive(c)) return null;
  const ebay = ebayItemId(url);
  if (!ebay && !markedSold(c)) return null;
  return {
    url, price: money(c.price ?? c.sold_price), title: str(c.title, 160),
    shipping: money(c.shipping ?? c.shipping_cost), sold: true,
    source: ebay ? 'ebay' : str(c.source, 40),
  };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return null;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

// Sold prices only. Three or more go through pricing.estimate (it trims outliers).
// One or two still count: the scout rule is "no comps left", not "fewer than 3".
export function resaleFrom(comps) {
  const priced = comps.filter((c) => c.price != null && c.price > 0);
  if (!priced.length) return { resale: null, shipping: null };
  let resale;
  if (priced.length >= 3) resale = estimate(priced.map((c) => ({ price: c.price }))).value;
  else resale = median(priced.map((c) => c.price));
  const ships = priced.map((c) => c.shipping).filter((s) => s != null && s >= 0);
  return { resale: resale == null ? null : round2(resale), shipping: ships.length ? round2(median(ships)) : null };
}

export function feeAmount(resale, spec) {
  if (resale == null || !spec || spec.rate == null) return null;
  // Rate is on the resale price. Shipping is its own term in the profit formula.
  return round2(resale * spec.rate + (spec.flat || 0));
}

export function cleanDeal(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const source = SOURCES.includes(raw.source) ? raw.source : null;
  const url = httpUrl(raw.url || raw.link, false);
  if (!source || !url) return null;
  const comps = (Array.isArray(raw.comps) ? raw.comps : []).map(cleanComp).filter(Boolean).slice(0, 12);
  return {
    source, url, photo_url: httpUrl(raw.photo_url, true), ask: money(raw.ask ?? raw.ask_price ?? raw.price),
    distance_mi: money(raw.distance_mi), area: str(raw.area, 80), risk_note: str(raw.risk_note, 300),
    title: str(raw.title, 200), comps,
  };
}

function blankScore(deal, extra) {
  return {
    ...deal, resale: null, shipping: null, fee: null, gas: null, profit: null,
    flags: [], ranked: false, rank: null, unranked_reason: null, ...extra,
  };
}

// Score one cleaned deal. Does not decide rank; buildFeed does that.
export function scoreDeal(deal, config) {
  const cfg = config || emptyConfig();
  const { resale, shipping } = resaleFrom(deal.comps);
  if (resale == null) return blankScore(deal, { unranked_reason: 'no comps' });
  const spec = cfg.fees && cfg.fees[deal.source];
  const fee = feeAmount(resale, spec);
  if (fee == null) return blankScore(deal, { resale, shipping, unranked_reason: 'profit unknown' });
  const ship = shipping == null ? 0 : shipping;
  const flags = [];
  let gas = 0;
  if (cfg.gas_per_mile == null) {
    flags.push('gas not included');
  } else if (deal.distance_mi == null) {
    return blankScore(deal, { resale, shipping, fee, unranked_reason: 'distance unknown' });
  } else {
    gas = round2(2 * deal.distance_mi * cfg.gas_per_mile);
  }
  if (deal.ask == null) return blankScore(deal, { resale, shipping, fee, gas, flags, unranked_reason: 'profit unknown' });
  const profit = round2(resale - deal.ask - fee - ship - gas);
  return { ...deal, resale, shipping, fee, gas, profit, flags, ranked: false, rank: null, unranked_reason: null };
}

function rejectReason(deal, config) {
  if (deal.unranked_reason) return deal.unranked_reason;
  if (!config.sites.includes(deal.source)) return 'site not in scout config';
  if (deal.distance_mi == null) return 'distance unknown';
  if (deal.distance_mi > config.max_pickup_miles) return 'too far';
  if (config.max_per_flip != null && (deal.ask == null || deal.ask > config.max_per_flip)) return 'over max per flip';
  if (deal.profit == null) return 'profit unknown';
  if (deal.profit < config.min_profit) return 'under min profit';
  return null;
}

// Clean, score, and rank. When a required filter is null, deals are stored and left unranked.
export function buildFeed(rawDeals, config) {
  const cfg = config || emptyConfig();
  const ready = filtersReady(cfg);
  const deals = (Array.isArray(rawDeals) ? rawDeals : []).slice(0, 100).map(cleanDeal).filter(Boolean).map((d) => scoreDeal(d, cfg));
  if (!ready) return { filters_set: false, deals: deals.map((d) => ({ ...d, ranked: false, rank: null })) };
  const ranked = [];
  const rest = [];
  for (const d of deals) {
    const why = rejectReason(d, cfg);
    if (why) rest.push({ ...d, ranked: false, rank: null, unranked_reason: why });
    else ranked.push({ ...d, ranked: true, unranked_reason: null });
  }
  ranked.sort((a, b) => b.profit - a.profit || (a.ask ?? 0) - (b.ask ?? 0));
  ranked.forEach((d, i) => { d.rank = i + 1; });
  return { filters_set: true, deals: [...ranked, ...rest] };
}
