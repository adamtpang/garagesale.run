'use client';
import React, { useState } from 'react';
import { BUY_STATUS, STATUSES } from '../lib/surplus.js';

const e = React.createElement;
const TONE = {
  watch: 'bg-amber-200 text-amber-950',
  'needs preview': 'bg-brand/25 text-link',
  [BUY_STATUS]: 'bg-[#9be8b8] text-foreground',
  skip: 'bg-red-200 text-red-800',
};

function chip(on, children, onClick) {
  return e('button', {
    type: 'button',
    onClick,
    'aria-pressed': on,
    className: `rounded-full border px-3 py-1.5 text-xs font-medium ${on ? 'border-border bg-brand text-foreground' : 'border-border bg-secondary text-muted-foreground hover:text-foreground'}`,
  }, children);
}

function fact(label, value, extra, className) {
  return e('div', { className: `min-w-0 ${className || ''}`, 'data-field': label.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
    e('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' }, label),
    e('div', { className: 'mt-0.5 break-words text-sm font-medium text-foreground' }, value),
    extra ? e('div', { className: 'mt-0.5 break-words text-xs text-muted-foreground' }, extra) : null);
}

function link(href, text) {
  if (!href) return e('span', { className: 'text-muted-foreground' }, 'no link');
  return e('a', { href, target: '_blank', rel: 'noopener', className: 'break-all text-link underline-offset-4 hover:underline' }, text);
}

