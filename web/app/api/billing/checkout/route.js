import { json } from '../../../../lib/store';
import { sessionAccount } from '../../../../lib/accounts';
import { paymentsOn, createCheckout } from '../../../../lib/billing';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Starts a Stripe Checkout for one pack of items, for the signed-in account. Returns { url } to send them to.
export async function POST(req) {
  const me = await sessionAccount(req);
  if (!me) return json({ error: 'Sign in first. Ask your Garry for a sign-in link.', reason: 'sign-in' }, 401);
  if (!paymentsOn()) return json({ error: "Paying isn't switched on yet.", reason: 'payments-off' }, 503);
  const body = await req.json().catch(() => ({}));
  const origin = new URL(req.url).origin;
  let url = null;
  try { url = await createCheckout({ accountId: me.id, origin, jobId: body && body.job }); } catch (e) { url = null; }
  if (!url) return json({ error: 'Could not open the payment page. Try again in a minute.', reason: 'stripe-error' }, 502);
  return json({ url });
}
