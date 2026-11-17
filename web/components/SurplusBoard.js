'use client';
import React, { useState } from 'react';
import { BUY_STATUS, STATUSES } from '../lib/surplus.js';

const e = React.createElement;
const TONE = {
  watch: 'bg-amber-200 text-amber-950',
  'needs preview': 'bg-accent text-foreground',
  [BUY_STATUS]: 'bg-[#9be8b8] text-foreground',
  skip: 'bg-red-200 text-red-800',
};

function chip(on, children, onClick) {
  return e('button', {
    type: 'button',
    onClick,
    'aria-pressed': on,
    className: `rounded-full border px-3 py-1.5 text-xs font-medium ${on ? 'border-border bg-brand text-white' : 'border-border bg-secondary text-muted-foreground hover:text-foreground'}`,
  }, children);
}

function fact(label, value, extra, className) {
  return e('div', { className: `min-w-0 ${className || ''}`, 'data-field': label.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
    e('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' }, label),
    e('div', { className: 'mt-0.5 break-words text-sm font-medium text-foreground' }, value),
    extra ? e('div', { className: 'mt-0.5 break-words text-xs text-muted-foreground' }, extra) : null);
}

const VERDICT = { watch: 'Watch', 'needs preview': 'Needs preview', [BUY_STATUS]: 'Buy, needs your yes', skip: 'Skip' };
const FILTER = { watch: 'Watch', 'needs preview': 'Needs preview', [BUY_STATUS]: 'Buy', skip: 'Skip' };

function keyNumber(label, value, note) {
  return e('div', { className: 'min-w-0 bg-card px-4 py-3' },
    e('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' }, label),
    e('div', { className: 'mt-0.5 break-words text-xl font-semibold leading-tight' }, value),
    note ? e('div', { className: 'mt-0.5 break-words text-xs text-muted-foreground' }, note) : null);
}

const RULE_TONE = { pass: 'bg-[#9be8b8] text-foreground', fail: 'bg-red-200 text-red-800', unknown: 'bg-amber-200 text-amber-950' };
const RULE_WORD = { pass: 'Pass', fail: 'Fail', unknown: 'Unknown' };

// Each rule shows a word as well as a color.
function ruleChecks(lot) {
  if (!lot.rule_checks || !lot.rule_checks.length) return null;
  return e('ul', { className: 'mb-3 grid list-none gap-1.5 p-0', 'data-field': 'rule-checks', 'aria-label': 'Rule checks' },
    lot.rule_checks.map((c) => e('li', { key: c.rule, className: 'flex items-start gap-2 text-xs leading-5', 'data-rule': c.rule, 'data-result': c.result },
      e('span', { className: `inline-flex w-[4.5rem] shrink-0 justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${RULE_TONE[c.result]}` }, RULE_WORD[c.result]),
      e('span', { className: 'min-w-0' }, e('span', { className: 'font-semibold' }, `${c.label}. `), c.text))));
}

function link(href, text) {
  if (!href) return e('span', { className: 'text-muted-foreground' }, 'no link');
  return e('a', { href, target: '_blank', rel: 'noopener', className: 'break-all text-link underline-offset-4 hover:underline' }, text);
}

function side(name, children) {
  return e('section', {
    'data-side': name,
    className: 'min-w-0',
  },
  e('h3', { className: 'border-b border-border pb-1 text-sm font-bold uppercase tracking-wide' }, name === 'buy' ? 'Buy side' : 'Sell side'),
  children);
}

// A long comp list folds, with the counts on the fold so nothing is hidden without a number.
function comps(lot) {
  if (!lot.comps.length) return e('p', { className: 'text-xs text-muted-foreground' }, 'No comps in the scan.');
  if (lot.comps.length <= 8) return compList(lot);
  const sold = lot.comps.filter((c) => c.type === 'sold').length;
  const kinds = lot.comps_working_sales || lot.comps_parts_sales
    ? ` (${lot.comps_working_sales} working, ${lot.comps_parts_sales} for parts)` : '';
  return e('details', { className: 'rounded-xl bg-secondary p-3', 'data-field': 'comps-fold' },
    e('summary', { className: 'cursor-pointer text-sm font-semibold' }, `${sold} sold comps${kinds}. Show all ${lot.comps.length}.`),
    lot.comps_note ? e('p', { className: 'mt-1 text-xs text-foreground' }, lot.comps_note) : null,
    compList(lot));
}

