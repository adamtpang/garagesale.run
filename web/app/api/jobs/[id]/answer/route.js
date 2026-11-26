import { canAct, ownerOf, sessionAccount } from '../../../../../lib/accounts';
import { getJob, addLog, queue, json } from '../../../../../lib/store';
export const dynamic = 'force-dynamic';
export async function POST(req, { params }) {
  const job = await getJob(params.id);
  if (!job) return json({ error: 'not found' }, 404);
  // An account's job can only be answered by that account. The site owner's jobs stay open, as before.
  if (ownerOf(job)) { const me = await sessionAccount(req); if (!canAct(job, { sessionAccount: me && me.id })) return json({ error: 'Sign in as the account this item belongs to.', reason: 'not-your-job' }, 403); }
  const body = await req.json().catch(() => ({}));
  const answer = String((body && body.answer) || '').trim().slice(0, 1000);
  if (!answer) return json({ error: 'answer required' }, 400);
  const field = (job.question && job.question.field) || (body && body.field) || '';
  const question = job.question ? job.question.message : '';
  job.answers = job.answers || [];
  job.answers.push({ field, question, answer, ts: new Date().toISOString() });
  job.question = null;
  addLog(job, `Seller answered${field ? ` (${field})` : ''}: ${answer}`);
  await queue(job, 'answered', { field, question, answer });
  return json(job);
}
