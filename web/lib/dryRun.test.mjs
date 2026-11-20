import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const KEY = 'dry-run-test-key-0123456789abcdef';
const seed = fs.readFileSync(new URL('../config/surplus-scan-2026-11-15.json', import.meta.url), 'utf8');
const DATA = path.join(process.cwd(), '.data');

// Every file under web/.data with its size and change time, so a write anywhere shows up.
function snapshot() {
  const out = {};
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p); else out[p] = `${st.size}:${st.mtimeMs}`;
    }
  };
  walk(DATA);
  return out;
}

const post = (url, body, method = 'POST') => new Request(url, { method, headers: { 'content-type': 'application/json', 'x-worker-key': KEY }, body: JSON.stringify(body) });

test('?dry_run=1 checks and scores a post on every write route, and saves nothing', async () => {
  const prev = { key: process.env.GST_WORKER_KEY, blob: process.env.BLOB_READ_WRITE_TOKEN, ors: process.env.ORS_API_KEY };
  process.env.GST_WORKER_KEY = KEY;
  // No Blob and no routing key: a save would land in web/.data, and a lookup would have nothing to call.
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.ORS_API_KEY;
  const before = snapshot();
  try {
    const surplus = await import('../app/api/surplus/route.js');
    const s = await surplus.POST(post('http://localhost/api/surplus?dry_run=1', JSON.parse(seed)));
    assert.equal(s.status, 200);
    const sb = await s.json();
    assert.deepEqual([sb.dry_run, sb.saved, sb.source], [true, false, 'dry run']);
    assert.equal(sb.lots.length, JSON.parse(seed).lots.length);
    assert.match(sb.note, /nothing was saved/);

    const deals = await import('../app/api/deals/route.js');
    const d = await deals.POST(post('http://localhost/api/deals?dry_run=1', { area: 'New Braunfels, TX', deals: [{ source: 'fb', url: 'https://www.facebook.com/marketplace/item/1/', title: 'Canon EOS R body', ask: 40 }] }));
    assert.equal(d.status, 200);
    const db = await d.json();
    assert.deepEqual([db.dry_run, db.saved, db.updated_at, db.deals.length], [true, false, null, 1]);

    const config = await import('../app/api/scout/config/route.js');
    const c = await config.PUT(post('http://localhost/api/scout/config?dry_run=1', { sites: ['fb'], min_profit: 5 }, 'PUT'));
    assert.equal(c.status, 200);
    const cb = await c.json();
    assert.deepEqual([cb.dry_run, cb.saved], [true, false]);
    // A rule field in the body is still reported as ignored, so the bot sees it before a real post.
    assert.ok(cb.ignored.includes('min_profit'));

    // A dry run still needs the key.
    const denied = await surplus.POST(new Request('http://localhost/api/surplus?dry_run=1', { method: 'POST', body: '{}' }));
    assert.equal(denied.status, 401);

    assert.deepEqual(snapshot(), before);
  } finally {
    for (const [k, v] of [['GST_WORKER_KEY', prev.key], ['BLOB_READ_WRITE_TOKEN', prev.blob], ['ORS_API_KEY', prev.ors]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});
