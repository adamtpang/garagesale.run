// Turns one item from the daily feed into the plain words a deal card shows.
// No network and no disk. Every number comes from the feed item. Nothing is worked out here that the
// feed does not already carry, except adding up cost parts for one line.
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round2 = (n) => Math.round(n * 100) / 100;
export const money = (v) => (num(v) == null ? 'unknown' : `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`);
const whole = (v) => `$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;
const LABEL = { buy: 'Buy', watch: 'Watch', skip: 'Skip' };
// Adam's work time on a deal in plain words: "4 h" or "30 min".
const workText = (m) => (num(m) == null ? 'the time' : (m >= 60 ? `${Math.round((m / 60) * 10) / 10} h` : `${m} min`));

export function countdown(iso, nowMs) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t) || nowMs == null) return null;
  const diff = t - nowMs;
  if (diff <= 0) return 'Closed';
  const mins = Math.floor(diff / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d) return `Closes in ${d}d ${h}h`;
  return h ? `Closes in ${h}h ${m}m` : `Closes in ${m}m`;
}

// Adds the parts that are known. Null when any part is unknown, so a missing fee is never shown as $0.
function sum(parts) {
  if (parts.some((p) => num(p) == null)) return null;
  return round2(parts.reduce((s, p) => s + p, 0));
}

export function cardFor(item, nowMs = null) {
  const lot = item.kind === 'surplus';
  // Profit at the max bid, but only while the lot can still be won there. Once the bid has passed the
  // max bid, the card shows today's bid and says the max is behind it.
  const overbid = lot && num(item.max_bid) != null && num(item.price.current) != null && item.price.current > item.max_bid;
  const atMax = !!(lot && num(item.max_bid) != null && item.profit.at_max_bid && !overbid);
  const cases = atMax ? item.profit.at_max_bid : { low: item.profit.low, middle: item.profit.middle, high: item.profit.high };
  const confirmed = !atMax && num(item.profit.confirmed) != null;
  const profit = confirmed ? item.profit.confirmed : num(cases.middle);
  const pay = atMax ? item.max_bid : item.price.current;
  const c = item.costs;

  const headline = profit == null ? 'Profit unknown' : (profit >= 0 ? 'You make about' : 'You lose about');
  let where;
  if (atMax) where = `If you win at your ${money(item.max_bid)} max bid.`;
  else if (overbid) where = `At today's ${money(pay)} bid, which is already over your ${money(item.max_bid)} max bid.`;
  else if (lot) where = num(pay) != null ? `At today's ${money(pay)} bid.` : 'No bid yet.';
  else where = num(pay) != null ? `At the ${money(pay)} asking price.` : 'No asking price.';
  const basis = [
    where,
    profit == null ? null : (confirmed ? 'Confirmed from sold prices and stated costs.' : 'Middle case. An estimate, not confirmed.'),
    profit != null && num(c.time) == null ? 'Drive time is not counted yet.' : null,
    num(c.work) > 0 ? `Counts ${workText(c.work_minutes)} of your work (${money(c.work)}).` : null,
  ].filter(Boolean).join(' ');

  // What it costs to buy on top of the price: the buyer's premium and tax. On a listing both are $0.
  const cash = atMax ? c.all_in_at_max_bid : c.all_in;
  let buyFees = lot ? null : 0;
  if (lot && num(cash) != null && num(pay) != null && num(c.gas) != null) buyFees = round2(cash - pay - c.gas);
  const fees = sum([buyFees, c.fee, c.shipping]);
  const feeParts = [
    lot ? `Buyer's premium and tax ${money(buyFees)}` : null,
    `${lot ? 'selling' : 'Selling'} fee ${money(c.fee)}`,
    `shipping ${money(c.shipping)}`,
  ].filter(Boolean).join(', ');
  const mins = item.location.drive_minutes_round_trip;
  let priceNote = null;
  if (atMax && num(item.price.current) != null) priceNote = `Bid now ${money(item.price.current)}`;
  else if (overbid) priceNote = `Over your ${money(item.max_bid)} max bid`;
  else if (lot && num(pay) == null && num(item.price.opening) != null) priceNote = `Opens at ${money(item.price.opening)}`;
  // The miles the gas dollars were worked out on, so the two always describe the same trip.
  let milesNote = 'Miles unknown';
  if (num(c.gas_miles) != null) milesNote = c.gas_miles_basis === 'routed' ? `${c.gas_miles} mi round trip, routed` : `${item.location.miles_approximate ? 'About ' : ''}${c.gas_miles} mi round trip, from the stated miles`;
  const costs = [
    { key: 'price', label: atMax ? 'Your max bid' : (lot ? 'Current bid' : 'Asking price'), value: money(pay), note: priceNote },
    { key: 'fees', label: 'Fees', value: money(fees), note: `${feeParts}.` },
    { key: 'gas', label: 'Gas', value: money(c.gas), note: milesNote },
    { key: 'drive', label: 'Drive time', value: num(mins) != null ? `${mins} min` : 'unknown', note: num(c.time) != null ? `${money(c.time)} of your time` : `Not counted in profit yet${item.location.drive_unknown_reason ? `: ${item.location.drive_unknown_reason}` : ''}` },
  ];

  const sold = (item.comps || []).filter((x) => x.type === 'sold' && x.url);
  return {
    id: item.id,
    kind: item.kind,
    title: item.title || 'Untitled',
    photo_url: item.photo_url || null,
    label: LABEL[item.decision.value] || 'Watch',
    decision: LABEL[item.decision.value] ? item.decision.value : 'watch',
    headline,
    amount: profit == null ? null : whole(profit),
    profit,
    loss: profit != null && profit < 0,
    basis,
    costs,
    cases: ['low', 'middle', 'high'].map((name) => ({ name, label: name[0].toUpperCase() + name.slice(1), value: money(cases[name]) })),
    // Why it has this label, in one line.
    reason: (item.decision.reasons || [])[0] || null,
    // The main risk, in one line.
    risk: (item.risks || [])[0] || null,
    place: [item.location.place, item.source.site].filter(Boolean).join(' · '),
    listing_url: item.source.url || null,
    listing_text: lot ? 'Open the auction' : 'Open the listing',
    comps: sold.slice(0, 3).map((x) => ({ url: x.url, text: `Sold ${money(x.price)}${x.sold_on ? `, ${x.sold_on}` : ''}` })),
    comps_more: Math.max(0, sold.length - 3),
    comps_none: sold.length === 0 ? 'No sold comps with a link.' : null,
    countdown: countdown(item.price.closes_at, nowMs),
    closes_text: item.price.closes_text || null,
    // When Adam's listing draft set the price, say so, and what the comps alone said.
    plan_note: item.resale && item.resale.listing_plan ? [
      `Priced at your listing draft: ${money(item.resale.listing_plan.ask)} Buy It Now${item.resale.listing_plan.floor != null ? `, ${money(item.resale.listing_plan.floor)} lowest offer` : ''}.`,
      item.resale.comps_say && item.resale.comps_say.middle != null ? `Comps say ${money(item.resale.comps_say.middle)} a unit.` : null,
    ].filter(Boolean).join(' ') : null,
  };
}

// Best profit first. A card with no profit number goes last.
export function sortCards(cards) {
  return [...cards].sort((a, b) => {
    if (a.profit == null && b.profit == null) return 0;
    if (a.profit == null) return 1;
    if (b.profit == null) return -1;
    return b.profit - a.profit;
  });
}
