import test from 'node:test';
import assert from 'node:assert/strict';
import { workerCheck, workerOk, presentedKey, MIN_KEY_LENGTH } from './workerKey.js';

const KEY = 'test-key-0123456789abcdefghij';
const NEXT = 'next-key-0123456789abcdefghij';
const req = (headers = {}) => new Request('http://localhost/api/worker/check', { headers });

test('a matching key is accepted from either header', () => {
  const env = { GST_WORKER_KEY: KEY };
  assert.deepEqual(workerCheck(req({ 'x-worker-key': KEY }), env), { ok: true, reason: 'ok', hint: null });
  assert.equal(workerOk(req({ authorization: `Bearer ${KEY}` }), env), true);
  assert.equal(workerOk(req({ authorization: `bearer   ${KEY}  ` }), env), true);
});

test('a wrong, missing or partial key is refused, each with its own reason', () => {
  const env = { GST_WORKER_KEY: KEY };
  assert.equal(workerCheck(req({ 'x-worker-key': 'nope' }), env).reason, 'key-does-not-match');
  assert.equal(workerCheck(req({ 'x-worker-key': KEY.slice(0, -1) }), env).reason, 'key-does-not-match');
  assert.equal(workerCheck(req({ 'x-worker-key': `${KEY}x` }), env).reason, 'key-does-not-match');
  assert.equal(workerCheck(req(), env).reason, 'no-key-sent');
  assert.equal(workerCheck(req({ 'x-worker-key': '   ' }), env).reason, 'no-key-sent');
  assert.equal(workerCheck(req({ authorization: 'Basic abc' }), env).reason, 'no-key-sent');
});

test('with no key on the server nothing is accepted, not even an empty key', () => {
  for (const env of [{}, { GST_WORKER_KEY: '' }, { GST_WORKER_KEY: '   ' }, { GST_WORKER_KEY: '""' }]) {
    assert.equal(workerCheck(req({ 'x-worker-key': KEY }), env).reason, 'server-has-no-key');
    assert.equal(workerOk(req({ 'x-worker-key': '' }), env), false);
    assert.equal(workerOk(req(), env), false);
  }
});

test('stray whitespace or quotes around the stored key do not cause a 401', () => {
  for (const stored of [`${KEY}\n`, `  ${KEY}  `, `${KEY}\r\n`, `"${KEY}"`, `'${KEY}'\n`]) {
    assert.equal(workerOk(req({ 'x-worker-key': KEY }), { GST_WORKER_KEY: stored }), true, JSON.stringify(stored));
  }
  assert.equal(workerOk(req({ 'x-worker-key': `${KEY}\n`.trim() }), { GST_WORKER_KEY: KEY }), true);
  // Whitespace inside the key still matters.
  assert.equal(workerOk(req({ 'x-worker-key': KEY.replace('-', ' ') }), { GST_WORKER_KEY: KEY }), false);
});

test('during a rotation both the old and the new key work, and afterwards only the new one', () => {
  const during = { GST_WORKER_KEY: KEY, GST_WORKER_KEY_NEXT: NEXT };
  assert.equal(workerOk(req({ 'x-worker-key': KEY }), during), true);
  assert.equal(workerOk(req({ 'x-worker-key': NEXT }), during), true);
  const after = { GST_WORKER_KEY: NEXT };
  assert.equal(workerOk(req({ 'x-worker-key': KEY }), after), false);
  assert.equal(workerOk(req({ 'x-worker-key': NEXT }), after), true);
});

test('a short key works but is called out, and the reply never contains a key', () => {
  const short = workerCheck(req({ 'x-worker-key': 'short' }), { GST_WORKER_KEY: 'short' });
  assert.equal(short.ok, true);
  assert.match(short.hint, new RegExp(`shorter than ${MIN_KEY_LENGTH} characters`));
  for (const r of [workerCheck(req({ 'x-worker-key': 'nope' }), { GST_WORKER_KEY: KEY }), workerCheck(req({ 'x-worker-key': KEY }), { GST_WORKER_KEY: KEY })]) {
    assert.equal(JSON.stringify(r).includes(KEY), false);
    assert.equal(JSON.stringify(r).includes('nope'), false);
  }
  assert.equal(presentedKey(req({ 'x-worker-key': ` ${KEY} ` })), KEY);
});

test('the check endpoint and the write endpoints give the reason on a 401', async () => {
  const prev = process.env.GST_WORKER_KEY;
  process.env.GST_WORKER_KEY = `${KEY}\n`;
  try {
    const check = await import('../app/api/worker/check/route.js');
    const good = await check.GET(req({ 'x-worker-key': KEY }));
    assert.equal(good.status, 200);
    assert.equal((await good.json()).ok, true);
    const bad = await check.GET(req({ 'x-worker-key': 'nope' }));
    assert.equal(bad.status, 401);
    const body = await bad.json();
    assert.equal(body.reason, 'key-does-not-match');
    assert.equal(JSON.stringify(body).includes(KEY), false);
    const surplus = await import('../app/api/surplus/route.js');
    const denied = await surplus.POST(new Request('http://localhost/api/surplus', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
    assert.equal(denied.status, 401);
    assert.equal((await denied.json()).reason, 'no-key-sent');
    const deals = await import('../app/api/deals/route.js');
    const denied2 = await deals.POST(new Request('http://localhost/api/deals', { method: 'POST', headers: { 'content-type': 'application/json', 'x-worker-key': 'nope' }, body: '{}' }));
    assert.equal(denied2.status, 401);
    assert.equal((await denied2.json()).reason, 'key-does-not-match');
  } finally {
    if (prev === undefined) delete process.env.GST_WORKER_KEY; else process.env.GST_WORKER_KEY = prev;
  }
});

test('every worker route goes through the shared key check, with no raw compare left', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const root = path.join(process.cwd(), 'app', 'api');
  const files = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f); else if (e.name === 'route.js') files.push(f); } };
  walk(root);
  assert.ok(files.length > 10);
  // The key env var is read in lib/workerKey.js only. A route that reads it is doing its own compare.
  const raw = files.filter((f) => /GST_WORKER_KEY/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
  assert.deepEqual(raw, []);
});

test('the job events route accepts a padded stored key and a rotated key', async () => {
  const prev = { k: process.env.GST_WORKER_KEY, n: process.env.GST_WORKER_KEY_NEXT };
  process.env.GST_WORKER_KEY = `${KEY}\n`;
  process.env.GST_WORKER_KEY_NEXT = NEXT;
  try {
    const events = await import('../app/api/jobs/[id]/events/route.js');
    const post = (headers) => events.POST(new Request('http://localhost/api/jobs/abc123/events', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}' }), { params: { id: 'abc123' } });
    const denied = await post({ 'x-worker-key': 'nope' });
    assert.equal(denied.status, 401);
    assert.equal((await denied.json()).reason, 'key-does-not-match');
    // An accepted key gets past the check. The empty body is then refused for its own reason, not as unauthorized.
    for (const headers of [{ 'x-worker-key': KEY }, { 'x-worker-key': NEXT }, { authorization: `Bearer ${KEY}` }]) {
      const res = await post(headers);
      assert.equal(res.status, 400);
      assert.match((await res.json()).error, /body must have type/);
    }
  } finally {
    for (const [k, name] of [['k', 'GST_WORKER_KEY'], ['n', 'GST_WORKER_KEY_NEXT']]) { if (prev[k] === undefined) delete process.env[name]; else process.env[name] = prev[k]; }
  }
});
