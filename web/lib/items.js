// Free items. Each account may approve FREE_ITEMS listings for posting at no charge. An item is counted when
// its owner approves it, not when the photo is taken, so a blurry photo or an abandoned draft costs nothing.
// Paying for more is not built yet: past the free items, Approve is refused with a clear reason.
// One small record per counted item lives at items-<account>/<job>.json, so counting is a single list.
import { kvPut, kvDel, kvList } from './kv.js';
import { seatState } from './accounts.js';

export const FREE_ITEMS = 10;
export const PRICE_AFTER_FREE = 1; // US dollars per item. Shown to people, not charged yet.
const ID = /^[a-z0-9]{6,40}$/i;
const folder = (owner) => `items-${owner}/`;

// { used, free, left } from the list of counted items, or null when the list couldn't be read.
export function usageOf(list, free = FREE_ITEMS) {
  if (!Array.isArray(list)) return null;
  return { used: list.length, free, left: Math.max(0, free - list.length) };
}
export async function itemUsage(owner) {
  if (!ID.test(String(owner || ''))) return null;
  return usageOf(await kvList(folder(owner)));
}

const USED = (usage) => ({ ok: false, status: 402, reason: 'free-items-used', usage,
  error: `You've used your ${FREE_ITEMS} free items. More items will be $${PRICE_AFTER_FREE} each, but paying isn't open yet, so this one can't be posted from here. The price and listing above are still yours to use.` });
const UNKNOWN = { ok: false, status: 503, reason: 'items-unknown', usage: null, error: 'Could not check your free items just now. Try again in a minute.' };

// Counts one item against an account, once per job. Storage has no locks, so after writing the record this
// looks again: only the first `free` records, oldest first, keep their place, and a late one is undone.
// When the list can't be read, or doesn't show the new record yet, it refuses rather than guess.
export async function takeItem(owner, jobId, free = FREE_ITEMS) {
  if (!ID.test(String(owner || '')) || !ID.test(String(jobId || ''))) return UNKNOWN;
  const before = await kvList(folder(owner));
  if (!before) return UNKNOWN;
  const rec = `${folder(owner)}${jobId}.json`;
  // A record already there only counts if it holds one of the free places. One sitting past them is a
  // leftover from an undo that didn't land: clear it again and refuse, so a retry can't slip through.
  const mine = seatState(before, jobId, free);
  if (mine === 'held') return { ok: true, usage: usageOf(before, free) };
  if (mine === 'over') { await kvDel(rec); return USED(usageOf(before.filter((r) => r.name !== jobId), free)); }
  if (before.length >= free) return USED(usageOf(before, free));
  await kvPut(rec, { job: jobId, at: new Date().toISOString() });
  const after = await kvList(folder(owner));
  const state = seatState(after, jobId, free);
  if (state === 'held') return { ok: true, usage: usageOf(after, free) };
  await kvDel(rec);
  return state === 'over' ? USED(usageOf(after.filter((r) => r.name !== jobId), free)) : UNKNOWN;
}
