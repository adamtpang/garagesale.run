'use client';
import React, { useState } from 'react';
import { cardFor, sortCards } from '../lib/dealCard.js';

const e = React.createElement;
// A solid fill and a word, so the label never rests on color alone.
const TONE = { buy: 'bg-[#9be8b8] text-foreground', watch: 'bg-amber-200 text-amber-950', skip: 'bg-red-200 text-red-900' };
const SMALL = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

function chip(on, children, onClick) {
  return e('button', {
    type: 'button',
    onClick,
    'aria-pressed': on,
    className: `rounded-full border px-3 py-2 text-sm font-medium ${on ? 'border-border bg-brand text-white' : 'border-border bg-secondary text-foreground'}`,
  }, children);
}

function PhotoBox({ src, title }) {
  const [bad, setBad] = useState(false);
  const box = 'flex aspect-[16/10] w-full items-center justify-center overflow-hidden bg-secondary md:aspect-auto md:h-full md:min-h-[220px]';
  if (!src || bad) return e('div', { className: `${box} text-5xl font-bold text-muted-foreground`, 'aria-label': 'No photo' }, String(title || '?').trim().charAt(0).toUpperCase());
  return e('div', { className: box }, e('img', { src, alt: title, loading: 'lazy', className: 'h-full w-full object-cover', onError: () => setBad(true) }));
}

function extLink(href, text) {
  return e('a', { href, target: '_blank', rel: 'noopener', className: 'font-medium text-link underline underline-offset-4' }, text);
}

function dealCard(card) {
  return e('article', {
    key: card.id,
    className: 'overflow-hidden rounded-2xl border border-border bg-card shadow-tag md:grid md:grid-cols-[240px_1fr]',
    'data-card': card.id,
    'data-decision': card.decision,
  },
  e(PhotoBox, { src: card.photo_url, title: card.title }),
  e('div', { className: 'min-w-0 md:border-l md:border-border' },
    e('div', { className: 'p-4' },
      e('div', { className: 'flex flex-wrap items-start justify-between gap-2' },
        e('span', { className: `inline-flex rounded-full border border-border px-3 py-1 text-base font-bold uppercase tracking-wide ${TONE[card.decision]}`, 'data-field': 'label' }, card.label),
        card.countdown ? e('span', { className: 'text-sm font-semibold', 'data-field': 'countdown', title: card.closes_text || undefined }, card.countdown) : null),
      e('h2', { className: 'mt-2 text-lg font-semibold leading-snug' }, card.title),
      card.place ? e('p', { className: 'mt-0.5 text-sm text-muted-foreground' }, card.place) : null,

      // The one number that matters, in plain words.
      e('p', { className: 'mt-3 text-2xl font-bold leading-tight sm:text-3xl', 'data-field': 'headline' },
        card.headline,
        card.amount ? e(React.Fragment, null, ' ', e('span', { className: 'whitespace-nowrap font-marker text-3xl font-normal text-price sm:text-4xl', 'data-field': 'amount' }, card.amount)) : null),
      e('p', { className: 'mt-1 text-sm text-foreground', 'data-field': 'basis' }, card.basis)),

    // Right under it: what it costs.
    e('dl', { className: 'grid grid-cols-2 gap-[2px] border-y border-border bg-foreground lg:grid-cols-4', 'data-field': 'costs' },
      card.costs.map((c) => e('div', { key: c.key, className: 'min-w-0 bg-card px-4 py-3', 'data-cost': c.key },
        e('dt', { className: SMALL }, c.label),
        e('dd', { className: 'mt-0.5 text-lg font-semibold tabular-nums' }, c.value),
        c.note ? e('dd', { className: 'break-words text-xs leading-5 text-muted-foreground' }, c.note) : null))),

    e('div', { className: 'p-4' },
      e('div', { className: SMALL }, 'Profit if it sells low, middle or high'),
      e('dl', { className: 'mt-1 grid grid-cols-3 gap-2', 'data-field': 'cases' },
        card.cases.map((c) => e('div', { key: c.name, className: 'rounded-xl bg-secondary px-3 py-2', 'data-case': c.name },
          e('dt', { className: 'text-xs font-semibold' }, c.label),
          e('dd', { className: 'text-base font-semibold tabular-nums' }, c.value)))),

      card.reason ? e('p', { className: 'mt-3 text-sm leading-6', 'data-field': 'reason' }, e('b', null, `Why ${card.label.toLowerCase()}: `), card.reason) : null,
      card.risk ? e('p', { className: 'mt-1 text-sm leading-6', 'data-field': 'risk' }, e('b', null, 'Main risk: '), card.risk) : null,

      e('div', { className: 'mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm', 'data-field': 'links' },
        card.listing_url ? extLink(card.listing_url, card.listing_text) : e('span', { className: 'text-muted-foreground' }, 'No listing link'),
        ...card.comps.map((c) => e(React.Fragment, { key: c.url }, extLink(c.url, c.text))),
        card.comps_more ? e('span', { className: 'text-muted-foreground' }, `and ${card.comps_more} more sold`) : null,
        card.comps_none ? e('span', { className: 'text-muted-foreground' }, card.comps_none) : null))));
}

