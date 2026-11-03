import { readSaved, upsertSaved, removeSaved } from '../../../lib/saved.js';
import { json } from '../../../lib/store.js';
export const dynamic = 'force-dynamic';

export async function GET() { return json({ deals: await readSaved() }); }

// Save a deal, or update its status, target, opener or notes. Body: { id, ...fields }.
export async function POST(req) {
  const b = await req.json().catch(() => null);
  if (!b || !b.id) return json({ error: 'id required' }, 400);
  try { return json(await upsertSaved(b)); } catch (e) { return json({ error: String(e.message || e) }, 400); }
}

export async function DELETE(req) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'id required' }, 400);
  return json({ removed: await removeSaved(id) });
}
