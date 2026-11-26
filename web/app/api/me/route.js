import { json } from '../../../lib/store';
import { sessionAccount } from '../../../lib/accounts';
export const dynamic = 'force-dynamic';
// Who this browser is signed in as, or null.
export async function GET(req) {
  const a = await sessionAccount(req);
  return json({ account: a ? { id: a.id, name: a.name } : null });
}
