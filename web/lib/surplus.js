// Surplus lot math. No network and no disk.
// Asking comps never become resale. Missing dollars stay null, not zero.
// A lot is a buy candidate only when profit is confirmed and Adam's status says so.
import { money as parseMoney, moneyText, round2 } from './decision.js';

export const HAUL_PER_MILE = 0.18;
export const TAX_ASSUMPTION_RATE = 0.0825;
export const TAX_ASSUMPTION_LABEL = 'seller says tax added, rate not stated';
export const HOME = 'New Braunfels, TX';
export const BUY_STATUS = 'buy candidate (needs Adam yes)';
export const STATUSES = ['watch', 'needs preview', BUY_STATUS, 'skip'];

export const RULES = {
  home: HOME,
  haul_per_mile: HAUL_PER_MILE,
  haul_note: 'Hauling cost is round-trip miles times $0.18.',
  tax_assumption_rate: TAX_ASSUMPTION_RATE,
  tax_assumption_label: TAX_ASSUMPTION_LABEL,
  tax_base_note: 'The assumed tax base is the bid plus the buyer\'s premium. Lots in this scan did not state the base.',
  places_bids: false,
};

const money = parseMoney;

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
  return { type, url, price, title, note, marketplace };
}

export function cleanLot(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = str(raw.id, 40);
  if (!id || !/^[a-z0-9-]+$/i.test(id)) return null;
  const miles = money(raw.miles_from_home);
  const taxBasis = raw.tax_basis === 'stated' || raw.tax_basis === 'assumption' ? raw.tax_basis : 'unknown';
  let taxRate = taxBasis === 'unknown' ? null : rate(raw.tax_rate);
  if (taxBasis === 'assumption' && taxRate == null) taxRate = TAX_ASSUMPTION_RATE;
  const feeBasis = raw.fee_basis === 'stated' || raw.fee_basis === 'assumption' ? raw.fee_basis : 'unknown';
  const feeRate = feeBasis === 'unknown' ? null : rate(raw.fee_rate);
  const shippingBasis = raw.shipping_basis === 'stated' ? 'stated' : 'unknown';
  const shipping = shippingBasis === 'stated' ? money(raw.shipping) : null;
  const status = STATUSES.includes(raw.status) ? raw.status : 'watch';
  const comps = (Array.isArray(raw.comps) ? raw.comps : []).slice(0, 12).map(cleanComp).filter(Boolean);
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
    tax_rate: taxRate != null && taxRate >= 0 ? taxRate : null,
    tax_basis: taxBasis,
    pickup_address: str(raw.pickup_address, 200),
    pickup_terms: str(raw.pickup_terms, 300),
    pickup_deadline: str(raw.pickup_deadline, 200),
    quantity: quantity != null && quantity > 0 ? quantity : null,
    quantity_note: str(raw.quantity_note, 300),
    marketplaces,
    comps,
    fee_rate: feeRate != null && feeRate >= 0 ? feeRate : null,
    fee_basis: feeBasis,
    fee_note: str(raw.fee_note, 240),
    shipping: shipping != null && shipping >= 0 ? shipping : (shippingBasis === 'stated' ? null : null),
    shipping_basis: shipping != null && shipping >= 0 ? 'stated' : 'unknown',
    status,
    risks,
    scan_notes: str(raw.scan_notes, 500),
  };
}

