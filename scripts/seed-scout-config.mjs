// PUT web/config/scout-config.seed.json to /api/scout/config.
// Env: GST_WORKER_KEY, GARAGESALE_BASE_URL. Never prints the key.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const seedPath = path.join(root, 'web', 'config', 'scout-config.seed.json');
const base = (process.env.GARAGESALE_BASE_URL || '').replace(/\/$/, '');
const key = process.env.GST_WORKER_KEY;

if (!base || !key) {
  console.error('GST_WORKER_KEY and GARAGESALE_BASE_URL are required');
  process.exit(1);
}

const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const res = await fetch(new URL('/api/scout/config', base), {
  method: 'PUT',
  headers: { 'content-type': 'application/json', 'x-worker-key': key },
  body: JSON.stringify(seed),
});
const text = await res.text();
if (!res.ok) {
  console.error(`seed failed: ${res.status} ${text.slice(0, 300)}`);
  process.exit(1);
}
console.log(`scout config seeded (${res.status})`);
