// Targets: the deals Adam starred, kept in this browser only (one viewer). Each target keeps the tile as
// it last looked, so a deal that closes or leaves the feed still shows its last known numbers.
// Every read and write is wrapped, because browser storage can be blocked or missing.
export const TARGETS_KEY = 'gs_targets_v1';
export const TARGETS_EVENT = 'gs-targets';

const store = (s) => s || (typeof window !== 'undefined' ? window.localStorage : null);

export function readTargets(storage) {
  try {
    const raw = store(storage) && store(storage).getItem(TARGETS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

function write(all, storage) {
  try {
    store(storage).setItem(TARGETS_KEY, JSON.stringify(all));
    if (typeof window !== 'undefined' && !storage) window.dispatchEvent(new Event(TARGETS_EVENT));
    return true;
  } catch {
    return false;
  }
}

// Adds the tile as a target, or removes it when it is one already. Returns the new state, or null when
// storage is not available.
export function toggleTarget(tile, storage, nowMs = Date.now()) {
  const all = readTargets(storage);
  if (all[tile.id]) delete all[tile.id];
  else all[tile.id] = { ...tile, saved_at: new Date(nowMs).toISOString() };
  return write(all, storage) ? !!all[tile.id] : null;
}

// Keeps a target's snapshot current while the deal is still in the feed, and notes when it was last seen.
export function refreshTargets(liveTiles, storage, nowMs = Date.now()) {
  const all = readTargets(storage);
  let changed = false;
  const seen = new Date(nowMs).toISOString();
  for (const t of liveTiles) if (all[t.id]) { all[t.id] = { ...t, saved_at: all[t.id].saved_at, seen_at: seen }; changed = true; }
  if (changed) write(all, storage);
  return all;
}

// The Targets page rows: live deals first, best profit first by feed order, then the gone ones.
// liveTiles null means the feed could not be loaded: nothing can be called gone, so every target shows its
// last known numbers and says the feed is out.
export function targetRows(targets, liveTiles) {
  if (liveTiles == null) {
    return Object.values(targets).map((saved) => ({ ...saved, gone: false, stale: true, closes: 'Feed not loaded', reason: `Could not load today's feed, so these are the numbers from ${String(saved.seen_at || saved.saved_at || '').slice(0, 10) || 'earlier'}.` }));
  }
  const live = new Map(liveTiles.map((t) => [t.id, t]));
  const rows = Object.values(targets).map((saved) => (live.has(saved.id)
    ? { ...live.get(saved.id), gone: false }
    : { ...saved, gone: true, label: 'Gone', decision: 'gone', closes: 'No longer in the feed', href: saved.listing_url || null, external: !!saved.listing_url, reason: `Last seen ${String(saved.seen_at || saved.saved_at || '').slice(0, 10) || 'earlier'}. It closed or was left off. These are its last known numbers.` }));
  const order = new Map(liveTiles.map((t, i) => [t.id, i]));
  return rows.sort((a, b) => (a.gone === b.gone ? (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0) : a.gone ? 1 : -1));
}
