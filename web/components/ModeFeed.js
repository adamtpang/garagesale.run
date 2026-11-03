'use client';
import { useEffect, useState } from 'react';
import Photo from './Photo';
import ScoutFreshness from './ScoutFreshness';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
const $ = (v) => '$' + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
// Never spin forever: give up after 10 seconds and say so.
const getJson = (url) => fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
export default function ModeFeed({ mode }) {
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(false);
  const [feed, setFeed] = useState(null);
  useEffect(() => {
    const load = async () => {
      try {
        if (mode === 'sell') {
          const r = await getJson('/api/jobs?recent=1');
          setItems((r.jobs || []).filter((j) => j.kind === 'sell' && !j.test && j.stage === 'live').slice(0, 8).map((j) => ({ key: j.id, href: `/job/${j.id}`, photo: j.image_url, title: j.title, top: $(j.price), sub: 'Live' })));
        } else {
          const [r, f] = await Promise.all([getJson('/api/saved'), getJson('/api/deals').catch(() => null)]);
          setFeed(f);
          // Top flips are the deals you saved, best discount first.
          const ds = (r.deals || []).filter((d) => d.status === 'saved' || d.status === 'messaged').sort((a, b) => (b.discount ?? -999) - (a.discount ?? -999)).slice(0, 8);
          setItems(ds.map((d) => ({ key: d.id, href: d.fb_url, ext: true, photo: d.photo_url, title: d.title, top: $(d.ask), sub: d.value ? `${d.discount >= 0 ? `${d.discount}% under` : `${-d.discount}% over`} · target ${$(d.target)}` : `Not enough comps · target ${$(d.target)}` })));
        }
      } catch (e) { setFailed(true); setItems([]); }
    };
    load();
    // Refresh right after a deal is saved on the same page.
    window.addEventListener('gs-saved', load);
    return () => window.removeEventListener('gs-saved', load);
  }, [mode]);
  const empty = failed ? (mode === 'sell' ? 'Could not load listings right now.' : 'Could not load saved deals right now.') : mode === 'sell' ? 'No live listings yet.' : 'No saved deals yet. Search above and save the ones worth chasing.';
  return <section className="pb-8 pt-8"><div className="wrap">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="!text-3xl !font-semibold !tracking-tight">{mode === 'sell' ? 'Live now' : 'Top flips'}</h2><span className="flex flex-wrap gap-2"><Button asChild variant="secondary" size="sm"><a href="/deals">Deals</a></Button><Button asChild variant="secondary" size="sm"><a href="/dashboard">Dashboard</a></Button></span></div>
    {mode === 'buy' && <ScoutFreshness updatedAt={feed && feed.updated_at} filtersSet={feed && feed.filters_set} />}
    {items === null ? <p className="text-muted-foreground">Loading...</p> : items.length === 0 ? <p className="text-muted-foreground">{empty}</p> :
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{items.map((x) => <a key={x.key} href={x.href} target={x.ext ? '_blank' : undefined} rel="noopener" className="group">
        <Card className="overflow-hidden border-border/60 transition-colors group-hover:border-muted-foreground/40">
          <span className="block aspect-square overflow-hidden bg-secondary [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>img]:transition-transform [&>img]:duration-500 group-hover:[&>img]:scale-[1.03]"><Photo src={x.photo} title={x.title} fb={x.fb} /></span>
          <span className="block p-4"><b className="block text-lg font-semibold">{x.top}</b><span className="block truncate text-sm text-muted-foreground">{x.title}</span><small className="mt-1 block text-xs text-success">{x.sub}</small></span>
        </Card></a>)}</div>}
  </div></section>;
}
