// Small JSON records for accounts, keys, invites and sign-in codes.
// Blob when BLOB_READ_WRITE_TOKEN is set, otherwise files under web/.data/kv so a plain dev server works.
// Nothing secret is stored in the clear: keys and codes are stored only as SHA-256 hashes, and the hash is
// the record's path, so a record can only be found by someone who already holds the key or code.
import { put, list, del } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

const blobOn = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const SAFE = /^[a-z0-9-]+\/[a-z0-9]+\.json$/i;
const file = (p) => path.join(process.cwd(), '.data', 'kv', ...p.split('/'));

export async function kvPut(p, obj) {
  if (!SAFE.test(p)) throw new Error('bad kv path');
  if (blobOn()) { await put(p, JSON.stringify(obj), { access: 'public', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60 }); return; }
  fs.mkdirSync(path.dirname(file(p)), { recursive: true });
  fs.writeFileSync(file(p), JSON.stringify(obj));
}

export async function kvGet(p) {
  if (!SAFE.test(p)) return null;
  if (blobOn()) {
    try {
      const { blobs } = await list({ prefix: p, limit: 5 });
      const b = blobs.find((x) => x.pathname === p);
      if (!b) return null;
      const r = await fetch(`${b.url}?t=${Date.now()}`, { cache: 'no-store' });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; }
  }
  try { return JSON.parse(fs.readFileSync(file(p), 'utf8')); } catch (e) { return null; }
}

export async function kvDel(p) {
  if (!SAFE.test(p)) return;
  if (blobOn()) {
    try { const { blobs } = await list({ prefix: p, limit: 5 }); const urls = blobs.filter((x) => x.pathname === p).map((x) => x.url); if (urls.length) await del(urls); } catch (e) {}
    return;
  }
  try { fs.unlinkSync(file(p)); } catch (e) {}
}

// The records under a folder such as "accounts/", oldest first: [{ name, at }]. name is the file name without
// ".json". Returns null when the folder can't be read, so a caller can refuse rather than guess.
export async function kvList(folder) {
  if (!/^[a-z0-9-]+\/$/i.test(folder)) return null;
  let rows;
  if (blobOn()) {
    try {
      const { blobs } = await list({ prefix: folder, limit: 1000 });
      rows = blobs.filter((b) => SAFE.test(b.pathname)).map((b) => ({ name: b.pathname.slice(folder.length, -5), at: new Date(b.uploadedAt).getTime() }));
    } catch (e) { return null; }
  } else {
    const dir = file(folder.slice(0, -1));
    try {
      rows = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ name: f.slice(0, -5), at: fs.statSync(path.join(dir, f)).mtimeMs }));
    } catch (e) { if (e && e.code === 'ENOENT') return []; return null; }
  }
  return rows.sort((a, b) => (a.at - b.at) || (a.name < b.name ? -1 : 1));
}
