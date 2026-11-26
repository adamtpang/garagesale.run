import { put } from '@vercel/blob';
import { botPrincipal, canWork } from '../../../../../lib/accounts';
import { getJob, saveJob, now, json } from '../../../../../lib/store';
export const dynamic = 'force-dynamic';
export async function POST(req, { params }) {
  const who = await botPrincipal(req);
  if (!who) return json({ error: 'unauthorized' }, 401);
  const job = await getJob(params.id);
  if (!job) return json({ error: 'not found' }, 404);
  if (!canWork(job, who)) return json({ error: 'This job belongs to another account.' }, 403);
  const fd = await req.formData().catch(() => null);
  const file = fd && fd.get('image');
  if (!file || typeof file === 'string') return json({ error: "multipart field 'image' required" }, 400);
  const caption = String((fd.get('caption') || '')).slice(0, 300);
  const type = file.type || 'image/png';
  const ext = (type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'png';
  const b = await put(`snapshots/${job.id}/s.${ext}`, file, { access: 'public', contentType: type, addRandomSuffix: true });
  const snap = { url: b.url, caption, at: now() };
  job.snapshots = [...(Array.isArray(job.snapshots) ? job.snapshots : []), snap].slice(-30);
  await saveJob(job);
  return json({ ok: true, snapshot: snap, count: job.snapshots.length });
}
