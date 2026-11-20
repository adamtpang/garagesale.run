import { saveVersioned, readLatest, workerCheck, now, json, isDryRun, DRY_RUN_NOTE } from '../../../lib/store.js';
import { readConfig } from '../../../lib/scoutConfig.js';
import { buildFeed } from '../../../lib/deals.js';
import { keepPhotos } from '../../../lib/dealPhotos.js';
import { liveRules } from '../../../lib/bankroll.js';
import { drivesFor } from '../../../lib/driveStore.js';
import { put, head } from '@vercel/blob';

export const dynamic = 'force-dynamic';
// Copying up to 40 photos can take longer than the default limit.
export const maxDuration = 60;

export async function GET() {
  const feed = await readLatest('deals/').catch(() => null);
  return json(feed || { updated_at: null, filters_set: null, deals: [] });
}

export async function POST(req) {
  const auth = workerCheck(req);
  if (!auth.ok) return json({ error: 'unauthorized', reason: auth.reason, hint: auth.hint }, 401);
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.deals)) return json({ error: 'body must be {deals:[...], area?}' }, 400);
  const config = await readConfig(await liveRules());
  const built = buildFeed(body.deals, config);
  const area = typeof body.area === 'string' ? body.area.trim().slice(0, 80) : null;
  // A dry run returns the feed as it would be stored. No photos are copied and nothing is saved.
  if (isDryRun(req)) return json({ updated_at: null, area: area || null, test: !!body.test, filters_set: built.filters_set, photos_kept: null, deals: built.deals, dry_run: true, saved: false, note: DRY_RUN_NOTE });
  // Listing photo links expire within days. With Blob storage set, keep a copy so the feed still has photos later.
  let deals = built.deals;
  let photos = null;
  if (process.env.BLOB_READ_WRITE_TOKEN && !body.test) {
    const kept = await keepPhotos(deals, { fetch, put, head }).catch(() => null);
    if (kept) { deals = kept.deals; photos = { copied: kept.copied, tried: kept.tried }; }
  }
  const feed = { updated_at: now(), area: area || null, test: !!body.test, filters_set: built.filters_set, photos_kept: photos, deals };
  await saveVersioned('deals/', feed);
  // This call carries the worker key, so it may look up drive times for the new listings. The feed reads them from the cache.
  const places = deals.filter((d) => d && typeof d.lat === 'number' && typeof d.lng === 'number').map((d) => ({ lat: d.lat, lng: d.lng }));
  if (places.length) await drivesFor(places).catch(() => null);
  return json(feed);
}
