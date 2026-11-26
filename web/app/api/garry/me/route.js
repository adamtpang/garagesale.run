import { json } from '../../../../lib/store';
import { botPrincipal } from '../../../../lib/accounts';
import { webhookState } from '../../../../lib/wake';
import { itemUsage } from '../../../../lib/items';
export const dynamic = 'force-dynamic';
// Lets a Garry check that its key works, and see how many free items its person has left. Writes nothing.
export async function GET(req) {
  const who = await botPrincipal(req);
  if (!who) return json({ ok: false, error: 'unauthorized', hint: 'Send your garry_key as the x-garry-key header.' }, 401);
  return json({ ok: true, account: who.account ? { id: who.account, name: who.name } : null, owner_bot: !who.account, webhook: who.account ? await webhookState(who.account) : null, items: who.account ? await itemUsage(who.account) : null });
}
