// Applies Adam's flip rules to one lot. No network and no disk.
// A failed rule is a hard stop. An unknown number never counts as a pass.
import { RULES_CONFIG } from '../config/rules.js';
import { moneyText } from './decision.js';

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function onOff(input, base) {
  const src = input && typeof input === 'object' ? input : {};
  return { ...base, ...src, enabled: src.enabled === true };
}

// Rules with optional overrides on top. A missing or broken override falls back to the config value.
export function activeRules(overrides) {
  const o = overrides && typeof overrides === 'object' ? overrides : {};
  const pick = (key) => (num(o[key]) != null && o[key] >= 0 ? o[key] : RULES_CONFIG[key]);
  const optional = o.optional && typeof o.optional === 'object' ? o.optional : {};
  const lotRoi = onOff(optional.lot_roi, RULES_CONFIG.optional.lot_roi);
  const surplusRadius = onOff(optional.surplus_radius, RULES_CONFIG.optional.surplus_radius);
  // "bankroll" as an override is the current bankroll, read from the ledger. Without one it is the starting number.
  const bankrollStart = RULES_CONFIG.bankroll;
  const bankroll = num(o.bankroll) != null && o.bankroll >= 0 ? o.bankroll : bankrollStart;
  const fixedCap = num(o.max_per_flip) != null && o.max_per_flip >= 0 ? o.max_per_flip : RULES_CONFIG.max_per_flip;
  const maxCost = fixedCap == null ? bankroll : Math.min(fixedCap, bankroll);
  const baseMiles = pick('max_pickup_miles');
  return {
    approved_on: RULES_CONFIG.approved_on,
    home: typeof o.home === 'string' && o.home.trim() ? o.home.trim() : RULES_CONFIG.home,
    bankroll_start: bankrollStart,
    bankroll,
    // 'ledger' when the current bankroll was read from the ledger, 'start' when it is the starting number.
    bankroll_source: o.bankroll_source === 'ledger' ? 'ledger' : 'start',
    // The most one flip can cost: the current bankroll, or a fixed cap when one is set and smaller.
    max_cost: maxCost,
    max_per_flip: maxCost,
    min_profit: pick('min_profit'),
    hourly_rate: pick('hourly_rate'),
    max_drive_minutes: pick('max_drive_minutes'),
    max_pickup_miles: baseMiles,
    // The radius in force. The wider surplus radius counts only when it is switched on.
    pickup_miles: surplusRadius.enabled && num(surplusRadius.miles) != null ? surplusRadius.miles : baseMiles,
    categories: [...RULES_CONFIG.categories],
    gas_per_mile: pick('gas_per_mile'),
    gas_per_mile_confirmed: RULES_CONFIG.gas_per_mile_confirmed,
    gas_per_mile_note: RULES_CONFIG.gas_per_mile_note,
    tax_assumption_rate: pick('tax_assumption_rate'),
    optional: { lot_roi: lotRoi, surplus_radius: surplusRadius },
  };
}

export const DEFAULT_RULES = activeRules();

function check(rule, label, pass, text) {
  return { rule, label, pass, result: pass === true ? 'pass' : (pass === false ? 'fail' : 'unknown'), text };
}

