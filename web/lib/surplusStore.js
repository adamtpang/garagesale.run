// Surplus feed. Blob when BLOB_READ_WRITE_TOKEN is set, otherwise web/.data/surplus.json.
// With nothing stored, GET serves the Nov 15, 2026 scan snapshot.
import fs from 'fs';
import path from 'path';
import { saveVersioned, readLatest } from './store.js';
import { assessSnapshot, cleanSnapshot } from './surplus.js';

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

export async function readSurplus(nowMs = null) {
  const stored = await loadStored();
  if (stored) return stamp(assessSnapshot(stored, nowMs), 'stored', stored.updated_at || null);
  return stamp(assessSnapshot(readSeed(), nowMs), 'seed', null);
}

export async function writeSurplus(body, nowMs = null) {
  const doc = cleanSnapshot(body);
  doc.updated_at = new Date().toISOString();
  if (blobOn()) await saveVersioned('surplus/', doc);
  else {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(doc, null, 1));
  }
  return stamp(assessSnapshot(doc, nowMs), 'stored', doc.updated_at);
}

export const surplusFile = FILE;
