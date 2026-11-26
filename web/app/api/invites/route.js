import { json, ownerGate } from '../../../lib/store';
import { createInvite } from '../../../lib/accounts';
export const dynamic = 'force-dynamic';
// The site owner makes a one-time invite code for one beta tester's Garry bot.
export async function POST(req) {
  const stop = ownerGate(req); if (stop) return stop;
  const body = await req.json().catch(() => ({}));
  return json({ invite: await createInvite(body && body.note) });
}
