import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { sellingRows, SLOW_DAYS } from './selling.js';
import { cleanItem, applyPatch, costOf, normalize } from './ledger.js';

const NOW = Date.parse('2026-11-19T18:00:00Z');
const bought = (extra = {}) => cleanItem({ item: 'Canon EOS R body', buy_price: 60, date_bought: '2026-10-30', costs: { gas: 4.5, fees: 2, repairs: 0 }, ...extra }, 'a1');

test('the ledger keeps a list price, a floor and the listing date', () => {
  const it = bought();
  assert.deepEqual([it.list_price, it.floor_price, it.date_listed], [null, null, null]);
  const listed = applyPatch(it, { status: 'listed', list_price: '180', floor_price: 140, date_listed: '2026-11-01' });
  assert.deepEqual([listed.status, listed.list_price, listed.floor_price, listed.date_listed], ['listed', 180, 140, '2026-11-01']);
  // The fields survive the save and reload the ledger does on every read.
  const reread = normalize(JSON.parse(JSON.stringify({ items: [listed] }))).items[0];
  assert.deepEqual([reread.list_price, reread.floor_price, reread.date_listed], [180, 140, '2026-11-01']);
  // Selling it keeps the listing history.
  const sold = applyPatch(listed, { status: 'sold', sell_price: 170, sell_date: '2026-11-20' });
  assert.equal(sold.list_price, 180);
});

test('selling rows: paid, days listed, profit at list and floor, and a Slow flag at 14 days', () => {
  const listedLong = applyPatch(bought(), { status: 'listed', list_price: 180, floor_price: 140, date_listed: '2026-11-01' });
  const listedNew = { ...applyPatch(bought(), { status: 'listed', list_price: 90, date_listed: '2026-11-15' }), id: 'a2', item: 'Drill' };
  const onHand = { ...bought(), id: 'a3', item: 'Monitor' };
  const sold = { ...applyPatch(bought(), { status: 'sold', sell_price: 150 }), id: 'a4' };
  const rows = sellingRows([onHand, listedNew, sold, listedLong], NOW);
  assert.deepEqual(rows.map((r) => r.id), ['a1', 'a2', 'a3']);
  const [a1, a2, a3] = rows;
  // Paid is the price plus gas, fees and repairs, the same sum the ledger uses.
  assert.equal(a1.paid, 60 + costOf(listedLong));
  assert.deepEqual([a1.days_listed, a1.slow, a1.profit_at_list, a1.profit_at_floor], [18, true, 113.5, 73.5]);
  assert.deepEqual([a2.days_listed, a2.slow, a2.floor_price, a2.profit_at_floor], [4, false, null, null]);
  assert.deepEqual([a3.status, a3.days_listed, a3.slow, a3.profit_at_list], ['on_hand', null, false, null]);
  assert.equal(SLOW_DAYS, 14);
});

test('the Selling page is browser-safe and only talks to the ledger API', () => {
  const lib = fs.readFileSync(new URL('./selling.js', import.meta.url), 'utf8');
  assert.equal(/from '\.\/ledger\.js'/.test(lib), false);
  const page = fs.readFileSync(new URL('../app/selling/SellingScreen.js', import.meta.url), 'utf8');
  const urls = [...page.matchAll(/fetch\(([^,]+),/g)].map((m) => m[1].trim());
  assert.ok(urls.length >= 2);
  for (const u of urls) assert.match(u, /\/api\/ledger/);
  assert.match(page, /gs_ledger_key/);
});

test('the Selling page dates a listing in local time and can forget a wrong key', async () => {
  const page = fs.readFileSync(new URL('../app/selling/SellingScreen.js', import.meta.url), 'utf8');
  assert.equal(/toISOString\(\)\.slice\(0, 10\)/.test(page), false);
  // A US evening: 9 PM on Nov 19 in Austin is already Nov 20 in UTC.
  const m = page.match(/export const localDay = [^;]+;/);
  assert.ok(m);
  const localDay = new Function(`${m[0].replace('export const localDay', 'const f')} return f;`)();
  const evening = { getFullYear: () => 2026, getMonth: () => 10, getDate: () => 19 };
  assert.equal(localDay(evening), '2026-11-19');
  assert.match(page, /function forget\(\)/);
  assert.match(page, /sessionStorage\.removeItem\(KEY\)/);
  assert.match(page, /Use a different key/);
});

test('the Selling page drops a ledger read that returns after the key changed, and saves one at a time', async () => {
  // The page is JSX, which this test runner cannot load, so its source is checked.
  const page = fs.readFileSync(new URL('../app/selling/SellingScreen.js', import.meta.url), 'utf8');
  assert.match(page, /if \(live\.current !== asked\) return;/);
  assert.match(page, /\{key && doc && <SellingTable/);
  assert.match(page, /if \(busy\) return false;/);
  // While a save runs, the Save button and every "I listed it" button are disabled, and the form stays open
  // until the save is done.
  assert.equal((page.match(/disabled=\{busy\}/g) || []).length, 2);
  assert.match(page, /const ok = await onList\(r\.id, form\); if \(ok\) setOpen\(null\);/);
});
