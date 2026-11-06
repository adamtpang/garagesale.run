'use client';
import { useEffect, useState } from 'react';
import DealBoard from '@/components/DealBoard';
import Photo from '@/components/Photo';
import SavedDeals from '@/components/SavedDeals';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const LABEL = { received: 'Received', identifying: 'Identifying', researching: 'Researching', writing: 'Writing', awaiting_approval: 'Needs approval', approved: 'Approved', posting: 'Posting', live: 'Live' };
const money = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? 'unknown' : `$${Math.round(Number(v)).toLocaleString()}`);

export default function Dashboard() {
  const [jobs, setJobs] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch('/api/jobs?recent=1', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((j) => setJobs(j.jobs || []))
      .catch(() => { setFailed(true); setJobs([]); });
  }, []);
  const sells = (jobs || []).filter((j) => j.kind === 'sell');
  return <main className="wrap py-10 md:py-16">
    <DealBoard />
    <section className="mt-16">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Your listings</h2>
        <Button asChild variant="brand" size="sm"><a href="/sell">Sell</a></Button>
      </div>
      <Card className="overflow-hidden border-border/60">
        {jobs === null && <div className="p-8 text-center text-sm text-muted-foreground">Loading listings…</div>}
        {failed && <div className="p-8 text-center text-sm text-muted-foreground">Could not load listings.</div>}
        {jobs && !failed && sells.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No listings yet. <a href="/sell" className="underline underline-offset-4">Snap one</a> when you have something to sell.</div>}
        {sells.map((j, k) => <a key={j.id} href={`/job/${j.id}`} className={`flex items-center gap-4 px-5 py-4 hover:bg-accent/40 ${k ? 'border-t border-border/60' : ''}`}>
          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-secondary [&>img]:h-full [&>img]:w-full [&>img]:object-cover"><Photo src={j.image_url} title={j.title || 'Listing'} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{j.title || 'Identifying…'}</span>
            <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary" className="font-normal">{LABEL[j.stage] || j.stage}</Badge></span>
          </span>
          <span className="font-semibold tabular-nums">{money(j.price)}</span>
        </a>)}
      </Card>
    </section>
    <details className="mt-10 rounded-2xl border border-white/10 bg-[#141416] p-4">
      <summary className="cursor-pointer text-sm font-medium">Saved deals</summary>
      <div className="mt-4"><SavedDeals /></div>
    </details>
  </main>;
}
