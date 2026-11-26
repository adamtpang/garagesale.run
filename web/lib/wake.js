// Waking a Garry. Each account's Garry registers the webhook of its own worker routine. When that account
// queues work, the site POSTs to it, so the bot starts right away and never has to poll on a schedule.
// The webhook URL and key are secrets, so they are stored encrypted with a key only the server has.
import crypto from 'crypto';
import { kvGet, kvPut, kvDel } from './kv.js';

const secretBase = () => process.env.GS_SESSION_SECRET || process.env.GST_WORKER_KEY || '';
const aesKey = () => crypto.createHash('sha256').update(`gs-wake:${secretBase()}`).digest();
const ACCT = /^[a-z0-9]{6,40}$/i;

// ---- pure, tested in wake.test.mjs ----

// Only a public https address may be registered. This stops a key holder from pointing the server at
// its own network.
export function checkWebhookUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch (e) { return { error: 'url must be a full https address.' }; }
  if (u.protocol !== 'https:') return { error: 'url must start with https://.' };
  if (u.username || u.password) return { error: 'url must not contain a username or password.' };
  const h = u.hostname.toLowerCase();
  const privateName = h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.');
  const ipLiteral = /^\d+(\.\d+){3}$/.test(h) || h.includes(':') || h.startsWith('[');
  if (privateName || ipLiteral) return { error: 'url must be a public host name, not an IP address or a local name.' };
  if (u.toString().length > 600) return { error: 'url is too long.' };
  return { url: u.toString() };
}

export function seal(obj, key = aesKey()) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
}
export function unseal(box, key = aesKey()) {
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'));
    d.setAuthTag(Buffer.from(box.tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]).toString('utf8'));
  } catch (e) { return null; }
}

// ---- server state ----

export async function setWebhook(accountId, { url, key }) {
  if (!secretBase()) return { error: 'Webhooks are off: the server has no secret set.', status: 503 };
  const ok = checkWebhookUrl(url);
  if (ok.error) return { error: ok.error, status: 400 };
  const k = String(key || '').trim();
  if (!k || k.length > 400) return { error: 'key is required: the key shown in the routine\'s Webhook section.', status: 400 };
  await kvPut(`account-hooks/${accountId}.json`, { ...seal({ url: ok.url, key: k }), set_at: new Date().toISOString() });
  return { ok: true, host: new URL(ok.url).hostname };
}
export async function clearWebhook(accountId) { await kvDel(`account-hooks/${accountId}.json`); }
export async function webhookState(accountId) {
  const box = ACCT.test(String(accountId || '')) ? await kvGet(`account-hooks/${accountId}.json`) : null;
  const hook = box ? unseal(box) : null;
  return hook ? { set: true, host: new URL(hook.url).hostname, set_at: box.set_at } : { set: false };
}

// POSTs one event to the account's Garry. Never throws: a failed wake leaves the work in /api/pending.
// key: the queued item's own key. The bot sends it back to claim exactly this item.
export async function wakeGarry(job, event, payload, key = '') {
  const owner = job && job.owner;
  if (!owner || !ACCT.test(owner) || job.test) return { skipped: true };
  const box = await kvGet(`account-hooks/${owner}.json`);
  const hook = box ? unseal(box) : null;
  if (!hook) return { skipped: true };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 4000);
  try {
    const r = await fetch(hook.url, {
      method: 'POST', signal: ac.signal, redirect: 'error',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${hook.key}` },
      body: JSON.stringify({ job_id: job.id, kind: job.kind, event, key: key || '', payload: payload ?? null }),
    });
    return { ok: r.ok, status: r.status };
  } catch (e) { return { ok: false }; } finally { clearTimeout(t); }
}
