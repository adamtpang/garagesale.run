import { workerOk, json } from '../../../../lib/store.js';
import { readConfig, writeConfig } from '../../../../lib/scoutConfig.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  return json(await readConfig());
}

export async function PUT(req) {
  if (!workerOk(req)) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'body must be a config object' }, 400);
  try { return json(await writeConfig(body)); }
  catch (e) { return json({ error: String(e.message || e) }, 400); }
}
