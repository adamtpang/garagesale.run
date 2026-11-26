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

test('signing out clears the same cookie that signing in set, with Secure in production', () => {
  const attrs = (c) => c.split(';').slice(1).map((x) => x.trim()).filter((x) => !/^Max-Age=/.test(x)).sort().join('; ');
  const was = process.env.NODE_ENV;
  for (const env of ['production', 'development']) {
    process.env.NODE_ENV = env;
    assert.equal(attrs(A.clearCookie()), attrs(A.sessionCookie('acct01')), env);
    assert.equal(/; Secure/.test(A.clearCookie()), env === 'production', env);
    assert.match(A.clearCookie(), /Max-Age=0/);
  }
  process.env.NODE_ENV = was;
});

test('the session secret never comes from a key that is typed into a browser', () => {
  const keep = { ...process.env };
  delete process.env.GS_SESSION_SECRET; delete process.env.GST_WORKER_KEY;
  process.env.GS_OWNER_KEY = 'owner-key'; process.env.GS_LEDGER_KEY = 'ledger-key';
  assert.equal(A.sessionSecret(), '', 'owner and ledger keys alone give no sessions');
  process.env.GST_WORKER_KEY = 'worker-key';
  const fromWorker = A.sessionSecret();
  assert.notEqual(fromWorker, '');
  process.env.GS_OWNER_KEY = 'a-different-owner-key';
  assert.equal(A.sessionSecret(), fromWorker, 'the owner key has no effect on it');
  process.env.GS_SESSION_SECRET = 'dedicated';
  assert.notEqual(A.sessionSecret(), fromWorker, 'a dedicated secret wins');
  for (const k of ['GS_SESSION_SECRET', 'GST_WORKER_KEY', 'GS_OWNER_KEY', 'GS_LEDGER_KEY']) { if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k]; }
});

test('each account has its own job index, apart from the site owner\'s', async () => {
  const { indexPrefix, indexPath } = await import('./store.js');
  assert.equal(indexPrefix(null), 'jobs-index/');
  assert.equal(indexPath({ id: 'job111' }), 'jobs-index/job111.json');
  assert.equal(indexPath({ id: 'job222', owner: 'acct01' }), 'account-index/acct01/job222.json');
  assert.notEqual(indexPrefix('acct01'), indexPrefix('acct02'));
  // An odd owner value can't reach outside its own folder.
  assert.equal(indexPrefix('../jobs-index'), 'jobs-index/');
});

test('a Garry can register with no invite while beta seats are open, and an invite still works when they are full', async () => {
  const keep = process.env.GS_BETA_SEATS;
  assert.equal(A.DEFAULT_BETA_SEATS, 25);
  assert.equal(A.seatOpen(24, 25), true);
  assert.equal(A.seatOpen(25, 25), false);
  delete process.env.GS_BETA_SEATS; assert.equal(A.betaSeats(), 25);
  process.env.GS_BETA_SEATS = 'lots'; assert.equal(A.betaSeats(), 25, 'an odd value falls back to the default');
  process.env.GS_BETA_SEATS = '0'; assert.equal(A.betaSeats(), 0);

  // Seats closed: no invite is refused with a reason the bot can act on, and nothing is created.
  const full = await A.registerGarry({ name: 'Pat' });
  assert.deepEqual([full.status, full.reason], [403, 'beta-full']);
  // An invite still works when the open seats are full.
  const invite = await A.createInvite('Pat');
  const viaInvite = await A.registerGarry({ invite, name: 'Pat' });
  made.push(`invites/${A.sha(invite)}.json`, `accounts/${viaInvite.account.id}.json`, `account-keys/${A.sha(viaInvite.key)}.json`);
  assert.equal(viaInvite.account.joined, 'invite');
  // A wrong invite is refused even when seats are open: it is never silently treated as "no invite".
  process.env.GS_BETA_SEATS = '1000';
  const wrong = await A.registerGarry({ invite: 'inv-0000000000000000', name: 'Pat' });
  assert.deepEqual([wrong.status, wrong.reason], [403, 'bad-invite']);
  // Seats open: no invite needed.
  const open = await A.registerGarry({ name: 'Pat' });
  made.push(`accounts/${open.account.id}.json`, `account-keys/${A.sha(open.key)}.json`);
  assert.match(open.key, /^garry_[a-f0-9]{48}$/);
  assert.equal(open.account.joined, 'open');
  assert.equal((await A.registerGarry({ name: '  ' })).status, 400);
  if (keep === undefined) delete process.env.GS_BETA_SEATS; else process.env.GS_BETA_SEATS = keep;
});

test('the beta cap holds under a burst of sign-ups, and an unreadable seat count refuses', async () => {
  // Oldest first. With 2 seats, only the first two accounts hold a seat, however many were written.
  const burst = [{ name: 'aaa111', at: 1 }, { name: 'bbb222', at: 2 }, { name: 'ccc333', at: 3 }, { name: 'ddd444', at: 3 }];
  assert.deepEqual(burst.map((a) => A.holdsSeat(burst, a.name, 2)), [true, true, false, false]);
  assert.equal(A.holdsSeat(burst, 'zzz999', 2), false, 'an account that is not in the list holds nothing');
  assert.equal(A.holdsSeat(null, 'aaa111', 2), false, 'a list that could not be read holds nothing');

  // Real run against local storage: five sign-ups at once with room for only the accounts already here plus two.
  const { kvList } = await import('./kv.js');
  const keep = process.env.GS_BETA_SEATS;
  const here = (await kvList('accounts/')).length;
  process.env.GS_BETA_SEATS = String(here + 2);
  const out = await Promise.all([1, 2, 3, 4, 5].map((i) => A.registerGarry({ name: `Burst${i}` })));
  const ok = out.filter((o) => o.account);
  for (const o of ok) made.push(`accounts/${o.account.id}.json`, `account-keys/${A.sha(o.key)}.json`);
  assert.ok(ok.length <= 2, `at most 2 seats, got ${ok.length}`);
  assert.equal((await kvList('accounts/')).length <= here + 2, true, 'no extra accounts are left behind');
  for (const o of out.filter((x) => !x.account)) assert.equal(o.reason, 'beta-full');
  if (keep === undefined) delete process.env.GS_BETA_SEATS; else process.env.GS_BETA_SEATS = keep;

  // A folder name that can't be read gives null, never an empty list.
  assert.equal(await kvList('../etc/'), null);
});
