'use client';
// "Buy 100 items for $10". Asks the site for a Stripe Checkout page and sends the person there.
// job: the item they were approving, so Stripe brings them back to it.
import { useState } from 'react';
import { PACK_ITEMS, PACK_PRICE } from '../lib/pack';

export default function BuyItems({ job, className = 'pill blue' }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function buy() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(job ? { job } : {}) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) { window.location.href = j.url; return; }
      setErr(j.error || 'Could not open the payment page.');
    } catch (e) { setErr('Could not open the payment page.'); }
    setBusy(false);
  }
  return <span data-field="buy-items">
    <button type="button" className={className} onClick={buy} disabled={busy}>{busy ? 'Opening...' : `Buy ${PACK_ITEMS} items for $${PACK_PRICE}`}</button>
    {err && <span role="alert" style={{ display: 'block', marginTop: 8, fontSize: 14, color: '#f87171' }}>{err}</span>}
  </span>;
}
