import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { netProfit, totals, cleanItem, applyPatch, ledgerAuth, sealLedger, openLedger, ledgerPathname, writeLedger, readLedger, rekeyLedger, cleanDecision, applyDecisionPatch, addDecision, normalize, emptyLedger } from './ledger.js';

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

// Decisions: what Adam approved or declined.

test('an approval needs a ceiling, and a decline has none', () => {
  const yes = cleanDecision({ title: '8 Zebra TC700K handhelds', decision: 'approved', max_bid: '35', decided_on: '2026-11-16', source_link: 'https://www.publicsurplus.com/sms/all,tx/auction/view?auc=4123518', lot_id: 'ps-4123518' }, 'd1');
  assert.deepEqual([yes.decision, yes.max_bid, yes.outcome, yes.lot_id, yes.decided_on], ['approved', 35, 'pending', 'ps-4123518', '2026-11-16']);
  assert.throws(() => cleanDecision({ title: 'Lot', decision: 'approved' }, 'd2'), /max_bid required/);
  assert.throws(() => cleanDecision({ title: 'Lot', decision: 'approved', max_bid: 0 }, 'd2'), /max_bid required/);
  assert.throws(() => cleanDecision({ title: 'Lot', decision: 'maybe', max_bid: 10 }, 'd2'), /approved or declined/);
  assert.throws(() => cleanDecision({ decision: 'approved', max_bid: 10 }, 'd2'), /title required/);
  const no = cleanDecision({ title: 'TFC Lot 13', decision: 'declined', max_bid: 500, outcome: 'won' }, 'd3');
  assert.deepEqual([no.decision, no.max_bid, no.outcome], ['declined', null, 'not_bid']);
});

test('an approval moves to won, lost or not bid, and a decline cannot be won', () => {
  const yes = cleanDecision({ title: 'Lot', decision: 'approved', max_bid: 35 }, 'd1');
  assert.equal(applyDecisionPatch(yes, { outcome: 'won', item_id: 'abc123' }).outcome, 'won');
  assert.equal(applyDecisionPatch(yes, { outcome: 'won', item_id: 'abc123' }).item_id, 'abc123');
  assert.equal(applyDecisionPatch(yes, { outcome: 'lost' }).outcome, 'lost');
  assert.equal(applyDecisionPatch(yes, { max_bid: 40 }).max_bid, 40);
  assert.throws(() => applyDecisionPatch(yes, { outcome: 'maybe' }), /bad outcome/);
  assert.throws(() => applyDecisionPatch(yes, { max_bid: null }), /max_bid required/);
  const no = cleanDecision({ title: 'Lot', decision: 'declined' }, 'd2');
  assert.throws(() => applyDecisionPatch(no, { outcome: 'won' }), /was not bid on/);
  assert.throws(() => applyDecisionPatch(no, { max_bid: 10 }), /only an approval/);
});

test('open approvals show as committed, not spent', () => {
  const doc = { ...emptyLedger(), starting_bankroll: 100 };
  doc.items.push(cleanItem({ item: 'Lamp', buy_price: 15, costs: { gas: 1 } }, 'it1'));
  addDecision(doc, { title: 'Zebra lot', decision: 'approved', max_bid: 35 });
  addDecision(doc, { title: 'Phone', decision: 'approved', max_bid: 20, outcome: 'lost' });
  addDecision(doc, { title: 'TFC Lot 13', decision: 'declined' });
  const t = totals(doc);
  // Bankroll: 100 - (15 + 1) = 84. One approval is still open, for up to $35.
  assert.equal(t.bankroll, 84);
  assert.equal(t.open_approvals, 1);
  assert.equal(t.committed, 35);
  assert.equal(t.bankroll_after_open_approvals, 49);
  assert.equal(t.sold_count, 0);
  assert.equal(totals({ starting_bankroll: 100, items: [] }).open_approvals, 0);
});

test('decisions survive encryption and an old ledger with none still opens', () => {
  const doc = { ...emptyLedger(), starting_bankroll: 100 };
  addDecision(doc, { title: 'Zebra lot', decision: 'approved', max_bid: 35, note: 'Zebra only' });
  const sealed = sealLedger(doc, 'secret-key-for-test');
  assert.equal(JSON.stringify(sealed).includes('Zebra'), false);
  const opened = normalize(openLedger(sealed, 'secret-key-for-test'));
  assert.equal(opened.decisions.length, 1);
  assert.deepEqual([opened.decisions[0].title, opened.decisions[0].max_bid, opened.decisions[0].note], ['Zebra lot', 35, 'Zebra only']);
  assert.deepEqual(normalize({ starting_bankroll: 50, items: [] }).decisions, []);
  // A stored record with a decision that is not approved or declined is dropped.
  assert.deepEqual(normalize({ items: [], decisions: [{ id: 'x', decision: 'bought', title: 'x' }] }).decisions, []);
});

test('only the ledger key can record a decision, and the worker key cannot', async () => {
  const prev = { l: process.env.GS_LEDGER_KEY, w: process.env.GST_WORKER_KEY, b: process.env.BLOB_READ_WRITE_TOKEN };
  delete process.env.BLOB_READ_WRITE_TOKEN;
  process.env.GS_LEDGER_KEY = 'ledger-key-for-test';
  process.env.GST_WORKER_KEY = 'worker-key-for-test-0123456789';
  fs.rmSync(ledgerFile, { force: true });
  try {
    const route = await import('../app/api/ledger/route.js');
    const one = await import('../app/api/ledger/decisions/[id]/route.js');
    const post = (headers, body) => route.POST(new Request('http://localhost/api/ledger', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }));
    const body = { decision: { title: 'Zebra lot', decision: 'approved', max_bid: 35 } };
    assert.equal((await post({ 'x-worker-key': 'worker-key-for-test-0123456789' }, body)).status, 401);
    assert.equal((await post({ 'x-ledger-key': 'worker-key-for-test-0123456789' }, body)).status, 401);
    assert.equal((await post({}, body)).status, 401);
    const ok = await post({ 'x-ledger-key': 'ledger-key-for-test' }, body);
    assert.equal(ok.status, 201);
    const saved = await ok.json();
    assert.equal(saved.decided.outcome, 'pending');
    assert.equal(saved.totals.open_approvals, 1);
    const id = saved.decided.id;
    const patch = (headers, b) => one.PATCH(new Request(`http://localhost/api/ledger/decisions/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(b) }), { params: { id } });
    assert.equal((await patch({ 'x-worker-key': 'worker-key-for-test-0123456789' }, { outcome: 'won' })).status, 401);
    const won = await patch({ 'x-ledger-key': 'ledger-key-for-test' }, { outcome: 'won' });
    assert.equal(won.status, 200);
    assert.equal((await won.json()).totals.open_approvals, 0);
    assert.equal((await post({ 'x-ledger-key': 'ledger-key-for-test' }, { decision: { title: 'x', decision: 'approved' } })).status, 400);
  } finally {
    fs.rmSync(ledgerFile, { force: true });
    for (const [k, name] of [['l', 'GS_LEDGER_KEY'], ['w', 'GST_WORKER_KEY'], ['b', 'BLOB_READ_WRITE_TOKEN']]) { if (prev[k] === undefined) delete process.env[name]; else process.env[name] = prev[k]; }
  }
});
