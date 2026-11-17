import { workerCheck, readLatest, json } from '../../../../lib/store.js';
import { surplusPlaces } from '../../../../lib/surplusStore.js';
import { drivesFor } from '../../../../lib/driveStore.js';
import { routingKey } from '../../../../lib/drive.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Looks up the drive time for every place in the stored surplus scan and listings that has none yet.
// Needs the worker key. This and the two write routes are the only callers that spend the routing key.
// Public pages read the cache and never call the routing service.
export async function POST(req) {
  const auth = workerCheck(req);
  if (!auth.ok) return json({ error: 'unauthorized', reason: auth.reason, hint: auth.hint }, 401);
  if (!routingKey()) return json({ error: 'no routing key', hint: 'Set ORS_API_KEY in the environment. See docs/SCOUT.md.' }, 503);
  const deals = await readLatest('deals/').catch(() => null);
  const places = [
    ...(await surplusPlaces().catch(() => [])),
    ...((deals && Array.isArray(deals.deals) ? deals.deals : []).filter((d) => d && typeof d.lat === 'number' && typeof d.lng === 'number').map((d) => ({ lat: d.lat, lng: d.lng }))),
  ];
  const found = await drivesFor(places, { max: 20 });
  const known = [...found.values()].filter(Boolean).length;
  return json({ places: found.size, known, unknown: found.size - known, note: found.size - known ? 'Call again for the rest. A place that could not be routed is tried again after a day.' : 'Every place has a drive time.' });
}