export function cleanSnapshot(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('body must be {lots:[...]}');
  if (!Array.isArray(input.lots)) throw new Error('body must be {lots:[...]}');
  if (input.lots.length > 100) throw new Error('too many lots');
  const lots = input.lots.map((lot, i) => {
    const cleaned = cleanLot(lot);
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

export function assessLot(raw, nowMs = null) {
  const lot = cleanLot(raw);
  if (!lot) return null;
  const bid = lot.current_bid;
  const premiumPct = lot.premium_pct;
  const premium = bid != null && premiumPct != null ? round2(bid * (premiumPct / 100)) : null;
  const taxBase = bid != null && premium != null ? round2(bid + premium) : null;
  const tax = taxBase != null && lot.tax_rate != null && lot.tax_basis !== 'unknown'
    ? round2(taxBase * lot.tax_rate) : null;
  const roundTrip = lot.miles_from_home != null ? round2(lot.miles_from_home * 2) : null;
  const haul = roundTrip != null ? round2(roundTrip * HAUL_PER_MILE) : null;
  const allInParts = bid != null && premium != null && tax != null && haul != null;
  const allIn = allInParts ? round2(bid + premium + tax + haul) : null;
  const allInBasis = !allInParts ? 'unknown'
    : (lot.tax_basis === 'stated' && lot.miles_approximate === false ? 'stated' : 'assumption');

  const comps = lot.comps.map(presentComp);
  const sold = comps.filter((c) => c.type === 'sold' && c.price != null);
  const soldCited = sold.filter((c) => c.url);
  const asking = comps.filter((c) => c.type === 'asking');
  const unitResale = sold.length > 0 && soldCited.length === sold.length ? median(soldCited.map((c) => c.price)) : null;
  const quantity = lot.quantity;
  const gross = unitResale != null && quantity != null ? round2(unitResale * quantity) : null;
  const feeKnown = lot.fee_rate != null && (lot.fee_basis === 'stated' || lot.fee_basis === 'assumption');
  const fee = gross != null && feeKnown ? round2(gross * lot.fee_rate) : null;
  const ship = lot.shipping_basis === 'stated' && lot.shipping != null ? lot.shipping : null;
  const inputsConfirmed = unitResale != null && gross != null && fee != null && lot.fee_basis === 'stated'
    && ship != null && allIn != null && allInBasis === 'stated';
  const net = inputsConfirmed ? round2(gross - fee - ship - allIn) : null;
  const roi = net != null && allIn > 0 ? round4(net / allIn) : null;
  const profitConfidence = net != null ? 'confirmed' : 'unknown';

  let profitReason;
  if (profitConfidence === 'confirmed') profitReason = 'Profit is confirmed from sold comps and stated costs.';
  else if (sold.length > 0 && soldCited.length !== sold.length) profitReason = 'A sold comp has no URL, so resale stays unknown.';
  else if (unitResale == null && asking.length) profitReason = 'Resale is unknown. Asking prices are labeled asking, not sold, and are not used as resale.';
  else if (unitResale == null) profitReason = 'Resale is unknown, so profit and ROI are unknown.';
  else {
    const missing = [];
    if (!(lot.fee_rate != null && lot.fee_basis === 'stated')) missing.push('platform fee');
    if (ship == null) missing.push('shipping');
    if (allInBasis !== 'stated') missing.push('all-in cost');
    if (quantity == null) missing.push('unit count');
    profitReason = `Profit is not confirmed. Missing or unconfirmed: ${missing.join(', ') || 'a required cost'}. Missing costs are not treated as zero.`;
  }

  let status = lot.status;
  let statusReason = null;
  if (status === BUY_STATUS && profitConfidence !== 'confirmed') {
    status = 'watch';
    statusReason = unitResale == null
      ? 'Resale is unknown, so this lot cannot be marked buy.'
      : 'Profit is not confirmed, so this lot cannot be marked buy.';
  } else if (status === BUY_STATUS && !(net > 0)) {
    status = 'watch';
    statusReason = 'Confirmed net is not above zero, so this lot is not a buy candidate.';
  }

  const milesText = lot.miles_from_home == null
    ? 'unknown'
    : `${lot.miles_approximate ? 'about ' : ''}${lot.miles_from_home} mi from ${HOME}`;
  const range = lot.bid_scan_low != null && lot.bid_scan_high != null
    ? `${moneyText(lot.bid_scan_low)}–${moneyText(lot.bid_scan_high)}`
    : null;

  return {
    ...lot,
    ...formatClose(lot.closes_at, nowMs),
    miles_text: milesText,
    current_bid_text: moneyOrUnknown(bid),
    opening_bid_text: lot.opening_bid == null ? null : moneyText(lot.opening_bid),
    bid_count_text: lot.bid_count == null ? 'unknown' : String(lot.bid_count),
    bid_scan_text: range,
    premium_amount: premium,
    premium_text: premiumPct == null ? 'unknown' : `${round2(premiumPct)}%`,
    premium_amount_text: moneyOrUnknown(premium),
    tax_amount: tax,
    tax_text: moneyOrUnknown(tax),
    tax_label: lot.tax_basis === 'assumption'
      ? TAX_ASSUMPTION_LABEL
      : (lot.tax_basis === 'stated' ? 'Tax rate stated on the lot.' : 'unknown'),
    tax_rate_text: lot.tax_rate == null ? 'unknown' : `${round2(lot.tax_rate * 100)}%`,
    round_trip_miles: roundTrip,
    haul_cost: haul,
    haul_text: moneyOrUnknown(haul),
    all_in: allIn,
    all_in_text: moneyOrUnknown(allIn),
    all_in_basis: allInBasis,
    all_in_note: allInBasis === 'unknown'
      ? 'All-in stays unknown until the bid, buyer\'s premium, tax, and haul are all known.'
      : [
        lot.tax_basis === 'assumption' ? `Includes assumed ${round2(lot.tax_rate * 100)}% tax. ${TAX_ASSUMPTION_LABEL}.` : null,
        lot.miles_approximate ? 'Miles are approximate, so the haul is approximate.' : null,
        RULES.tax_base_note,
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
    shipping_text: ship == null ? 'unknown' : moneyText(ship),
    gross,
    gross_text: moneyOrUnknown(gross),
    net,
    net_text: moneyOrUnknown(net),
    roi,
    roi_text: roi == null ? 'unknown' : `${round2(roi * 100)}%`,
    profit_confidence: profitConfidence,
    profit_reason: profitReason,
    status,
    status_reason: statusReason,
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

export function assessSnapshot(input, nowMs = null) {
  const doc = cleanSnapshot(input);
  const lots = doc.lots.map((lot) => assessLot(lot, nowMs)).filter(Boolean);
  const trips = tripGroups(lots);
  return {
    kind: 'surplus-scan-snapshot',
    sample: false,
    scanned_on: doc.scanned_on || null,
    scanned_on_text: scanDateText(doc.scanned_on),
    label: doc.label || null,
    notice: doc.notice || null,
    places_bids: false,
    rules: RULES,
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
