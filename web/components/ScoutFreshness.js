'use client';
import { scoutFreshness } from '@/lib/ago';

export default function ScoutFreshness({ updatedAt, filtersSet }) {
  const fresh = scoutFreshness(updatedAt);
  return <div className="mb-4 space-y-2">
    <p className="text-sm text-muted-foreground">The scheduled scout is paused. This is stored data, not a live scan.</p>
    <p className="text-sm text-muted-foreground">{fresh.label ? `Stored feed updated ${fresh.label}` : 'No stored scout feed yet.'}</p>
    {filtersSet === false && <p className="text-sm font-medium">Filters not set</p>}
    {fresh.stale && <div role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">This stored feed is more than 2 hours old. Listings may already be gone.</div>}
  </div>;
}
