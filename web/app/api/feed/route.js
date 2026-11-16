import { readLatest, json } from '../../../lib/store.js';
import { readSurplus } from '../../../lib/surplusStore.js';
import { readConfig } from '../../../lib/scoutConfig.js';
import { buildDailyFeed } from '../../../lib/feed.js';

export const dynamic = 'force-dynamic';

// The daily deals feed: the stored surplus scan and the stored listings, in one shape, best first.
// Public and read-only. It scores everything again on each read, so today's rules always apply.
export async function GET() {
  try {
    const now = Date.now();
    const [surplus, deals, config] = await Promise.all([
      readSurplus(now),
      readLatest('deals/').catch(() => null),
      readConfig(),
    ]);
    return json(buildDailyFeed({ surplus, deals, config, nowMs: now }));
  } catch {
    return json({ error: 'feed unavailable' }, 500);
  }
}
