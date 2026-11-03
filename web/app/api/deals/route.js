import { saveVersioned, readLatest, workerOk, now, json } from '../../../lib/store.js';
import { readConfig } from '../../../lib/scoutConfig.js';
import { buildFeed } from '../../../lib/deals.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const feed = await readLatest('deals/').catch(() => null);
  return json(feed || { updated_at: null, filters_set: null, deals: [] });
}

export async function POST(req) {
  if (!workerOk(req)) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.deals)) return json({ error: 'body must be {deals:[...], area?}' }, 400);
  const config = await readConfig();
  const built = buildFeed(body.deals, config);
  const area = typeof body.area === 'string' ? body.area.trim().slice(0, 80) : null;
  const feed = { updated_at: now(), area: area || null, test: !!body.test, filters_set: built.filters_set, deals: built.deals };
  await saveVersioned('deals/', feed);
  return json(feed);
}
