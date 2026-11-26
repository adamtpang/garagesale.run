'use client';
// The page a sign-in link from Garry opens. Nothing happens until the person presses the button, so a chat
// preview or a link scanner that only opens the link can't use the one-time code up.
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Enter({ params }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function signIn() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/enter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: params.code }) });
      if (r.ok) { window.location.replace('/connect?welcome=1'); return; }
      if (r.status === 410) { window.location.replace('/connect?link=expired'); return; }
      setErr('Could not sign you in. Try again.');
    } catch (e) { setErr('Could not sign you in. Check your connection and try again.'); }
    setBusy(false);
  }
  return <main className="wrap py-20 md:py-32">
    <Card className="mx-auto max-w-md border-border/60 p-8 text-center">
      <h1 className="!text-3xl !font-semibold !tracking-tight">Sign in to Garage Sale</h1>
      <p className="mt-3 text-muted-foreground">Your Garry sent you this link. It works once, on this browser.</p>
      <Button type="button" size="lg" className="mt-8 w-full" onClick={signIn} disabled={busy} data-action="sign-in">{busy ? 'Signing in...' : 'Sign in'}</Button>
      {err && <p role="alert" className="mt-4 text-sm text-red-400">{err}</p>}
      <p className="mt-6 text-xs text-muted-foreground">Didn't ask for this? Close the page. Nothing happens unless you press Sign in.</p>
    </Card>
  </main>;
}
