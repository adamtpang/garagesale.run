'use client';
// Targets: the deals Adam starred. Live ones show today's numbers; gone ones keep their last known
// numbers and say so. Stored in this browser only.
import React, { useEffect, useState } from 'react';
import { cardFor } from '@/lib/dealCard';
import { tileFor } from '@/lib/market';
import { readTargets, refreshTargets, targetRows, TARGETS_EVENT } from '@/lib/targets';
import { tile } from '@/components/Market';

export default function TargetsScreen() {
  const [live, setLive] = useState(null);
  const [failed, setFailed] = useState(false);
  const [targets, setTargets] = useState({});

  useEffect(() => {
    const sync = () => setTargets(readTargets());
    sync();
    window.addEventListener(TARGETS_EVENT, sync);
    window.addEventListener('storage', sync);
    fetch('/api/feed', { cache: 'no-store', signal: AbortSignal.timeout(20000) })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((feed) => {
        const now = Date.now();
        const tiles = (feed.items || []).map((it) => tileFor(it, cardFor(it, now)));
        setTargets(refreshTargets(tiles));
        setLive(tiles);
      })
      .catch(() => { setFailed(true); setLive([]); });
    return () => { window.removeEventListener(TARGETS_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  // Until the feed has loaded, live and gone can't be told apart, so no rows are drawn. If it failed, every
  // target shows its last known numbers and none is called gone.
  const rows = failed ? targetRows(targets, null) : live === null ? [] : targetRows(targets, live);
  return <section>
    <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Targets</h1>
    <p className="mt-2 max-w-2xl text-base">The deals you starred on the Market. They are kept in this browser only. A deal that closes stays here with its last known numbers.</p>
    {failed && <p role="status" className="mt-4 border-l-4 border-amber-400/80 bg-amber-500/10 text-amber-100 px-3 py-2 text-sm">Could not load the deals feed, so every target shows its last known numbers.</p>}
    {live === null && <p role="status" className="mt-6 text-base">Loading…</p>}
    {live !== null && rows.length === 0 && <p className="mt-6 rounded-lg border border-border bg-card p-6 text-base">No targets yet. Tap the star on a Market tile to add one.</p>}
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((t) => tile(t))}</div>
  </section>;
}
