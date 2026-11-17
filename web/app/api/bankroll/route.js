import { json } from '../../../lib/store.js';
import { currentBankroll } from '../../../lib/bankroll.js';

export const dynamic = 'force-dynamic';

// Public and read-only: the current bankroll, which is also the most one flip can cost.
// Nothing else from the ledger is returned.
export async function GET() {
  const b = await currentBankroll();
  return json({ bankroll: b.bankroll, start: b.start, source: b.source, note: b.note, max_buy: b.bankroll });
}
