import { readLatest, json } from '../../../lib/store.js';
import { readSurplus } from '../../../lib/surplusStore.js';
import { readConfig } from '../../../lib/scoutConfig.js';
import { buildDailyFeed } from '../../../lib/feed.js';
import { liveRules } from '../../../lib/bankroll.js';
import { cachedDrives } from '../../../lib/driveStore.js';
import { placeKey } from '../../../lib/drive.js';

export const dynamic = 'force-dynamic';

// The daily deals feed: the stored surplus scan and the stored listings, in one shape, best first.
// Public and read-only. It scores everything again on each read, so today's rules always apply.
export async function GET() {
  try {
    const now = Date.now();
    const rules = await liveRules();
    const [surplus, deals, config] = await Promise.all([
      readSurplus(now, rules),
      readLatest('deals/').catch(() => null),
      readConfig(rules),
    ]);
    // Each listing with coordinates gets its round-trip drive from the cache. This route is public, so it
    // never calls the routing service. A place not in the cache yet has an unknown drive.
    let withDrive = deals;
    if (deals && Array.isArray(deals.deals)) {
      const placeOf = (d) => (d && !d.drive && typeof d.lat === 'number' && typeof d.lng === 'number' ? { lat: d.lat, lng: d.lng } : null);
      const found = await cachedDrives(deals.deals.map(placeOf).filter(Boolean)).catch(() => new Map());
      withDrive = { ...deals, deals: deals.deals.map((d) => { const p = placeOf(d); const dr = p ? found.get(placeKey(p)) : null; return dr ? { ...d, drive: dr } : d; }) };
    }
    return json(buildDailyFeed({ surplus, deals: withDrive, config, nowMs: now, rules }));
  } catch {
    return json({ error: 'feed unavailable' }, 500);
  }
}
