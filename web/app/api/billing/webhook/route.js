import { verifyStripeSignature, packFromEvent, creditPack } from '../../../../lib/billing';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

// Stripe calls this when a payment completes. Nothing is believed unless Stripe's signature checks out.
// A 2xx tells Stripe the event is handled. A 5xx asks it to send the event again later.
export async function POST(req) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return reply({ error: 'payments are not switched on' }, 503);
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get('stripe-signature'), secret)) return reply({ error: 'bad signature' }, 400);
  let event = null;
  try { event = JSON.parse(raw); } catch (e) { return reply({ error: 'bad body' }, 400); }
  const pack = packFromEvent(event);
  if (!pack) return reply({ received: true, credited: false });
  let out;
  try { out = await creditPack(pack.account, pack.session); } catch (e) { out = 'unknown'; }
  if (out === 'unknown') return reply({ error: 'could not record the payment yet' }, 503);
  return reply({ received: true, credited: out === 'credited', result: out });
}
