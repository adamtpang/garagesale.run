import { saveVersioned, readLatest, workerOk, now, json } from '../../../lib/store';
export const dynamic = 'force-dynamic';
export async function GET() {
  const feed = await readLatest('deals/');
  return json(feed || { updated_at: null, deals: [] });
}
export async function POST(req) {
  if (!workerOk(req)) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.deals)) return json({ error: 'body must be {deals:[...], area?}' }, 400);
  const feed = { updated_at: now(), area: body.area || 'Austin, TX', deals: body.deals.slice(0, 100), test: !!body.test };
  await saveVersioned('deals/', feed);
  return json(feed);
}
