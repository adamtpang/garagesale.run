import { getJob, saveJob, addLog, json } from '../../../../../lib/store';
export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const key = process.env.GST_WORKER_KEY;
  if (!key || req.headers.get('x-worker-key') !== key) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  if (!body || !body.type) return json({ error: 'body must have type log|stage|result' }, 400);
  const job = await getJob(params.id);
  if (!job) return json({ error: 'not found' }, 404);
  if (body.type === 'log') {
    if (body.stage) job.stage = String(body.stage);
    addLog(job, body.message ?? '', body.stage || job.stage, 'worker');
  } else if (body.type === 'stage') {
    if (!body.stage) return json({ error: 'stage required' }, 400);
    job.stage = String(body.stage);
    addLog(job, `Stage: ${job.stage}`, job.stage, 'worker');
  } else if (body.type === 'result') {
    const { type, ...fields } = body;
    job.results = { ...(job.results || {}), ...fields };
    if (fields.listing_url) job.listing_url = fields.listing_url;
    addLog(job, `Result: ${Object.keys(fields).join(', ') || 'empty'}`, job.stage, 'worker');
  } else if (body.type === 'question') {
    if (!body.message) return json({ error: 'message required' }, 400);
    job.question = { message: String(body.message).slice(0, 500), field: body.field ? String(body.field).slice(0, 60) : '', ts: new Date().toISOString() };
    addLog(job, `Question for seller: ${job.question.message}`, job.stage, 'worker');
  } else if (body.type === 'inquiry') {
    if (!body.id) return json({ error: 'id required' }, 400);
    job.inquiries = job.inquiries || [];
    const iid = String(body.id).slice(0, 60);
    const ex = job.inquiries.find((q) => q.id === iid);
    const rec = { id: iid, buyer_name: String(body.buyer_name || 'Buyer').slice(0, 80), message: String(body.message || '').slice(0, 2000), draft_reply: String(body.draft_reply || '').slice(0, 2000), status: body.status === 'new' ? 'new' : 'drafted', ts: new Date().toISOString() };
    if (body.intent) rec.intent = String(body.intent).slice(0, 80);
    if (body.offer_price !== undefined && body.offer_price !== null && body.offer_price !== '' && isFinite(Number(body.offer_price))) rec.offer_price = Number(body.offer_price);
    if (body.pickup_time) rec.pickup_time = String(body.pickup_time).slice(0, 120);
    if (body.pickup_place) rec.pickup_place = String(body.pickup_place).slice(0, 160);
    if (body.deal_stage) rec.deal_stage = String(body.deal_stage).slice(0, 40);
    if (ex) Object.assign(ex, rec); else job.inquiries.push(rec);
    addLog(job, `Buyer message from ${rec.buyer_name}${rec.status === 'new' ? '' : '; reply drafted'}`, job.stage, 'worker');
  } else if (body.type === 'inquiry_sent') {
    const q = (job.inquiries || []).find((x) => x.id === String(body.id));
    if (!q) return json({ error: 'unknown inquiry' }, 404);
    q.status = 'sent'; q.sent_at = new Date().toISOString();
    addLog(job, `Reply sent to ${q.buyer_name}`, job.stage, 'worker');
  } else {
    return json({ error: 'unknown type' }, 400);
  }
  await saveJob(job);
  return json(job);
}
