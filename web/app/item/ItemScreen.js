'use client';
// One deal, in full: the long card the Market tiles link to. Read from the same daily feed.
import React, { useEffect, useState } from 'react';
import { cardFor } from '@/lib/dealCard';
import { dealCard } from '@/components/DealFeed';
import { tierOf, tileFor } from '@/lib/market';
import { speedText, TIER_LABEL } from '@/lib/tiers';
import TargetStar from '@/components/TargetStar';

export default function ItemScreen() {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    fetch('/api/feed', { cache: 'no-store', signal: AbortSignal.timeout(20000) })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((feed) => {
        const item = (feed.items || []).find((it) => it.id === id);
        setState({ item, id, now: Date.now() });
      })
      .catch(() => setState({ failed: true }));
  }, []);

  // Back to the Market with whatever filters were set there.
  const back = <a href={typeof document !== 'undefined' && document.referrer.startsWith(`${window.location.origin}/?`) ? document.referrer : '/'} className="text-sm font-medium underline underline-offset-4">Back to the Market</a>;
  if (state.loading) return <p role="status" className="text-base">Loading the deal…</p>;
  if (state.failed) return <div><p className="text-base font-semibold">Could not load the deals feed.</p><p className="mt-3">{back}</p></div>;
  if (!state.item) return <div><h1 className="text-2xl font-semibold">This deal is not in the feed</h1><p className="mt-2 text-base">It may have closed or been left off as too old. The page does not guess its numbers.</p><p className="mt-3">{back}</p></div>;
  const card = cardFor(state.item, state.now);
  return <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3">{back}<TargetStar tile={tileFor(state.item, card)} big /></div>{tierBox(state.item)}{dealCard(card)}</div>;
}

// The tier, how fast this kind of item sells, and what the auction page warns about. Each says where it came from.
function tierBox(item) {
  const t = tierOf(item);
  const sp = item.sell_speed;
  const watchers = item.price && typeof item.price.watchers === 'number' ? item.price.watchers : null;
  return <section className="mb-5 rounded-lg border-2 border-border bg-card p-4 text-sm leading-6" data-field="tier-box" data-tier={t}>
    <p><b>Tier {t === 'skip' ? 'Skip' : `${t}: ${TIER_LABEL[t]}`}.</b> {item.tier ? item.tier.why : 'This feed has no tier yet.'}</p>
    <p className="mt-1" data-field="speed"><b>{speedText(sp)}.</b> {sp && sp.evidence ? sp.evidence : 'No sell-speed evidence was posted with this deal.'}{sp && sp.active_competitors != null ? ` ${sp.active_competitors} competing listings seen.` : ''}</p>
    {watchers != null ? <p className="mt-1" data-field="watchers">{watchers} watching on the auction page.</p> : null}
    {item.caveats ? <p className="mt-1" data-field="caveats"><b>Caveats:</b> {item.caveats}</p> : null}
  </section>;
}
