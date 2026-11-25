'use client';
import { useEffect, useState } from 'react';
import Photo from './Photo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
const $ = (v) => '$' + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
export default function ModeFeed({ mode }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        if (mode === 'sell') {
          const r = await (await fetch('/api/jobs?recent=1', { cache: 'no-store' })).json();
          setItems((r.jobs || []).filter((j) => j.kind === 'sell' && !j.test && j.stage === 'live').slice(0, 8).map((j) => ({ key: j.id, href: `/job/${j.id}`, photo: j.image_url, title: j.title, top: $(j.price), sub: 'Live' })));
        } else {
          const f = await (await fetch('/api/deals', { cache: 'no-store' })).json();
          const ds = ((f && f.deals) || []).map((d, i) => { const a = Number(d.ask_price ?? d.buy_price ?? d.price); const r = Number(d.resale_price ?? d.resell_price ?? d.est_market_price); const p = d.est_profit !== undefined && d.est_profit !== null && d.est_profit !== '' ? Number(d.est_profit) : r - a; return { d, i, a, p }; })
            .filter((x) => !x.d.example && isFinite(x.p) && x.p > 0).sort((x, y) => y.p - x.p).slice(0, 8);
          setItems(ds.map(({ d, i, a, p }) => ({ key: i, href: `/deal/feed/${i}`, photo: d.photo_url || d.image_url || d.image, fb: d.fb_url || d.source_url || d.link || d.url, title: d.title, top: $(a), sub: `+${$(p)} profit` })));
        }
      } catch (e) { setItems([]); }
    })();
  }, [mode]);
  return <section className="pb-8 pt-8"><div className="wrap">
    <div className="mb-6 flex items-center justify-between"><h2 className="!text-3xl !font-semibold !tracking-tight">{mode === 'sell' ? 'Live now' : 'Top flips'}</h2><Button asChild variant="secondary" size="sm"><a href="/dashboard">Dashboard</a></Button></div>
    {items === null ? <p className="text-muted-foreground">Loading...</p> : items.length === 0 ? <p className="text-muted-foreground">{mode === 'sell' ? 'No live listings yet.' : 'No flips found yet.'}</p> :
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{items.map((x) => <a key={x.key} href={x.href} className="group">
        <Card className="overflow-hidden border-border/60 transition-colors group-hover:border-muted-foreground/40">
          <span className="block aspect-square overflow-hidden bg-secondary [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>img]:transition-transform [&>img]:duration-500 group-hover:[&>img]:scale-[1.03]"><Photo src={x.photo} title={x.title} fb={x.fb} /></span>
          <span className="block p-4"><b className="block text-lg font-semibold">{x.top}</b><span className="block truncate text-sm text-muted-foreground">{x.title}</span><small className={'mt-1 block text-xs ' + (mode === 'sell' ? 'text-success' : 'text-success')}>{x.sub}</small></span>
        </Card></a>)}</div>}
  </div></section>;
}
