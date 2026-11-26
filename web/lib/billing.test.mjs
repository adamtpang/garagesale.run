import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

// No Blob token, so records land in web/.data/kv. The keys here are made up for the test.
delete process.env.BLOB_READ_WRITE_TOKEN;
process.env.GS_OWNER_KEY = 'test-owner-key-0123456789';
process.env.GST_WORKER_KEY = 'test-worker-key-0123456789';
const B = await import('./billing.js');
const A = await import('./accounts.js');
const I = await import('./items.js');

const SECRET = 'whsec_test_made_up_for_this_test';
const sign = (body, t, secret = SECRET) => `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
const NOW = 1800000000000;
const T = NOW / 1000;
const paidEvent = (over = {}, type = 'checkout.session.completed') => ({ type, data: { object: { id: 'cs_test_abc123', mode: 'payment', payment_status: 'paid', amount_total: 1000, currency: 'usd', metadata: { account: 'abc123def456' }, ...over } } });

test('payments are off until both Stripe keys are set', () => {
  const k = process.env.STRIPE_SECRET_KEY; const w = process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_WEBHOOK_SECRET;
  assert.equal(B.paymentsOn(), false);
  process.env.STRIPE_SECRET_KEY = 'x';
  assert.equal(B.paymentsOn(), false);
  process.env.STRIPE_WEBHOOK_SECRET = 'y';
  assert.equal(B.paymentsOn(), true);
  if (k === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = k;
  if (w === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = w;
});

test('the checkout is one pack at the server price, tied to the account', () => {
  const p = B.checkoutParams({ accountId: 'abc123def456', origin: 'https://garagesale.run', jobId: 'job000001' });
  assert.equal(p.get('mode'), 'payment');
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), '1000');
  assert.equal(p.get('line_items[0][price_data][currency]'), 'usd');
  assert.equal(p.get('line_items[0][quantity]'), '1');
  assert.equal(p.get('metadata[account]'), 'abc123def456');
  assert.equal(p.get('client_reference_id'), 'abc123def456');
  assert.equal(p.get('success_url'), 'https://garagesale.run/job/job000001?paid=1');
  assert.equal(p.get('cancel_url'), 'https://garagesale.run/job/job000001');
});

test('the return address is the item when there is one, and never something the browser made up', () => {
  assert.deepEqual(B.returnUrls('https://garagesale.run', undefined), { success_url: 'https://garagesale.run/connect?paid=1', cancel_url: 'https://garagesale.run/connect' });
  assert.equal(B.returnUrls('https://garagesale.run', '../../evil').success_url, 'https://garagesale.run/connect?paid=1');
  assert.equal(B.returnUrls('https://garagesale.run', 'https://evil.example').success_url, 'https://garagesale.run/connect?paid=1');
});

test('a Stripe message is believed only with a good, fresh signature', () => {
  const body = JSON.stringify(paidEvent());
  assert.equal(B.verifyStripeSignature(body, sign(body, T), SECRET, NOW), true);
  assert.equal(B.verifyStripeSignature(body + ' ', sign(body, T), SECRET, NOW), false, 'a changed body');
  assert.equal(B.verifyStripeSignature(body, sign(body, T, 'whsec_other'), SECRET, NOW), false, 'the wrong secret');
  assert.equal(B.verifyStripeSignature(body, sign(body, T - 301), SECRET, NOW), false, 'too old');
  assert.equal(B.verifyStripeSignature(body, sign(body, T - 200), SECRET, NOW), true, 'inside the window');
  assert.equal(B.verifyStripeSignature(body, `t=${T},v1=00`, SECRET, NOW), false);
  assert.equal(B.verifyStripeSignature(body, '', SECRET, NOW), false);
  assert.equal(B.verifyStripeSignature(body, null, SECRET, NOW), false);
  assert.equal(B.verifyStripeSignature(body, sign(body, T), '', NOW), false, 'no secret set');
  assert.equal(B.verifyStripeSignature(body, `${sign(body, T, 'whsec_old')},v1=${sign(body, T).split('v1=')[1]}`, SECRET, NOW), true, 'any one matching signature is enough');
});

test('only a completed, fully paid pack at the exact price adds items', () => {
  assert.deepEqual(B.packFromEvent(paidEvent()), { account: 'abc123def456', session: 'cs_test_abc123' });
  assert.deepEqual(B.packFromEvent(paidEvent({}, 'checkout.session.async_payment_succeeded')), { account: 'abc123def456', session: 'cs_test_abc123' });
  assert.equal(B.packFromEvent(paidEvent({ payment_status: 'unpaid' })), null);
  assert.equal(B.packFromEvent(paidEvent({ amount_total: 100 })), null, 'a smaller amount');
  assert.equal(B.packFromEvent(paidEvent({ amount_total: 2000 })), null, 'a different amount');
  assert.equal(B.packFromEvent(paidEvent({ currency: 'eur' })), null);
  assert.equal(B.packFromEvent(paidEvent({ mode: 'subscription' })), null);
  assert.equal(B.packFromEvent(paidEvent({ metadata: {} })), null);
  assert.equal(B.packFromEvent(paidEvent({ metadata: { account: '../etc' } })), null);
  assert.equal(B.packFromEvent(paidEvent({}, 'payment_intent.succeeded')), null);
  assert.equal(B.packFromEvent(null), null);
});

test('a paid checkout adds one pack, once, however many times Stripe says so', async () => {
  const inv = await A.createInvite('billing test');
  const out = await A.registerGarry({ invite: inv, name: 'Pat' });
  const id = out.account.id;
  assert.equal(await B.creditPack(id, 'cs_test_one'), 'credited');
  assert.equal(await B.creditPack(id, 'cs_test_one'), 'already');
  assert.equal((await I.itemUsage(id)).bought, 100);
  assert.equal(await B.creditPack(id, 'cs_test_two'), 'credited');
  assert.equal((await I.itemUsage(id)).bought, 200);
  // An account that can't be found is never quietly dropped: Stripe is asked to send the payment again.
  assert.equal(await B.creditPack('nosuchaccount1', 'cs_test_three'), 'unknown');
  assert.equal(await B.creditPack('../etc', 'cs_test_three'), 'unknown');
  assert.equal(await B.creditPack(id, ''), 'unknown');
});
