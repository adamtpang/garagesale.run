'use client';
import { scoutFreshness } from '@/lib/ago';

export default function ScoutFreshness({ updatedAt, filtersSet }) {
  const fresh = scoutFreshness(updatedAt);
  return <div className="mb-4 space-y-2">
    <p className="text-sm text-muted-foreground">{fresh.label ? `Last scouted ${fresh.label}` : 'Last scouted —'}</p>
    {filtersSet === false && <p className="text-sm font-medium">Filters not set</p>}
    {fresh.stale && <div role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">This scout is more than 2 hours old. Listings may already be gone.</div>}
  </div>;
}
