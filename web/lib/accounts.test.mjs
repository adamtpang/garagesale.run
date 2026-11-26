import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

// No Blob token, so records land in web/.data/kv. Each run uses its own invite and account.
delete process.env.BLOB_READ_WRITE_TOKEN;
process.env.GS_OWNER_KEY = 'test-owner-key-0123456789';
process.env.GST_WORKER_KEY = 'test-worker-key-0123456789';
const A = await import('./accounts.js');
const kvDir = path.join(process.cwd(), '.data', 'kv');
const made = [];
const cleanup = () => { for (const p of made) { try { fs.unlinkSync(path.join(kvDir, ...p.split('/'))); } catch (e) {} } };
test.after(cleanup);
const req = (headers = {}) => ({ headers: { get: (k) => headers[k.toLowerCase()] ?? null } });

test('a job with no owner is the site owner\'s, and each bot only works its own jobs', () => {
  const legacy = { id: 'a1b2c3' };
  const theirs = { id: 'd4e5f6', owner: 'acct01' };
  assert.equal(A.ownerOf(legacy), null);
  assert.equal(A.canWork(legacy, { account: null }), true);
  assert.equal(A.canWork(legacy, { account: 'acct01' }), false);
  assert.equal(A.canWork(theirs, { account: 'acct01' }), true);
  assert.equal(A.canWork(theirs, { account: 'acct02' }), false);
  assert.equal(A.canWork(theirs, { account: null }), false);
  assert.equal(A.canWork(theirs, null), false);
});

test('approving needs the job\'s own account signed in, or the owner key for the site owner\'s jobs', () => {
  const legacy = { id: 'a1b2c3' };
  const theirs = { id: 'd4e5f6', owner: 'acct01' };
  assert.equal(A.canAct(theirs, { sessionAccount: 'acct01' }), true);
  assert.equal(A.canAct(theirs, { sessionAccount: 'acct02' }), false);
  assert.equal(A.canAct(theirs, {}), false);
  // The owner key does not open another account's job.
  assert.equal(A.canAct(theirs, { ownerKeyOk: true }), false);
  assert.equal(A.canAct(legacy, { ownerKeyOk: true }), true);
  assert.equal(A.canAct(legacy, { sessionAccount: 'acct01' }), false);
});

test('a session is signed, expires, and cannot be forged or edited', () => {
  const secret = 'secret-one';
  const now = Date.parse('2026-11-25T12:00:00Z');
  const good = A.signSession('acct01', now + 1000, secret);
  assert.equal(A.readSession(good, secret, now), 'acct01');
  assert.equal(A.readSession(good, secret, now + 2000), null, 'expired');
  assert.equal(A.readSession(good, 'secret-two', now), null, 'wrong secret');
  assert.equal(A.readSession(good.replace('acct01', 'acct02'), secret, now), null, 'edited account');
  assert.equal(A.readSession(`acct01.${now + 99999999}.${good.split('.')[2]}`, secret, now), null, 'edited expiry');
  assert.equal(A.readSession('', secret, now), null);
  assert.equal(A.readSession(good, '', now), null, 'no secret means no sessions');
});

test('an invite registers one Garry, once, and the key is stored only as a hash', async () => {
  const invite = await A.createInvite('Sam');
  made.push(`invites/${A.sha(invite)}.json`);
  assert.match(invite, /^inv-[a-f0-9]{16}$/);
  assert.equal((await A.registerGarry({ invite: 'inv-0000000000000000', name: 'Sam' })).status, 403);
  assert.equal((await A.registerGarry({ invite, name: '   ' })).status, 400);
  const out = await A.registerGarry({ invite, name: '  Sam <b> ' });
  made.push(`accounts/${out.account.id}.json`, `account-keys/${A.sha(out.key)}.json`);
  assert.match(out.key, /^garry_[a-f0-9]{48}$/);
  assert.equal(out.account.name, 'Sam b');
  // The invite is used up.
  assert.equal((await A.registerGarry({ invite, name: 'Sam' })).status, 403);
  // The key file holds no key, and no file anywhere under kv contains it.
  const all = fs.readdirSync(kvDir, { recursive: true }).filter((f) => String(f).endsWith('.json')).map((f) => fs.readFileSync(path.join(kvDir, String(f)), 'utf8')).join('\n');
  assert.equal(all.includes(out.key), false);
  assert.equal(all.includes(invite), false);

  // The bot key identifies the account. The owner's worker key is the site owner. Anything else is nobody.
  assert.deepEqual(await A.botPrincipal(req({ 'x-garry-key': out.key })), { account: out.account.id, name: 'Sam b' });
  assert.deepEqual(await A.botPrincipal(req({ authorization: `Bearer ${out.key}` })), { account: out.account.id, name: 'Sam b' });
  assert.deepEqual(await A.botPrincipal(req({ 'x-worker-key': process.env.GST_WORKER_KEY })), { account: null, name: 'owner' });
  assert.equal(await A.botPrincipal(req({ 'x-garry-key': `garry_${'0'.repeat(48)}` })), null);
  assert.equal(await A.botPrincipal(req({})), null);

  // A sign-in code works once.
  const { code } = await A.createLoginCode(out.account.id);
  made.push(`login-codes/${A.sha(code)}.json`);
  assert.equal((await A.redeemLoginCode(code)).id, out.account.id);
  assert.equal(await A.redeemLoginCode(code), null, 'second use');
  assert.equal(await A.redeemLoginCode('not-a-code'), null);

  // The cookie it sets reads back as that account, and only for a request that carries it.
  const cookie = A.sessionCookie(out.account.id).split(';')[0];
  assert.equal((await A.sessionAccount(req({ cookie }))).id, out.account.id);
  assert.equal(await A.sessionAccount(req({ cookie: `${A.COOKIE}=forged.9999999999999.abc` })), null);
  assert.equal(await A.sessionAccount(req({})), null);
});

test('an expired sign-in code is refused', () => {
  const now = Date.parse('2026-11-25T12:00:00Z');
  assert.equal(A.codeExpired({ expires_at: '2026-11-25T12:05:00Z' }, now), false);
  assert.equal(A.codeExpired({ expires_at: '2026-11-25T11:59:59Z' }, now), true);
  assert.equal(A.codeExpired(null, now), true);
  assert.equal(A.LOGIN_CODE_MINUTES, 10);
});
