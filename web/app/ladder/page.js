'use client';
import { useCallback, useEffect, useState } from 'react';
import Ladder from '@/components/Ladder';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// The same tab-only key the Ledger page uses, so one unlock covers both pages.
const KEY = 'gs_ledger_key';

export default function LadderPage() {
  const [key, setKey] = useState('');
  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(false);
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let stored = '';
    try { stored = sessionStorage.getItem(KEY) || ''; } catch (e) {}
    setKey(stored);
    setDraft(stored);
    setReady(true);
    // The one public number, shown before the ledger is unlocked.
    fetch('/api/bankroll', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setOpen).catch(() => {});
  }, []);

  const load = useCallback(async (k) => {
    setErr('');
    const res = await fetch('/api/ledger', { cache: 'no-store', headers: { 'x-ledger-key': k } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setDoc(null); setErr(res.status === 401 ? 'That key did not open the ledger.' : (data.error || 'Could not load the ledger.')); return; }
    setDoc(data);
  }, []);
  useEffect(() => { if (ready && key) load(key); }, [ready, key, load]);

  function unlock(e) {
    e.preventDefault();
    const next = draft.trim();
    try { sessionStorage.setItem(KEY, next); } catch (er) {}
    setKey(next);
  }
  function forget() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    setKey(''); setDraft(''); setDoc(null); setErr('');
  }

  return <main className="wrap py-10 md:py-16">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Bankroll ladder</h1>
        <p className="mt-2 max-w-2xl text-base">Every buy and sale in order, and what the bankroll was after each one. The max buy per flip is the bankroll you have now.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm"><a href="/dashboard">Deals</a></Button>
        <Button asChild variant="secondary" size="sm"><a href="/ledger">Ledger</a></Button>
        {key && <Button variant="ghost" size="sm" onClick={forget}>Forget key</Button>}
      </div>
    </div>

    {!doc && open && <p className="mb-4 text-base" data-field="public-bankroll">
      <b>Bankroll now: ${Number(open.bankroll).toFixed(2)}.</b> {open.source === 'ledger' ? 'Unlock to see each buy and sale behind that number.' : 'That is the starting number. Nothing in the ledger has changed it, or the ledger could not be read.'}
    </p>}

    {ready && !key && <Card className="max-w-md border-border p-6">
      <form onSubmit={unlock} className="grid gap-3">
        <label className="text-sm font-medium" htmlFor="ladder-key">Ledger key</label>
        <Input id="ladder-key" type="password" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Stays in this tab only" />
        <p className="text-xs text-muted-foreground">The buys and sales are private, so the steps need the same key as the Ledger page. It is kept for this tab only.</p>
        <Button type="submit" variant="brand">Unlock</Button>
      </form>
    </Card>}
    {err && <p role="status" className="mb-4 text-base font-medium text-red-800">{err}</p>}
    {key && !doc && !err && <p role="status" className="text-base">Loading the ledger…</p>}
    {doc && <Ladder doc={doc} />}
  </main>;
}
