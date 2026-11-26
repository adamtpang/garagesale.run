import { listStalled, STALL_MINUTES, json } from '../../../lib/store';
import { botPrincipal } from '../../../lib/accounts';
export const dynamic = 'force-dynamic';
// Work the calling bot claimed but never reported done. It may be half finished, so the bot must check
// before redoing it.
export async function GET(req) {
  const who = await botPrincipal(req);
  if (!who) return json({ error: 'unauthorized' }, 401);
  return json({ minutes: STALL_MINUTES, items: await listStalled(who.account || null) });
}
