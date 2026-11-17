// The daily deals feed: surplus lots and local listings in one shape, best first.
// No network and no disk. Every number comes from the lot or deal math. Nothing is guessed here,
// and a value that is not known is null and is listed under "unknown".
import { assessDeal, feeAmount, moneyText, round2 } from './decision.js';
import { BUY_STATUS } from './surplus.js';
import { DEFAULT_RULES } from './rules.js';
import { driveCosts } from './drive.js';

const ORDER = { buy: 0, watch: 1, skip: 2 };
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function unknownFields(item) {
  const out = [];
  const walk = (obj, path) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v === null) out.push(path ? `${path}.${k}` : k);
      else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk({ location: { ...item.location, drive_source: undefined }, price: item.price, costs: item.costs, resale: item.resale, profit: item.profit, roi: item.roi, max_bid: item.max_bid }, '');
  return out;
}

// One surplus lot, as assessLot returns it.
export function fromLot(lot) {
  const cases = Object.fromEntries((lot.cases || []).map((c) => [c.name, c]));
  const decision = lot.status === BUY_STATUS ? 'buy' : (lot.status === 'skip' ? 'skip' : 'watch');
  const reasons = [
    lot.status_reason,
    ...(lot.rule_checks || []).filter((c) => c.result !== 'pass' && !(lot.status_reason || '').includes(c.text)).map((c) => `${c.label}: ${c.text}`),
    decision !== 'buy' && lot.profit_confidence !== 'confirmed' ? lot.profit_reason : null,
    lot.status === 'needs preview' ? 'Needs a preview before any bid.' : null,
  ].filter(Boolean);
  const item = {
    kind: 'surplus',
    id: lot.id,
    title: lot.title,
    source: { site: lot.source_site, url: lot.url, seller: lot.seller, auction_id: lot.auction_id },
    location: {
      place: lot.city, pickup_address: lot.pickup_address, miles: lot.miles_from_home, miles_approximate: lot.miles_from_home == null ? null : lot.miles_approximate,
      drive_minutes_round_trip: lot.drive_minutes, drive_miles_round_trip: lot.drive_miles, drive_source: lot.drive_source,
    },
    price: {
      kind: 'bid',
      current: lot.current_bid,
      opening: lot.opening_bid,
      bid_count: lot.bid_count,
      closes_at: lot.closes_at,
      closes_text: lot.closes_at ? lot.close_text : null,
    },
    costs: {
      premium: lot.premium_amount,
      premium_pct: lot.premium_pct,
      tax: lot.tax_amount,
      tax_basis: lot.tax_basis,
      gas: lot.haul_cost,
      // Adam's drive time at the hourly rate. It comes off profit and is not part of all_in.
      time: lot.time_cost,
      fee: lot.fee_amount,
      fee_basis: lot.fee_basis,
      shipping: lot.shipping,
      shipping_basis: lot.shipping_basis,
      all_in: lot.all_in,
      all_in_basis: lot.all_in_basis,
    },
    resale: {
      per: 'unit',
      units: lot.quantity,
      low: cases.low ? cases.low.unit : null,
      middle: cases.middle ? cases.middle.unit : null,
      high: cases.high ? cases.high.unit : null,
      basis: (lot.cases || []).map((c) => `${c.name}: ${c.basis}`),
      caveats: lot.case_caveats || [],
      sell_on: lot.marketplaces,
    },
    comps: lot.comps.map((c) => ({
      type: c.type, url: c.url, price: c.price, sold_on: c.type === 'sold' ? c.sold_on : null,
      title: c.title, marketplace: c.marketplace, lot_size: c.lot_size, battery: c.battery, condition: c.condition,
    })),
    profit: {
      at: 'current bid',
      confirmed: lot.net,
      low: cases.low ? cases.low.profit_at_current_bid : null,
      middle: cases.middle ? cases.middle.profit_at_current_bid : null,
      high: cases.high ? cases.high.profit_at_current_bid : null,
      at_max_bid: cases.middle && lot.max_bid != null
        ? { low: cases.low.profit_at_max_bid, middle: cases.middle.profit_at_max_bid, high: cases.high.profit_at_max_bid } : null,
    },
    roi: lot.roi != null ? lot.roi
      : (cases.middle && num(cases.middle.profit_at_current_bid) != null && lot.all_in > 0 ? Math.round((cases.middle.profit_at_current_bid / lot.all_in) * 10000) / 10000 : null),
    roi_basis: lot.roi != null ? 'confirmed' : 'middle case estimate',
    max_bid: lot.max_bid,
    max_bid_note: lot.max_bid_note,
    risks: [...lot.risks, ...(lot.lock_flag ? [lot.lock_flag] : [])],
    decision: { value: decision, reasons, needs_adam_yes: true },
  };
  return { ...item, unknown: unknownFields(item) };
}

