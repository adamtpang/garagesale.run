import test from 'node:test';
import assert from 'node:assert/strict';

// No Blob token, so records land in web/.data/kv. Each run uses its own made-up account ids.
delete process.env.BLOB_READ_WRITE_TOKEN;
const I = await import('./items.js');
const { kvList, kvPut } = await import('./kv.js');
const acct = () => 'itest' + Math.random().toString(16).slice(2, 10);
const job = (n) => 'job' + String(n).padStart(6, '0');
const HASH = (n) => String(n).padStart(32, '0');
const addPack = (a, n, items = I.PACK_ITEMS) => kvPut(`${I.packFolder(a)}${I.packName(HASH(n), items)}.json`, { items });
const U = (used, free, bought = 0, paidUsed = 0) => ({ used, free, left: Math.max(0, free - used), bought, paid_used: paidUsed, paid_left: Math.max(0, bought - paidUsed) });

test('10 items are free, then a pack is 100 items for $10', () => {
  assert.equal(I.FREE_ITEMS, 10);
  assert.equal(I.PACK_ITEMS, 100);
  assert.equal(I.PACK_PRICE, 10);
});

test('usage counts free and paid items, and says nothing when a list is unreadable', () => {
  assert.deepEqual(I.usageOf([]), U(0, 10));
  assert.deepEqual(I.usageOf([{ name: 'a' }, { name: 'b' }, { name: 'c' }]), U(3, 10));
  assert.deepEqual(I.usageOf(new Array(12).fill({ name: 'x' })), U(12, 10));
  assert.deepEqual(I.usageOf(new Array(10).fill({ name: 'x' }), 10, [{ name: 'p' }], [{ name: I.packName(HASH(1), 100) }]), U(10, 10, 100, 1));
  assert.equal(I.usageOf(null), null);
  assert.equal(I.usageOf([], 10, null, []), null);
  assert.equal(I.usageOf([], 10, [], null), null);
});

test('a pack keeps the size it was bought at, and a record that is not a pack counts for nothing', () => {
  assert.equal(I.packItems(I.packName(HASH(1), 100)), 100);
  assert.equal(I.packItems(I.packName(HASH(2), 25)), 25);
  assert.equal(I.packItems('notapack'), 0);
  assert.equal(I.packItems(`${HASH(1)}q-5`), 0);
  assert.equal(I.boughtOf([{ name: I.packName(HASH(1), 100) }, { name: I.packName(HASH(2), 100) }, { name: 'junk' }]), 200);
  assert.equal(I.boughtOf(null), null);
});

test('ten items are free, the eleventh is refused with the price, and nothing is left behind for it', async () => {
  const a = acct();
  for (let n = 1; n <= 10; n++) {
    const t = await I.takeItem(a, job(n));
    assert.equal(t.ok, true, `item ${n} is free`);
    assert.equal(t.usage.used, n);
  }
  const t = await I.takeItem(a, job(11));
  assert.equal(t.ok, false);
  assert.equal(t.status, 402);
  assert.equal(t.reason, 'no-items-left');
  assert.match(t.error, /10 free items/);
  assert.match(t.error, /100 more items are \$10/);
  assert.deepEqual(t.buy, { items: 100, price: 10 });
  assert.deepEqual(t.usage, U(10, 10));
  assert.equal((await kvList(`items-${a}/`)).length, 10);
  assert.equal((await kvList(`paid-${a}/`)).length, 0);
  assert.deepEqual(await I.itemUsage(a), U(10, 10));
});

test('after buying a pack, items past the free ones take paid places until the pack runs out', async () => {
  const a = acct();
  assert.equal((await I.takeItem(a, job(1), 1)).ok, true);
  assert.equal((await I.takeItem(a, job(2), 1)).ok, false, 'no pack yet');
  await addPack(a, 1, 2);
  const t2 = await I.takeItem(a, job(2), 1);
  assert.equal(t2.ok, true);
  assert.deepEqual(t2.usage, U(1, 1, 2, 1));
  assert.equal((await I.takeItem(a, job(3), 1)).ok, true);
  const t4 = await I.takeItem(a, job(4), 1);
  assert.equal(t4.ok, false);
  assert.equal(t4.reason, 'no-items-left');
  assert.match(t4.error, /used all your items/);
  assert.deepEqual(t4.usage, U(1, 1, 2, 2));
  assert.equal((await I.takeItem(a, job(2), 1)).ok, true, 'a paid item already counted is still allowed');
  await addPack(a, 2, 2);
  assert.equal((await I.takeItem(a, job(4), 1)).ok, true, 'a second pack adds to the first');
  assert.equal((await kvList(`paid-${a}/`)).length, 3);
});

test('the same item is only counted once, even when it is approved again after the limit is reached', async () => {
  const a = acct();
  assert.equal((await I.takeItem(a, job(1), 2)).usage.used, 1);
  assert.equal((await I.takeItem(a, job(1), 2)).usage.used, 1);
  assert.equal((await I.takeItem(a, job(2), 2)).usage.used, 2);
  assert.equal((await I.takeItem(a, job(3), 2)).ok, false);
  assert.equal((await I.takeItem(a, job(1), 2)).ok, true, 'an item already counted is still allowed');
});

test('a leftover record past the limit does not let that item through on a retry', async () => {
  const a = acct();
  assert.equal((await I.takeItem(a, job(1), 2)).ok, true);
  assert.equal((await I.takeItem(a, job(2), 2)).ok, true);
  // As if an undo never landed: a third free record, and a paid record with no pack behind it.
  await new Promise((r) => setTimeout(r, 20));
  await kvPut(`items-${a}/${job(3)}.json`, { job: job(3) });
  await kvPut(`paid-${a}/${job(3)}.json`, { job: job(3) });
  const t = await I.takeItem(a, job(3), 2);
  assert.equal(t.ok, false);
  assert.equal(t.reason, 'no-items-left');
  assert.deepEqual(t.usage, U(2, 2));
  assert.equal((await kvList(`items-${a}/`)).length, 2, 'the free leftover is cleared');
  assert.equal((await kvList(`paid-${a}/`)).length, 0, 'the paid leftover is cleared');
  assert.equal((await I.takeItem(a, job(1), 2)).ok, true, 'items inside the limit are still allowed');
});

test('a burst of approvals cannot go past the free items plus the pack', async () => {
  const a = acct();
  await addPack(a, 1, 2);
  const out = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((n) => I.takeItem(a, job(n), 3)));
  assert.equal(out.filter((t) => t.ok).length <= 5, true);
  assert.equal((await kvList(`items-${a}/`)).length <= 3, true);
  assert.equal((await kvList(`paid-${a}/`)).length <= 2, true);
});

test('one account never counts against another, and a bad id is refused rather than guessed', async () => {
  const a = acct(); const b = acct();
  await I.takeItem(a, job(1));
  await addPack(a, 1);
  assert.deepEqual(await I.itemUsage(b), U(0, 10));
  assert.equal(await I.itemUsage('../etc'), null);
  const bad = await I.takeItem('../etc', job(1));
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'items-unknown');
  assert.equal(bad.status, 503);
});
