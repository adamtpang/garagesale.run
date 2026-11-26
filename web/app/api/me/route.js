import { json } from '../../../lib/store';
import { sessionAccount } from '../../../lib/accounts';
import { itemUsage } from '../../../lib/items';
export const dynamic = 'force-dynamic';
// Who this browser is signed in as, or null. items is { used, free, left }, or null when it couldn't be read.
export async function GET(req) {
  const a = await sessionAccount(req);
  return json({ account: a ? { id: a.id, name: a.name } : null, items: a ? await itemUsage(a.id) : null });
}
