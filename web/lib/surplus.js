// Surplus lot math. No network and no disk.
// Asking comps never become resale. Missing dollars stay null, not zero.
// A lot is a buy candidate only when profit is confirmed, every rule passes, and Adam's status says so.
// The rules (max cost, minimum profit, pickup radius, gas rate) come from config/rules.js through lib/rules.js.
import { money as parseMoney, moneyText, round2 } from './decision.js';
import { DEFAULT_RULES, checkLot } from './rules.js';
import { cleanDrive, driveCosts, driveText } from './drive.js';

export const HAUL_PER_MILE = DEFAULT_RULES.gas_per_mile;
export const TAX_ASSUMPTION_RATE = DEFAULT_RULES.tax_assumption_rate;
export const TAX_ASSUMPTION_LABEL = 'seller says tax added, rate not stated';
export const HOME = DEFAULT_RULES.home;
export const BUY_STATUS = 'buy candidate (needs Adam yes)';
export const STATUSES = ['watch', 'needs preview', BUY_STATUS, 'skip'];
const TAX_BASE_NOTE = 'The assumed tax base is the bid plus the buyer\'s premium. Lots in this scan did not state the base.';

// What the board shows about the rules in force.
export function rulesView(rules = DEFAULT_RULES) {
  return {
    home: rules.home,
    approved_on: rules.approved_on,
    max_cost: rules.max_cost,
    max_cost_text: moneyText(rules.max_cost),
    bankroll: rules.bankroll,
    bankroll_start: rules.bankroll_start,
    bankroll_source: rules.bankroll_source,
    max_cost_note: rules.bankroll_source === 'ledger' ? 'Current bankroll, from the ledger' : `Starting bankroll of ${moneyText(rules.bankroll_start)}`,
    min_profit: rules.min_profit,
    min_profit_text: moneyText(rules.min_profit),
    pickup_miles: rules.pickup_miles,
    hourly_rate: rules.hourly_rate,
    hourly_rate_text: `${moneyText(rules.hourly_rate)} an hour`,
    max_drive_minutes: rules.max_drive_minutes,
    haul_per_mile: rules.gas_per_mile,
    haul_per_mile_text: moneyText(rules.gas_per_mile),
    haul_confirmed: rules.gas_per_mile_confirmed,
    haul_note: `Hauling cost is round-trip miles times ${moneyText(rules.gas_per_mile)}.`,
    tax_assumption_rate: rules.tax_assumption_rate,
    tax_assumption_text: `${round2(rules.tax_assumption_rate * 100)}%`,
    tax_assumption_label: TAX_ASSUMPTION_LABEL,
    tax_base_note: TAX_BASE_NOTE,
    optional_on: Object.entries(rules.optional).filter(([, v]) => v.enabled).map(([k]) => k),
    places_bids: false,
  };
}

export const RULES = rulesView();

const money = parseMoney;
const BATTERY_STATES = ['included', 'none', 'unknown'];
// Whether a unit works. "parts" is a for-parts or not-working sale.
const CONDITIONS = ['working', 'parts', 'unknown'];
// The most comps one lot keeps. Anything past this is counted and reported, not dropped in silence.
export const MAX_COMPS = 80;

function str(v, n) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, n) : null;
}
function intOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}
function httpUrl(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > 1000) return null;
  let u;
  try { u = new URL(s); } catch (e) { return null; }
  if (u.username || u.password) return null;
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  return u.toString();
}
function round4(n) {
  return Math.round(Number(n) * 10000) / 10000;
}
// Rates are fractions (0.0825), so they cannot go through cent rounding.
function rate(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[%$,]/g, ''));
  if (!Number.isFinite(n)) return null;
  return round4(n);
}
function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2) return s[mid];
  return round2((s[mid - 1] + s[mid]) / 2);
}
export function moneyOrUnknown(v) {
  return moneyText(v) || 'unknown';
}
export function normalizeAddress(v) {
  const s = String(v || '').toLowerCase().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
  return s || null;
}

export function formatClose(iso, nowMs) {
  if (!iso) return { close_text: 'unknown', countdown: 'unknown', closed: null };
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return { close_text: 'unknown', countdown: 'unknown', closed: null };
  const when = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(t)) + ' CT';
  if (nowMs == null) return { close_text: when, countdown: null, closed: null };
  const diff = t - nowMs;
  if (diff <= 0) return { close_text: when, countdown: 'closed', closed: true };
  const sec = Math.floor(diff / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  parts.push(`${h}h`);
  parts.push(`${m}m`);
  return { close_text: when, countdown: parts.join(' '), closed: false };
}

export function scanDateText(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ''));
  if (!m) return 'unknown';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(m[2]) - 1];
  if (!month) return 'unknown';
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