// facts: { miles, miles_approximate, drive_minutes, all_in, price_floor, net, net_estimate, net_low, net_high, roi }
// Every number is in dollars or miles, or null when unknown.
export function checkLot(facts, rules = DEFAULT_RULES) {
  const f = facts || {};
  const checks = [];

  const miles = num(f.miles);
  const milesText = miles == null ? null : `${f.miles_approximate ? 'About ' : ''}${miles} mi`;
  if (miles == null) checks.push(check('radius', 'Pickup radius', null, `Distance from ${rules.home} is unknown.`));
  else if (miles > rules.pickup_miles) checks.push(check('radius', 'Pickup radius', false, `${milesText} from ${rules.home} is past the ${rules.pickup_miles}-mile pickup limit.`));
  else checks.push(check('radius', 'Pickup radius', true, `${milesText} is inside the ${rules.pickup_miles}-mile pickup limit.`));

  // Round-trip drive time against the cap. Unknown is not a pass.
  if (rules.max_drive_minutes != null) {
    const mins = num(f.drive_minutes);
    const capMin = rules.max_drive_minutes;
    if (mins == null) checks.push(check('drive_time', 'Drive time', null, `Round-trip drive time from ${rules.home} is unknown, so the ${capMin}-minute cap cannot be checked.`));
    else if (mins > capMin) checks.push(check('drive_time', 'Drive time', false, `A ${mins}-minute round trip is over the ${capMin}-minute drive cap.`));
    else checks.push(check('drive_time', 'Drive time', true, `A ${mins}-minute round trip is inside the ${capMin}-minute drive cap.`));
  }

  const allIn = num(f.all_in);
  const floor = num(f.price_floor);
  const cap = moneyText(rules.max_cost);
  if (allIn != null && allIn > rules.max_cost) checks.push(check('max_cost', 'Max cost', false, `All-in cost ${moneyText(allIn)} is over the ${cap} max per flip.`));
  else if (allIn == null && floor != null && floor > rules.max_cost) checks.push(check('max_cost', 'Max cost', false, `The bid alone, ${moneyText(floor)}, is over the ${cap} max per flip.`));
  else if (allIn == null) checks.push(check('max_cost', 'Max cost', null, 'All-in cost is unknown.'));
  else checks.push(check('max_cost', 'Max cost', true, `All-in cost ${moneyText(allIn)} at the current bid is under the ${cap} max per flip.`));

  const net = num(f.net);
  const est = num(f.net_estimate);
  const min = moneyText(rules.min_profit);
  if (net != null && net < rules.min_profit) checks.push(check('min_profit', 'Min profit', false, `Confirmed profit ${moneyText(net)} is under the ${min} minimum.`));
  else if (net != null) checks.push(check('min_profit', 'Min profit', true, `Confirmed profit ${moneyText(net)} meets the ${min} minimum.`));
  else if (est != null && num(f.net_high) != null && f.net_high < rules.min_profit) checks.push(check('min_profit', 'Min profit', false, `Even the high case, ${moneyText(f.net_high)} at the current bid, is under the ${min} minimum.`));
  else if (est != null && num(f.net_high) == null && est < rules.min_profit) checks.push(check('min_profit', 'Min profit', false, `Estimated profit ${moneyText(est)} is under the ${min} minimum.`));
  else if (est != null && num(f.net_low) != null && f.net_low < rules.min_profit) checks.push(check('min_profit', 'Min profit', null, `At the current bid the estimate runs from ${moneyText(f.net_low)} (low case) to ${moneyText(num(f.net_high) != null ? f.net_high : est)} (high case). The low case is under the ${min} minimum, and nothing is confirmed.`));
  else if (est != null) checks.push(check('min_profit', 'Min profit', null, `Estimated profit ${moneyText(est)} would meet the ${min} minimum, but it is not confirmed.`));
  else checks.push(check('min_profit', 'Min profit', null, `Profit is unknown, so the ${min} minimum cannot be checked.`));

  const lotRoi = rules.optional.lot_roi;
  if (lotRoi.enabled) {
    const roi = num(f.roi);
    if (roi == null) checks.push(check('lot_roi', 'Lot return', null, 'Return is unknown.'));
    else if (roi < lotRoi.min_roi) checks.push(check('lot_roi', 'Lot return', false, `Return of ${Math.round(roi * 100) / 100}x is under the ${lotRoi.min_roi}x minimum.`));
    else checks.push(check('lot_roi', 'Lot return', true, `Return of ${Math.round(roi * 100) / 100}x meets the ${lotRoi.min_roi}x minimum.`));
  }

  const failed = checks.filter((c) => c.pass === false);
  return {
    checks,
    failed,
    all_pass: checks.every((c) => c.pass === true),
    skip_reason: failed.length ? failed.map((c) => c.text).join(' ') : null,
  };
}

// The rules in the shape the scout config uses. The deals API scores every deal against this.
export const RULE_FIELDS = ['max_per_flip', 'bankroll', 'min_profit', 'max_pickup_miles', 'categories', 'gas_per_mile', 'gas_per_mile_note'];
export function rulesAsConfig(rules = DEFAULT_RULES) {
  return {
    max_per_flip: rules.max_per_flip,
    bankroll: rules.bankroll,
    bankroll_start: rules.bankroll_start,
    bankroll_source: rules.bankroll_source,
    hourly_rate: rules.hourly_rate,
    max_drive_minutes: rules.max_drive_minutes,
    categories: [...rules.categories],
    min_profit: rules.min_profit,
    // The 15-mile rule for local listings. The wider surplus radius, when it is on, is for surplus lots only.
    max_pickup_miles: rules.max_pickup_miles,
    sites: [...RULES_CONFIG.sites],
    areas: RULES_CONFIG.areas.map((a) => ({ ...a })),
    gas_per_mile: rules.gas_per_mile,
    gas_per_mile_note: rules.gas_per_mile_note,
    fees: Object.fromEntries(Object.entries(RULES_CONFIG.fees).map(([k, v]) => [k, { ...v }])),
    run_hours: RULES_CONFIG.run_hours,
  };
}
