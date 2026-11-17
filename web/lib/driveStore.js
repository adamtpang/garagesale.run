// Drive lookups, kept so each place is routed once. Blob when BLOB_READ_WRITE_TOKEN is set,
// otherwise web/.data/drive-cache.json. Holds places and drive times only. No key is stored.
import fs from 'fs';
import path from 'path';
import { saveVersioned, readLatest } from './store.js';
import { cleanDrive, lookUpDrive, placeKey, routingKey } from './drive.js';

const FILE = path.join(process.cwd(), '.data', 'drive-cache.json');
const blobOn = () => !!process.env.BLOB_READ_WRITE_TOKEN;
// No new lookup starts once a batch has run this long. With two calls of up to 5 seconds each still in
// flight, the batch ends inside 22 seconds, under the 30 seconds the routes that use it are given.
// What was found is saved either way, so the next load does not repeat it.
export const BATCH_BUDGET_MS = 12000;
// A place that could not be routed is tried again after a day.
const RETRY_MS = 24 * 60 * 60 * 1000;

async function load() {
  try {
    const doc = blobOn() ? await readLatest('drive-cache/') : JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return doc && doc.entries && typeof doc.entries === 'object' ? doc.entries : {};
  } catch { return {}; }
}
async function save(entries) {
  const doc = { updated_at: new Date().toISOString(), entries };
  if (blobOn()) await saveVersioned('drive-cache/', doc);
  else { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(doc, null, 1)); }
}

// places: [{ lat, lng } or { address }]. Returns a Map from placeKey to a drive or null.
// At most `max` new lookups a call, so one page load cannot burn the daily quota.
export async function drivesFor(places, { max = 8, deps = null, nowMs = Date.now(), store = { load, save }, budgetMs = BATCH_BUDGET_MS, clock = Date.now } = {}) {
  const out = new Map();
  const keys = [...new Set(places.map(placeKey).filter(Boolean))];
  if (!keys.length) return out;
  const entries = await store.load();
  const key = deps ? deps.key : routingKey();
  const d = { fetch: deps ? deps.fetch : fetch, key };
  let looked = 0;
  let changed = false;
  const began = clock();
  for (const k of keys) {
    const hit = entries[k];
    if (hit && hit.drive) { out.set(k, cleanDrive(hit.drive)); continue; }
    const recentMiss = hit && hit.failed_at && nowMs - Date.parse(hit.failed_at) < RETRY_MS;
    if (!key || recentMiss || looked >= max || clock() - began > budgetMs) { out.set(k, null); continue; }
    looked += 1;
    const place = places.find((p) => placeKey(p) === k);
    let drive = null;
    try { drive = await lookUpDrive(place, d); } catch { drive = null; }
    entries[k] = drive ? { drive } : { failed_at: new Date(nowMs).toISOString() };
    changed = true;
    out.set(k, drive);
  }
  if (changed) await Promise.resolve(store.save(entries)).catch(() => {});
  return out;
}

export const driveCacheFile = FILE;
