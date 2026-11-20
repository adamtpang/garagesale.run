// The Market's filters and sort, kept apart from the page so they can be tested.
// No network and no disk. Works on feed items and the cards cardFor makes from them.
import { sortCards } from './dealCard.js';
import { canonicalCategory } from './decision.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
export const VERDICTS = ['all', 'buy', 'watch', 'skip'];
export const SOURCES = ['all', 'surplus', 'listing'];
export const SORTS = ['profit', 'closing', 'drive'];
export const DEFAULT_FILTERS = Object.freeze({ verdict: 'all', source: 'all', category: 'all', maxPrice: null, maxDrive: null, sort: 'profit' });

const pick = (v, allowed, dflt) => (allowed.includes(v) ? v : dflt);
const posNum = (v) => { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) && n > 0 ? n : null; };

// Filters from a URL query string, so a link or a refresh keeps them. Anything odd falls back to the default.
export function parseFilters(search) {
  const q = new URLSearchParams(search || '');
  return {
    verdict: pick(q.get('verdict'), VERDICTS, 'all'),
    source: pick(q.get('source'), SOURCES, 'all'),
    category: (q.get('category') || 'all').slice(0, 40),
    maxPrice: posNum(q.get('max_price')),
    maxDrive: posNum(q.get('max_drive')),
    sort: pick(q.get('sort'), SORTS, 'profit'),
  };
}

// The query string for a set of filters. Defaults are left out, so the plain Market is just "/".
export function filtersToSearch(f) {
  const q = new URLSearchParams();
  if (f.verdict !== 'all') q.set('verdict', f.verdict);
  if (f.source !== 'all') q.set('source', f.source);
  if (f.category && f.category !== 'all') q.set('category', f.category);
  if (f.maxPrice != null) q.set('max_price', String(f.maxPrice));
  if (f.maxDrive != null) q.set('max_drive', String(f.maxDrive));
  if (f.sort !== 'profit') q.set('sort', f.sort);
  const s = q.toString();
  return s ? `?${s}` : '';
}

// The categories to offer: the rules' categories plus any a listing carries.
// Aliases ("game consoles", "console") fold into the one name scoring uses, so a filter never misses one.
export const categoryKey = (v) => canonicalCategory(v) || (v ? String(v).trim().toLowerCase() : null);

export function categoriesOf(items, rules) {
  const set = new Set();
  for (const c of (rules && rules.categories) || []) { const k = categoryKey(c); if (k) set.add(k); }
  for (const it of items) { const k = categoryKey(it.category); if (k) set.add(k); }
  return [...set].sort();
}

const later = (a, b) => (a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : a - b);
const closeTime = (item) => { const t = Date.parse((item.price && item.price.closes_at) || ''); return Number.isFinite(t) ? t : null; };
// 0: still open, 1: close time unknown, 2: already closed.
const closeRank = (item, nowMs) => { const t = closeTime(item); if (t == null) return 1; return nowMs != null && t <= nowMs ? 2 : 0; };

// pairs: [{ item, card }]. Returns the pairs that pass the filters, in the chosen order.
// An unknown price or drive time is kept when that filter is set, and counted, so nothing is hidden for
// lack of data.
export function applyFilters(pairs, f, nowMs = null) {
  let unknownKept = 0;
  const kept = pairs.filter(({ item, card }) => {
    if (f.verdict !== 'all' && card.decision !== f.verdict) return false;
    if (f.source !== 'all' && item.kind !== f.source) return false;
    if (f.category !== 'all' && categoryKey(item.category) !== categoryKey(f.category)) return false;
    let unknown = false;
    if (f.maxPrice != null) {
      const p = num(item.price && item.price.current);
      if (p == null) unknown = true;
      else if (p > f.maxPrice) return false;
    }
    if (f.maxDrive != null) {
      const m = num(item.location && item.location.drive_minutes_round_trip);
      if (m == null) unknown = true;
      else if (m > f.maxDrive) return false;
    }
    if (unknown) unknownKept += 1;
    return true;
  });
  let out;
  if (f.sort === 'closing') out = [...kept].sort((a, b) => (closeRank(a.item, nowMs) - closeRank(b.item, nowMs)) || later(closeTime(a.item), closeTime(b.item)));
  else if (f.sort === 'drive') out = [...kept].sort((a, b) => later(num(a.item.location.drive_minutes_round_trip), num(b.item.location.drive_minutes_round_trip)));
  else {
    const order = sortCards(kept.map((x) => x.card)).map((c) => c.id);
    out = [...kept].sort((a, b) => order.indexOf(a.card.id) - order.indexOf(b.card.id));
  }
  return { pairs: out, unknownKept };
}

const dollars = (v) => `$${v.toFixed(2)}`;

// The short lines a Market tile shows. Every number comes from the card or the feed item.
export function tileFor(item, card) {
  const lot = item.kind === 'surplus';
  const mins = num(item.location.drive_minutes_round_trip);
  const cur = num(item.price.current);
  return {
    id: card.id,
    href: `/item?id=${encodeURIComponent(card.id)}`,
    title: card.title,
    photo_url: card.photo_url,
    decision: card.decision,
    label: card.label,
    profit: card.amount ? `${card.loss ? '-' : '+'}${card.amount}` : null,
    price: `${lot ? 'Bid' : 'Ask'} ${cur != null ? dollars(cur) : 'unknown'}`,
    max_bid: `Max ${lot ? 'bid' : 'offer'} ${num(item.max_bid) != null ? dollars(item.max_bid) : 'unknown'}`,
    closes: card.countdown || (lot ? 'Close time unknown' : 'No close time'),
    drive: mins != null ? `${mins} min round trip` : 'Drive unknown',
    reason: card.reason || card.risk || null,
  };
}
