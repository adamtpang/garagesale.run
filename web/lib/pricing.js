// Pure buy-side logic: parse a request, match comps, estimate value, rank, draft an opener.
// No network and no browser here, so it can be tested on its own.

const STOP = new Set('a an and the with for of in on to my your our is it this that new used great good excellent condition works working comes set plus only like mint gently lightly barely perfect clean nice cheap obo firm price must go pickup asap'.split(' '));
// Words that change what the item is. A comp only counts if it agrees with the listing on these.
const HARD = new Set('lite oled pro max mini air ultra plus xl xs se m1 m2 m3 m4 m5 intel 2 3 4 5 parts broken cracked locked damaged repair'.split(' '));
const ACCESSORY = /\b(games?|cartridges?|protectors?|thumb ?caps?|grips?|skins?|covers?|chargers?|charging|docks?|stands?|cables?|adapters?|bags?|sleeves?|keyboards?|mouse|cushions?|headrests?|arms?|casters?|wheels?|tires?|tubes?|pedals?|helmets?|saddles?|manuals?|box only|cases?|replacement|shell|joy[- ]?cons?|controllers?|amiibo)\b/i;
// Words that say the accessory comes along with the item rather than being the item.
const BUNDLE = /\b(with|w\/|bundle|includes?|extra|comes with)\b|\+/i;
const NOT_FOR_SALE = /\b(iso|wanted|looking for|wtb|trade only|in search of)\b/i;
const BAD_SHAPE = /\b(for parts|parts only|not working|broken|cracked|as[- ]is|icloud locked|locked)\b/i;

export const tokens = (s) => String(s || '').toLowerCase().replace(/(\d+)\s*(gb|tb)\b/g, '$1$2').split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));

