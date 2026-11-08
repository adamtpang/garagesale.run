// Reads Marketplace and eBay sold listings through Adam's own Helium tab (see lib/helium.js).
// Per search: one Marketplace results page, one eBay sold page, and up to DETAILS listing pages.
// Seller names and profiles are never read or stored.
import { browse, sleep, jitter } from './helium.js';
import { parseRequest, rank, soldQuery } from './pricing.js';

const DETAILS = 6;
const CACHE_MS = 15 * 60 * 1000;
const cache = globalThis.__gsSearchCache || (globalThis.__gsSearchCache = new Map());
const inflight = globalThis.__gsSearchInflight || (globalThis.__gsSearchInflight = new Map());

function readCards() {
  const out = [];
  for (const a of document.querySelectorAll('a[href*="/marketplace/item/"]')) {
    const id = (a.getAttribute('href').match(/\/marketplace\/item\/(\d+)/) || [])[1];
    const lines = a.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    const prices = lines.filter((s) => /^(\$[\d,]+|Free)$/i.test(s));
    const rest = lines.filter((s) => !prices.includes(s));
    const img = a.querySelector('img');
    if (!id || !prices.length || !rest[0]) continue;
    out.push({ id, title: rest[0], location: rest[1] || '', price_text: prices[0], was_text: prices[1] || null, photo_url: img ? img.src : null });
  }
  return out;
}

function readSold() {
  const out = [];
  for (const li of document.querySelectorAll('ul.srp-results > li, li.s-card, li.s-item')) {
    const lines = li.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    const sold = lines.find((s) => /^Sold\s+\w+ \d+, \d{4}$/.test(s));
    if (!sold) continue;
    const title = lines[lines.indexOf(sold) + 1] || '';
    const priceLine = lines.find((s) => /^\$[\d,]+(\.\d\d)?$/.test(s));
    const a = li.querySelector('a[href*="/itm/"]');
    const id = a && (a.href.match(/\/itm\/(\d+)/) || [])[1];
    if (!priceLine || !id || title === 'Shop on eBay') continue;
    const condition = lines.find((s) => /^(Brand New|New \(Other\)|Pre-Owned|Used|Open Box|Refurbished|Parts Only|For parts or not working|Certified - Refurbished|Excellent - Refurbished|Very Good - Refurbished|Good - Refurbished)$/i.test(s)) || '';
    out.push({ source: 'eBay sold', id, title: title.replace(/^New Listing\s*/i, ''), price: Number(priceLine.replace(/[$,]/g, '')), sold_on: sold.replace(/^Sold\s+/, ''), condition, url: `https://www.ebay.com/itm/${id}` });
  }
  return out;
}

function readDetail() {
  const txt = (document.querySelector('[role=main]') || document.body).innerText;
  const listed = (txt.match(/Listed [^\n]{0,60}/) || [])[0] || null;
  const cond = (txt.match(/Condition\s*\n\s*([^\n]{1,40})/) || [])[1] || null;
  const gone = /This listing is no longer available|This item has been sold|\bSold\b\s*\n/i.test(txt.slice(0, 600));
  return { listed, condition: cond, gone };
}

const money = (s) => (/free/i.test(s || '') ? 0 : Number(String(s || '').replace(/[$,]/g, '')));
const slug = (city) => String(city || '').toLowerCase().replace(/[^a-z]+/g, '');

export async function searchMarketplace({ query, max_price, city = 'Austin', radius_mi = 20 }) {
  const { core, max } = parseRequest(query, max_price);
  const key = JSON.stringify([core.toLowerCase(), max, slug(city), Number(radius_mi)]);
  const hit = cache.get(key);
  if (hit && hit.raw && Date.now() - hit.at < CACHE_MS) return { ...ranked(hit.raw), cached: true };

  const fbUrl = `https://www.facebook.com/marketplace/${slug(city) || 'austin'}/search/?query=${encodeURIComponent(core)}${max ? `&maxPrice=${max}` : ''}&radius=${Math.round(Number(radius_mi || 20) * 1.609)}&exact=false`;
  // Used items only (LH_ItemCondition=3000), since Marketplace listings are almost always used.
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(soldQuery(core))}&LH_Sold=1&LH_Complete=1&LH_ItemCondition=3000&_ipg=120`;

  // The same search asked twice while it runs shares one browsing session.
  if (inflight.has(key)) return inflight.get(key);
  const run = browse(async (page) => {
    const landed = await page.goto(fbUrl, 3500);
    if (/login|checkpoint/.test(landed)) throw new Error('Facebook is asking you to log in. Log in to Facebook in Helium yourself, then search again.');
    await page.scroll(2);
    const cards = await page.run(readCards);
    const area = await page.run(() => ([...document.querySelectorAll('span')].map((s) => s.textContent).find((t) => /within\s+\d+/i.test(t)) || '').replace(/\s+/g, ' ').trim());
    await sleep(jitter(3000, 5000));
    await page.goto(ebayUrl, 2500);
    const sold = await page.run(readSold);

    const listings = cards.map((c) => ({ ...c, ask: money(c.price_text), was: c.was_text ? money(c.was_text) : null, fb_url: `https://www.facebook.com/marketplace/item/${c.id}/` }))
      .filter((l) => isFinite(l.ask) && (max === null || l.ask <= max));
    const first = rank(listings, sold, { core, city });

    // Open only the best few to read how long they have been listed and their condition.
    const top = first.filter((d) => d.relevant.ok).slice(0, DETAILS);
    for (const d of top) {
      await sleep(jitter(2500, 5000));
      await page.goto(d.fb_url, 2000);
      Object.assign(d, await page.run(readDetail));
    }
    const gone = first.filter((d) => d.gone).length;
    const kept = first.filter((d) => !d.gone).map(({ relevant, estimate, comps, score, reason, discount, target, ...l }) => l);
    return { query, core, max, city, radius_mi: Number(radius_mi), area, fb_search_url: fbUrl, ebay_search_url: ebayUrl, sold_seen: sold.length, sold, gone_removed: gone, details_checked: top.length, listings: kept, searched_at: new Date().toISOString() };
  });
  inflight.set(key, run);
  try {
    // Cache what was read, not the ranking, so a pricing change applies without reading pages again.
    const raw = await run;
    cache.set(key, { at: Date.now(), raw });
    return ranked(raw);
  } finally { inflight.delete(key); }
}

function ranked({ listings, ...meta }) {
  return { ...meta, deals: rank(listings, meta.sold, { core: meta.core, city: meta.city }) };
}