function compList(lot) {
  return e('ul', { className: 'mt-2 list-none p-0' }, lot.comps.map((c, i) => e('li', {
    key: `${c.title || 'comp'}-${i}`,
    className: 'border-t border-border py-2',
  },
  e('div', { className: 'flex items-start justify-between gap-3' },
    e('span', { className: 'min-w-0' },
      e('span', { className: `inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.type === 'asking' ? 'bg-amber-200 text-amber-950' : 'bg-[#9be8b8] text-foreground'}` }, c.type_label),
      e('span', { className: 'mt-1 block text-sm font-medium' }, c.title || 'Comp'),
      e('span', { className: 'mt-0.5 block text-xs text-muted-foreground' }, [
        c.marketplace,
        c.confidence === 'lower' ? 'Lower confidence' : 'Used for resale',
        c.type === 'sold' ? (c.lot_size ? `Lot of ${c.lot_size}${c.lot_price != null ? ` for $${c.lot_price.toFixed(2)}` : ''}` : 'Single unit') : null,
        c.type === 'sold' && c.condition === 'working' ? 'Working' : null,
        c.type === 'sold' && c.condition === 'parts' ? 'For parts' : null,
        c.type === 'sold' && c.battery === 'none' ? 'No battery' : null,
        c.type === 'sold' && c.battery === 'included' ? 'Battery included' : null,
        c.type === 'sold' && c.sold_on ? `Sold ${c.sold_on}` : null,
      ].filter(Boolean).join(' · ')),
      c.note ? e('span', { className: 'mt-1 block text-xs text-muted-foreground' }, c.note) : null),
    e('span', { className: 'shrink-0 text-right' },
      e('span', { className: 'block font-semibold tabular-nums' }, c.price_text),
      c.type === 'sold' && c.lot_size ? e('span', { className: 'block text-[11px] text-muted-foreground' }, 'a unit') : null,
      e('span', { className: 'mt-1 block text-xs' }, c.url ? link(c.url, 'Open comp') : 'no comp URL in the scan'))))));
}

const CASE_NAME = { low: 'Low', middle: 'Middle', high: 'High' };

