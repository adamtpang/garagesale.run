import test from 'node:test';
import assert from 'node:assert/strict';
import { keepPhotos, photoKey, copyable } from './dealPhotos.js';

const FB = 'https://scontent-dfw6-1.xx.fbcdn.net/v/t39/862402429_n.jpg?stp=dst-jpg&oh=abc&oe=6AE1E30B';

function fakeIo({ type = 'image/jpeg', bytes = 1000, ok = true, existing = {} } = {}) {
  const calls = { fetch: 0, put: [] };
  return {
    calls,
    head: async (path) => (existing[path] ? { url: existing[path] } : Promise.reject(new Error('not found'))),
    fetch: async () => { calls.fetch++; return { ok, headers: { get: () => type }, arrayBuffer: async () => new ArrayBuffer(bytes) }; },
    put: async (path) => { calls.put.push(path); return { url: `https://blob.example/${path}` }; },
  };
}

test('only image hosts we already proxy are copied', () => {
  assert.equal(copyable(FB), true);
  assert.equal(copyable('https://i.ebayimg.com/images/g/abc/s-l500.jpg'), true);
  assert.equal(copyable('http://scontent.xx.fbcdn.net/a.jpg'), false);
  assert.equal(copyable('https://example.com/a.jpg'), false);
  assert.equal(copyable('not a url'), false);
});

test('the same photo gets the same key when its signed query or CDN node changes', () => {
  const again = 'https://scontent-iad3-1.xx.fbcdn.net/v/t39/862402429_n.jpg?stp=other&oh=zzz&oe=7BE1E30B';
  assert.equal(photoKey(FB), photoKey(again));
  assert.notEqual(photoKey(FB), photoKey('https://scontent-dfw6-1.xx.fbcdn.net/v/t39/999_n.jpg'));
});

test('a copied photo replaces the link and keeps the source', async () => {
  const io = fakeIo();
  const { deals, copied, tried } = await keepPhotos([{ title: 'Camera', photo_url: FB }, { title: 'No photo', photo_url: null }], io);
  assert.equal(tried, 1);
  assert.equal(copied, 1);
  assert.match(deals[0].photo_url, /^https:\/\/blob\.example\/deal-photos\/[0-9a-f]{24}\.jpg$/);
  assert.equal(deals[0].photo_source_url, FB);
  assert.equal(deals[1].photo_url, null);
});

test('a photo already stored is reused, not fetched or stored again', async () => {
  const path = `deal-photos/${photoKey(FB)}.jpg`;
  const io = fakeIo({ existing: { [path]: 'https://blob.example/kept.jpg' } });
  const { deals, copied } = await keepPhotos([{ photo_url: FB }], io);
  assert.equal(copied, 1);
  assert.equal(deals[0].photo_url, 'https://blob.example/kept.jpg');
  assert.equal(io.calls.fetch, 0);
  assert.equal(io.calls.put.length, 0);
});

test('a failed, oversized or non-image fetch keeps the original link', async () => {
  for (const io of [fakeIo({ ok: false }), fakeIo({ bytes: 5 * 1024 * 1024 }), fakeIo({ type: 'text/html' })]) {
    const { deals, copied } = await keepPhotos([{ photo_url: FB }], io);
    assert.equal(copied, 0);
    assert.equal(deals[0].photo_url, FB);
    assert.equal(deals[0].photo_source_url, undefined);
    assert.equal(io.calls.put.length, 0);
  }
  const boom = { head: async () => { throw new Error('x'); }, fetch: async () => { throw new Error('network'); }, put: async () => null };
  const { deals } = await keepPhotos([{ photo_url: FB }], boom);
  assert.equal(deals[0].photo_url, FB);
});
