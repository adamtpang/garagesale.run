// Market tiers: A, B, C or Skip, worked out from what a feed item already carries.
// No network and no disk. A tier never makes a deal a Buy: only the rules and confirmed profit do that,
// and tier A is exactly the Buys.
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
const count = (v) => { const n = typeof v === 'number' ? v : Number(v); return v != null && v !== '' && Number.isInteger(n) && n >= 0 ? n : null; };

export const TIERS = ['A', 'B', 'C', 'skip'];
export const TIER_LABEL = Object.freeze({ A: 'Buy', B: 'Strong watch', C: 'Long shot', skip: 'Skip' });
export const SPEEDS = ['fast', 'medium', 'slow', 'unknown'];
// Tier B needs this many sold comps, each with a link. Fewer is thin proof.
export const MIN_SOLD_FOR_B = 3;

// How fast an item type sells, as the scout saw it on real pages. The label is the scout's call; the
// evidence line says what it saw. Anything missing or odd reads as unknown.
export function cleanSpeed(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const label = SPEEDS.includes(raw.label) ? raw.label : 'unknown';
  return {
    label,
    evidence: str(raw.evidence, 300),
    sold_90d: count(raw.sold_90d),
    active_competitors: count(raw.active_competitors),
  };
}

export function speedText(speed) {
  if (!speed || speed.label === 'unknown') return 'Sell speed unknown';
  const sold = speed.sold_90d != null ? ` · ${speed.sold_90d} sold in 90 days` : '';
  return `Sells ${speed.label}${sold}`;
}

// The tier of one feed item, with the reason in plain words.
export function tierFor(item, rules) {
  const decision = item && item.decision ? item.decision.value : 'watch';
  if (decision === 'skip') return { value: 'skip', label: TIER_LABEL.skip, why: (item.decision.reasons || [])[0] || 'Breaks a rule.' };
  if (decision === 'buy') return { value: 'A', label: TIER_LABEL.A, why: 'Every rule passes and profit is confirmed from sold prices.' };

  const sold = (item.comps || []).filter((c) => c.type === 'sold' && c.url).length;
  const speed = item.sell_speed ? item.sell_speed.label : 'unknown';
  const middle = num(item.profit && item.profit.middle);
  const min = rules && num(rules.min_profit);
  const gaps = [];
  if (sold < MIN_SOLD_FOR_B) gaps.push(sold === 0 ? 'no sold comps' : `only ${sold} sold comp${sold === 1 ? '' : 's'}`);
  if (speed === 'slow') gaps.push('sells slowly');
  else if (speed === 'unknown') gaps.push('sell speed unknown');
  if (middle != null && min != null && middle < min) gaps.push(`middle case $${Math.round(middle)} is under the $${min} minimum`);

  const proof = `${sold} sold comp${sold === 1 ? '' : 's'}${speed !== 'unknown' ? `, sells ${speed}` : ''}`;
  if (!gaps.length) return { value: 'B', label: TIER_LABEL.B, why: `${proof}. Not a Buy yet: ${(item.decision.reasons || [])[0] || 'profit is not confirmed.'}` };
  return { value: 'C', label: TIER_LABEL.C, why: `${gaps.join(', ')}.`.replace(/^./, (c) => c.toUpperCase()) };
}

export const tierRank = (t) => { const i = TIERS.indexOf(t); return i < 0 ? TIERS.length : i; };
