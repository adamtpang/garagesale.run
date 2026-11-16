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
  const maxPerFlip = pick('max_per_flip');
  const bankroll = pick('bankroll');
  const baseMiles = pick('max_pickup_miles');
  return {
    approved_on: RULES_CONFIG.approved_on,
    home: typeof o.home === 'string' && o.home.trim() ? o.home.trim() : RULES_CONFIG.home,
    max_per_flip: maxPerFlip,
    bankroll,
    // The most one flip can cost is the smaller of the two.
    max_cost: Math.min(maxPerFlip, bankroll),
    min_profit: pick('min_profit'),
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

// facts: { miles, miles_approximate, all_in, price_floor, net, net_estimate, net_low, net_high, roi }
// Every number is in dollars or miles, or null when unknown.
export function checkLot(facts, rules = DEFAULT_RULES) {
  const f = facts || {};
  const checks = [];

  const miles = num(f.miles);
  const milesText = miles == null ? null : `${f.miles_approximate ? 'About ' : ''}${miles} mi`;
  if (miles == null) checks.push(check('radius', 'Pickup radius', null, `Distance from ${rules.home} is unknown.`));
  else if (miles > rules.pickup_miles) checks.push(check('radius', 'Pickup radius', false, `${milesText} from ${rules.home} is past the ${rules.pickup_miles}-mile pickup limit.`));
  else checks.push(check('radius', 'Pickup radius', true, `${milesText} is inside the ${rules.pickup_miles}-mile pickup limit.`));

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
    categories: [...rules.categories],
    min_profit: rules.min_profit,
    max_pickup_miles: rules.pickup_miles,
    sites: [...RULES_CONFIG.sites],
    areas: RULES_CONFIG.areas.map((a) => ({ ...a })),
    gas_per_mile: rules.gas_per_mile,
    gas_per_mile_note: rules.gas_per_mile_note,
    fees: Object.fromEntries(Object.entries(RULES_CONFIG.fees).map(([k, v]) => [k, { ...v }])),
    run_hours: RULES_CONFIG.run_hours,
  };
}
