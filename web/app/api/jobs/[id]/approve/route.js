import { getJob, addLog, queue, json, ownerGate } from '../../../../../lib/store';
export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const job = await getJob(params.id);
  if (!job) return json({ error: 'not found' }, 404);
  // A test job is never queued for the worker, so it needs no key. A real one posts to Facebook.
  if (!job.test) { const stop = ownerGate(req); if (stop) return stop; }
  if (job.kind !== 'sell') return json({ error: 'only sell jobs can be approved' }, 400);
  if (job.stage !== 'awaiting_approval') return json({ error: `job is ${job.stage}, not awaiting_approval` }, 409);
  const body = await req.json().catch(() => ({}));
  const price = Number(body && body.price);
  job.stage = 'approved';
  if (body && body.price !== undefined && body.price !== '' && isFinite(price) && price >= 0) {
    job.approved_price = price;
    if (job.results && job.results.listing) job.results.listing.price = price;
  }
  const pk = body && body.pickup;
  if (pk && (pk.spot || pk.times)) job.pickup = { spot: String(pk.spot || '').slice(0, 200), times: String(pk.times || '').slice(0, 200) };
  addLog(job, `Approved by seller${job.approved_price !== undefined ? ` at $${job.approved_price}` : ''}${job.pickup ? `. Pickup: ${job.pickup.spot || 'flexible'}${job.pickup.times ? `, ${job.pickup.times}` : ''}` : ''}`, 'approved');
  await queue(job, 'approved', { price: job.approved_price ?? null, pickup: job.pickup || null });
  return json(job);
}
