'use client';
import { useEffect, useState } from 'react';
import Photo from './Photo';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUSES = ['saved', 'messaged', 'bought', 'resold'];
const TONE = { saved: 'secondary', messaged: 'brand', bought: 'warn', resold: 'success' };
const $ = (v) => (v === null || v === undefined || isNaN(Number(v)) ? '-' : '$' + Math.round(Number(v)).toLocaleString());

export default function SavedDeals() {
  const [deals, setDeals] = useState(null); const [err, setErr] = useState('');
  useEffect(() => {
    fetch('/api/saved', { cache: 'no-store', signal: AbortSignal.timeout(10000) }).then((r) => r.json()).then((j) => setDeals(j.deals || [])).catch(() => { setErr('Could not load saved deals.'); setDeals([]); });
  }, []);
  async function update(id, patch) {
    setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    try { const r = await fetch('/api/saved', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...patch }) }); if (!r.ok) throw new Error(); } catch (e) { setErr('Could not save that change.'); }
  }
  async function remove(id) {
    setDeals((ds) => ds.filter((d) => d.id !== id));
    try { await fetch(`/api/saved?id=${id}`, { method: 'DELETE' }); } catch (e) { setErr('Could not remove it.'); }
  }
  if (deals === null) return <Card className="border-border/60 p-8 text-center text-sm text-muted-foreground">Loading saved deals...</Card>;
  return <div className="grid gap-3">
    {err && <p className="text-sm text-red-400">{err}</p>}
    {deals.length === 0 && <Card className="border-border/60 p-8 text-center text-sm text-muted-foreground">No saved deals yet. <a href="/buy" className="text-foreground underline underline-offset-4">Find one</a> and press Save deal.</Card>}
    {deals.map((d) => <Card key={d.id} className="flex gap-4 overflow-hidden border-border/60 p-3" data-saved={d.id}>
      <a className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>.phx]:h-full [&>.phx]:w-full" href={d.fb_url} target="_blank" rel="noopener"><Photo src={d.photo_url} title={d.title} /></a>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2"><a href={d.fb_url} target="_blank" rel="noopener" className="block min-w-0 truncate font-medium hover:underline">{d.title}</a><Badge variant={TONE[d.status]} className="shrink-0 font-normal">{d.status}</Badge></div>
        <div className="mt-1 text-xs text-muted-foreground">{d.value ? `Worth about ${$(d.value)} (${d.confidence}, ${d.comps_n} comps)` : 'Not enough comps'}{d.listed ? ` · ${d.listed.replace(/ in .*/, '')}` : ''}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg bg-secondary px-2.5 py-1"><span className="text-muted-foreground">Ask </span><b className="font-medium tabular-nums">{$(d.ask)}</b></span>
          <label className="flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-0.5"><span className="text-muted-foreground">Target $</span><Input className="h-7 w-20 border-0 bg-transparent px-1" inputMode="decimal" defaultValue={d.target ?? ''} onBlur={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); if (v !== String(d.target ?? '')) update(d.id, { target: v }); }} aria-label={`Target price for ${d.title}`} /></label>
          <select className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground [color-scheme:dark]" value={d.status} onChange={(e) => update(d.id, { status: e.target.value })} aria-label={`Status for ${d.title}`}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          {d.status === 'bought' && <a className="text-xs underline underline-offset-4" href={`/ledger?${new URLSearchParams({ saved_deal_id: d.id, item: d.title || '', buy_price: d.ask == null ? '' : String(d.ask), source_link: d.fb_url || '' })}`}>Add this buy to the ledger</a>}
          <Button size="sm" variant="ghost" className={cn('ml-auto h-8 px-2 text-xs text-muted-foreground')} onClick={() => remove(d.id)}>Remove</Button>
        </div>
        {d.opener && <p className="mt-2 truncate text-xs text-muted-foreground">Draft: {d.opener}</p>}
      </div>
    </Card>)}
  </div>;
}