function side(name, children) {
  return e('section', {
    'data-side': name,
    className: 'min-w-0 rounded-xl border border-border bg-white p-3',
  },
  e('h3', { className: 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' }, name === 'buy' ? 'Buy' : 'Sell'),
  children);
}

function comps(lot) {
  if (!lot.comps.length) return e('p', { className: 'text-xs text-muted-foreground' }, 'No comps in the scan.');
  return e('ul', { className: 'mt-2' }, lot.comps.map((c, i) => e('li', {
    key: `${c.title || 'comp'}-${i}`,
    className: 'border-t border-border py-2',
  },
  e('div', { className: 'flex items-start justify-between gap-3' },
    e('span', { className: 'min-w-0' },
      e('span', { className: `inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.type === 'asking' ? 'bg-amber-200 text-amber-950' : 'bg-[#9be8b8] text-foreground'}` }, c.type_label),
      e('span', { className: 'mt-1 block text-sm font-medium' }, c.title || 'Comp'),
      e('span', { className: 'mt-0.5 block text-xs text-muted-foreground' }, [c.marketplace, c.confidence === 'lower' ? 'Lower confidence' : 'Used for resale'].filter(Boolean).join(' · ')),
      c.note ? e('span', { className: 'mt-1 block text-xs text-muted-foreground' }, c.note) : null),
    e('span', { className: 'shrink-0 text-right' },
      e('span', { className: 'block font-semibold tabular-nums' }, c.price_text),
      e('span', { className: 'mt-1 block text-xs' }, c.url ? link(c.url, 'Open comp') : 'no comp URL in the scan'))))));
}

function lotCard(lot) {
  const buy = side('buy', e('div', { className: 'mt-3 grid gap-3' },
    lot.photo_url
      ? e('div', { className: 'flex aspect-[16/10] items-center justify-center overflow-hidden rounded-xl bg-secondary' },
        e('img', { src: lot.photo_url, alt: lot.title || 'Lot photo', className: 'h-full w-full object-cover' }))
      : e('div', { className: 'rounded-xl bg-secondary px-4 py-5 text-center text-xs text-muted-foreground' }, lot.photo_note || 'No photo in the scan.'),
    e('div', { className: 'grid grid-cols-2 gap-3' },
      fact('Source', lot.source_site || 'unknown'),
      fact('Seller', lot.seller || 'unknown'),
      fact('Where', lot.city || 'unknown', lot.miles_text),
      fact('Lot', link(lot.url, lot.auction_id ? `Auction ${lot.auction_id}` : 'Open lot')),
      fact('Current bid', e('span', { className: 'font-marker text-2xl font-normal text-price' }, lot.current_bid_text), lot.bid_note),
      lot.opening_bid_text ? fact('Opening bid', lot.opening_bid_text, 'Not used as the current bid.') : null,
      fact('Bids', lot.bid_count_text, lot.bid_scan_text ? `Scan range ${lot.bid_scan_text}. ${lot.bid_scan_note || ''}`.trim() : lot.bid_scan_note),
      fact('Closes', lot.close_text, lot.countdown ? `Countdown ${lot.countdown}` : null),
      fact('Premium', lot.premium_text, lot.premium_note),
      fact('Tax', lot.tax_text, `${lot.tax_rate_text}. ${lot.tax_label}`),
      fact('Haul', lot.haul_text, lot.round_trip_miles == null ? 'Round trip unknown.' : `${lot.round_trip_miles} round-trip miles × $0.18. ${lot.miles_note || ''}`.trim()),
      fact('Pickup', lot.pickup_address || 'unknown', [lot.pickup_terms, lot.pickup_deadline].filter(Boolean).join(' '), 'col-span-2'),
      fact('Quantity', lot.quantity == null ? 'unknown' : String(lot.quantity), lot.quantity_note),
      fact('All-in', lot.all_in_text, lot.all_in_note, 'col-span-2'))));

  const sell = side('sell', e('div', { className: 'mt-3 grid gap-3' },
    fact('Marketplaces', lot.marketplaces_text),
    fact('Resale / unit', lot.unit_resale_text, lot.resale_basis === 'sold' ? ['Median of the cited sold comps.', lot.resale_note].filter(Boolean).join(' ') : 'Unknown until a sold comp is cited.'),
    fact('Unit count', lot.unit_count_text, lot.quantity_note),
    fact('Platform fee', lot.fee_text, lot.fee_note),
    fact('Shipping', lot.shipping_text, lot.shipping_text === 'unknown' ? 'Unknown shipping is not treated as $0.' : lot.shipping_note),
    fact('Gross resale', lot.gross_text),
    e('div', { className: 'rounded-xl bg-white p-3' },
      e('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' }, 'Est. net'),
      e('div', { className: 'mt-1 text-2xl font-semibold tabular-nums', 'data-field': 'net' }, lot.net_text),
      e('div', { className: 'mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' }, 'ROI'),
      e('div', { className: 'mt-1 text-lg font-semibold tabular-nums', 'data-field': 'roi' }, lot.roi_text),
      lot.net_estimate_text ? e('div', { className: 'mt-2 rounded-lg border border-border bg-amber-200 p-2', 'data-field': 'net-estimate' },
        e('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-amber-950' }, 'Rough estimate'),
        e('div', { className: 'mt-1 text-lg font-semibold tabular-nums' }, lot.net_estimate_text),
        e('p', { className: 'mt-1 text-xs leading-5 text-muted-foreground' }, lot.net_estimate_note)) : null,
      e('p', { className: 'mt-2 text-xs text-muted-foreground' }, lot.profit_confidence === 'confirmed' ? 'Profit confirmed.' : 'Profit not confirmed.'),
      e('p', { className: 'mt-1 text-xs leading-5 text-muted-foreground' }, lot.profit_reason)),
    comps(lot)));

  return e('article', {
    className: 'rounded-2xl border border-border bg-card p-4 shadow-tag',
    'data-lot': lot.id,
    'data-status': lot.status,
  },
  e('div', { className: 'mb-4 flex flex-wrap items-start justify-between gap-3' },
    e('div', { className: 'min-w-0' },
      e('h2', { className: 'text-lg font-semibold leading-snug' }, lot.title || 'Untitled lot'),
      e('p', { className: 'mt-1 text-xs text-muted-foreground' }, [lot.seller, lot.city, lot.auction_id ? `Auction ${lot.auction_id}` : null].filter(Boolean).join(' · '))),
    e('span', { className: `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[lot.status] || TONE.watch}` }, lot.status)),
  lot.status_reason ? e('p', { className: 'mb-3 text-xs text-amber-950' }, lot.status_reason) : null,
  e('div', { 'data-sides': 'buy-sell', className: 'grid gap-3 md:grid-cols-2' }, buy, sell),
  lot.risks.length ? e('p', { className: 'mt-3 text-xs text-amber-950' }, `Risk: ${lot.risks.join(' ')}`) : null,
  lot.scan_notes ? e('p', { className: 'mt-2 text-xs leading-5 text-muted-foreground' }, lot.scan_notes) : null);
}

