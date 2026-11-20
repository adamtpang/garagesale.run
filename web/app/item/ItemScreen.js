'use client';
// One deal, in full: the long card the Market tiles link to. Read from the same daily feed.
import React, { useEffect, useState } from 'react';
import { cardFor } from '@/lib/dealCard';
import { dealCard } from '@/components/DealFeed';

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
  return <div><p className="mb-4">{back}</p>{dealCard(cardFor(state.item, state.now))}</div>;
}
