import { sessionAccount } from '../../../lib/accounts';
import { wakeGarry } from '../../../lib/wake';
import { recentJobs, saveJob, uploadImage, addLog, fireWebhook, markPending, isTest, indexPending, newId, now, json } from '../../../lib/store';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function OPTIONS() {
  return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,x-worker-key' } });
}

export async function GET(req) {
  const u = new URL(req.url);
  if (u.searchParams.get('recent') !== '1') return json({ error: 'use ?recent=1' }, 400);
  const me = await sessionAccount(req);
  return json({ jobs: await recentJobs(15, me ? me.id : null), at: now() });
}

export async function POST(req) {
  const ct = req.headers.get('content-type') || '';
  const id = newId();
  const job = { id, created_at: now(), stage: 'received', logs: [], results: {} };
  const me = await sessionAccount(req);
  if (me) job.owner = me.id;
  let test = isTest(req);
  try {
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();
      test = test || isTest(req, form);
      if (form.get('batch_id')) job.batch_id = String(form.get('batch_id')).slice(0, 40);
      const file = form.get('image');
      if (!file || typeof file === 'string') return json({ error: "multipart field 'image' is required" }, 400);
      if (file.type && !file.type.startsWith('image/')) return json({ error: 'image must be an image file' }, 400);
      job.kind = 'sell';
      job.image_url = await uploadImage(id, file);
      addLog(job, 'Photo received and stored');
    } else {
      const body = await req.json().catch(() => null);
      if (!body || body.kind !== 'buy' || !String(body.query || '').trim())
        return json({ error: "send multipart 'image' for sell, or JSON {kind:'buy', query, max_price?}" }, 400);
      job.kind = 'buy';
      job.query = String(body.query).trim().slice(0, 200);
      test = test || body.test === 1 || body.test === '1' || body.test === true;
      const mp = Number(body.max_price);
      if (body.max_price !== undefined && body.max_price !== null && body.max_price !== '' && isFinite(mp)) job.max_price = mp;
      addLog(job, `Buy request received: "${job.query}"${job.max_price ? ` under $${job.max_price}` : ''}`);
    }
    if (test) {
      job.test = true;
      addLog(job, 'Test job: not queued for the worker');
      await saveJob(job);
      return json({ id, test: true });
    }
    markPending(job, 'created');
    await saveJob(job);
    const pendingKey = await indexPending(job, 'created');
    // The site owner's bot is woken by the owner webhook. An account's Garry is woken by the one it registered.
    if (!job.owner) await fireWebhook(job, 'created'); else await wakeGarry(job, 'created', null, pendingKey);
    return json({ id });
  } catch (e) {
    return json({ error: 'failed to create job', detail: String(e.message || e) }, 500);
  }
}
