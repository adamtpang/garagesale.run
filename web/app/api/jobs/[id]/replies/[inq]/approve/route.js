import { canAct, ownerOf, sessionAccount } from '../../../../../../../lib/accounts';
import { getJob, addLog, queue, json, ownerGate } from '../../../../../../../lib/store';
export const dynamic = 'force-dynamic';
export async function POST(req, { params }) {
  const job = await getJob(params.id);
  if (!job) return json({ error: 'not found' }, 404);
  // An account's job needs that account signed in. The site owner's own jobs need the owner key.
  if (!job.test) {
    if (ownerOf(job)) { const me = await sessionAccount(req); if (!canAct(job, { sessionAccount: me && me.id })) return json({ error: 'Sign in as the account this item belongs to. Ask your Garry for a sign-in link.', reason: 'not-your-job' }, 403); }
    else { const stop = ownerGate(req); if (stop) return stop; }
  }
  const q = (job.inquiries || []).find((x) => x.id === params.inq);
  if (!q) return json({ error: 'unknown inquiry' }, 404);
  if (q.status !== 'drafted') return json({ error: `reply is ${q.status}` }, 409);
  const body = await req.json().catch(() => ({}));
  const text = String((body && body.text) || q.draft_reply || '').trim().slice(0, 2000);
  if (!text) return json({ error: 'text required' }, 400);
  q.approved_text = text; q.status = 'sending'; q.approved_at = new Date().toISOString();
  addLog(job, `Seller approved reply to ${q.buyer_name}`);
  await queue(job, 'reply_approved', { inquiry_id: q.id, text });
  return json(job);
}
