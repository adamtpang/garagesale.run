// Saved buy-side deals. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise a
// local JSON file (web/.data/saved-deals.json) so the buy side works on a plain dev server.
// Only listing facts are kept. No seller names or profile links.
import fs from 'fs';
import path from 'path';
import { saveVersioned, readLatest } from './store.js';

export const STATUSES = ['saved', 'messaged', 'bought', 'resold'];
const FILE = path.join(process.cwd(), '.data', 'saved-deals.json');
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function readSaved() {
  if (useBlob()) return ((await readLatest('saved-deals/').catch(() => null)) || { deals: [] }).deals || [];
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')).deals || []; } catch (e) { return []; }
}

async function write(deals) {
  const doc = { updated_at: new Date().toISOString(), deals };
  if (useBlob()) return saveVersioned('saved-deals/', doc);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(doc, null, 1));
}

const num = (v) => (v === null || v === undefined || v === '' || !isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
const str = (v, n) => (v === null || v === undefined ? null : String(v).slice(0, n));

// Whitelist the fields we keep, so nothing extra (like a seller name) can slip in.
function clean(d) {
  const id = String(d.id || '').replace(/\D/g, '').slice(0, 30);
  if (!id) throw new Error('id required');
  return {
    id, title: str(d.title, 200), fb_url: `https://www.facebook.com/marketplace/item/${id}/`, photo_url: /^https:\/\//.test(d.photo_url || '') ? str(d.photo_url, 1000) : null,
    location: str(d.location, 80), listed: str(d.listed, 80), condition: str(d.condition, 60), query: str(d.query, 200),
    ask: num(d.ask), target: num(d.target), value: num(d.value), confidence: str(d.confidence, 10), comps_n: num(d.comps_n), discount: num(d.discount), reason: str(d.reason, 300),
    comps: Array.isArray(d.comps) ? d.comps.slice(0, 8).map((c) => ({ title: str(c.title, 160), price: num(c.price), sold_on: str(c.sold_on, 20), condition: str(c.condition, 40), url: /^https:\/\/www\.ebay\.com\/itm\/\d+$/.test(c.url || '') ? c.url : null })) : [],
    opener: str(d.opener, 1000), notes: str(d.notes, 1000),
    status: STATUSES.includes(d.status) ? d.status : 'saved',
  };
}

export async function upsertSaved(input) {
  const deals = await readSaved();
  const i = deals.findIndex((x) => x.id === String(input.id || '').replace(/\D/g, ''));
  const now = new Date().toISOString();
  const merged = clean(i >= 0 ? { ...deals[i], ...input } : input);
  const rec = { ...merged, saved_at: i >= 0 ? deals[i].saved_at : now, updated_at: now };
  if (i >= 0) deals[i] = rec; else deals.unshift(rec);
  await write(deals.slice(0, 200));
  return rec;
}

export async function removeSaved(id) {
  const deals = await readSaved();
  const left = deals.filter((x) => x.id !== String(id));
  await write(left);
  return deals.length - left.length;
}
