// Flip ledger. Blob JSON under ledger/ when a token is set, otherwise web/.data/ledger.json.
// @vercel/blob 0.27.3 only allows access: 'public' (see PutCommandOptions). There is no
// private blob mode in this version, so the API key is what keeps the ledger closed.
import fs from 'fs';
import path from 'path';
import { newId, saveVersioned, readLatest } from './store.js';

export const STATUSES = ['on_hand', 'listed', 'sold'];
const FILE = path.join(process.cwd(), '.data', 'ledger.json');
const blobOn = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export function moneyField(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
const money = moneyField;
const round2 = (n) => Math.round(n * 100) / 100;
const num0 = (v) => (v == null || !Number.isFinite(Number(v)) ? 0 : Number(v));
function str(v, n) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, n) : null;
}
function dateStr(v) {
  if (v == null || v === '') return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function httpUrl(v) {
  if (typeof v !== 'string' || !v.trim() || v.length > 1000) return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.toString();
  } catch (e) { return null; }
}
function dealId(v) {
  if (v == null || v === '') return null;
  const s = String(v).replace(/[^\w-]/g, '').slice(0, 40);
  return s || null;
}

export function emptyLedger() {
  return { starting_bankroll: null, items: [] };
}

export function costOf(item) {
  const c = (item && item.costs) || {};
  return round2(num0(c.gas) + num0(c.fees) + num0(c.repairs));
}

// net_profit = sell_price - buy_price - gas - fees - repairs. Null until it is sold.
export function netProfit(item) {
  if (!item || item.status !== 'sold' || item.sell_price == null || item.buy_price == null) return null;
  return round2(item.sell_price - item.buy_price - costOf(item));
}

export function withProfit(item) {
  return { ...item, net_profit: netProfit(item) };
}

export function totals(doc) {
  const items = (doc && doc.items) || [];
  const spent = items.reduce((s, it) => s + num0(it.buy_price) + costOf(it), 0);
  const sales = items.reduce((s, it) => s + (it.status === 'sold' ? num0(it.sell_price) : 0), 0);
  const onHand = items.filter((it) => it.status === 'on_hand' || it.status === 'listed');
  const realized = items.reduce((s, it) => s + (it.status === 'sold' && it.net_profit != null ? it.net_profit : 0), 0);
  return {
    bankroll: round2(num0(doc && doc.starting_bankroll) - spent + sales),
    realized_profit: round2(realized),
    on_hand_count: onHand.length,
    on_hand_value: round2(onHand.reduce((s, it) => s + num0(it.buy_price) + costOf(it), 0)),
  };
}

function costsFrom(input, prev) {
  const src = (input && input.costs) || {};
  const was = (prev && prev.costs) || {};
  const pick = (k) => (k in src ? (money(src[k]) ?? 0) : (money(was[k]) ?? 0));
  return { gas: pick('gas'), fees: pick('fees'), repairs: pick('repairs') };
}

export function cleanItem(input, id) {
  if (!input || typeof input !== 'object') throw new Error('bad item');
  const itemName = str(input.item, 200);
  const buy = money(input.buy_price);
  if (!itemName) throw new Error('item required');
  if (buy == null) throw new Error('buy_price required');
  const status = STATUSES.includes(input.status) ? input.status : 'on_hand';
  const sell_price = status === 'sold' ? money(input.sell_price) : null;
  if (status === 'sold' && sell_price == null) throw new Error('sell_price required');
  return withProfit({
    id, item: itemName, date_bought: dateStr(input.date_bought), buy_price: buy,
    source_link: httpUrl(input.source_link), costs: costsFrom(input), status,
    sell_date: status === 'sold' ? dateStr(input.sell_date) : null,
    sell_price, platform: str(input.platform, 40), saved_deal_id: dealId(input.saved_deal_id),
  });
}

export function applyPatch(existing, patch) {
  const p = patch && typeof patch === 'object' ? patch : {};
  const next = {
    ...existing,
    costs: costsFrom(p, existing),
  };
  if ('item' in p) {
    const name = str(p.item, 200);
    if (!name) throw new Error('item required');
    next.item = name;
  }
  if ('date_bought' in p) next.date_bought = dateStr(p.date_bought);
  if ('buy_price' in p) {
    const buy = money(p.buy_price);
    if (buy == null) throw new Error('buy_price required');
    next.buy_price = buy;
  }
  if ('source_link' in p) next.source_link = httpUrl(p.source_link);
  if ('platform' in p) next.platform = str(p.platform, 40);
  if ('saved_deal_id' in p) next.saved_deal_id = dealId(p.saved_deal_id);
  if ('status' in p) {
    if (!STATUSES.includes(p.status)) throw new Error('bad status');
    next.status = p.status;
  }
  if ('sell_date' in p) next.sell_date = dateStr(p.sell_date);
  if ('sell_price' in p) next.sell_price = money(p.sell_price);
  if (next.status !== 'sold') {
    next.sell_price = null;
    next.sell_date = null;
  } else if (next.sell_price == null) throw new Error('sell_price required');
  return withProfit(next);
}

export function normalize(doc) {
  const base = doc && typeof doc === 'object' ? doc : {};
  const items = (Array.isArray(base.items) ? base.items : []).filter((it) => it && it.id).map((it) => withProfit({
    id: String(it.id).slice(0, 40),
    item: str(it.item, 200),
    date_bought: dateStr(it.date_bought),
    buy_price: money(it.buy_price),
    source_link: httpUrl(it.source_link),
    costs: { gas: money(it.costs && it.costs.gas) ?? 0, fees: money(it.costs && it.costs.fees) ?? 0, repairs: money(it.costs && it.costs.repairs) ?? 0 },
    status: STATUSES.includes(it.status) ? it.status : 'on_hand',
    sell_date: dateStr(it.sell_date),
    sell_price: money(it.sell_price),
    platform: str(it.platform, 40),
    saved_deal_id: dealId(it.saved_deal_id),
  }));
  return { starting_bankroll: money(base.starting_bankroll), items };
}

// Header x-ledger-key against GS_LEDGER_KEY. Unset key is 503, not a silent open.
export function ledgerAuth(headerValue) {
  const key = process.env.GS_LEDGER_KEY;
  if (!key) return { ok: false, status: 503, error: 'ledger key not configured' };
  if (headerValue !== key) return { ok: false, status: 401, error: 'unauthorized' };
  return { ok: true };
}
export function authFromRequest(req) {
  return ledgerAuth(req.headers.get('x-ledger-key'));
}

export async function readLedger() {
  if (blobOn()) return normalize(await readLatest('ledger/').catch(() => null));
  try { return normalize(JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch (e) { return emptyLedger(); }
}

export async function writeLedger(doc) {
  const out = normalize(doc);
  if (blobOn()) await saveVersioned('ledger/', out);
  else {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(out, null, 1));
  }
  return out;
}

export function addItem(doc, input) {
  const rec = cleanItem(input, newId());
  doc.items.unshift(rec);
  return rec;
}
