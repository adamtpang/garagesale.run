import { workerCheck, json } from '../../../lib/store.js';
import { readSurplus, writeSurplus } from '../../../lib/surplusStore.js';
import { liveRules } from '../../../lib/bankroll.js';

export const dynamic = 'force-dynamic';
// A write looks up drive times for new pickup addresses. See BATCH_BUDGET_MS in lib/driveStore.js.
export const maxDuration = 30;

export async function GET() {
  try {
    return json(await readSurplus(Date.now(), await liveRules()));
  } catch {
    return json({ error: 'surplus feed unavailable' }, 500);
  }
}

export async function POST(req) {
  const auth = workerCheck(req);
  if (!auth.ok) return json({ error: 'unauthorized', reason: auth.reason, hint: auth.hint }, 401);
  const body = await req.json().catch(() => null);
  try {
    return json(await writeSurplus(body, Date.now(), await liveRules()));
  } catch (e) {
    return json({ error: String(e.message || e) }, 400);
  }
}
