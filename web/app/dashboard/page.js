'use client';
import { useEffect, useRef, useState } from 'react';
import Photo from '../../components/Photo';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
const $ = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? '-' : '$' + Math.round(Number(v)).toLocaleString());
const LABEL = { received: 'Received', identifying: 'Identifying', researching: 'Researching', writing: 'Writing', awaiting_approval: 'Needs approval', approved: 'Approved', posting: 'Posting', live: 'Live' };
function Tick({ value }) {
  const [v, setV] = useState(0); const cur = useRef(0);
  useEffect(() => {
    const from = cur.current, to = Number(value) || 0, t0 = performance.now(), dur = 900;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { cur.current = to; setV(to); return; }
    let raf; const step = (t) => { const k = Math.min(1, (t - t0) / dur); const x = from + (to - from) * (1 - Math.pow(1 - k, 3)); cur.current = x; setV(x); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{'$' + Math.round(v).toLocaleString()}</>;
}
function action(j) {
  if (j.question) return ['Answer a question', 'warn'];
  if (j.stage === 'awaiting_approval') return [`Approve at ${$(j.price)}`, 'go'];
  if (j.inquiries_drafted > 0) return ['Reply to buyer', 'go'];
  if (j.stage === 'live') return [`Live, ${j.inquiries || 0} message${j.inquiries === 1 ? '' : 's'}`, 'ok'];
  if (j.stage === 'approved' || j.stage === 'posting') return ['Posting now', 'ok'];
  return ['Agent working', 'dim'];
}
const num = (x) => (x === null || x === undefined || x === '' || isNaN(Number(x)) ? null : Number(x));
function srcName(x) { const s = String(x || '').toLowerCase(); if (s.includes('ebay')) return 'eBay'; if (s.includes('amazon')) return 'Amazon'; if (s.includes('facebook') || s.includes('marketplace')) return 'FB'; return x ? String(x).split(/[ (,]/)[0] : 'Resale'; }
function dealNums(d) {
  const comps = Array.isArray(d.comps) ? d.comps : [];
  const ask = num(d.ask_price ?? d.buy_price ?? d.price);
  const resell = num(d.resale_price ?? d.resell_price ?? d.est_market_price);
  const profit = num(d.est_profit) ?? (ask !== null && resell !== null ? Math.round((resell - ask) * 100) / 100 : null);
  let disc = num(d.discount_pct); if (disc !== null && disc > 0 && disc <= 1) disc *= 100;
  if (disc === null && ask !== null && resell) disc = (1 - ask / resell) * 100;
  const buyUrl = d.fb_url || d.source_url || d.link || d.url || null;
  const sellUrl = d.resale_url || d.resell_url || (comps[0] && comps[0].url) || null;
  const sellSrc = srcName(d.resale_source || d.resell_source || d.resell_platform || (comps[0] && comps[0].source));
  return { ask, resell, profit, disc, buyUrl, sellUrl, sellSrc };
}
export default function Dashboard() {
  const [jobs, setJobs] = useState(null); const [feed, setFeed] = useState(null);
  useEffect(() => {
    const load = async () => {
      try { const r = await fetch('/api/jobs?recent=1', { cache: 'no-store' }); const j = await r.json(); if (j.jobs) setJobs(j.jobs); } catch (e) {}
      try { const r = await fetch('/api/deals', { cache: 'no-store' }); setFeed(await r.json()); } catch (e) {}
    };
    load(); const t = setInterval(load, 30000); return () => clearInterval(t);
  }, []);
  const sells = (jobs || []).filter((j) => j.kind === 'sell');
  const buyJobs = (jobs || []).filter((j) => j.kind === 'buy');
  const deals = [
    ...((feed && feed.deals) || []).map((d, i) => ({ ...d, _src: 'Scout feed', _ex: !!(feed.test || d.example), _href: `/deal/feed/${i}` })),
    ...buyJobs.filter((b) => b.stage === 'done').flatMap((b) => (b.deals || []).map((d, i) => ({ ...d, _src: `For "${b.title}"`, _job: b.id, _href: `/deal/${b.id}/${i}` }))),
  ].map((d) => ({ ...d, _n: dealNums(d) })).filter((d) => d._n.profit !== null && d._n.profit > 0).sort((a, b) => (b._n.profit ?? -1e9) - (a._n.profit ?? -1e9));
  const sellTotal = sells.reduce((n, j) => n + (num(j.price) || 0), 0);
  const profitTotal = deals.filter((d) => !d._ex).reduce((n, d) => n + Math.max(0, dealNums(d).profit || 0), 0);
  const loading = jobs === null;
  const real = deals.filter((d) => !d._ex);
  const liveCount = sells.filter((j) => j.stage === 'live').length;
  const xp = sells.length * 20 + liveCount * 50 + real.length * 10 + Math.round(profitTotal / 10);
  const level = Math.floor(xp / 250) + 1, into = xp % 250;
  const tone = { warn: 'warn', go: 'brand', ok: 'success', dim: 'secondary' };
  return <main className="wrap py-16 md:py-24">
    <section className="text-center">
      <p className="text-sm font-medium text-muted-foreground">Money on the table</p>
      <div className="mt-3 text-6xl font-semibold tabular-nums tracking-tight md:text-8xl"><Tick value={sellTotal + profitTotal} /></div>
      <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-3">
        <Card className="border-border/60 p-5 text-left"><div className="text-xs text-muted-foreground">Your items</div><div className="mt-2 text-2xl font-semibold tabular-nums"><Tick value={sellTotal} /></div><div className="mt-1 text-xs text-muted-foreground">{sells.length} listing{sells.length === 1 ? '' : 's'}</div></Card>
        <Card className="border-border/60 p-5 text-left"><div className="text-xs text-muted-foreground">Deal profit</div><div className="mt-2 text-2xl font-semibold tabular-nums text-success"><Tick value={profitTotal} /></div><div className="mt-1 text-xs text-muted-foreground">{deals.length} deal{deals.length === 1 ? '' : 's'}</div></Card>
        <Card className="border-border/60 p-5 text-left"><div className="text-xs text-muted-foreground">Last scouted</div><div className="mt-2 text-2xl font-semibold">{feed && feed.updated_at ? new Date(feed.updated_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not yet'}</div><div className="mt-1 text-xs text-muted-foreground">Austin, TX</div></Card>
      </div>
    </section>
    <Card className="mt-6 flex flex-wrap items-center gap-6 border-border/60 p-6">
      <Avatar className="h-12 w-12"><AvatarFallback className="bg-brand text-lg font-semibold text-white">G</AvatarFallback></Avatar>
      <div className="min-w-[200px] flex-1"><div className="font-semibold">Austin flipper</div><div className="text-sm text-muted-foreground">Level {level} trader</div>
        <Progress value={(into / 250) * 100} className="mt-3 h-1.5" indicatorClassName="bg-brand" /><div className="mt-1.5 text-xs text-muted-foreground">{into} / 250 XP to level {level + 1}</div></div>
      <div className="flex gap-8 text-sm">
        <div><div className="text-xs text-muted-foreground">Spread found</div><div className="mt-1 text-lg font-semibold text-success">+<Tick value={profitTotal} /></div></div>
        <div><div className="text-xs text-muted-foreground">Buys scouted</div><div className="mt-1 text-lg font-semibold">{real.length}</div></div>
        <div><div className="text-xs text-muted-foreground">Sells listed</div><div className="mt-1 text-lg font-semibold">{sells.length} <span className="text-xs font-normal text-muted-foreground">{liveCount} live</span></div></div>
      </div>
    </Card>
    <div className="mt-16 grid gap-10 lg:grid-cols-2">
      <section className="min-w-0"><div className="mb-5 flex items-center justify-between"><h2 className="!text-3xl !font-semibold !tracking-tight">Sell</h2><Button asChild variant="brand" size="sm"><a href="/sell">+ Sell</a></Button></div>
        <Card className="overflow-hidden border-border/60">
          {loading && <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}
          {!loading && sells.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No items yet. <a href="/sell" className="text-foreground underline underline-offset-4">Snap one</a>.</div>}
          {sells.map((j, k) => { const [a, cls] = action(j); return <a key={j.id} href={`/job/${j.id}`} className={cn('flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/40', k > 0 && 'border-t border-border/60')}>
            {j.image_url ? <img src={j.image_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <i className="h-12 w-12 shrink-0 rounded-xl bg-secondary" />}
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{j.title || 'Identifying...'}</span>
              <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary" className="font-normal">{LABEL[j.stage] || j.stage}</Badge>{j.low !== null && j.high !== null ? `${$(j.low)}-${$(j.high)}` : ''}</span></span>
            <span className="flex shrink-0 flex-col items-end gap-1"><span className="font-semibold tabular-nums">{$(j.price)}</span><Badge variant={tone[cls]} className="font-normal">{a}</Badge></span></a>; })}
        </Card>
      </section>
      <section className="min-w-0"><div className="mb-5 flex items-center justify-between"><h2 className="!text-3xl !font-semibold !tracking-tight">Buy</h2><Button asChild variant="secondary" size="sm"><a href="/buy">Find deals</a></Button></div>
        {feed === null && <Card className="border-border/60 p-8 text-center text-sm text-muted-foreground">Loading...</Card>}
        {feed !== null && deals.length === 0 && <Card className="border-border/60 p-8 text-center text-sm text-muted-foreground">No deals yet.</Card>}
        <div className="grid gap-3">{deals.slice(0, 30).map((d, k) => { const n = d._n; const photo = d.photo_url || d.image_url || d.image; return <Card key={k} className="flex gap-4 overflow-hidden border-border/60 p-3">
          <a className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>.phx]:h-full [&>.phx]:w-full" href={d._href}><Photo src={photo} title={d.title} fb={(d.fb_url || d.source_url || d.link || d.url)} /></a>
          <div className="flex min-w-0 flex-1 flex-col justify-between py-1 pr-1">
            <a href={d._href} className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block truncate font-medium">{d.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5"><Badge variant="secondary" className="max-w-[180px] truncate font-normal">{d._ex ? 'Example' : d._src}</Badge>{n.disc !== null && isFinite(n.disc) ? <span className="text-xs text-muted-foreground">{Math.round(n.disc)}% under</span> : null}</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></a>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <a className="rounded-lg bg-secondary px-2.5 py-1.5 hover:bg-accent" href={n.buyUrl || undefined} target="_blank" rel="noopener"><span className="text-muted-foreground">Buy </span><b className="font-medium">FB {$(n.ask)}</b></a>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <a className="truncate rounded-lg bg-secondary px-2.5 py-1.5 hover:bg-accent" href={n.sellUrl || undefined} target="_blank" rel="noopener"><span className="text-muted-foreground">Sell </span><b className="font-medium">{n.resell !== null ? `${n.sellSrc} ${$(n.resell)}` : 'Check comps'}</b></a>
              <span className="ml-auto shrink-0">{n.profit !== null ? <Badge variant={n.profit < 0 ? 'destructive' : 'success'} className="text-sm">{n.profit >= 0 ? '+' : ''}{$(n.profit)}{n.ask ? <span className="ml-1 text-xs opacity-70">{Math.round((n.profit / n.ask) * 100)}%</span> : null}</Badge> : <Badge variant="secondary">?</Badge>}</span>
            </div></div></Card>; })}</div>
      </section>
    </div>
    <section className="mt-24 text-center"><h2 className="!text-3xl !font-semibold !tracking-tight md:!text-5xl">How to flip IRL</h2>
      <div className="mx-auto mt-10 grid max-w-3xl gap-3 md:grid-cols-3">
        {[['1', 'Message the seller'], ['2', 'Pick it up'], ['3', <a key="a" href="/sell" className="underline-offset-4 hover:underline">Snap it to resell</a>]].map(([n, t]) => <Card key={n} className="border-border/60 p-6 text-left"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm">{n}</div><div className="mt-5 font-medium">{t}</div></Card>)}
      </div></section>
  </main>;
}