function cleanComp(c) {
  if (!c || typeof c !== 'object') return null;
  const type = String(c.type || '').toLowerCase();
  if (type !== 'sold' && type !== 'asking') return null;
  const url = httpUrl(c.url);
  const price = money(c.price);
  const title = str(c.title, 180);
  const note = str(c.note, 400);
  const marketplace = str(c.marketplace, 80);
  if (price == null && !url && !title) return null;
  // price is always per unit. A lot sale also records how many units sold together and for how much.
  const lotSize = intOrNull(c.lot_size);
  const lotPrice = money(c.lot_price);
  const battery = BATTERY_STATES.includes(c.battery) ? c.battery : 'unknown';
  return {
    type, url, price, title, note, marketplace,
    lot_size: lotSize != null && lotSize > 1 ? lotSize : null,
    lot_price: lotSize != null && lotSize > 1 && lotPrice != null && lotPrice >= 0 ? lotPrice : null,
    battery,
    condition: CONDITIONS.includes(c.condition) ? c.condition : 'unknown',
    sold_on: str(c.sold_on, 40),
  };
}

export function cleanLot(raw, rules = DEFAULT_RULES) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = str(raw.id, 40);
  if (!id || !/^[a-z0-9-]+$/i.test(id)) return null;
  const miles = money(raw.miles_from_home);
  const taxBasis = raw.tax_basis === 'stated' || raw.tax_basis === 'assumption' ? raw.tax_basis : 'unknown';
  let taxRate = taxBasis === 'unknown' ? null : rate(raw.tax_rate);
  if (taxBasis === 'assumption' && taxRate == null) taxRate = rules.tax_assumption_rate;
  const feeBasis = raw.fee_basis === 'stated' || raw.fee_basis === 'assumption' ? raw.fee_basis : 'unknown';
  const feeRate = feeBasis === 'unknown' ? null : rate(raw.fee_rate);
  const shippingBasis = raw.shipping_basis === 'stated' || raw.shipping_basis === 'assumption' ? raw.shipping_basis : 'unknown';
  const shipping = shippingBasis === 'unknown' ? null : money(raw.shipping);
  const status = STATUSES.includes(raw.status) ? raw.status : 'watch';
  const allComps = (Array.isArray(raw.comps) ? raw.comps : []).map(cleanComp).filter(Boolean);
  const comps = allComps.slice(0, MAX_COMPS);
  const marketplaces = (Array.isArray(raw.marketplaces) ? raw.marketplaces : []).map((m) => str(m, 80)).filter(Boolean).slice(0, 6);
  const risks = (Array.isArray(raw.risks) ? raw.risks : []).map((r) => str(r, 240)).filter(Boolean).slice(0, 8);
  const quantity = intOrNull(raw.quantity);
  return {
    id: id.toLowerCase(),
    auction_id: str(raw.auction_id, 20),
    source_site: str(raw.source_site, 80),
    title: str(raw.title, 180),
    seller: str(raw.seller, 120),
    city: str(raw.city, 80),
    miles_from_home: miles != null && miles >= 0 ? miles : null,
    miles_approximate: raw.miles_approximate === false ? false : miles != null,
    miles_note: str(raw.miles_note, 240),
    url: httpUrl(raw.url),
    photo_url: (() => { const u = httpUrl(raw.photo_url); return u && u.startsWith('https:') ? u : null; })(),
    photo_note: str(raw.photo_note, 240),
    current_bid: (() => { const n = money(raw.current_bid); return n != null && n >= 0 ? n : null; })(),
    opening_bid: (() => { const n = money(raw.opening_bid); return n != null && n >= 0 ? n : null; })(),
    bid_count: intOrNull(raw.bid_count),
    bid_note: str(raw.bid_note, 300),
    bid_scan_low: (() => { const n = money(raw.bid_scan_low); return n != null && n >= 0 ? n : null; })(),
    bid_scan_high: (() => { const n = money(raw.bid_scan_high); return n != null && n >= 0 ? n : null; })(),
    bid_scan_note: str(raw.bid_scan_note, 300),
    closes_at: (() => {
      const s = str(raw.closes_at, 40);
      if (!s || !Number.isFinite(Date.parse(s))) return null;
      return new Date(Date.parse(s)).toISOString();
    })(),
    premium_pct: (() => { const n = money(raw.premium_pct); return n != null && n >= 0 ? n : null; })(),
    // Some sellers state a minimum premium per auction (City of Schertz: $1).
    premium_min: (() => { const n = money(raw.premium_min); return n != null && n >= 0 ? n : null; })(),
    tax_rate: taxRate != null && taxRate >= 0 ? taxRate : null,
    tax_basis: taxBasis,
    pickup_address: str(raw.pickup_address, 200),
    // Round-trip drive from home, from the routing service or posted with the lot. Null when unknown.
    drive: cleanDrive(raw.drive),
    pickup_terms: str(raw.pickup_terms, 300),
    pickup_deadline: str(raw.pickup_deadline, 200),
    quantity: quantity != null && quantity > 0 ? quantity : null,
    quantity_note: str(raw.quantity_note, 300),
    marketplaces,
    comps,
    fee_rate: feeRate != null && feeRate >= 0 ? feeRate : null,
    fee_basis: feeBasis,
    fee_note: str(raw.fee_note, 240),
    // Flat platform fee for the whole lot, such as eBay's per-order fee times the number of orders.
    fee_fixed: (() => { const n = feeBasis === 'unknown' ? null : money(raw.fee_fixed); return n != null && n >= 0 ? n : null; })(),
    shipping: shipping != null && shipping >= 0 ? shipping : null,
    shipping_basis: shipping != null && shipping >= 0 ? shippingBasis : 'unknown',
    shipping_note: str(raw.shipping_note, 240),
    resale_note: str(raw.resale_note, 300),
    listing_plan: cleanPlan(raw.listing_plan),
    // A snapshot is cleaned once when stored and again when shown. Carry the count forward so the second pass keeps it.
    comps_dropped: (intOrNull(raw.comps_dropped) || 0) + (allComps.length - comps.length),
    // Whether the units work. Unknown is the honest value for a phone nobody has powered on.
    condition: CONDITIONS.includes(raw.condition) ? raw.condition : 'unknown',
    // A phone or handheld from an agency fleet. A device-management or carrier lock is likely.
    fleet_device: raw.fleet_device === true,
    // Whether the units in this lot come with batteries. "none" means resale is priced from battery-less sales.
    batteries: BATTERY_STATES.includes(raw.batteries) ? raw.batteries : 'unknown',
    // What one battery costs, only when a source is cited. Without it, a sale that included a battery cannot be adjusted.
    battery_cost: (() => { const n = money(raw.battery_cost); return n != null && n >= 0 ? n : null; })(),
    battery_cost_note: str(raw.battery_cost_note, 240),
    status,
    risks,
    scan_notes: str(raw.scan_notes, 500),
  };
}

