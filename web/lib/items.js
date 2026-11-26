// Items. Each account may approve FREE_ITEMS listings for posting at no charge, then buys more in packs:
// PACK_ITEMS items for PACK_PRICE dollars. An item is counted when its owner approves it, not when the photo
// is taken, so a blurry photo or an abandoned draft costs nothing.
// Three small sets of records per account, so every count is a list and nothing is read one by one:
//   items-<account>/<job>.json     an item that took a free place
//   paid-<account>/<job>.json      an item that took a paid place
//   packs-<account>/<hash>q<n>.json  a paid pack of n items (the hash is of the Stripe checkout id)
import { kvPut, kvDel, kvList } from './kv.js';
import { seatState } from './accounts.js';

import { FREE_ITEMS, PACK_ITEMS, PACK_PRICE } from './pack.js';
export { FREE_ITEMS, PACK_ITEMS, PACK_PRICE };
const ID = /^[a-z0-9]{6,40}$/i;
const freeFolder = (owner) => `items-${owner}/`;
const paidFolder = (owner) => `paid-${owner}/`;
export const packFolder = (owner) => `packs-${owner}/`;

// A pack's size is part of its record name, so changing PACK_ITEMS later never revalues an old purchase.
export const packName = (hash32, items) => `${hash32}q${items}`;
export const packItems = (name) => { const m = /^[a-f0-9]{32}q(\d{1,6})$/.exec(String(name)); return m ? Number(m[1]) : 0; };
export const boughtOf = (packs) => (Array.isArray(packs) ? packs.reduce((n, r) => n + packItems(r.name), 0) : null);

// { used, free, left, bought, paid_used, paid_left } or null when any list couldn't be read.
// left is free items left. An account can post while left + paid_left is above zero.
export function usageOf(freeList, free = FREE_ITEMS, paidList = [], packs = []) {
  if (!Array.isArray(freeList) || !Array.isArray(paidList) || !Array.isArray(packs)) return null;
  const bought = boughtOf(packs);
  return { used: freeList.length, free, left: Math.max(0, free - freeList.length), bought, paid_used: paidList.length, paid_left: Math.max(0, bought - paidList.length) };
}
const lists = (owner) => Promise.all([kvList(freeFolder(owner)), kvList(paidFolder(owner)), kvList(packFolder(owner))]);
export async function itemUsage(owner) {
  if (!ID.test(String(owner || ''))) return null;
  const [f, p, k] = await lists(owner);
  return usageOf(f, FREE_ITEMS, p, k);
}

const OUT = (usage) => ({ ok: false, status: 402, reason: 'no-items-left', usage, buy: { items: PACK_ITEMS, price: PACK_PRICE },
  error: `${usage && usage.bought > 0 ? "You've used all your items." : `You've used your ${FREE_ITEMS} free items.`} ${PACK_ITEMS} more items are $${PACK_PRICE}. The price and listing above are still yours to use.` });
const UNKNOWN = { ok: false, status: 503, reason: 'items-unknown', usage: null, error: 'Could not check your items just now. Try again in a minute.' };

// Writes a record for this job in one set, then looks again. Storage has no locks, so only the first `cap`
// records, oldest first, keep their place: a late one is undone. Returns the state and the list without it.
async function claim(folderName, jobId, cap) {
  const rec = `${folderName}${jobId}.json`;
  await kvPut(rec, { job: jobId, at: new Date().toISOString() });
  const after = await kvList(folderName);
  const state = seatState(after, jobId, cap);
  if (state === 'held') return { state, list: after };
  await kvDel(rec);
  return { state, list: Array.isArray(after) ? after.filter((r) => r.name !== jobId) : null };
}

// Counts one item against an account, once per job: a free place first, then a paid one.
// When a list can't be read, or doesn't show a new record yet, it refuses rather than guess.
export async function takeItem(owner, jobId, free = FREE_ITEMS) {
  if (!ID.test(String(owner || '')) || !ID.test(String(jobId || ''))) return UNKNOWN;
  let [f, p, k] = await lists(owner);
  if (!f || !p || !k) return UNKNOWN;
  const bought = boughtOf(k);
  const ok = () => ({ ok: true, usage: usageOf(f, free, p, k) });
  // Already counted: fine. A record sitting past its limit is a leftover from an undo that didn't land,
  // so it is cleared again and never lets the item through.
  const inFree = seatState(f, jobId, free);
  if (inFree === 'held') return ok();
  if (inFree === 'over') { await kvDel(`${freeFolder(owner)}${jobId}.json`); f = f.filter((r) => r.name !== jobId); }
  const inPaid = seatState(p, jobId, bought);
  if (inPaid === 'held') return ok();
  if (inPaid === 'over') { await kvDel(`${paidFolder(owner)}${jobId}.json`); p = p.filter((r) => r.name !== jobId); }
  if (f.length < free) {
    const c = await claim(freeFolder(owner), jobId, free);
    if (c.state === 'unknown') return UNKNOWN;
    f = c.list;
    if (c.state === 'held') return ok();
  }
  if (p.length < bought) {
    const c = await claim(paidFolder(owner), jobId, bought);
    if (c.state === 'unknown') return UNKNOWN;
    p = c.list;
    if (c.state === 'held') return ok();
  }
  return OUT(usageOf(f, free, p, k));
}
