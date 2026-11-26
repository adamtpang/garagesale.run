// Accounts for Garage Sale. A person's Garry bot is their account:
//   1. The owner makes a one-time invite code.
//   2. Garry registers with that code and gets its own bot key (shown once, kept by the bot).
//   3. Garry asks for a sign-in link and gives it to its person. Opening it signs their browser in.
// Keys, invites and sign-in codes are stored only as hashes.
import crypto from 'crypto';
import { kvGet, kvPut, kvDel, kvCount } from './kv.js';

export const LOGIN_CODE_MINUTES = 10;
export const SESSION_DAYS = 30;
export const COOKIE = 'gs_session';

export const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const rand = (bytes) => crypto.randomBytes(bytes).toString('hex');
const now = () => new Date().toISOString();
const cleanName = (v) => String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);

// ---- pure rules, tested in accounts.test.mjs ----

// A job with no owner is the site owner's own (everything from before accounts). Otherwise it belongs to one account.
export const ownerOf = (job) => (job && job.owner) || null;

// May this bot work on this job? principal: { account } where account is null for the site owner's bot.
export const canWork = (job, principal) => !!principal && ownerOf(job) === (principal.account || null);

// May this browser approve, answer or send a reply on this job?
// An account's job needs that account's session. The site owner's jobs need the owner key.
export function canAct(job, { sessionAccount = null, ownerKeyOk = false } = {}) {
  const owner = ownerOf(job);
  return owner ? sessionAccount === owner : ownerKeyOk;
}

// Signed session value: "<account>.<expiry ms>.<hmac>". No server-side session store is needed.
export function signSession(accountId, expiresMs, secret) {
  const body = `${accountId}.${expiresMs}`;
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
}
export function readSession(value, secret, nowMs = Date.now()) {
  if (!value || !secret) return null;
  const parts = String(value).split('.');
  if (parts.length !== 3) return null;
  const [accountId, exp, mac] = parts;
  const want = crypto.createHmac('sha256', secret).update(`${accountId}.${exp}`).digest('hex');
  const a = Buffer.from(mac); const b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (!/^[a-z0-9]{6,40}$/i.test(accountId) || !(Number(exp) > nowMs)) return null;
  return accountId;
}
export const codeExpired = (record, nowMs = Date.now()) => !record || !(Date.parse(record.expires_at) > nowMs);

// ---- server state ----

// The session secret is GS_SESSION_SECRET, or else derived from the worker key, which only the server and the
// owner's bot hold. It is never derived from the owner key or the ledger key: those are typed into a browser,
// and whoever holds the session secret can sign in as any account.
export function sessionSecret() {
  const base = process.env.GS_SESSION_SECRET || process.env.GST_WORKER_KEY || '';
  return base ? sha(`gs-session:${base}`) : '';
}

export async function createInvite(note) {
  const code = `inv-${rand(8)}`;
  await kvPut(`invites/${sha(code)}.json`, { created_at: now(), note: cleanName(note) });
  return code;
}

// Registers a Garry bot. The invite is used up. The bot key is returned once and never stored in the clear.
// How many accounts may join without an invite while this is a beta. GS_BETA_SEATS overrides it; 0 closes
// open sign-up. An invite always works, even when the open seats are full.
export const DEFAULT_BETA_SEATS = 25;
export function betaSeats() {
  const n = Number(process.env.GS_BETA_SEATS);
  return process.env.GS_BETA_SEATS !== undefined && process.env.GS_BETA_SEATS !== '' && Number.isInteger(n) && n >= 0 ? n : DEFAULT_BETA_SEATS;
}
export const seatOpen = (accountsNow, seats) => accountsNow < seats;

export async function registerGarry({ invite, name }) {
  const person = cleanName(name);
  if (!person) return { error: 'name is required: the first name of the person this Garry works for.', status: 400 };
  const code = String(invite || '').trim();
  let inv = null;
  if (code) {
    // With an invite: the code must be good, and it is used up.
    const inviteKey = `invites/${sha(code)}.json`;
    inv = await kvGet(inviteKey);
    if (!inv) return { error: 'That invite code is not valid, or it was already used.', status: 403, reason: 'bad-invite' };
    await kvDel(inviteKey);
  } else if (!seatOpen(await kvCount('accounts/'), betaSeats())) {
    // Without one: open sign-up, while there are beta seats left.
    return { error: 'The Garage Sale beta is full right now. Ask Adam for an invite code, then register again with it.', status: 403, reason: 'beta-full' };
  }
  const account = { id: rand(6), name: person, created_at: now(), invite_note: inv ? (inv.note || '') : '', joined: inv ? 'invite' : 'open' };
  const key = `garry_${rand(24)}`;
  await kvPut(`accounts/${account.id}.json`, account);
  await kvPut(`account-keys/${sha(key)}.json`, { account_id: account.id, created_at: now() });
  return { account, key };
}

export async function getAccount(id) {
  return /^[a-z0-9]{6,40}$/i.test(String(id || '')) ? kvGet(`accounts/${id}.json`) : null;
}

export async function accountForKey(key) {
  if (!/^garry_[a-f0-9]{48}$/.test(String(key || ''))) return null;
  const rec = await kvGet(`account-keys/${sha(key)}.json`);
  return rec ? getAccount(rec.account_id) : null;
}

// A one-time code that signs one browser in. Good for a few minutes, and used up when opened.
export async function createLoginCode(accountId) {
  const code = rand(20);
  const expires_at = new Date(Date.now() + LOGIN_CODE_MINUTES * 60000).toISOString();
  await kvPut(`login-codes/${sha(code)}.json`, { account_id: accountId, expires_at });
  return { code, expires_at };
}
export async function redeemLoginCode(code) {
  if (!/^[a-f0-9]{40}$/.test(String(code || ''))) return null;
  const p = `login-codes/${sha(code)}.json`;
  const rec = await kvGet(p);
  if (!rec) return null;
  await kvDel(p);
  return codeExpired(rec) ? null : getAccount(rec.account_id);
}

// ---- request helpers ----

const bearer = (req) => { const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || ''); return m ? m[1].trim() : ''; };
const cookieOf = (req, name) => {
  for (const part of (req.headers.get('cookie') || '').split(';')) { const [k, ...v] = part.trim().split('='); if (k === name) return decodeURIComponent(v.join('=')); }
  return '';
};

// Who is calling a bot route. { account: null } is the site owner's bot (GST_WORKER_KEY). { account: id } is a Garry.
export async function botPrincipal(req) {
  const key = req.headers.get('x-garry-key') || req.headers.get('x-worker-key') || bearer(req);
  if (!key) return null;
  const owner = process.env.GST_WORKER_KEY || '';
  if (owner && key.length === owner.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(owner))) return { account: null, name: 'owner' };
  const acct = await accountForKey(key);
  return acct ? { account: acct.id, name: acct.name } : null;
}

// The signed-in account for a browser request, or null.
export async function sessionAccount(req) {
  const id = readSession(cookieOf(req, COOKIE), sessionSecret());
  return id ? getAccount(id) : null;
}

// Setting and clearing use the same attributes, so the browser treats them as the same cookie.
const cookieAttrs = () => `Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
export function sessionCookie(accountId) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  return `${COOKIE}=${encodeURIComponent(signSession(accountId, exp, sessionSecret()))}; ${cookieAttrs()}; Max-Age=${SESSION_DAYS * 86400}`;
}
export const clearCookie = () => `${COOKIE}=; ${cookieAttrs()}; Max-Age=0`;