export function cleanSnapshot(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('body must be {lots:[...]}');
  if (!Array.isArray(input.lots)) throw new Error('body must be {lots:[...]}');
  if (input.lots.length > 100) throw new Error('too many lots');
  // Lots that share comps can name a set once ("comp_set": "sm-g781v") instead of repeating every row.
  const sets = input.comp_sets && typeof input.comp_sets === 'object' && !Array.isArray(input.comp_sets) ? input.comp_sets : {};
  const lots = input.lots.map((lot, i) => {
    const name = lot && typeof lot.comp_set === 'string' ? lot.comp_set : null;
    const own = lot && Array.isArray(lot.comps) ? lot.comps : [];
    if (name && !Array.isArray(sets[name])) throw new Error(`lot ${i} names comp set ${name}, which is not in comp_sets`);
    const cleaned = cleanLot(name ? { ...lot, comps: [...sets[name], ...own] } : lot);
    if (!cleaned) throw new Error(`lot ${i} is missing a usable id`);
    return cleaned;
  });
  const ids = new Set();
  for (const lot of lots) {
    if (ids.has(lot.id)) throw new Error(`duplicate lot id ${lot.id}`);
    ids.add(lot.id);
  }
  const scanned = str(input.scanned_on, 10);
  return {
    kind: 'surplus-scan-snapshot',
    sample: false,
    scanned_on: scanned && /^\d{4}-\d{2}-\d{2}$/.test(scanned) ? scanned : null,
    label: str(input.label, 240),
    notice: str(input.notice, 500),
    places_bids: false,
    updated_at: str(input.updated_at, 40),
    lots,
  };
}

function presentComp(c) {
  const asking = c.type === 'asking';
  return {
    ...c,
    price_text: moneyOrUnknown(c.price),
    type_label: asking ? 'asking, not sold' : 'sold',
    confidence: asking ? 'lower' : 'sold',
    url_text: c.url ? c.url : 'no comp URL in the scan',
  };
}

// Low, middle and high resale per unit, from cited sold comps only.
// The lot is sold as one lot (one box, one order fee), so lot sales set the middle and high cases
// when there are any. Single-unit sales are kept apart and can only pull the low case down.
// When the lot has no batteries, only battery-less sales set the middle and high cases.
// A sale that included a battery is lowered by the battery cost when that cost is cited.
// When it is not, that sale still counts toward the low case, unadjusted.
// A fleet device may be locked. No cited sale tells us what a locked one sells for.
function lockCaveat(lot) {
  return lot.fleet_device ? ['No cited sale is of a locked unit. If these are locked, the price is unknown and may be under the low case.'] : [];
}

// Adam's own listing draft for the lot: the Buy It Now price for the whole lot and the lowest offer he
// would take. When there is one, it sets the cases, because the lot will be listed at that price, not at
// the comps. The comps are kept beside it.
function cleanPlan(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const ask = money(raw.ask);
  const floor = money(raw.floor);
  if (ask == null || ask <= 0) return null;
  return { ask, floor: floor != null && floor > 0 && floor <= ask ? floor : null, source: str(raw.source, 200) };
}

