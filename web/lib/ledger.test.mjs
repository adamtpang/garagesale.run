import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { netProfit, totals, cleanItem, applyPatch, ledgerAuth, sealLedger, openLedger, ledgerPathname, writeLedger, readLedger, rekeyLedger } from './ledger.js';

const ledgerFile = path.join(process.cwd(), '.data', 'ledger.json');

test('net profit subtracts buy, gas, fees and repairs', () => {
  const sold = cleanItem({
    item: 'Camera', buy_price: 50, status: 'sold', sell_price: 200, platform: 'ebay',
    costs: { gas: 3.6, fees: 26.5, repairs: 10 },
  }, 'abc123');
  assert.equal(sold.net_profit, 109.9);
  assert.equal(netProfit({ ...sold, status: 'on_hand' }), null);

  const onHand = cleanItem({ item: 'Bike', buy_price: 40, costs: { gas: 5, fees: 2, repairs: 3 } }, 'def456');
  assert.equal(onHand.status, 'on_hand');
  assert.equal(onHand.net_profit, null);

  const listed = applyPatch(onHand, { status: 'listed' });
  assert.equal(listed.net_profit, null);
  const closed = applyPatch(listed, { status: 'sold', sell_price: 90, sell_date: '2026-11-03', platform: 'offerup' });
  assert.equal(closed.net_profit, 40);
});

test('totals: bankroll, realized profit, and on-hand value', () => {
  const doc = {
    starting_bankroll: 100,
    items: [
      cleanItem({ item: 'Bike', buy_price: 40, costs: { gas: 5, fees: 2, repairs: 3 }, saved_deal_id: '99' }, 'on1'),
      cleanItem({ item: 'Lamp', buy_price: 15, status: 'listed', costs: { gas: 1, fees: 0, repairs: 0 } }, 'ls1'),
      cleanItem({ item: 'Camera', buy_price: 20, status: 'sold', sell_price: 50, costs: { gas: 0, fees: 0, repairs: 0 } }, 'sd1'),
    ],
  };
  const t = totals(doc);
  // spent = (40+10) + (15+1) + 20 = 86; sales = 50; bankroll = 100 - 86 + 50 = 64
  assert.equal(t.bankroll, 64);
  assert.equal(t.realized_profit, 30);
  assert.equal(t.on_hand_count, 2);
  assert.equal(t.on_hand_value, 66);
});

test('stored ledger is ciphertext: no names or prices, wrong key fails, round trip works', () => {
  const doc = { starting_bankroll: 100, items: [{ id: 'a1', item: 'Zeiss-Planar-secret-name', buy_price: 418.25, costs: { gas: 1.5, fees: 0, repairs: 0 }, status: 'on_hand', sell_price: null, net_profit: null }] };
  const a = sealLedger(doc, 'desk-key');
  const b = sealLedger(doc, 'desk-key');
  const raw = JSON.stringify(a);
  assert.deepEqual(Object.keys(a).sort(), ['ct', 'iv', 'tag', 'v']);
  assert.equal(a.v, 1);
  assert.equal(Buffer.from(a.iv, 'base64').length, 12);
  assert.equal(raw.includes('Zeiss-Planar-secret-name'), false);
  assert.equal(raw.includes('418.25'), false);
  assert.equal(raw.includes('starting_bankroll'), false);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ct, b.ct);
  const back = openLedger(a, 'desk-key');
  assert.equal(back.items[0].item, 'Zeiss-Planar-secret-name');
  assert.equal(back.items[0].buy_price, 418.25);
  assert.throws(() => openLedger(a, 'other-key'), (e) => e.message === 'ledger decrypt failed');
  assert.throws(() => openLedger({ ...a, ct: Buffer.from('nope').toString('base64') }, 'desk-key'), (e) => e.message === 'ledger decrypt failed');
  const pathA = ledgerPathname('desk-key');
  const pathB = ledgerPathname('other-key');
  assert.match(pathA, /^ledger\/[a-f0-9]{64}\.json$/);
  assert.notEqual(pathA, pathB);
  assert.equal(pathA.includes('Zeiss'), false);
});

