// Paying for items with Stripe Checkout. The site never sees a card: it sends the person to Stripe's page,
// and Stripe tells the webhook when the payment is complete. Only that signed message adds items.
// STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET live in the host's settings and are never sent to a browser.
import crypto from 'crypto';
import { kvPut, kvList } from './kv.js';
import { getAccount, sha } from './accounts.js';
import { PACK_ITEMS, PACK_PRICE, packFolder, packName } from './items.js';

const ID = /^[a-z0-9]{6,40}$/i;
export const paymentsOn = () => !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
export const PACK_CENTS = PACK_PRICE * 100;

// Where Stripe sends the person afterwards: back to the item they were approving, or to their account page.
export function returnUrls(origin, jobId) {
  const back = ID.test(String(jobId || '')) ? `/job/${jobId}` : '/connect';
  return { success_url: `${origin}${back}?paid=1`, cancel_url: `${origin}${back}` };
}

// The form Stripe expects for one pack. The price is set here, on the server, never by the browser.
export function checkoutParams({ accountId, origin, jobId }) {
  const u = returnUrls(origin, jobId);
  const p = new URLSearchParams();
  p.set('mode', 'payment');
  p.set('client_reference_id', accountId);
  p.set('metadata[account]', accountId);
  p.set('metadata[items]', String(PACK_ITEMS));
  p.set('payment_intent_data[metadata][account]', accountId);
  p.set('line_items[0][quantity]', '1');
  p.set('line_items[0][price_data][currency]', 'usd');
  p.set('line_items[0][price_data][unit_amount]', String(PACK_CENTS));
  p.set('line_items[0][price_data][product_data][name]', `Garage Sale: ${PACK_ITEMS} items`);
  p.set('success_url', u.success_url);
  p.set('cancel_url', u.cancel_url);
  return p;
}

// Opens a Stripe Checkout page for one pack and returns its address.
export async function createCheckout({ accountId, origin, jobId }) {
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: checkoutParams({ accountId, origin, jobId }).toString(),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || typeof j.url !== 'string' || !j.url.startsWith('https://')) return null;
  return j.url;
}

// Stripe signs each webhook: the header carries a time and one or more signatures of "<time>.<body>".
// True only when one matches and the time is within the tolerance, so an old message can't be replayed.
export function verifyStripeSignature(rawBody, header, secret, nowMs = Date.now(), toleranceSec = 300) {
  if (!secret || typeof header !== 'string' || typeof rawBody !== 'string') return false;
  const parts = header.split(',').map((x) => x.trim().split('='));
  const t = (parts.find(([k]) => k === 't') || [])[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!/^\d{1,12}$/.test(String(t || '')) || !sigs.length) return false;
  if (Math.abs(nowMs / 1000 - Number(t)) > toleranceSec) return false;
  const want = Buffer.from(crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex'));
  return sigs.some((s) => { const got = Buffer.from(String(s)); return got.length === want.length && crypto.timingSafeEqual(got, want); });
}

// Which account a Stripe event pays for, or null when the event is not a completed, fully paid pack.
// The amount and currency must be exactly one pack: nothing else adds items.
export function packFromEvent(event) {
  if (!event || (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded')) return null;
  const s = event.data && event.data.object;
  if (!s || s.mode !== 'payment' || s.payment_status !== 'paid') return null;
  if (s.amount_total !== PACK_CENTS || String(s.currency).toLowerCase() !== 'usd') return null;
  const account = s.metadata && s.metadata.account;
  if (!ID.test(String(account || '')) || typeof s.id !== 'string' || !s.id) return null;
  return { account, session: s.id };
}

// Adds one pack to an account, once per Stripe checkout: Stripe may deliver the same event more than once.
// Returns 'credited', 'already', 'no-account', or 'unknown' when storage couldn't be read (Stripe retries).
export async function creditPack(accountId, sessionId) {
  if (!(await getAccount(accountId))) return 'no-account';
  const have = await kvList(packFolder(accountId));
  if (!have) return 'unknown';
  const hash = sha(sessionId).slice(0, 32);
  if (have.some((r) => r.name.startsWith(`${hash}q`))) return 'already';
  await kvPut(`${packFolder(accountId)}${packName(hash, PACK_ITEMS)}.json`, { at: new Date().toISOString(), items: PACK_ITEMS, cents: PACK_CENTS });
  return 'credited';
}
