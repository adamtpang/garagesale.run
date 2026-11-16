// Keeps a copy of each deal photo when a scout feed is stored.
// Facebook and eBay image links expire within days, so a stored feed would otherwise lose its photos.
// One copy per source image: the Blob path is a hash of the image URL without its query string,
// so the same listing is not stored again on the next scout run.
import crypto from 'crypto';

const ALLOWED = [/(^|\.)fbcdn\.net$/i, /(^|\.)ebayimg\.com$/i, /(^|\.)media-amazon\.com$/i, /(^|\.)ssl-images-amazon\.com$/i];
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PHOTOS = 40;
const BATCH = 5;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function photoKey(url) {
  const u = new URL(url);
  return crypto.createHash('sha1').update(u.hostname.replace(/^scontent[^.]*\./, 'scontent.') + u.pathname).digest('hex').slice(0, 24);
}

export function copyable(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ALLOWED.some((r) => r.test(u.hostname));
  } catch (e) { return false; }
}

async function copyOne(url, io) {
  const key = photoKey(url);
  for (const ext of Object.values(EXT)) {
    const found = await io.head(`deal-photos/${key}.${ext}`).catch(() => null);
    if (found && found.url) return found.url;
  }
  const r = await io.fetch(url, { headers: { accept: 'image/*', 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) });
  const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!r.ok || !EXT[type]) return null;
  const buf = await r.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > MAX_BYTES) return null;
  const saved = await io.put(`deal-photos/${key}.${EXT[type]}`, buf, { access: 'public', contentType: type, addRandomSuffix: false });
  return saved && saved.url ? saved.url : null;
}

// Returns the deals with photo_url pointing at the stored copy where one could be made.
// A photo that cannot be copied keeps its original link. Nothing here can fail the feed write.
export async function keepPhotos(deals, io) {
  const out = deals.map((d) => ({ ...d }));
  const todo = out.filter((d) => d.photo_url && copyable(d.photo_url)).slice(0, MAX_PHOTOS);
  let copied = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    await Promise.all(todo.slice(i, i + BATCH).map(async (d) => {
      try {
        const url = await copyOne(d.photo_url, io);
        if (url) { d.photo_source_url = d.photo_url; d.photo_url = url; copied++; }
      } catch (e) { /* keep the original link */ }
    }));
  }
  return { deals: out, copied, tried: todo.length };
}
