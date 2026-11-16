// Scout config. Adam's rule numbers (max cost, bankroll, minimum profit, radius, categories, gas rate)
// always come from config/rules.js. A stored config can only change where the scout looks and what
// each site charges: sites, areas, fees and run hours. Nothing sent to the API can change a rule.
// Blob when BLOB_READ_WRITE_TOKEN is set, otherwise web/.data/scout-config.json.
import fs from 'fs';
import path from 'path';
import { saveVersioned, readLatest } from './store.js';
import { rulesAsConfig, RULE_FIELDS } from './rules.js';

export const RULES_SOURCE = 'web/config/rules.js';
const STORED_FIELDS = ['sites', 'areas', 'fees', 'run_hours'];

// Rules from the file, with the stored look-and-fee settings on top where one is set.
export function withRules(stored) {
  const base = rulesAsConfig();
  const s = stored && typeof stored === 'object' ? stored : {};
  for (const key of STORED_FIELDS) {
    const v = s[key];
    if (v == null || (Array.isArray(v) && v.length === 0)) continue;
    if (key === 'fees') {
      // A stored fee replaces the default for that site only.
      for (const [site, fee] of Object.entries(v)) if (fee && fee.rate != null) base.fees[site] = fee;
    } else base[key] = v;
  }
  return { ...base, rules_source: RULES_SOURCE };
}

export const SOURCES = ['fb', 'craigslist', 'ebay', 'offerup'];
const FILE = path.join(process.cwd(), '.data', 'scout-config.json');
const blobOn = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export function emptyConfig() {
  return {
    max_per_flip: null,
    bankroll: null,
    categories: null,
    min_profit: null,
    max_pickup_miles: null,
    sites: null,
    areas: null,
    gas_per_mile: null,
    gas_per_mile_note: null,
    fees: null,
    run_hours: null,
  };
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1e6) / 1e6;
}
function str(v, n) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, n) : null;
}

function cleanFees(fees) {
  if (fees == null) return null;
  if (typeof fees !== 'object' || Array.isArray(fees)) return null;
  const out = {};
  for (const src of SOURCES) {
    if (!(src in fees) || fees[src] == null) { out[src] = null; continue; }
    const f = fees[src];
    if (typeof f === 'number') out[src] = { rate: num(f), flat: null, plus_shipping: false, confirmed: false, note: null };
    else if (typeof f === 'object') out[src] = {
      rate: num(f.rate), flat: num(f.flat), plus_shipping: f.plus_shipping === true,
      confirmed: f.confirmed === true, note: str(f.note, 200),
    };
    else out[src] = null;
  }
  return out;
}

function cleanAreas(areas) {
  if (areas == null) return null;
  if (!Array.isArray(areas)) return null;
  return areas.map((a) => {
    if (!a || typeof a !== 'object') return null;
    const name = str(a.name, 80);
    const lat = num(a.lat);
    const lng = num(a.lng);
    if (!name || lat == null || lng == null) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { name, lat, lng };
  }).filter(Boolean);
}

// Whitelist. Unknown keys are dropped. Missing keys stay null.
export function cleanConfig(input) {
  const base = emptyConfig();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return base;
  base.max_per_flip = num(input.max_per_flip);
  base.bankroll = num(input.bankroll);
  base.min_profit = num(input.min_profit);
  base.max_pickup_miles = num(input.max_pickup_miles);
  base.gas_per_mile = num(input.gas_per_mile);
  base.gas_per_mile_note = str(input.gas_per_mile_note, 200);
  base.run_hours = str(input.run_hours, 80);
  if (Array.isArray(input.categories)) {
    const cats = [...new Set(input.categories.map((c) => str(c, 40)).filter(Boolean))];
    base.categories = cats;
  }
  if (Array.isArray(input.sites)) {
    base.sites = [...new Set(input.sites.map((s) => String(s).toLowerCase().trim()).filter((s) => SOURCES.includes(s)))];
  }
  base.areas = cleanAreas(input.areas);
  base.fees = cleanFees(input.fees);
  return base;
}

// Ranking needs a min profit, a mile cap, at least one site, and a fee rate for each site.
// gas_per_mile is not required: a null rate means gas is left out and flagged.
export function filtersReady(config) {
  if (!config) return false;
  if (config.min_profit == null || config.max_pickup_miles == null) return false;
  if (!Array.isArray(config.sites) || config.sites.length === 0) return false;
  if (!config.fees) return false;
  return config.sites.every((s) => config.fees[s] && config.fees[s].rate != null);
}

function present(doc) {
  const cleaned = withRules(cleanConfig(doc || {}));
  if (doc && doc.updated_at) cleaned.updated_at = String(doc.updated_at).slice(0, 40);
  return cleaned;
}

export async function readConfig() {
  if (blobOn()) return present(await readLatest('scout-config/').catch(() => null));
  try { return present(JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch (e) { return present(null); }
}

// Rule fields in the body that differ from the rules file. They are not stored.
export function ignoredRuleFields(input) {
  const sent = cleanConfig(input);
  const rules = rulesAsConfig();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // The gas note is wording, not a rule, so a different note is not reported.
  return RULE_FIELDS.filter((key) => key !== 'gas_per_mile_note' && sent[key] != null && !same(sent[key], rules[key]));
}

export async function writeConfig(input) {
  const cleaned = cleanConfig(input);
  const stored = { updated_at: new Date().toISOString() };
  for (const key of STORED_FIELDS) stored[key] = cleaned[key];
  if (blobOn()) await saveVersioned('scout-config/', stored);
  else {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(stored, null, 1));
  }
  const ignored = ignoredRuleFields(input);
  return {
    ...present(stored),
    ignored,
    ignored_note: ignored.length ? `These are Adam's rules and come from ${RULES_SOURCE}. They were not changed: ${ignored.join(', ')}.` : null,
  };
}

export const scoutConfigFile = FILE;