// The cases from a listing plan. Middle: the asking price. Low: the floor, or the comps' low with no floor.
// High: the asking price, since Buy It Now caps the sale there. Prices are per unit, like the comps.
export function planCases(resale, plan, quantity) {
  if (!resale || !plan || !quantity) return resale;
  const ask = round2(plan.ask / quantity);
  const floor = plan.floor == null ? null : round2(plan.floor / quantity);
  const from = plan.source ? ` (${plan.source})` : '';
  const comps = Object.fromEntries(resale.cases.map((c) => [c.name, c.unit]));
  const low = floor == null ? Math.min(comps.low, ask) : floor;
  return {
    ...resale,
    cases: [
      { name: 'low', unit: low, basis: floor == null ? `No floor in the listing draft, so the lowest cited sale, capped at the asking price.` : `The lowest offer to take in the listing draft: ${moneyText(plan.floor)} for the lot${from}.` },
      { name: 'middle', unit: ask, basis: `The Buy It Now price in the listing draft: ${moneyText(plan.ask)} for the lot${from}.` },
      { name: 'high', unit: ask, basis: 'Buy It Now caps the sale at the asking price.' },
    ],
    comps_say: comps,
    plan: { ask: plan.ask, floor: plan.floor, source: plan.source },
    caveats: [
      `The comps say ${moneyText(comps.middle)} a unit in the middle case. The listing draft asks ${moneyText(ask)} a unit, so the cases use the draft.`,
      ...resale.caveats,
    ],
  };
}

export function resaleCases(lot, soldCited) {
  if (!soldCited.length) return null;
  // Working and for-parts sales are different markets, so they are never blended into one median.
  const working = soldCited.filter((c) => c.condition === 'working');
  const parts = soldCited.filter((c) => c.condition === 'parts');
  if (working.length || parts.length) {
    const prices = (list) => list.map((c) => c.price);
    const counts = { used: 0, lot_sales: soldCited.filter((c) => c.lot_size != null).length, single_sales: soldCited.filter((c) => c.lot_size == null).length, working_sales: working.length, parts_sales: parts.length };
    const lock = lockCaveat(lot);
    const band = (list, label) => [
      { name: 'low', unit: round2(Math.min(...prices(list))), basis: `Lowest of ${list.length} ${label} sale${list.length === 1 ? '' : 's'}.` },
      { name: 'middle', unit: median(prices(list)), basis: `Median of ${list.length} ${label} sale${list.length === 1 ? '' : 's'}.` },
      { name: 'high', unit: round2(Math.max(...prices(list))), basis: `Highest of ${list.length} ${label} sale${list.length === 1 ? '' : 's'}.` },
    ];
    if (lot.condition === 'working' && working.length) return { cases: band(working, 'working'), ...counts, used: working.length, caveats: lock };
    if (lot.condition === 'parts' && parts.length) return { cases: band(parts, 'for-parts'), ...counts, used: parts.length, caveats: lock };
    if (working.length && parts.length) {
      // Condition unknown: the middle case assumes the unit is only good for parts. Working is the high case.
      return {
        cases: [
          { name: 'low', unit: round2(Math.min(...prices(parts))), basis: `Lowest of ${parts.length} for-parts sales.` },
          { name: 'middle', unit: median(prices(parts)), basis: `Median of ${parts.length} for-parts sales. The condition is unknown, so the middle case does not assume it works.` },
          { name: 'high', unit: median(prices(working)), basis: `Median of ${working.length} working sales. Only if it powers on and is not locked.` },
        ],
        ...counts,
        used: working.length + parts.length,
        caveats: lock,
      };
    }
    const only = working.length ? working : parts;
    const label = working.length ? 'working' : 'for-parts';
    const missing = lot.condition === 'unknown'
      ? [`Every cited sale is ${label}. The condition of this lot is unknown.`]
      : [`This lot is marked ${lot.condition}, but every cited sale is ${label}.`];
    return { cases: band(only, label), ...counts, used: only.length, caveats: [...missing, ...lock] };
  }
  const noBatteries = lot.batteries === 'none';
  const adjusted = soldCited.map((c) => {
    if (noBatteries && c.battery === 'included' && lot.battery_cost != null) {
      return { ...c, unit: round2(Math.max(0, c.price - lot.battery_cost)), fit: 'adjusted' };
    }
    if (noBatteries && c.battery !== 'none') return { ...c, unit: c.price, fit: c.battery === 'included' ? 'has battery' : 'battery unknown' };
    return { ...c, unit: c.price, fit: 'match' };
  });
  const matched = adjusted.filter((c) => c.fit === 'match' || c.fit === 'adjusted');
  const pool = matched.length ? matched : adjusted;
  const lotSales = pool.filter((c) => c.lot_size != null);
  const core = lotSales.length ? lotSales : pool;
  const coreUnits = core.map((c) => c.unit);
  const lowUnit = Math.min(...adjusted.map((c) => c.unit));
  const lowComp = adjusted.find((c) => c.unit === lowUnit);
  const coreText = [
    lotSales.length ? `${lotSales.length} lot sale${lotSales.length === 1 ? '' : 's'}` : `${core.length} sold comp${core.length === 1 ? '' : 's'}`,
    noBatteries && matched.length ? 'without batteries' : null,
  ].filter(Boolean).join(' ');
  const caveats = [];
  if (noBatteries && !matched.length) caveats.push('No cited sale is known to be battery-less, so these cases use sales whose battery state is unknown or included. They are likely too high.');
  if (!lotSales.length && lot.quantity != null && lot.quantity > 1) caveats.push('No cited sale was a lot, so the cases use single-unit prices. A lot usually sells for less a unit.');
  const biggest = lotSales.reduce((m, c) => Math.max(m, c.lot_size), 0);
  if (lotSales.length && lot.quantity != null && biggest && lot.quantity > biggest) caveats.push(`The biggest cited lot sale was ${biggest} units. This lot is ${lot.quantity}.`);
  caveats.push(...lockCaveat(lot));
  return {
    cases: [
      { name: 'low', unit: round2(lowUnit), basis: `Lowest cited sale of any kind${lowComp && lowComp.fit !== 'match' ? ` (${lowComp.fit})` : ''}.` },
      { name: 'middle', unit: median(coreUnits), basis: `Median of ${coreText}.` },
      { name: 'high', unit: round2(Math.max(...coreUnits)), basis: `Highest of ${coreText}.` },
    ],
    used: core.length,
    lot_sales: adjusted.filter((c) => c.lot_size != null).length,
    single_sales: adjusted.filter((c) => c.lot_size == null).length,
    caveats,
  };
}