// Low, middle and high resale, with profit at the max bid first and at today's bid second.
function casesBlock(lot) {
  if (!lot.cases || !lot.cases.length) return null;
  const atMax = lot.max_bid != null;
  return e('div', { className: 'rounded-xl bg-secondary p-3', 'data-field': 'cases' },
    e('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' }, 'Resale cases (estimates, sold as one lot)'),
    e('div', { className: 'mt-2', 'data-field': 'max-bid' },
      e('div', { className: 'flex items-baseline justify-between gap-3' },
        e('span', { className: 'text-sm font-semibold' }, 'Max bid'),
        e('span', { className: 'text-sm font-semibold tabular-nums' }, lot.max_bid_text)),
      e('p', { className: 'mt-1 text-xs leading-5 text-foreground' }, lot.max_bid_note)),
    e('ul', { className: 'mt-2 grid list-none gap-2 p-0' }, lot.cases.map((c) => e('li', { key: c.name, className: 'border-t border-border pt-2', 'data-case': c.name },
      e('div', { className: 'flex items-baseline justify-between gap-3' },
        e('span', { className: 'text-sm font-semibold' }, CASE_NAME[c.name]),
        e('span', { className: 'text-sm tabular-nums' }, `${c.unit_text} a unit · ${c.gross_text} for the lot`)),
      e('div', { className: 'mt-1 flex items-baseline justify-between gap-3 text-sm' },
        e('span', { className: 'text-muted-foreground' }, atMax ? `Profit at the ${lot.max_bid_text} max bid` : 'Profit at the max bid'),
        e('span', { className: 'font-semibold tabular-nums', 'data-field': `profit-max-${c.name}` }, atMax ? c.profit_at_max_bid_text : (lot.max_bid_text === 'none' ? 'no max bid' : 'unknown'))),
      e('div', { className: 'mt-0.5 flex items-baseline justify-between gap-3 text-xs text-muted-foreground' },
        e('span', null, lot.current_bid == null ? 'No bid on the lot yet' : `At today's ${lot.current_bid_text} bid`),
        e('span', { className: 'tabular-nums' }, c.profit_at_current_bid_text)),
      e('p', { className: 'mt-1 text-xs leading-5 text-muted-foreground' }, c.basis)))),
    lot.case_caveats.length ? e('p', { className: 'mt-2 text-xs leading-5 text-foreground', 'data-field': 'case-caveats' }, lot.case_caveats.join(' ')) : null,
    e('p', { className: 'mt-2 text-xs leading-5 text-muted-foreground' }, `After the platform fee and shipping. ${lot.net_estimate_note || 'Not confirmed.'}`));
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
      fact('Current bid', lot.current_bid_text, lot.bid_note),
      lot.opening_bid_text ? fact('Opening bid', lot.opening_bid_text, 'Not used as the current bid.') : null,
      fact('Bids', lot.bid_count_text, lot.bid_scan_text ? `Scan range ${lot.bid_scan_text}. ${lot.bid_scan_note || ''}`.trim() : lot.bid_scan_note),
      fact('Closes', lot.close_text, lot.countdown ? `Countdown ${lot.countdown}` : null),
      fact('Premium', lot.premium_text, lot.premium_note),
      fact('Tax', lot.tax_text, `${lot.tax_rate_text}. ${lot.tax_label}`),
      fact('Haul', lot.haul_text, lot.round_trip_miles == null ? 'Round trip unknown.' : `${lot.round_trip_miles} round-trip miles × ${lot.haul_rate_text}. ${lot.miles_note || ''}`.trim()),
      fact('Pickup', lot.pickup_address || 'unknown', [lot.pickup_terms, lot.pickup_deadline].filter(Boolean).join(' '), 'col-span-2'),
      fact('Quantity', lot.quantity == null ? 'unknown' : String(lot.quantity), lot.quantity_note),
      fact('All-in', lot.all_in_text, lot.all_in_note, 'col-span-2'))));

  const sell = side('sell', e('div', { className: 'mt-3 grid gap-3' },
    fact('Marketplaces', lot.marketplaces_text),
    fact('Resale / unit', lot.unit_resale_text, lot.resale_basis === 'sold' ? ['Middle case.', lot.resale_note].filter(Boolean).join(' ') : 'Unknown until a sold comp is cited.'),
    lot.batteries !== 'unknown' ? fact('Batteries', lot.batteries_text, lot.battery_cost_note) : null,
    fact('Unit count', lot.unit_count_text, lot.quantity_note),
    fact('Platform fee', lot.fee_text, lot.fee_note),
    fact('Shipping', lot.shipping_text, lot.shipping_text === 'unknown' ? 'Unknown shipping is not treated as $0.' : lot.shipping_note),
    fact('Gross resale', lot.gross_text),
    e('div', null,
      e('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' }, 'Confirmed net'),
      e('div', { className: 'mt-0.5 text-sm font-medium tabular-nums', 'data-field': 'net' }, lot.net_text),
      e('div', { className: 'mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' }, 'ROI'),
      e('div', { className: 'mt-0.5 text-sm font-medium tabular-nums', 'data-field': 'roi' }, lot.roi_text),
      e('p', { className: 'mt-2 text-xs text-muted-foreground' }, lot.profit_confidence === 'confirmed' ? 'Profit confirmed.' : 'Profit not confirmed.'),
      e('p', { className: 'mt-1 text-xs leading-5 text-muted-foreground' }, lot.profit_reason)),
    casesBlock(lot),
    comps(lot)));

  const low = lot.cases && lot.cases.find((c) => c.name === 'low');
  const high = lot.cases && lot.cases.find((c) => c.name === 'high');
  const atMax = lot.max_bid != null;
  const range = (k) => {
    const lo = low ? low[k] : 'unknown';
    const hi = high ? high[k] : 'unknown';
    if (lo === 'unknown' && hi === 'unknown') return 'unknown';
    return lo === hi ? lo : `${lo} to ${hi}`;
  };

  return e('article', {
    className: 'rounded-2xl border border-border bg-card shadow-tag',
    'data-lot': lot.id,
    'data-status': lot.status,
  },
  e('div', { className: 'flex flex-wrap items-start justify-between gap-3 p-4 pb-3' },
    e('div', { className: 'min-w-0 flex-1 basis-64' },
      e('h2', { className: 'text-lg font-semibold leading-snug' }, lot.title || 'Untitled lot'),
      e('p', { className: 'mt-1 text-xs text-muted-foreground' }, [lot.seller, lot.city, lot.auction_id ? `Auction ${lot.auction_id}` : null].filter(Boolean).join(' · '))),
    e('span', { className: `inline-flex shrink-0 rounded-full border border-border px-3 py-1 text-sm font-bold uppercase tracking-wide ${TONE[lot.status] || TONE.watch}`, 'data-field': 'verdict' }, VERDICT[lot.status] || lot.status)),
  lot.status_reason ? e('p', { className: 'px-4 pb-3 text-sm font-medium', 'data-field': 'status-reason' }, lot.status_reason) : null,

  // The four numbers that decide a lot, in one strip. Ink grid lines, no boxes inside boxes.
  e('div', { className: 'grid grid-cols-2 gap-[2px] border-y border-border bg-foreground md:grid-cols-4', 'data-field': 'key-numbers' },
    lot.current_bid == null && lot.bid_count === 0
      ? keyNumber('Current bid', 'No bids yet', lot.opening_bid_text ? `Opens at ${lot.opening_bid_text}` : 'Opening bid unknown')
      : keyNumber('Current bid', e('span', { className: 'tabular-nums' }, lot.current_bid_text), lot.bid_count_text === 'unknown' ? 'Bid count unknown' : `${lot.bid_count_text} bid${lot.bid_count_text === '1' ? '' : 's'}`),
    // No max bid has two causes: it cannot be worked out yet, or no bid works. The strip says which, with the reason.
    keyNumber('Max bid', e('span', { className: atMax ? 'font-marker text-2xl font-normal text-price' : 'text-muted-foreground', 'data-field': 'key-max-bid' }, lot.max_bid_text), atMax ? `All-in ${lot.max_bid_all_in_text}` : (lot.max_bid_note || 'Max bid is unknown.')),
    keyNumber(atMax ? 'Profit at max bid' : 'Profit at this bid', e('span', { className: 'tabular-nums' }, range(atMax ? 'profit_at_max_bid_text' : 'profit_at_current_bid_text')), 'Low to high case, estimate'),
    keyNumber('Closes in', lot.countdown || lot.close_text, lot.countdown ? lot.close_text : null)),

  e('div', { className: 'p-4' },
    lot.lock_flag ? e('p', { className: 'mb-3 rounded-xl border border-border bg-amber-200 px-3 py-2 text-sm font-medium text-amber-950', 'data-field': 'lock-flag' }, lot.lock_flag) : null,
    ruleChecks(lot),
    e('details', { className: 'group', open: lot.status !== 'skip', 'data-field': 'lot-detail' },
      e('summary', { className: 'cursor-pointer text-sm font-semibold underline-offset-4 hover:underline' }, 'Costs, resale and comps'),
      e('div', { 'data-sides': 'buy-sell', className: 'mt-3 grid gap-6 md:grid-cols-2' }, buy, sell),
      lot.risks.length ? e('p', { className: 'mt-3 text-xs text-amber-950' }, `Risk: ${lot.risks.join(' ')}`) : null,
      lot.scan_notes ? e('p', { className: 'mt-2 text-xs leading-5 text-muted-foreground' }, lot.scan_notes) : null)));
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
      e('div', { role: 'status', className: 'mb-4 border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm' },
        e('p', { className: 'font-medium' }, view.label || view.scanned_on_text),
        e('p', { className: 'mt-0.5 text-xs leading-5 text-muted-foreground' }, [
          view.source === 'seed' ? 'No newer feed is stored, so this is the scan file.' : 'Stored feed.',
          view.notice,
        ].filter(Boolean).join(' '))),

      e('div', { className: 'mb-2 grid grid-cols-2 gap-[2px] overflow-hidden rounded-2xl border border-border bg-foreground sm:grid-cols-3 lg:grid-cols-6', 'data-field': 'rules', 'aria-label': 'Flip rules' },
        [['Max cost per flip', view.rules.max_cost_text], ['Min profit', `${view.rules.min_profit_text} after fees and gas`], ['Pickup radius', `${view.rules.pickup_miles} mi from ${view.rules.home}`], ['Gas', `${view.rules.haul_per_mile_text} a mile${view.rules.haul_confirmed ? '' : ' (estimate)'}`], ['Tax assumed', view.rules.tax_assumption_text], ['Bids', 'Not placed here']].map(([k, v]) => e('div', { key: k, className: 'bg-card px-3 py-2' },
          e('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' }, k),
          e('div', { className: 'mt-0.5 text-sm font-medium' }, v)))),
      e('details', { className: 'mb-2 text-sm' },
        e('summary', { className: 'cursor-pointer font-medium underline-offset-4 hover:underline' }, 'How the rules are applied'),
        e('p', { className: 'mt-1 text-muted-foreground' }, `${view.rules.tax_assumption_label}. ${view.rules.tax_base_note} A lot that breaks a rule is skipped, with the reason on the lot. A lot stays off the buy list while resale or any cost is unknown.`)),

      view.trips.length ? e('details', { className: 'mb-5 text-sm', 'data-field': 'trips' },
        e('summary', { className: 'cursor-pointer font-medium underline-offset-4 hover:underline' }, `Combine trips: ${view.trips.length} shared pickup${view.trips.length === 1 ? '' : 's'}`),
        e('p', { className: 'mt-1 text-muted-foreground' }, view.trip_note),
        view.trips.map((trip) => e('div', { key: trip.address, className: 'mt-2 border-t border-border pt-2' },
          e('div', { className: 'font-medium' }, trip.address),
          e('div', { className: 'mt-1 text-muted-foreground' }, trip.titles.join(' · ')),
          e('p', { className: 'mt-1' }, trip.hint)))) : e('div', { className: 'mb-5' }),

      e('div', { className: 'mb-5 flex flex-wrap gap-2', 'aria-label': 'Status' },
        chip(status === 'all', `All ${counts.all}`, () => setStatus('all')),
        ...STATUSES.map((id) => chip(status === id, `${FILTER[id] || id} ${counts[id]}`, () => setStatus(id)))),

      shown.length === 0 && e('p', { className: 'text-sm text-muted-foreground' }, 'No lots with this status.'),
      e('div', { className: 'grid gap-4' }, shown.map((lot) => e(React.Fragment, { key: lot.id }, lotCard(lot))))));
}