export default function DealFeed({ feed, now, failed, refreshFailed, loading }) {
  const [show, setShow] = useState('all');
  const items = (feed && feed.items) || [];
  const cards = sortCards(items.map((it) => cardFor(it, now)));
  const counts = { all: cards.length, buy: 0, watch: 0, skip: 0 };
  for (const c of cards) counts[c.decision] += 1;
  const shown = cards.filter((c) => show === 'all' || c.decision === show);
  const r = feed && feed.rules;

  return e('section', null,
    e('div', { className: 'mb-4 flex flex-wrap items-end justify-between gap-3' },
      e('div', null,
        e('h1', { className: 'text-3xl font-semibold tracking-tight md:text-4xl' }, 'Deals'),
        e('p', { className: 'mt-2 max-w-2xl text-base text-foreground' }, 'Best profit first. Profit is after every fee, gas and your drive time. Nothing here bids, buys or messages a seller.')),
      e('div', { className: 'flex flex-wrap gap-2 text-sm' },
        e('a', { href: '/surplus', className: 'inline-flex h-9 items-center rounded-full border border-border bg-secondary px-4 font-medium shadow-tag-sm' }, 'Surplus detail'),
        e('a', { href: '/ladder', className: 'inline-flex h-9 items-center rounded-full border border-border bg-secondary px-4 font-medium shadow-tag-sm' }, 'Bankroll'),
        e('a', { href: '/ledger', className: 'inline-flex h-9 items-center rounded-full border border-border bg-secondary px-4 font-medium shadow-tag-sm' }, 'Ledger'))),

    loading ? e('div', { role: 'status', className: 'rounded-2xl border border-border bg-card p-6 text-base' }, 'Loading deals…') : null,
    failed ? e('div', { role: 'status', className: 'rounded-2xl border border-border bg-card p-6 text-base' },
      e('p', { className: 'font-semibold' }, 'Could not load the deals feed.'),
      e('button', { type: 'button', className: 'mt-3 underline', onClick: () => window.location.reload() }, 'Try again')) : null,

    feed ? e('div', null,
      refreshFailed ? e('p', { role: 'status', className: 'mb-3 border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm', 'data-field': 'refresh-failed' },
        `The last refresh failed, so these are the deals as of ${feed.generated_at ? new Date(feed.generated_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'the last load'}. It will try again.`) : null,
      r ? e('p', { className: 'mb-3 text-sm', 'data-field': 'rules-line' },
        e('b', null, 'Your rules: '),
        `max buy $${r.max_cost} (${r.bankroll_source === 'ledger' ? 'bankroll now' : 'starting bankroll'}), at least $${r.min_profit} profit, within ${r.pickup_miles} miles and ${r.max_drive_minutes} minutes round trip of ${String(r.home).split(',')[0]}, time at $${r.hourly_rate} an hour.`) : null,
      (feed.stale || []).length ? e('div', { role: 'status', className: 'mb-4 border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm', 'data-field': 'stale' },
        feed.stale.map((s) => e('p', { key: s }, s))) : null,

      e('div', { className: 'mb-4 flex flex-wrap gap-2', 'aria-label': 'Show' },
        chip(show === 'all', `All ${counts.all}`, () => setShow('all')),
        chip(show === 'buy', `Buy ${counts.buy}`, () => setShow('buy')),
        chip(show === 'watch', `Watch ${counts.watch}`, () => setShow('watch')),
        chip(show === 'skip', `Skip ${counts.skip}`, () => setShow('skip'))),

      cards.length === 0 ? e('p', { className: 'rounded-2xl border border-border bg-card p-6 text-base' }, (feed.hidden && (feed.hidden.closed_lots || feed.hidden.old_listings)) ? 'No open deals right now. Everything in the last scan has closed or is too old. A new scan has not been posted.' : 'No deals in the feed yet.') : null,
      cards.length > 0 && shown.length === 0 ? e('p', { className: 'text-base' }, `Nothing is marked ${show} right now.`) : null,
      e('div', { className: 'grid gap-5' }, shown.map(dealCard))) : null);
}
