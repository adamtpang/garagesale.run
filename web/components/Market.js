'use client';
// The Market: one same-size tile per deal, with filters and a sort. A tile shows only what decides the
// deal. The long card is on the item page. See docs/TRANSFER-MARKET-SPEC.md.
import React, { useEffect, useState } from 'react';
import { cardFor } from '../lib/dealCard.js';
import { applyFilters, categoriesOf, DEFAULT_FILTERS, filtersToSearch, parseFilters, tileFor } from '../lib/market.js';
import TargetStar from './TargetStar.js';

const e = React.createElement;
// A solid fill and a word, so the verdict never rests on color alone.
const TONE = { buy: 'bg-[#9be8b8] text-foreground', watch: 'bg-amber-200 text-amber-950', skip: 'bg-red-200 text-red-900', gone: 'bg-secondary text-foreground' };
const LABEL = { all: 'All', buy: 'Buy', watch: 'Watch', skip: 'Skip' };
const FIELD = 'h-10 rounded-md border-2 border-border bg-card px-2 text-sm';

function chip(on, children, onClick) {
  return e('button', {
    type: 'button',
    onClick,
    'aria-pressed': on,
    className: `rounded-md border-2 border-border px-3 py-2 text-sm font-medium ${on ? 'bg-brand text-white' : 'bg-secondary text-foreground'}`,
  }, children);
}

function TilePhoto({ src, title }) {
  const [bad, setBad] = useState(false);
  const box = 'flex h-28 w-full items-center justify-center overflow-hidden border-b-2 border-border bg-secondary';
  if (!src || bad) return e('div', { className: `${box} text-4xl font-bold text-muted-foreground`, 'aria-hidden': 'true' }, String(title || '?').trim().charAt(0).toUpperCase());
  return e('div', { className: box }, e('img', { src, alt: '', loading: 'lazy', className: 'h-full w-full object-cover', onError: () => setBad(true) }));
}

// The star sits beside the link, not inside it, so it is its own button.
export function tile(t) {
  return e('div', { key: t.id, className: 'relative' }, e(TargetStar, { tile: t }), tileLink(t));
}

// A tile with no page to open (a gone target with no listing link) is not a link.
function tileLink(t) {
  return e(t.href ? 'a' : 'div', {
    href: t.href || undefined,
    ...(t.external ? { target: '_blank', rel: 'noopener' } : {}),
    'data-tile': t.id,
    'data-decision': t.decision,
    className: 'flex h-full flex-col overflow-hidden rounded-lg border-2 border-border bg-card shadow-tag outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-brand',
  },
  e(TilePhoto, { src: t.photo_url, title: t.title }),
  e('div', { className: 'flex flex-1 flex-col gap-1 p-3' },
    e('div', { className: 'flex items-start justify-between gap-2' },
      e('span', { className: `rounded-md border-2 border-border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${TONE[t.decision]}`, 'data-field': 'label' }, t.label),
      e('span', { className: 'font-marker text-2xl leading-none text-price', 'data-field': 'profit' }, t.profit || e('span', { className: 'font-sans text-sm font-semibold text-muted-foreground' }, 'Profit unknown'))),
    e('h2', { className: 'line-clamp-2 text-sm font-semibold leading-snug' }, t.title),
    e('p', { className: 'text-sm tabular-nums', 'data-field': 'price' }, `${t.price} · ${t.max_bid}`),
    e('p', { className: 'text-sm', 'data-field': 'when' }, `${t.closes} · ${t.drive}`),
    t.reason ? e('p', { className: 'line-clamp-2 text-xs leading-5 text-muted-foreground', 'data-field': 'reason' }, t.reason) : null));
}