test('ledger auth fails closed', async () => {
  const prevKey = process.env.GS_LEDGER_KEY;
  const prevBlob = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try { fs.unlinkSync(ledgerFile); } catch (e) {}
  try {
    assert.deepEqual(ledgerAuth('anything'), { ok: false, status: 503, error: 'ledger key not configured' });
    process.env.GS_LEDGER_KEY = 'desk-key';
    assert.equal(ledgerAuth('nope').status, 401);
    assert.equal(ledgerAuth(undefined).status, 401);
    assert.deepEqual(ledgerAuth('desk-key'), { ok: true });

    const root = await import('../app/api/ledger/route.js');
    const one = await import('../app/api/ledger/[id]/route.js');
    delete process.env.GS_LEDGER_KEY;
    const req = (path, method) => new Request('http://localhost' + path, { method, headers: { 'x-ledger-key': 'desk-key', 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
    for (const res of [
      await root.GET(req('/api/ledger', 'GET')),
      await root.POST(req('/api/ledger', 'POST')),
      await one.PATCH(req('/api/ledger/abc', 'PATCH'), { params: { id: 'abc' } }),
      await one.DELETE(req('/api/ledger/abc', 'DELETE'), { params: { id: 'abc' } }),
    ]) {
      assert.equal(res.status, 503);
      assert.equal((await res.json()).error, 'ledger key not configured');
    }

    process.env.GS_LEDGER_KEY = 'desk-key';
    const denied = await root.GET(new Request('http://localhost/api/ledger', { headers: { 'x-ledger-key': 'wrong' } }));
    assert.equal(denied.status, 401);
    const ok = await root.GET(new Request('http://localhost/api/ledger', { headers: { 'x-ledger-key': 'desk-key' } }));
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.ok(body.totals);
    assert.equal(typeof body.totals.bankroll, 'number');

    const secretName = 'Zeiss-Planar-secret-name';
    await writeLedger({ starting_bankroll: 100, items: [cleanItem({ item: secretName, buy_price: 418.25, costs: { gas: 1.25, fees: 0, repairs: 0 } }, 'id418')] }, 'desk-key');
    const stored = fs.readFileSync(ledgerFile, 'utf8');
    assert.equal(stored.includes(secretName), false);
    assert.equal(stored.includes('418.25'), false);
    assert.deepEqual(Object.keys(JSON.parse(stored)).sort(), ['ct', 'iv', 'tag', 'v']);
    const round = await readLedger('desk-key');
    assert.equal(round.items[0].item, secretName);
    assert.equal(round.items[0].buy_price, 418.25);

    process.env.GS_LEDGER_KEY = 'other-key';
    const badRead = await root.GET(new Request('http://localhost/api/ledger', { headers: { 'x-ledger-key': 'other-key' } }));
    assert.equal(badRead.status, 500);
    assert.equal((await badRead.json()).error, 'ledger decrypt failed');
    const poisoned = await root.POST(new Request('http://localhost/api/ledger', { method: 'POST', headers: { 'x-ledger-key': 'other-key', 'content-type': 'application/json' }, body: JSON.stringify({ item: 'Stolen-name', buy_price: 1 }) }));
    assert.equal(poisoned.status, 500);
    assert.equal(fs.readFileSync(ledgerFile, 'utf8'), stored);

    await rekeyLedger('desk-key', 'fresh-key');
    const moved = await readLedger('fresh-key');
    assert.equal(moved.items[0].item, secretName);
    assert.equal(moved.items[0].buy_price, 418.25);
    await assert.rejects(() => readLedger('desk-key'), (e) => e.message === 'ledger decrypt failed');
  } finally {
    try { fs.unlinkSync(ledgerFile); } catch (e) {}
    try { fs.unlinkSync(`${ledgerFile}.tmp`); } catch (e) {}
    if (prevKey === undefined) delete process.env.GS_LEDGER_KEY; else process.env.GS_LEDGER_KEY = prevKey;
    if (prevBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = prevBlob;
  }
});
