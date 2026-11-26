import { botPrincipal, canWork } from '../../../../../lib/accounts';
import { getJob, finishClaim, validId, json } from '../../../../../lib/store';
export const dynamic = 'force-dynamic';
// A Garry reports that a claimed item is finished, so it stops counting as in progress.
export async function POST(req, { params }) {
  const who = await botPrincipal(req);
  if (!who) return json({ error: 'unauthorized' }, 401);
  if (!validId(params.id)) return json({ error: 'bad id' }, 400);
  const job = await getJob(params.id);
  if (job && !canWork(job, who)) return json({ error: 'This job belongs to another account.' }, 403);
  const body = await req.json().catch(() => ({}));
  const event = body && body.event ? String(body.event) : '';
  const key = body && body.key ? String(body.key).replace(/[^a-z0-9]/gi, '') : '';
  // A Garry finishes one item by its key. The site owner's bot may finish by event, as its relay has no keys.
  if (who.account ? !key : (!event && !key)) return json({ error: 'key is required: the key you claimed with.' }, 400);
  return json({ ok: true, finished: await finishClaim(params.id, event, key) });
}
