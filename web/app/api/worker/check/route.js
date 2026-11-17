import { workerCheck } from '../../../../lib/workerKey.js';
import { json } from '../../../../lib/store.js';

export const dynamic = 'force-dynamic';

// Lets the worker test its key without writing anything.
// 200 { ok: true } when the key is accepted. 401 with a reason when it is not. It never returns a key.
export async function GET(req) {
  const check = workerCheck(req);
  return json({ ok: check.ok, reason: check.reason, hint: check.hint, writes: ['POST /api/deals', 'POST /api/surplus', 'PUT /api/scout/config'] }, check.ok ? 200 : 401);
}
