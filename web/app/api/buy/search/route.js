import { searchMarketplace } from '../../../../lib/marketplace.js';
import { BrowserUnavailable } from '../../../../lib/helium.js';
import { json } from '../../../../lib/store.js';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Live, read-only Marketplace search through Adam's own Helium browser. Runs on his computer only.
export async function POST(req) {
  const b = await req.json().catch(() => null);
  const query = String((b && b.query) || '').trim().slice(0, 120);
  if (!query) return json({ error: 'Tell us what you are looking for.' }, 400);
  const radius = Math.min(100, Math.max(1, Number(b.radius_mi) || 20));
  const city = String(b.city || 'Austin').replace(/[^a-z ]/gi, '').slice(0, 40) || 'Austin';
  try {
    return json(await searchMarketplace({ query, max_price: b.max_price, city, radius_mi: radius }));
  } catch (e) {
    const offline = e instanceof BrowserUnavailable;
    return json({ error: e.message || 'Search failed', browser: offline ? 'unavailable' : undefined }, offline ? 503 : 502);
  }
}
