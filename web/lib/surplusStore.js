// Surplus feed. Blob when BLOB_READ_WRITE_TOKEN is set, otherwise web/.data/surplus.json.
// With nothing stored, GET serves the Nov 15, 2026 scan snapshot.
import fs from 'fs';
import path from 'path';
import { saveVersioned, readLatest } from './store.js';
import { assessSnapshot, cleanSnapshot } from './surplus.js';
import { drivesFor, cachedDrives } from './driveStore.js';
import { placeKey } from './drive.js';

const FILE = path.join(process.cwd(), '.data', 'surplus.json');
const SEED_FILE = path.join(process.cwd(), 'config', 'surplus-scan-2026-11-15.json');
const blobOn = () => !!process.env.BLOB_READ_WRITE_TOKEN;

function readSeed() {
  return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
}

async function loadStored() {
  if (blobOn()) {
    const stored = await readLatest('surplus/').catch(() => null);
    return stored && Array.isArray(stored.lots) ? stored : null;
  }
  try {
    const stored = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return stored && Array.isArray(stored.lots) ? stored : null;
  } catch {
    return null;
  }
}

function stamp(view, source, updatedAt) {
  return { ...view, source, updated_at: updatedAt || null };
}

// Adds the round-trip drive to each lot that has a pickup address and no drive of its own.
// A lot with only a city is not routed: the middle of a city is not the pickup point, and a drive time
// to the wrong point could pass the drive cap. Its drive stays unknown.
// A lookup that fails leaves the drive unknown. It never stops the board from loading.
export async function withDrives(doc, lookup = drivesFor) {
  if (!doc || !Array.isArray(doc.lots)) return doc;
  const placeOf = (lot) => (lot && !lot.drive && lot.pickup_address ? { address: lot.pickup_address } : null);
  const places = doc.lots.map(placeOf).filter(Boolean);
  if (!places.length) return doc;
  let found;
  try { found = await lookup(places); } catch { return doc; }
  return { ...doc, lots: doc.lots.map((lot) => { const p = placeOf(lot); const d = p ? found.get(placeKey(p)) : null; return d ? { ...lot, drive: d } : lot; }) };
}

// Reading is public, so it uses drive times already in the cache and never calls the routing service.
export async function readSurplus(nowMs = null, rules = undefined, find = cachedDrives) {
  const stored = await loadStored();
  if (stored) return stamp(assessSnapshot(await withDrives(stored, find), nowMs, rules), 'stored', stored.updated_at || null);
  return stamp(assessSnapshot(await withDrives(readSeed(), find), nowMs, rules), 'seed', null);
}

// The lots as stored, or the scan file when nothing is stored. For the drive refresh.
export async function surplusPlaces() {
  const doc = (await loadStored()) || readSeed();
  return (doc.lots || []).filter((lot) => lot && !lot.drive && lot.pickup_address).map((lot) => ({ address: lot.pickup_address }));
}

// A dry run: the body checked and scored exactly as a write would, with drive times from the cache only.
// Nothing is saved.
export async function previewSurplus(body, nowMs = null, rules = undefined) {
  const doc = cleanSnapshot(body, { refusePercentRates: true });
  return { ...stamp(assessSnapshot(await withDrives(doc, cachedDrives), nowMs, rules), 'dry run', null), dry_run: true, saved: false };
}

// Writing needs the worker key, so it may look up drive times for the lots it stores.
export async function writeSurplus(body, nowMs = null, rules = undefined) {
  const doc = cleanSnapshot(body, { refusePercentRates: true });
  doc.updated_at = new Date().toISOString();
  if (blobOn()) await saveVersioned('surplus/', doc);
  else {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(doc, null, 1));
  }
  return stamp(assessSnapshot(await withDrives(doc), nowMs, rules), 'stored', doc.updated_at);
}

export const surplusFile = FILE;
