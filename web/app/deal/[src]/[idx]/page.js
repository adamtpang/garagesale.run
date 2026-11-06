'use client';
import { useEffect, useState } from 'react';
import Photo from '../../../../components/Photo';
import { DealCard } from '../../../../components/DealFacts';
import { assessDeal } from '../../../../lib/decision';

export default function Deal({ params }) {
  const { src, idx } = params;
  const [d, setD] = useState(undefined);
  const [config, setConfig] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const configRes = await fetch('/api/scout/config', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        const cfg = configRes.ok ? await configRes.json() : {};
        if (src === 'feed') {
          const res = await fetch('/api/deals', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
          if (!res.ok) throw new Error(String(res.status));
          const feed = await res.json();
          if (!dead) { setConfig(cfg); setD(((feed && feed.deals) || [])[Number(idx)] || null); }
        } else {
          const res = await fetch(`/api/jobs/${encodeURIComponent(src)}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
          if (!res.ok) throw new Error(String(res.status));
          const job = await res.json();
          const deals = (job && job.results && job.results.deals) || (job && job.deals) || [];
          if (!dead) { setConfig(cfg); setD(deals[Number(idx)] || null); }
        }
      } catch (e) {
        if (!dead) { setFailed(true); setD(null); }
      }
    })();
    return () => { dead = true; };
  }, [src, idx]);
  if (d === undefined) return <main className="wrap py-16"><p className="text-sm text-muted-foreground">Loading deal…</p></main>;
  if (failed) return <main className="wrap py-16"><h1 className="text-3xl font-semibold">Could not load this deal.</h1><p className="mt-3 text-sm text-muted-foreground">The page did not invent a price.</p><p className="mt-4"><a href="/dashboard" className="underline">Back to dashboard</a></p></main>;
  if (!d) return <main className="wrap py-16"><h1 className="text-3xl font-semibold">Deal not found</h1><p className="mt-4"><a href="/dashboard" className="underline">Back to dashboard</a></p></main>;
  const view = assessDeal(d, config || {});
  const photo = d.photo_url || d.image_url || d.image;
  return <main className="wrap max-w-3xl py-10 md:py-16">
    <p className="mb-4 text-sm text-muted-foreground"><a href="/dashboard" className="text-[#8eb7ff]">Dashboard</a> · {src === 'feed' ? 'Stored scout feed' : 'Buy search result'}</p>
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      <Photo src={photo} title={view.title} fb={d.fb_url || d.url} />
    </div>
    <div className="mt-4">
      <DealCard view={view} stacked />
    </div>
    <section className="mt-6 rounded-2xl border border-white/10 bg-[#141416] p-5">
      <h2 className="text-lg font-semibold">If you decide to pick it up</h2>
      <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
        <p><b className="text-foreground">1. Open the listing yourself.</b> Garage Sale does not message the seller.</p>
        <p><b className="text-foreground">2. Check the item in person.</b> The net above is an estimate, not a payout.</p>
        <p><b className="text-foreground">3. Selling it later is a separate approval.</b> Snap it on <a href="/sell" className="text-[#8eb7ff] underline">Sell</a>. Nothing is posted until you approve it.</p>
      </div>
    </section>
  </main>;
}