// "Nintendo Switch under $200" -> { core: 'Nintendo Switch', max: 200 }
export function parseRequest(q, max) {
  let core = String(q || '').trim();
  let m = core.match(/\b(?:under|below|less than|max|up to|<)\s*\$?\s*(\d[\d,]*)/i);
  let maxPrice = max !== undefined && max !== null && max !== '' && isFinite(Number(max)) ? Number(max) : null;
  if (m) { if (maxPrice === null) maxPrice = Number(m[1].replace(/,/g, '')); core = core.replace(m[0], ' '); }
  core = core.replace(/\b(to flip|for flipping|flip|deals?|cheap|used)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  return { core: core || String(q || '').trim(), max: maxPrice };
}

// Accessory or wanted-ad check against the core request words.
export function relevance(title, core) {
  const t = String(title || '');
  const need = tokens(core);
  const have = new Set(tokens(t));
  const missing = need.filter((w) => !have.has(w));
  if (NOT_FOR_SALE.test(t)) return { ok: false, why: 'Looks like a wanted ad, not a sale' };
  if (missing.length > Math.floor(need.length / 3)) return { ok: false, why: `Title does not mention ${missing.join(', ')}` };
  if (ACCESSORY.test(core)) return { ok: true };
  // "Joy cons for Nintendo switch", "Case Nintendo Switch": the accessory comes first or is "for" the item.
  const at = need[0] ? t.toLowerCase().indexOf(need[0]) : -1;
  if ((at > 0 && ACCESSORY.test(t.slice(0, at))) || (need[0] && new RegExp(`\\bfor (the |a |your )?${need[0]}`, 'i').test(t))) return { ok: false, why: 'Looks like an accessory or game made for the item' };
  if (ACCESSORY.test(t) && !BUNDLE.test(t)) return { ok: false, why: 'Looks like an accessory or game, not the item' };
  return { ok: true };
}

function hardSet(title) { return new Set(tokens(title).filter((w) => HARD.has(w))); }
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// A comp matches a listing when it has the core words and agrees on the words that change the item.
export function compsFor(listing, comps, core) {
  const need = tokens(core);
  const lh = hardSet(listing.title);
  const listingAcc = ACCESSORY.test(listing.title) && !BUNDLE.test(listing.title);
  return comps.filter((c) => {
    const ct = new Set(tokens(c.title));
    if (!need.every((w) => ct.has(w))) return false;
    if (!sameSet(hardSet(c.title), lh)) return false;
    if (!listingAcc && ACCESSORY.test(c.title) && !BUNDLE.test(c.title)) return false;
    if (/new/i.test(c.condition || '') && !/\b(new|sealed)\b/i.test(listing.title)) return false;
    return true;
  });
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const q = (s, p) => s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];

// Market value from sold comps only. Fewer than 3 matches means we do not guess.
export function estimate(matched) {
  let prices = matched.map((c) => c.price).filter((p) => p > 0);
  const m0 = median(prices);
  if (m0) prices = prices.filter((p) => p >= m0 * 0.35 && p <= m0 * 2.5);
  if (prices.length < 3) return { value: null, confidence: 'none', n: prices.length, note: 'not enough comps' };
  const s = [...prices].sort((a, b) => a - b);
  const value = median(s);
  const spread = (q(s, 0.75) - q(s, 0.25)) / value;
  const confidence = s.length >= 8 && spread <= 0.35 ? 'high' : s.length >= 5 && spread <= 0.6 ? 'medium' : 'low';
  return { value: Math.round(value), confidence, n: s.length, low: Math.round(q(s, 0.25)), high: Math.round(q(s, 0.75)) };
}

const W = { high: 1, medium: 0.7, low: 0.4, none: 0 };

// Weeks since listed, from "Listed 13 weeks ago" or "Listed 2 days ago".
export function ageWeeks(listed) {
  const m = String(listed || '').match(/(\d+|an?|one)\s+(minute|hour|day|week|month|year)s?\s+ago/i);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
  return n * { minute: 0, hour: 0, day: 1 / 7, week: 1, month: 4.3, year: 52 }[m[2].toLowerCase()];
}

export function score(d, city) {
  const notes = [];
  if (!d.relevant.ok) return { score: -2, reason: d.relevant.why };
  const e = d.estimate;
  if (e.value === null) return { score: -1, reason: `Not enough comps (${e.n} sold matches) to price this one` };
  const disc = (e.value - d.ask) / e.value;
  let s = disc * W[e.confidence];
  if (BAD_SHAPE.test(d.title) || /parts/i.test(d.condition || '')) { s -= 0.3; notes.push('listed as damaged or for parts'); }
  if (city && d.location && !d.location.toLowerCase().startsWith(city.toLowerCase())) { s -= 0.05; notes.push(`in ${d.location}`); }
  const wk = ageWeeks(d.listed);
  if (wk !== null && wk > 8) { s -= 0.05; notes.push(`listed ${Math.round(wk)} weeks ago, may be gone`); }
  const pct = Math.round(disc * 100);
  // Far under every comp usually means a different item (a game, an accessory, a part), not a steal.
  if (disc > 0.6) return { score: -0.5, discount: pct, reason: `${pct}% under ${e.n} eBay sold comps ($${e.value}). Too cheap to be the same item, so check what it really is` };
  const lead = pct >= 0 ? `${pct}% under` : `${-pct}% over`;
  return { score: s, discount: pct, reason: `${lead} the median of ${e.n} eBay sold comps ($${e.value}), ${e.confidence} confidence${notes.length ? '; ' + notes.join('; ') : ''}` };
}

const r5 = (n) => Math.max(5, Math.round(n / 5) * 5);
// Suggested offer: about 10% under asking, lower when comps say it is overpriced,
// but never under 70% of asking (a lowball rarely gets a reply) and never above asking.
export function targetPrice(ask, value) {
  let t = ask * 0.9;
  if (value) t = Math.min(t, value * 0.8);
  return Math.min(ask, r5(Math.max(t, ask * 0.7)));
}

const shortTitle = (t) => String(t || 'item').replace(/[!]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
export function openers(d) {
  const name = shortTitle(d.title);
  return {
    availability: `Hi! Is the ${name} still available? I could pick it up this week. Thanks!`,
    offer: `Hi! I'm interested in the ${name}. Would you take $${d.target} cash? I can pick it up this week. Thanks!`,
  };
}

// Full pipeline for one search: listings plus sold comps in, ranked deals out.
export function rank(listings, sold, { core, city }) {
  const seen = new Set();
  return listings.filter((l) => l.id && !seen.has(l.id) && seen.add(l.id)).map((l) => {
    const relevant = relevance(l.title, core);
    const matched = relevant.ok ? compsFor(l, sold, core) : [];
    const est = estimate(matched);
    const d = { ...l, relevant, estimate: est, comps: matched.slice(0, 12) };
    const s = score(d, city);
    d.score = s.score; d.reason = s.reason; d.discount = s.discount ?? null;
    d.target = targetPrice(l.ask, est.value);
    return d;
  }).sort((a, b) => b.score - a.score || a.ask - b.ask);
}