export default function SurplusBoard({ view, failed, loading }) {
  const [status, setStatus] = useState('all');
  const lots = (view && view.lots) || [];
  const counts = { all: lots.length };
  for (const id of STATUSES) counts[id] = lots.filter((lot) => lot.status === id).length;
  const shown = lots.filter((lot) => status === 'all' || lot.status === status);

  return e('section', null,
    e('div', { className: 'mb-4 flex flex-wrap items-end justify-between gap-3' },
      e('div', null,
        e('h1', { className: 'text-3xl font-semibold tracking-tight md:text-4xl' }, 'Surplus arbitrage'),
        e('p', { className: 'mt-2 max-w-2xl text-sm text-muted-foreground' }, 'Buy a government surplus lot, then sell the units somewhere else. The two sides stay apart. This board does not place bids.')),
      e('div', { className: 'flex flex-wrap gap-2' },
        e('a', { href: '/dashboard', className: 'inline-flex h-9 items-center rounded-full border border-border bg-secondary px-4 shadow-tag-sm text-sm font-medium text-secondary-foreground' }, 'Deals'))),

    loading && e('div', { role: 'status', className: 'rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground' }, 'Loading the surplus scan…'),
    failed && e('div', { role: 'status', className: 'rounded-2xl border border-border bg-card p-6 text-sm' },
      e('p', { className: 'font-medium' }, 'Could not load the surplus feed.'),
      e('button', { type: 'button', className: 'mt-3 underline', onClick: () => window.location.reload() }, 'Retry')),

    view && e('div', null,
      e('div', { role: 'status', className: 'mb-4 rounded-2xl border border-border bg-amber-200 px-4 py-3 text-sm' },
        e('p', { className: 'font-medium' }, view.label || view.scanned_on_text),
        e('p', { className: 'mt-1 text-muted-foreground' }, [
          view.source === 'seed' ? 'No newer feed is stored, so this is the scan file.' : 'Stored feed.',
          view.notice,
        ].filter(Boolean).join(' '))),

      e('div', { className: 'mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4' },
        [['Home', view.rules.home], ['Haul', '$0.18 × round-trip miles'], ['Tax assumption', '8.25%'], ['Bids', 'Not placed here']].map(([k, v]) => e('div', { key: k, className: 'rounded-2xl border border-border bg-card px-4 py-3' },
          e('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' }, k),
          e('div', { className: 'mt-1 text-sm font-medium' }, v)))),
      e('p', { className: 'mb-4 text-sm text-muted-foreground' }, `${view.rules.tax_assumption_label}. ${view.rules.tax_base_note} A lot stays off the buy list while resale or any cost is unknown.`),

      e('div', { className: 'mb-5 rounded-2xl border border-border bg-card p-4' },
        e('h2', { className: 'text-sm font-semibold' }, 'Combine trips'),
        e('p', { className: 'mt-1 text-sm text-muted-foreground' }, view.trip_note),
        view.trips.map((trip) => e('div', { key: trip.address, className: 'mt-3 border-t border-border pt-3 text-sm' },
          e('div', { className: 'font-medium' }, trip.address),
          e('div', { className: 'mt-1 text-muted-foreground' }, trip.titles.join(' · ')),
          e('p', { className: 'mt-1' }, trip.hint)))),

      e('div', { className: 'mb-5 flex flex-wrap gap-2', 'aria-label': 'Status' },
        chip(status === 'all', `All ${counts.all}`, () => setStatus('all')),
        ...STATUSES.map((id) => chip(status === id, `${id === BUY_STATUS ? 'Buy candidate' : id} ${counts[id]}`, () => setStatus(id)))),

      shown.length === 0 && e('p', { className: 'text-sm text-muted-foreground' }, 'No lots with this status.'),
      e('div', { className: 'grid gap-4' }, shown.map((lot) => e(React.Fragment, { key: lot.id }, lotCard(lot))))));
}