export default function Market({ feed, now, failed, refreshFailed, loading, initialFilters = null }) {
  const [f, setF] = useState(initialFilters || DEFAULT_FILTERS);
  // What is typed in the number boxes, kept as text so "12." or "0" can be typed. The filter takes the number.
  const [typed, setTyped] = useState({ maxPrice: null, maxDrive: null });
  const shownText = (k) => (typed[k] != null ? typed[k] : (f[k] ?? ''));
  const typeNumber = (k, text) => {
    setTyped((t) => ({ ...t, [k]: text }));
    const n = Number(text);
    set({ [k]: text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null });
  };
  // Filters live in the address bar, so a refresh or a shared link keeps them.
  useEffect(() => { if (!initialFilters && typeof window !== 'undefined') setF(parseFilters(window.location.search)); }, [initialFilters]);
  const set = (patch) => {
    const next = { ...f, ...patch };
    setF(next);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `${window.location.pathname}${filtersToSearch(next)}`);
  };

  const items = (feed && feed.items) || [];
  const pairs = items.map((item) => ({ item, card: cardFor(item, now) }));
  const counts = { all: pairs.length, buy: 0, watch: 0, skip: 0 };
  for (const p of pairs) counts[p.card.decision] += 1;
  const { pairs: shown, unknownKept } = applyFilters(pairs, f, now);
  const cats = categoriesOf(items, feed && feed.rules);
  const r = feed && feed.rules;
  const filtered = filtersToSearch({ ...f, sort: 'profit' }) !== '';

  return e('section', null,
    e('div', { className: 'mb-4 flex flex-wrap items-end justify-between gap-3' },
      e('div', null,
        e('h1', { className: 'text-3xl font-semibold tracking-tight md:text-4xl' }, 'Market'),
        e('p', { className: 'mt-2 max-w-2xl text-base text-foreground' }, 'Profit is after every fee, gas and your drive time. Tap a tile for the full breakdown. Nothing here bids, buys or messages a seller.')),
      e('a', { href: '/surplus', className: 'inline-flex h-9 items-center rounded-md border-2 border-border bg-secondary px-4 text-sm font-medium shadow-tag-sm' }, 'Surplus detail')),

    loading ? e('div', { role: 'status', className: 'rounded-lg border-2 border-border bg-card p-6 text-base' }, 'Loading deals…') : null,
    failed ? e('div', { role: 'status', className: 'rounded-lg border-2 border-border bg-card p-6 text-base' },
      e('p', { className: 'font-semibold' }, 'Could not load the deals feed.'),
      e('button', { type: 'button', className: 'mt-3 underline', onClick: () => window.location.reload() }, 'Try again')) : null,

    feed ? e('div', null,
      refreshFailed ? e('p', { role: 'status', className: 'mb-3 border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm', 'data-field': 'refresh-failed' },
        'The last refresh failed, so these are the deals from the last load. It will try again.') : null,
      r ? e('p', { className: 'mb-3 text-sm', 'data-field': 'rules-line' },
        e('b', null, 'Your rules: '),
        `max buy $${r.max_cost}, at least $${r.min_profit} profit, within ${r.pickup_miles} miles and ${r.max_drive_minutes} minutes round trip of ${String(r.home).split(',')[0]}, time at $${r.hourly_rate} an hour.`) : null,
      (feed.stale || []).length ? e('div', { role: 'status', className: 'mb-4 border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm', 'data-field': 'stale' },
        feed.stale.map((s) => e('p', { key: s }, s))) : null,

      // The filter bar.
      e('div', { className: 'mb-3 flex flex-wrap gap-2', 'aria-label': 'Verdict' },
        ...['all', 'buy', 'watch', 'skip'].map((v) => chip(f.verdict === v, `${LABEL[v]} ${counts[v]}`, () => set({ verdict: v })))),
      e('div', { className: 'mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end', 'data-field': 'filters' },
        e('label', { className: 'grid gap-1 text-xs font-semibold' }, 'Source',
          e('select', { className: FIELD, value: f.source, onChange: (ev) => set({ source: ev.target.value }) },
            e('option', { value: 'all' }, 'Everything'), e('option', { value: 'surplus' }, 'Surplus lots'), e('option', { value: 'listing' }, 'Local listings'))),
        e('label', { className: 'grid gap-1 text-xs font-semibold' }, 'Category',
          e('select', { className: FIELD, value: f.category, onChange: (ev) => set({ category: ev.target.value }) },
            e('option', { value: 'all' }, 'Any'), ...cats.map((c) => e('option', { key: c, value: c }, c)))),
        e('label', { className: 'grid gap-1 text-xs font-semibold' }, 'Max price ($)',
          e('input', { className: `${FIELD} w-full sm:w-28`, type: 'number', inputMode: 'decimal', min: 1, value: shownText('maxPrice'), placeholder: 'Any', onChange: (ev) => typeNumber('maxPrice', ev.target.value) })),
        e('label', { className: 'grid gap-1 text-xs font-semibold' }, 'Max drive (min)',
          e('input', { className: `${FIELD} w-full sm:w-28`, type: 'number', inputMode: 'numeric', min: 1, value: shownText('maxDrive'), placeholder: 'Any', onChange: (ev) => typeNumber('maxDrive', ev.target.value) })),
        e('label', { className: 'col-span-2 grid gap-1 text-xs font-semibold sm:col-span-1' }, 'Sort',
          e('select', { className: FIELD, value: f.sort, onChange: (ev) => set({ sort: ev.target.value }) },
            e('option', { value: 'profit' }, 'Profit, best first'), e('option', { value: 'closing' }, 'Closing soonest'), e('option', { value: 'drive' }, 'Shortest drive'))),
        filtered ? e('button', { type: 'button', className: 'col-span-2 h-10 text-sm font-medium underline underline-offset-4 sm:col-span-1', onClick: () => { setTyped({ maxPrice: null, maxDrive: null }); set({ ...DEFAULT_FILTERS, sort: f.sort }); } }, 'Clear filters') : null),
      unknownKept ? e('p', { className: 'mb-3 text-sm text-muted-foreground', 'data-field': 'unknown-kept' }, `${unknownKept} deal${unknownKept === 1 ? '' : 's'} with an unknown price or drive time ${unknownKept === 1 ? 'is' : 'are'} kept in, since they can't be ruled out.`) : null,

      pairs.length === 0 ? e('p', { className: 'rounded-lg border-2 border-border bg-card p-6 text-base' }, (feed.hidden && (feed.hidden.closed_lots || feed.hidden.old_listings)) ? 'No open deals right now. Everything in the last scan has closed or is too old. A new scan has not been posted.' : 'No deals in the feed yet. Flipping has not posted a scan.') : null,
      pairs.length > 0 && shown.length === 0 ? e('p', { className: 'rounded-lg border-2 border-border bg-card p-6 text-base' }, 'Nothing passes these filters.') : null,
      e('div', { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3' }, shown.map(({ item, card }) => tile(tileFor(item, card))))) : null);
}
