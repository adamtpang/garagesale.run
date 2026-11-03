// Ledger CLI. Env: GS_LEDGER_KEY, GARAGESALE_BASE_URL.
//   node scripts/ledger.mjs list
//   node scripts/ledger.mjs add --item "Camera" --buy 50 --link https://... --gas 3.6 --fees 0 --repairs 0 --saved 999
//   node scripts/ledger.mjs sell --id abc --price 120 --platform ebay --date 2026-11-03
import { argv, exit, env } from 'node:process';

const [cmd, ...args] = argv.slice(2);
const base = (env.GARAGESALE_BASE_URL || '').replace(/\/$/, '');
const key = env.GS_LEDGER_KEY;

function flag(name) {
  const i = args.indexOf('--' + name);
  if (i < 0) return null;
  return args[i + 1] ?? '';
}
function fail(msg) { console.error(msg); exit(1); }

if (!base || !key) fail('GS_LEDGER_KEY and GARAGESALE_BASE_URL are required');

async function call(method, path, body) {
  const res = await fetch(new URL(path, base), {
    method,
    headers: { 'content-type': 'application/json', 'x-ledger-key': key },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { error: text.slice(0, 300) }; }
  if (!res.ok) fail(`${method} ${path} failed: ${res.status} ${(data && data.error) || ''}`.trim());
  return data;
}

const money = (v) => (v == null || v === '' ? null : Number(v));

if (cmd === 'list') {
  const doc = await call('GET', '/api/ledger');
  const t = doc.totals || {};
  console.log(`bankroll ${t.bankroll}  realized ${t.realized_profit}  on hand ${t.on_hand_count} ($${t.on_hand_value})  starting ${doc.starting_bankroll}`);
  for (const it of doc.items || []) {
    const costs = it.costs || {};
    console.log(`${it.id}  ${it.status}  ${it.item}  buy ${it.buy_price}  gas ${costs.gas} fees ${costs.fees} repairs ${costs.repairs}  sell ${it.sell_price ?? '-'}  net ${it.net_profit ?? '-'}`);
  }
} else if (cmd === 'add') {
  const item = flag('item');
  const buy = money(flag('buy'));
  if (!item || buy == null || Number.isNaN(buy)) fail('add needs --item and --buy');
  const body = {
    item, buy_price: buy, source_link: flag('link'), date_bought: flag('date'),
    saved_deal_id: flag('saved'),
    costs: { gas: money(flag('gas')) || 0, fees: money(flag('fees')) || 0, repairs: money(flag('repairs')) || 0 },
  };
  const bankroll = flag('bankroll');
  if (bankroll != null) body.starting_bankroll = money(bankroll);
  const doc = await call('POST', '/api/ledger', body);
  console.log(doc.created ? `added ${doc.created.id}` : 'updated');
} else if (cmd === 'sell') {
  const id = flag('id');
  const price = money(flag('price'));
  if (!id || price == null || Number.isNaN(price)) fail('sell needs --id and --price');
  const doc = await call('PATCH', `/api/ledger/${encodeURIComponent(id)}`, {
    status: 'sold', sell_price: price, platform: flag('platform'), sell_date: flag('date'),
  });
  console.log(`sold ${id} net ${doc.item && doc.item.net_profit}`);
} else {
  fail('usage: ledger.mjs list | add --item --buy | sell --id --price');
}
