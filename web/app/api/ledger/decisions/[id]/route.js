import { json } from '../../../../../lib/store.js';
import { authFromRequest, readLedger, writeLedger, applyDecisionPatch, totals } from '../../../../../lib/ledger.js';

export const dynamic = 'force-dynamic';

function denied(auth) { return json({ error: auth.error }, auth.status); }
function failed(e) {
  if (e && e.message === 'ledger decrypt failed') return json({ error: 'ledger decrypt failed' }, 500);
  return json({ error: String(e.message || e) }, 400);
}

// Update what happened after a decision: won, lost, never bid, a note, or the ledger item it became.
export async function PATCH(req, { params }) {
  const auth = authFromRequest(req);
  if (!auth.ok) return denied(auth);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'bad body' }, 400);
  try {
    const doc = await readLedger();
    const i = (doc.decisions || []).findIndex((x) => x.id === params.id);
    if (i < 0) return json({ error: 'not found' }, 404);
    doc.decisions[i] = applyDecisionPatch(doc.decisions[i], body);
    const saved = await writeLedger(doc);
    return json({ decision: saved.decisions.find((x) => x.id === params.id), totals: totals(saved) });
  } catch (e) { return failed(e); }
}

export async function DELETE(req, { params }) {
  const auth = authFromRequest(req);
  if (!auth.ok) return denied(auth);
  try {
    const doc = await readLedger();
    const before = (doc.decisions || []).length;
    doc.decisions = (doc.decisions || []).filter((x) => x.id !== params.id);
    if (doc.decisions.length === before) return json({ error: 'not found' }, 404);
    const saved = await writeLedger(doc);
    return json({ removed: params.id, totals: totals(saved) });
  } catch (e) { return failed(e); }
}