// One local listing, as stored by POST /api/deals. It is scored again here, so today's rules apply.
export function fromDeal(deal, config, rules = DEFAULT_RULES) {
  const v = assessDeal(deal, config);
  const spec = config && config.fees && v.venue && v.venue !== 'mixed' ? config.fees[v.venue] : null;
  const allIn = v.ask != null && v.gas != null ? round2(v.ask + v.gas) : null;
  // Drive time, when the routing service gave one. Its cost comes off profit. Unknown is left out and said.
  const drive = driveCosts(deal.drive, rules);
  const timeOff = drive.time_cost != null ? drive.time_cost : 0;
  const net = v.net != null ? round2(v.net - timeOff) : null;
  // Profit in the low and high resale cases, with the fee worked out again at each price.
  const at = (resale) => {
    const fee = feeAmount(resale, spec);
    if (resale == null || fee == null || v.shipping == null || allIn == null) return null;
    return round2(resale - fee - v.shipping - allIn - timeOff);
  };
  // The most to pay: stays inside the max cost, and the middle case still makes the minimum profit.
  let maxOffer = null;
  if (v.resale != null && v.fee != null && v.shipping != null && v.gas != null) {
    const byProfit = v.resale - v.fee - v.shipping - v.gas - timeOff - rules.min_profit;
    const byCost = rules.max_cost - v.gas;
    // Whole dollars, rounded down. The one exception is the ask itself: an ask of $97.05 that fits the
    // rules to the cent is a price Adam can pay, so the max offer is never shown below an ask that fits.
    const exact = round2(Math.min(byProfit, byCost));
    const whole = Math.floor(exact);
    const most = v.ask != null && v.ask <= exact ? Math.max(whole, v.ask) : whole;
    maxOffer = most >= 1 ? most : null;
  }
  let decision = v.verdict === 'buy' ? 'buy' : (v.verdict === 'skip' ? 'skip' : 'watch');
  const reasons = v.reasons.map((r) => r.text);
  // The listing check looks at the ask alone. The max cost counts gas too, the same as for a surplus lot.
  // So an ask that fits but whose ask plus gas does not is a skip, and the feed cannot call it a buy
  // while showing a max offer below the ask.
  if (allIn != null && allIn > rules.max_cost && decision !== 'skip') {
    decision = 'skip';
    reasons.push(`Ask plus gas is ${moneyText(allIn)}, over the ${moneyText(rules.max_cost)} max per flip.`);
  }
  // Drive time: over the cap is a skip. Unknown, or a profit that drops under the minimum once time is counted, is not a buy.
  if (rules.max_drive_minutes != null) {
    if (drive.minutes != null && drive.minutes > rules.max_drive_minutes) {
      decision = 'skip';
      reasons.push(`A ${drive.minutes}-minute round trip is over the ${rules.max_drive_minutes}-minute drive cap.`);
    } else if (drive.minutes == null && decision === 'buy') {
      decision = 'watch';
      reasons.push('Round-trip drive time is unknown, so the drive cap cannot be checked and time is left out of profit.');
    }
  }
  if (decision === 'buy' && net != null && net < rules.min_profit) {
    decision = 'skip';
    reasons.push(`After ${moneyText(timeOff)} of drive time the profit is ${moneyText(net)}, under the ${moneyText(rules.min_profit)} minimum.`);
  }
  const item = {
    kind: 'listing',
    id: deal.url,
    title: v.title,
    source: { site: v.sourceLabel, url: v.buyUrl, seller: null, auction_id: null },
    location: {
      place: v.area || null, pickup_address: null, miles: v.pickup && v.pickup.known ? round2(v.pickup.miles) : null, miles_approximate: v.pickup && v.pickup.known ? false : null,
      drive_minutes_round_trip: drive.minutes, drive_miles_round_trip: drive.miles, drive_source: deal.drive && drive.minutes != null ? (deal.drive.source || 'posted') : null,
    },
    price: { kind: 'ask', current: v.ask, opening: null, bid_count: null, closes_at: null, closes_text: null },
    costs: {
      premium: 0, premium_pct: 0, tax: 0, tax_basis: 'none on a private sale',
      gas: v.gas, time: drive.time_cost, fee: v.fee, fee_basis: spec ? (spec.confirmed === true ? 'confirmed' : 'unconfirmed default') : 'unknown',
      shipping: v.shipping, shipping_basis: v.shipping == null ? 'unknown' : 'from the sold comps',
      all_in: allIn, all_in_basis: allIn == null ? 'unknown' : 'ask plus gas',
    },
    resale: {
      per: 'item', units: 1, low: v.resaleLow, middle: v.resale, high: v.resaleHigh,
      basis: v.uncertainty ? [v.uncertainty] : [], caveats: v.flags, sell_on: v.venue ? [v.venueLabel] : [],
    },
    comps: v.comps.map((c) => ({ type: 'sold', url: c.url, price: c.price, sold_on: c.sold_at || null, title: c.title, marketplace: c.source || null, lot_size: null, battery: 'unknown', condition: c.condition || 'unknown' })),
    profit: { at: 'asking price', confirmed: decision === 'buy' ? net : null, low: at(v.resaleLow), middle: net, high: at(v.resaleHigh), at_max_bid: null },
    roi: net != null && allIn > 0 ? Math.round((net / allIn) * 10000) / 10000 : null,
    roi_basis: decision === 'buy' ? 'confirmed' : 'calculated, not confirmed',
    max_bid: maxOffer,
    max_bid_note: maxOffer == null
      ? 'No offer works, or a cost is unknown.'
      : [
        `The most to offer: the cost stays inside ${moneyText(rules.max_cost)} and the middle case still makes ${moneyText(rules.min_profit)}.`,
        drive.time_cost == null ? 'Drive time is unknown and is left out, so the real max offer is lower.' : null,
        'The offer is Adam\'s to make. Nothing here contacts a seller.',
      ].filter(Boolean).join(' '),
    risks: [v.riskNote, ...v.flags].filter(Boolean),
    decision: { value: decision, reasons, needs_adam_yes: true },
  };
  return { ...item, unknown: unknownFields(item) };
}

