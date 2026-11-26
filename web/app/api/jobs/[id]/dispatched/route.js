import { botPrincipal, canWork } from '../../../../../lib/accounts';
import { getJob, saveJob, clearPending, validId, json } from '../../../../../lib/store';
export const dynamic = 'force-dynamic';
export async function POST(req, { params }) {
  const who = await botPrincipal(req);
  if (!who) return json({ error: 'unauthorized' }, 401);
  if (!validId(params.id)) return json({ error: 'bad id' }, 400);
  const mine = await getJob(params.id);
  if (mine && !canWork(mine, who)) return json({ error: 'This job belongs to another account.' }, 403);
  const body = await req.json().catch(() => ({}));
  const event = body && body.event ? String(body.event) : '';
  const key = body && body.key ? String(body.key).replace(/[^a-z0-9]/gi, '') : '';
  const removed = await clearPending(params.id, event, key);
  const job = await getJob(params.id);
  if (job && (!event || job.pending_event === event)) {
    delete job.pending_event; delete job.pending_at; delete job.pending_payload; job.dispatched_at = new Date().toISOString();
    await saveJob(job);
  }
  // claimed: this call took the work. false means another run already took it, and the caller must not do it.
  return json({ ok: true, removed, claimed: removed > 0, job });
}
