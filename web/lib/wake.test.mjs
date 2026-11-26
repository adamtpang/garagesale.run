import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

delete process.env.BLOB_READ_WRITE_TOKEN;
process.env.GST_WORKER_KEY = 'test-worker-key-0123456789';
const W = await import('./wake.js');
const file = (id) => path.join(process.cwd(), '.data', 'kv', 'account-hooks', `${id}.json`);
const ACCT = 'wakeacct01';
test.after(() => { try { fs.unlinkSync(file(ACCT)); } catch (e) {} });

test('only a public https address can be registered as a webhook', () => {
  assert.equal(W.checkWebhookUrl('https://hooks.example.com/routine/abc').url, 'https://hooks.example.com/routine/abc');
  for (const bad of ['http://hooks.example.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://[::1]/x', 'https://intranet/x', 'https://box.local/x', 'https://svc.internal/x', 'https://user:pw@hooks.example.com/x', 'ftp://hooks.example.com/x', 'not a url', '']) {
    assert.ok(W.checkWebhookUrl(bad).error, bad);
  }
});

test('a stored webhook is encrypted, and a changed or wrong-key record does not open', () => {
  const key = crypto.randomBytes(32);
  const box = W.seal({ url: 'https://hooks.example.com/a', key: 'routine-secret-123' }, key);
  assert.equal(JSON.stringify(box).includes('routine-secret-123'), false);
  assert.equal(JSON.stringify(box).includes('hooks.example.com'), false);
  assert.deepEqual(W.unseal(box, key), { url: 'https://hooks.example.com/a', key: 'routine-secret-123' });
  assert.equal(W.unseal(box, crypto.randomBytes(32)), null, 'wrong key');
  assert.equal(W.unseal({ ...box, data: Buffer.from('tampered').toString('base64') }, key), null, 'tampered');
});

test('registering, reading and clearing a webhook never returns the url or key', async () => {
  assert.equal((await W.setWebhook(ACCT, { url: 'http://x.example.com', key: 'k' })).status, 400);
  assert.equal((await W.setWebhook(ACCT, { url: 'https://hooks.example.com/a', key: '' })).status, 400);
  const out = await W.setWebhook(ACCT, { url: 'https://hooks.example.com/a?id=7', key: 'routine-secret-123' });
  assert.deepEqual(out, { ok: true, host: 'hooks.example.com' });
  const onDisk = fs.readFileSync(file(ACCT), 'utf8');
  assert.equal(onDisk.includes('routine-secret-123'), false);
  assert.equal(onDisk.includes('hooks.example.com'), false);
  const state = await W.webhookState(ACCT);
  assert.deepEqual([state.set, state.host], [true, 'hooks.example.com']);
  assert.equal(JSON.stringify(state).includes('routine-secret-123'), false);
  await W.clearWebhook(ACCT);
  assert.deepEqual(await W.webhookState(ACCT), { set: false });
});

test('waking sends the event with the bearer key, and skips owner jobs, test jobs and accounts with no webhook', async () => {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200 }; };
  try {
    assert.deepEqual(await W.wakeGarry({ id: 'job111', kind: 'sell' }, 'created'), { skipped: true }, 'site owner job');
    assert.deepEqual(await W.wakeGarry({ id: 'job111', kind: 'sell', owner: ACCT }, 'created'), { skipped: true }, 'no webhook yet');
    await W.setWebhook(ACCT, { url: 'https://hooks.example.com/a', key: 'routine-secret-123' });
    assert.deepEqual(await W.wakeGarry({ id: 'job111', kind: 'sell', owner: ACCT, test: true }, 'created'), { skipped: true }, 'test job');
    assert.equal(calls.length, 0);
    const out = await W.wakeGarry({ id: 'job111', kind: 'sell', owner: ACCT }, 'approved', { price: 40 });
    assert.deepEqual(out, { ok: true, status: 200 });
    assert.equal(calls[0].url, 'https://hooks.example.com/a');
    assert.equal(calls[0].init.headers.authorization, 'Bearer routine-secret-123');
    assert.deepEqual(JSON.parse(calls[0].init.body), { job_id: 'job111', kind: 'sell', event: 'approved', payload: { price: 40 } });
    // A failed call never throws: the work is still in /api/pending.
    globalThis.fetch = async () => { throw new Error('down'); };
    assert.deepEqual(await W.wakeGarry({ id: 'job111', kind: 'sell', owner: ACCT }, 'approved'), { ok: false });
  } finally { globalThis.fetch = real; await W.clearWebhook(ACCT); }
});
