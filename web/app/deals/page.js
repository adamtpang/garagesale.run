'use client';
import { useEffect, useState } from 'react';
import Photo from '../../components/Photo';
import ScoutFreshness from '../../components/ScoutFreshness';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const SRC = { fb: 'FB', craigslist: 'Craigslist', ebay: 'eBay', offerup: 'OfferUp' };
const $ = (v) => '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function DealsPage() {
  const [feed, setFeed] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch('/api/deals', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setFeed)
      .catch(() => { setFailed(true); setFeed({ deals: [], updated_at: null, filters_set: null }); });
  }, []);
  const deals = (feed && feed.deals) || [];
  return <main className="wrap py-16 md:py-24">
    <div className="mb-6 flex items-center justify-between gap-3">
      <h1 className="text-3xl font-semibold tracking-tight">Deals</h1>
      <Button asChild variant="secondary" size="sm"><a href="/dashboard">Dashboard</a></Button>
    </div>
    {feed && <ScoutFreshness updatedAt={feed.updated_at} filtersSet={feed.filters_set} />}
    {feed === null && <p className="text-sm text-muted-foreground">Loading...</p>}
    {failed && <p className="text-sm text-muted-foreground">Could not load the scout feed.</p>}
    {feed && !failed && deals.length === 0 && <Card className="border-border/60 p-8 text-center text-sm text-muted-foreground">No deals stored yet.</Card>}
    <div className="grid gap-3">{deals.map((d, i) => <Card key={d.url || i} className="flex gap-4 overflow-hidden border-border/60 p-3">
      <a className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>.phx]:h-full [&>.phx]:w-full" href={`/deal/feed/${i}`}><Photo src={d.photo_url} title={d.title || d.area || 'Deal'} /></a>
      <div className="min-w-0 flex-1 py-1 pr-1">
        <a href={`/deal/feed/${i}`} className="flex items-start justify-between gap-2">
          <span className="min-w-0"><span className="block truncate font-medium">{d.title || d.area || 'Deal'}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="font-normal">{SRC[d.source] || d.source}</Badge>
              {d.ranked ? <Badge variant="success" className="font-normal">#{d.rank}</Badge> : <Badge variant="secondary" className="font-normal">Unranked</Badge>}
              {d.area && <span className="text-xs text-muted-foreground">{d.area}{d.distance_mi != null ? ` · ${d.distance_mi} mi` : ''}</span>}
            </span></span>
        </a>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg bg-secondary px-2.5 py-1.5"><span className="text-muted-foreground">Ask </span><b className="font-medium">{d.ask == null ? '—' : $(d.ask)}</b></span>
          <span className="rounded-lg bg-secondary px-2.5 py-1.5"><span className="text-muted-foreground">Resale </span><b className="font-medium">{d.resale == null ? 'unknown' : $(d.resale)}</b></span>
          {d.profit != null && <Badge variant={d.profit < 0 ? 'destructive' : 'success'}>{d.profit >= 0 ? '+' : ''}{$(d.profit)}</Badge>}
          {d.url && <a className="underline-offset-4 hover:underline" href={d.url} target="_blank" rel="noopener">Listing</a>}
        </div>
        {(d.flags && d.flags.length > 0) && <p className="mt-2 text-xs text-muted-foreground">{d.flags.join(' · ')}</p>}
        {d.unranked_reason && <p className="mt-1 text-xs text-muted-foreground">{d.unranked_reason}</p>}
        {d.risk_note && <p className="mt-1 text-xs text-muted-foreground">{d.risk_note}</p>}
      </div>
    </Card>)}</div>
  </main>;
}
