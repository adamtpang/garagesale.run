import { listPending, json } from '../../../lib/store';
import { botPrincipal } from '../../../lib/accounts';
export const dynamic = 'force-dynamic';
// The work waiting for the calling bot. The site owner's bot gets the owner's jobs. A Garry gets its account's.
export async function GET(req) {
  const who = await botPrincipal(req);
  if (!who) return json({ error: 'unauthorized' }, 401);
  const items = (await listPending()).filter((it) => (it.owner || null) === (who.account || null));
  items.sort((a, b) => (String(a.at) < String(b.at) ? -1 : 1));
  // waiting_seconds lets a bot leave fresh items to the run that was just woken for them.
  const nowMs = Date.now();
  return json(items.map(({ job_id, kind, event, key, payload, at }) => ({ job_id, kind, event, key, payload, waiting_seconds: Math.max(0, Math.round((nowMs - new Date(at).getTime()) / 1000)) })));
}
