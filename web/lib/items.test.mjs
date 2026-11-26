import test from 'node:test';
import assert from 'node:assert/strict';

// No Blob token, so records land in web/.data/kv. Each run uses its own made-up account ids.
delete process.env.BLOB_READ_WRITE_TOKEN;
const I = await import('./items.js');
const { kvList } = await import('./kv.js');
const acct = () => 'itest' + Math.random().toString(16).slice(2, 10);
const job = (n) => 'job' + String(n).padStart(6, '0');

test('the free limit is 10 items, then $1 each', () => {
  assert.equal(I.FREE_ITEMS, 10);
  assert.equal(I.PRICE_AFTER_FREE, 1);
});

test('usage counts what is used and what is left, and says nothing when the list is unreadable', () => {
  assert.deepEqual(I.usageOf([]), { used: 0, free: 10, left: 10 });
  assert.deepEqual(I.usageOf([{ name: 'a' }, { name: 'b' }, { name: 'c' }]), { used: 3, free: 10, left: 7 });
  assert.deepEqual(I.usageOf(new Array(12).fill({ name: 'x' })), { used: 12, free: 10, left: 0 });
  assert.equal(I.usageOf(null), null);
});

test('ten items are free, the eleventh is refused, and nothing is left behind for it', async () => {
  const a = acct();
  for (let n = 1; n <= 10; n++) {
    const t = await I.takeItem(a, job(n));
    assert.equal(t.ok, true, `item ${n} is free`);
    assert.equal(t.usage.used, n);
  }
  const t = await I.takeItem(a, job(11));
  assert.equal(t.ok, false);
  assert.equal(t.status, 402);
  assert.equal(t.reason, 'free-items-used');
  assert.match(t.error, /10 free items/);
  assert.deepEqual(t.usage, { used: 10, free: 10, left: 0 });
  assert.equal((await kvList(`items-${a}/`)).length, 10);
  assert.deepEqual(await I.itemUsage(a), { used: 10, free: 10, left: 0 });
});

test('the same item is only counted once, even when it is approved again after the limit is reached', async () => {
  const a = acct();
  assert.equal((await I.takeItem(a, job(1), 2)).usage.used, 1);
  assert.equal((await I.takeItem(a, job(1), 2)).usage.used, 1);
  assert.equal((await I.takeItem(a, job(2), 2)).usage.used, 2);
  assert.equal((await I.takeItem(a, job(3), 2)).ok, false);
  assert.equal((await I.takeItem(a, job(1), 2)).ok, true, 'an item already counted is still allowed');
});

test('a burst of approvals cannot go past the limit', async () => {
  const a = acct();
  const out = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => I.takeItem(a, job(n), 3)));
  assert.equal(out.filter((t) => t.ok).length <= 3, true);
  assert.equal((await kvList(`items-${a}/`)).length <= 3, true);
});

test('one account never counts against another, and a bad id is refused rather than guessed', async () => {
  const a = acct(); const b = acct();
  await I.takeItem(a, job(1));
  assert.deepEqual(await I.itemUsage(b), { used: 0, free: 10, left: 10 });
  assert.equal(await I.itemUsage('../etc'), null);
  const bad = await I.takeItem('../etc', job(1));
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'items-unknown');
  assert.equal(bad.status, 503);
});
