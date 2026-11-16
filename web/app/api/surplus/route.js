import { workerOk, json } from '../../../lib/store.js';
import { readSurplus, writeSurplus } from '../../../lib/surplusStore.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return json(await readSurplus(Date.now()));
  } catch {
    return json({ error: 'surplus feed unavailable' }, 500);
  }
}

export async function POST(req) {
  if (!workerOk(req)) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  try {
    return json(await writeSurplus(body, Date.now()));
  } catch (e) {
    return json({ error: String(e.message || e) }, 400);
  }
}