export function assessLot(raw, nowMs = null, rules = DEFAULT_RULES) {
  const lot = cleanLot(raw, rules);
  if (!lot) return null;
  const bid = lot.current_bid;
  const premiumPct = lot.premium_pct;
  // Routed miles when the drive is known. Otherwise twice the stated miles from home.
  const drive = driveCosts(lot.drive, rules);
  const roundTrip = drive.miles != null ? drive.miles : (lot.miles_from_home != null ? round2(lot.miles_from_home * 2) : null);
  const haul = roundTrip != null ? round2(roundTrip * rules.gas_per_mile) : null;
  // Adam's time for the drive. It is not cash, so it is not part of the all-in cost or the max buy.
  // It comes off profit. While the drive is unknown it is left out, and the lot says so and cannot be a buy.
  const timeCost = drive.time_cost;
  const timeOff = timeCost != null ? timeCost : 0;
  const milesExact = lot.miles_approximate === false || drive.miles != null;
  const taxKnown = lot.tax_rate != null && lot.tax_basis !== 'unknown';
  // What the lot costs to win and bring home at a given bid. Null while any part is unknown.
  const costAt = (b) => {
    if (b == null || premiumPct == null) return null;
    const prem = round2(Math.max(b * (premiumPct / 100), lot.premium_min || 0));
    const tx = taxKnown ? round2(round2(b + prem) * lot.tax_rate) : null;
    return { premium: prem, tax: tx, all_in: tx != null && haul != null ? round2(b + prem + tx + haul) : null };
  };
  const nowCost = costAt(bid);
  const premium = nowCost ? nowCost.premium : null;
  const tax = nowCost ? nowCost.tax : null;
  const allInParts = nowCost != null && nowCost.all_in != null;
  const allIn = allInParts ? nowCost.all_in : null;
  const allInBasis = !allInParts ? 'unknown'
    : (lot.tax_basis === 'stated' && milesExact ? 'stated' : 'assumption');

  const comps = lot.comps.map(presentComp);
  const sold = comps.filter((c) => c.type === 'sold' && c.price != null);
  const soldCited = sold.filter((c) => c.url);
  const asking = comps.filter((c) => c.type === 'asking');
  // One sold comp without a URL blocks resale for the whole lot.
  const fromComps = sold.length > 0 && soldCited.length === sold.length ? resaleCases(lot, soldCited) : null;
  // A listing plan sets the cases only when cited sales back the lot. With no comps, resale stays unknown.
  const resale = lot.listing_plan ? planCases(fromComps, lot.listing_plan, lot.quantity) : fromComps;
  const unitResale = resale ? resale.cases[1].unit : null;
  const quantity = lot.quantity;
  const gross = unitResale != null && quantity != null ? round2(unitResale * quantity) : null;
  const feeKnown = lot.fee_rate != null && (lot.fee_basis === 'stated' || lot.fee_basis === 'assumption');
  const fee = gross != null && feeKnown ? round2(gross * lot.fee_rate + (lot.fee_fixed || 0)) : null;
  const ship = lot.shipping_basis !== 'unknown' && lot.shipping != null ? lot.shipping : null;
  const inputsConfirmed = unitResale != null && gross != null && fee != null && lot.fee_basis === 'stated'
    && ship != null && lot.shipping_basis === 'stated' && allIn != null && allInBasis === 'stated' && timeCost != null;
  const net = inputsConfirmed ? round2(gross - fee - ship - allIn - timeCost) : null;
  const roi = net != null && allIn > 0 ? round4(net / allIn) : null;
  // An estimate needs every input present. It is shown apart from confirmed profit and never makes a lot a buy.
  const netEstimate = net == null && gross != null && fee != null && ship != null && allIn != null
    ? round2(gross - fee - ship - allIn - timeOff) : null;
  const estimateAssumptions = netEstimate == null ? [] : [
    timeCost == null ? 'drive time left out' : null,
    lot.tax_basis !== 'stated' ? 'tax rate' : null,
    !milesExact ? 'miles' : null,
    lot.fee_basis !== 'stated' ? 'platform fee' : null,
    lot.shipping_basis !== 'stated' ? 'shipping' : null,
  ].filter(Boolean);
  const profitConfidence = net != null ? 'confirmed' : 'unknown';

  // What is left from a sale at one unit price, after the platform fee and shipping. Null while any part is unknown.
  const proceedsAt = (unit) => {
    if (unit == null || quantity == null || !feeKnown || ship == null) return null;
    const g = round2(unit * quantity);
    const f = round2(g * lot.fee_rate + (lot.fee_fixed || 0));
    return { gross: g, fee: f, proceeds: round2(g - f - ship) };
  };
  const caseMoney = resale ? resale.cases.map((c) => ({ ...c, ...(proceedsAt(c.unit) || { gross: null, fee: null, proceeds: null }) })) : [];
  const lowCase = caseMoney[0] || null;
  const midCase = caseMoney[1] || null;
  const highCase = caseMoney[2] || null;
  // Max bid: the highest whole-dollar bid where the all-in cost stays inside the max cost,
  // the middle case still makes the minimum profit, and the low case does not lose money.
  let maxBid = null;
  let maxBidReason = null;
  if (!midCase || midCase.proceeds == null) maxBidReason = 'Max bid is unknown until resale, the platform fee and shipping are known.';
  else if (costAt(1) == null || costAt(1).all_in == null) maxBidReason = 'Max bid is unknown until the buyer\'s premium, tax and haul are known.';
  else {
    for (let b = Math.floor(rules.max_cost); b >= 1; b--) {
      const cost = costAt(b).all_in;
      if (cost <= rules.max_cost && midCase.proceeds - cost - timeOff >= rules.min_profit && lowCase.proceeds - cost - timeOff >= 0) { maxBid = b; break; }
    }
    if (maxBid == null) {
      const floorCost = costAt(1).all_in;
      maxBidReason = midCase.proceeds - floorCost - timeOff < rules.min_profit
        ? `No bid works. Even at a $1 bid the middle case makes ${moneyText(round2(midCase.proceeds - floorCost - timeOff))}, under the ${moneyText(rules.min_profit)} minimum.`
        : `No bid works. Even at a $1 bid the low case loses money (${moneyText(round2(lowCase.proceeds - floorCost - timeOff))}).`;
    }
  }
  const maxCost = maxBid != null ? costAt(maxBid) : null;
  const profitAt = (c, cost) => (c && c.proceeds != null && cost != null ? round2(c.proceeds - cost - timeOff) : null);
  const cases = caseMoney.map((c) => ({
    name: c.name,
    unit: c.unit,
    unit_text: moneyOrUnknown(c.unit),
    basis: c.basis,
    gross: c.gross,
    gross_text: moneyOrUnknown(c.gross),
    proceeds: c.proceeds,
    proceeds_text: moneyOrUnknown(c.proceeds),
    profit_at_max_bid: profitAt(c, maxCost && maxCost.all_in),
    profit_at_max_bid_text: moneyOrUnknown(profitAt(c, maxCost && maxCost.all_in)),
    profit_at_current_bid: profitAt(c, allIn),
    profit_at_current_bid_text: moneyOrUnknown(profitAt(c, allIn)),
  }));
  const bidPastMax = maxBid != null && bid != null && bid > maxBid;

  let profitReason;
  if (profitConfidence === 'confirmed') profitReason = 'Profit is confirmed from sold comps and stated costs.';
  else if (sold.length > 0 && soldCited.length !== sold.length) profitReason = 'A sold comp has no URL, so resale stays unknown.';
  else if (unitResale == null && asking.length) profitReason = 'Resale is unknown. Asking prices are labeled asking, not sold, and are not used as resale.';
  else if (unitResale == null) profitReason = 'Resale is unknown, so profit and ROI are unknown.';
  else {
    const missing = [];
    if (!(lot.fee_rate != null && lot.fee_basis === 'stated')) missing.push('platform fee');
    if (ship == null || lot.shipping_basis !== 'stated') missing.push('shipping');
    if (allInBasis !== 'stated') missing.push('all-in cost');
    if (timeCost == null) missing.push('drive time');
    if (quantity == null) missing.push('unit count');
    profitReason = `Profit is not confirmed. Missing or unconfirmed: ${missing.join(', ') || 'a required cost'}. Missing costs are not treated as zero.`;
  }

  // Adam's rules are hard checks. One failed rule turns the lot to skip, whatever status came in.
  const ruleResult = checkLot({
    miles: lot.miles_from_home,
    miles_approximate: lot.miles_approximate,
    drive_minutes: drive.minutes,
    all_in: allIn,
    price_floor: bid != null ? bid : lot.opening_bid,
    net,
    net_estimate: netEstimate,
    // Estimated profit at the current bid in the low and high cases, so the rule sees the range.
    net_low: net == null ? profitAt(lowCase, allIn) : null,
    net_high: net == null ? profitAt(highCase, allIn) : null,
    roi,
  }, rules);

  let status = lot.status;
  let statusReason = null;
  if (ruleResult.failed.length) {
    status = 'skip';
    statusReason = `Skipped by rule. ${ruleResult.skip_reason}`;
  } else if (status === BUY_STATUS && profitConfidence !== 'confirmed') {
    status = 'watch';
    statusReason = unitResale == null
      ? 'Resale is unknown, so this lot cannot be marked buy.'
      : 'Profit is not confirmed, so this lot cannot be marked buy.';
  } else if (status === BUY_STATUS && !ruleResult.all_pass) {
    status = 'watch';
    statusReason = `A rule could not be checked, so this lot cannot be marked buy. ${ruleResult.checks.filter((c) => c.pass == null).map((c) => c.text).join(' ')}`;
  }

  const milesText = lot.miles_from_home == null
    ? 'unknown'
    : `${lot.miles_approximate ? 'about ' : ''}${lot.miles_from_home} mi from ${rules.home}`;
  const range = lot.bid_scan_low != null && lot.bid_scan_high != null
    ? `${moneyText(lot.bid_scan_low)}–${moneyText(lot.bid_scan_high)}`
    : null;

  // With a listing plan, the scan's resale and battery notes describe the comp math, which no longer sets
  // the cases. They are replaced with what does.
  const planNotes = resale && resale.plan ? {
    resale_note: `Priced at your listing draft: ${moneyText(resale.plan.ask)} Buy It Now${resale.plan.floor != null ? `, ${moneyText(resale.plan.floor)} lowest offer` : ''} for the lot. The comps alone said ${moneyText(resale.comps_say.middle)} a unit.`,
    // With a floor, the draft sets every case. Without one, the low case still comes from the cited sales, so
    // the scan's battery note still holds.
    battery_cost_note: lot.battery_cost_note && resale.plan.floor != null ? 'The listing draft sets the cases, so no battery sale does.' : lot.battery_cost_note,
  } : {};
  return {
    ...lot,
    ...planNotes,
    ...formatClose(lot.closes_at, nowMs),
    miles_text: milesText,
    current_bid_text: moneyOrUnknown(bid),
    opening_bid_text: lot.opening_bid == null ? null : moneyText(lot.opening_bid),
    bid_count_text: lot.bid_count == null ? 'unknown' : String(lot.bid_count),
    bid_scan_text: range,
    premium_amount: premium,
    premium_text: premiumPct == null ? 'unknown' : `${round2(premiumPct)}%`,
    premium_amount_text: moneyOrUnknown(premium),
    premium_note: [
      premium != null ? `Premium dollars ${moneyText(premium)}` : null,
      lot.premium_min != null ? `Minimum ${moneyText(lot.premium_min)} per auction.` : null,
    ].filter(Boolean).join('. ') || null,
    tax_amount: tax,
    tax_text: moneyOrUnknown(tax),
    tax_label: lot.tax_basis === 'assumption'
      ? TAX_ASSUMPTION_LABEL
      : (lot.tax_basis === 'stated' ? 'Tax rate stated on the lot.' : 'unknown'),
    tax_rate_text: lot.tax_rate == null ? 'unknown' : `${round2(lot.tax_rate * 100)}%`,
    round_trip_miles: roundTrip,
    haul_cost: haul,
    haul_text: moneyOrUnknown(haul),
    haul_basis: drive.miles != null ? 'routed' : (roundTrip != null ? 'stated miles' : 'unknown'),
    drive_minutes: drive.minutes,
    drive_miles: drive.miles,
    drive_text: driveText(lot.drive),
    drive_source: lot.drive ? lot.drive.source : null,
    time_cost: timeCost,
    time_cost_text: moneyOrUnknown(timeCost),
    time_note: timeCost != null
      ? `${drive.minutes} minutes at ${moneyText(rules.hourly_rate)} an hour. It comes off profit, not off the bankroll.`
      : 'Drive time is unknown, so the time cost is left out of every profit number on this lot.',
    all_in: allIn,
    all_in_text: moneyOrUnknown(allIn),
    all_in_basis: allInBasis,
    all_in_note: allInBasis === 'unknown'
      ? 'All-in stays unknown until the bid, buyer\'s premium, tax, and haul are all known.'
      : [
        lot.tax_basis === 'assumption' ? `Includes assumed ${round2(lot.tax_rate * 100)}% tax. ${TAX_ASSUMPTION_LABEL}.` : null,
        lot.miles_approximate ? 'Miles are approximate, so the haul is approximate.' : null,
        TAX_BASE_NOTE,
      ].filter(Boolean).join(' '),
    comps,
    marketplaces_text: lot.marketplaces.length ? lot.marketplaces.join(', ') : 'unknown',
    unit_resale: unitResale,
    unit_resale_text: moneyOrUnknown(unitResale),
    resale_basis: unitResale == null ? 'unknown' : 'sold',
    unit_count_text: quantity == null ? 'unknown' : String(quantity),
    fee_amount: fee,
    fee_text: lot.fee_basis === 'unknown' || lot.fee_rate == null
      ? 'unknown'
      : `${round2(lot.fee_rate * 100)}% ${lot.fee_basis === 'assumption' ? 'assumption' : 'stated'}`,
    shipping_text: ship == null ? 'unknown' : `${moneyText(ship)}${lot.shipping_basis === 'assumption' ? ' assumption' : ''}`,
    gross,
    gross_text: moneyOrUnknown(gross),
    net,
    net_text: moneyOrUnknown(net),
    net_estimate: netEstimate,
    net_estimate_text: netEstimate == null ? null : moneyText(netEstimate),
    net_estimate_note: netEstimate == null ? null
      : `Estimate, not confirmed. Assumed: ${estimateAssumptions.join(', ') || 'none'}. This is the middle case at the current bid, and it assumes every unit sells.`,
    cases,
    case_caveats: resale ? resale.caveats : [],
    // Set when Adam's listing draft priced the lot. comps_say keeps the comp-based cases beside it.
    listing_plan: resale && resale.plan ? resale.plan : null,
    comps_say: resale && resale.comps_say ? resale.comps_say : null,
    comps_lot_sales: resale ? resale.lot_sales : 0,
    comps_single_sales: resale ? resale.single_sales : 0,
    comps_working_sales: resale ? (resale.working_sales || 0) : 0,
    comps_parts_sales: resale ? (resale.parts_sales || 0) : 0,
    comps_note: lot.comps_dropped > 0 ? `${lot.comps_dropped} more comp${lot.comps_dropped === 1 ? ' was' : 's were'} sent than the ${MAX_COMPS} this board keeps. They are not counted.` : null,
    lock_flag: lot.fleet_device ? 'Fleet device. A device-management, Google account or carrier lock is likely, and it cannot be checked before pickup.' : null,
    max_bid: maxBid,
    // 'none' means no bid works. 'unknown' means it cannot be worked out yet. One word, used everywhere.
    max_bid_text: maxBid != null ? moneyText(maxBid) : (/^No bid works/.test(maxBidReason || '') ? 'none' : 'unknown'),
    max_bid_all_in: maxCost ? maxCost.all_in : null,
    max_bid_all_in_text: moneyOrUnknown(maxCost ? maxCost.all_in : null),
    max_bid_note: maxBid == null ? maxBidReason
      : [
        `All-in at this bid is ${moneyText(maxCost.all_in)}. The middle case still makes ${moneyText(rules.min_profit)} or more, the low case does not lose money, and the cost stays inside ${moneyText(rules.max_cost)}.`,
        timeCost == null ? 'Drive time is unknown and is left out, so the real max bid is lower.' : null,
        bidPastMax ? `The current bid ${moneyText(bid)} is already above it.` : null,
        'Whole dollars. The bid is Adam\'s to place. This board never bids.',
      ].filter(Boolean).join(' '),
    bid_past_max: bidPastMax,
    batteries_text: lot.batteries === 'none' ? 'No batteries' : (lot.batteries === 'included' ? 'Batteries included' : 'unknown'),
    roi,
    roi_text: roi == null ? 'unknown' : `${round2(roi * 100)}%`,
    profit_confidence: profitConfidence,
    profit_reason: profitReason,
    status,
    status_reason: statusReason,
    rule_checks: ruleResult.checks,
    rules_pass: ruleResult.all_pass,
    haul_rate_text: moneyText(rules.gas_per_mile),
    places_bids: false,
  };
}