const rank = (item) => {
  const p = num(item.profit.confirmed) ?? num(item.profit.middle);
  return [ORDER[item.decision.value], p == null ? 1 : 0, p == null ? 0 : -p, item.price.closes_at || '9999'];
};

function ageDays(iso, nowMs) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t) || nowMs == null) return null;
  return Math.max(0, Math.floor((nowMs - t) / 86400000));
}

// surplus: an assessed snapshot (assessSnapshot output plus source and updated_at). deals: the stored deals feed.
export function buildDailyFeed({ surplus, deals, config, nowMs = null, rules = DEFAULT_RULES }) {
  const lots = surplus && Array.isArray(surplus.lots) ? surplus.lots : [];
  const listings = deals && Array.isArray(deals.deals) ? deals.deals.filter((d) => d && d.url) : [];
  const items = [...lots.map(fromLot), ...listings.map((d) => fromDeal(d, config, rules))];
  items.sort((a, b) => {
    const x = rank(a); const y = rank(b);
    for (let i = 0; i < x.length; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; }
    return 0;
  });
  const counts = { buy: 0, watch: 0, skip: 0 };
  for (const it of items) counts[it.decision.value] += 1;
  const surplusAge = ageDays(surplus && (surplus.updated_at || (surplus.scanned_on ? `${surplus.scanned_on}T12:00:00Z` : null)), nowMs);
  const dealsAge = ageDays(deals && deals.updated_at, nowMs);
  const stale = [
    surplusAge != null && surplusAge >= 2 ? `The surplus scan is ${surplusAge} days old.` : null,
    surplus && surplus.source === 'seed' ? 'No surplus scan has been posted. These lots are the Nov 15, 2026 scan file.' : null,
    dealsAge != null && dealsAge >= 2 ? `The listings feed is ${dealsAge} days old.` : null,
    // A feed that was never posted and a feed that could not be read both arrive here as nothing.
    !deals || !deals.updated_at ? 'No listings feed was found. Either none has been posted or it could not be read, so local listings are missing from this feed.' : null,
  ].filter(Boolean);
  return {
    kind: 'daily-deals-feed',
    generated_at: nowMs == null ? null : new Date(nowMs).toISOString(),
    places_bids: false,
    contacts_sellers: false,
    note: 'Every buy needs Adam\'s yes on that item. Nothing here bids, buys, makes an offer or messages a seller. Unknown values are null and are listed under "unknown" on each item.',
    rules: {
      home: rules.home, max_cost: rules.max_cost, min_profit: rules.min_profit, pickup_miles: rules.pickup_miles,
      gas_per_mile: rules.gas_per_mile, hourly_rate: rules.hourly_rate, max_drive_minutes: rules.max_drive_minutes, bankroll: rules.bankroll, bankroll_source: rules.bankroll_source, categories: rules.categories, source: 'web/config/rules.js',
    },
    sources: {
      surplus: { from: surplus ? surplus.source || null : null, scanned_on: surplus ? surplus.scanned_on || null : null, updated_at: surplus ? surplus.updated_at || null : null, age_days: surplusAge, lots: lots.length },
      listings: { updated_at: deals ? deals.updated_at || null : null, age_days: dealsAge, deals: listings.length },
    },
    stale,
    counts,
    items,
  };
}
