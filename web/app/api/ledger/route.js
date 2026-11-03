import { json } from '../../../lib/store.js';
import { authFromRequest, readLedger, writeLedger, addItem, totals, moneyField } from '../../../lib/ledger.js';

export const dynamic = 'force-dynamic';

function denied(auth) { return json({ error: auth.error }, auth.status); }
function view(doc) { return { ...doc, totals: totals(doc) }; }

export async function GET(req) {
  const auth = authFromRequest(req);
  if (!auth.ok) return denied(auth);
  return json(view(await readLedger()));
}

export async function POST(req) {
  const auth = authFromRequest(req);
  if (!auth.ok) return denied(auth);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'bad body' }, 400);
  try {
    const doc = await readLedger();
    if ('starting_bankroll' in body) doc.starting_bankroll = moneyField(body.starting_bankroll);
    let created = null;
    if (body.item != null || body.buy_price != null) created = addItem(doc, body);
    const saved = await writeLedger(doc);
    return json({ ...view(saved), created }, created ? 201 : 200);
  } catch (e) { return json({ error: String(e.message || e) }, 400); }
}
