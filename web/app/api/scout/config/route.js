import { workerCheck, json, isDryRun, DRY_RUN_NOTE } from '../../../../lib/store.js';
import { readConfig, writeConfig } from '../../../../lib/scoutConfig.js';
import { liveRules } from '../../../../lib/bankroll.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  return json(await readConfig(await liveRules()));
}

export async function PUT(req) {
  const auth = workerCheck(req);
  if (!auth.ok) return json({ error: 'unauthorized', reason: auth.reason, hint: auth.hint }, 401);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'body must be a config object' }, 400);
  try {
    if (isDryRun(req)) return json({ ...(await writeConfig(body, await liveRules(), { dryRun: true })), note: DRY_RUN_NOTE });
    return json(await writeConfig(body, await liveRules()));
  }
  catch (e) { return json({ error: String(e.message || e) }, 400); }
}