export function tripGroups(lots) {
  const buckets = new Map();
  for (const lot of lots) {
    const key = normalizeAddress(lot.pickup_address);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(lot);
  }
  const groups = [];
  for (const members of buckets.values()) {
    if (members.length < 2) continue;
    const hauls = members.map((m) => m.haul_cost);
    const same = hauls.every((h) => h != null && h === hauls[0]);
    const shared = same ? hauls[0] : null;
    const separate = same ? round2(shared * members.length) : null;
    const saved = same ? round2(separate - shared) : null;
    groups.push({
      address: members[0].pickup_address,
      lot_ids: members.map((m) => m.id),
      titles: members.map((m) => m.title || m.id),
      shared_haul: shared,
      shared_haul_text: moneyOrUnknown(shared),
      separate_haul: separate,
      separate_haul_text: moneyOrUnknown(separate),
      saved,
      saved_text: moneyOrUnknown(saved),
      hint: same
        ? `One round trip is ${moneyText(shared)}. Hauling each lot alone would be ${moneyText(separate)}.`
        : 'These lots list the same pickup address, but the haul is not the same on each, so the costs are not combined.',
    });
  }
  return groups;
}

export function assessSnapshot(input, nowMs = null, rules = DEFAULT_RULES) {
  const doc = cleanSnapshot(input);
  const lots = doc.lots.map((lot) => assessLot(lot, nowMs, rules)).filter(Boolean);
  const trips = tripGroups(lots);
  return {
    kind: 'surplus-scan-snapshot',
    sample: false,
    scanned_on: doc.scanned_on || null,
    scanned_on_text: scanDateText(doc.scanned_on),
    label: doc.label || null,
    notice: doc.notice || null,
    places_bids: false,
    rules: rulesView(rules),
    lots,
    trips,
    trip_note: trips.length
      ? 'Lots at the same pickup address share one haul. Each lot still shows its own full round trip, so the lot all-in is not reduced.'
      : 'No two lots share a recorded pickup address, so nothing is combined. The same address would share one round trip.',
  };
}

export function withClock(view, nowMs) {
  if (!view || !Array.isArray(view.lots)) return view;
  return { ...view, lots: view.lots.map((lot) => ({ ...lot, ...formatClose(lot.closes_at, nowMs) })) };
}
