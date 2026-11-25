'use client';
import React from 'react';
import { buildLadder, chartPoints, money } from '../lib/ladder.js';

const e = React.createElement;
const SMALL = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

function big(label, value, note, marker) {
  return e('div', { className: 'min-w-0 bg-card px-4 py-3' },
    e('div', { className: SMALL }, label),
    e('div', { className: marker ? 'mt-0.5 text-3xl font-bold tracking-tight text-price' : 'mt-0.5 text-2xl font-bold tabular-nums' }, value),
    note ? e('div', { className: 'text-xs leading-5 text-muted-foreground' }, note) : null);
}

export default function Ladder({ doc }) {
  const l = buildLadder(doc);
  const chart = chartPoints(l);
  const up = l.growth >= 0;
  return e('section', { 'data-field': 'ladder' },
    e('div', { className: 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4', 'data-field': 'ladder-totals' },
      big('Started with', money(l.start), l.start_source === 'ledger' ? 'Set in the ledger' : 'From the rules file'),
      big('Bankroll now', money(l.now), `${l.steps.length} step${l.steps.length === 1 ? '' : 's'} so far`, true),
      big(up ? 'Grown by' : 'Down by', money(Math.abs(l.growth)), l.growth_pct == null ? null : `${Math.abs(l.growth_pct)}% ${up ? 'up' : 'down'} from the start`),
      big('Max buy right now', money(l.max_buy), l.committed > 0 ? `${money(l.committed)} is promised to ${l.open_approvals} open approval${l.open_approvals === 1 ? '' : 's'}` : 'The whole bankroll is free')),

    e('p', { className: 'mt-3 text-sm', 'data-field': 'ladder-summary' },
      `Profit on sold items: ${money(l.realized_profit)}. `,
      l.on_hand_count ? `${l.on_hand_count} item${l.on_hand_count === 1 ? '' : 's'} bought and not sold yet, ${money(l.on_hand_value)} tied up.` : 'Nothing is bought and waiting to sell.'),

    l.steps.length > 0 ? e('figure', { className: 'mt-4 rounded-2xl border border-border bg-card p-3' },
      e('svg', { viewBox: '0 0 600 160', role: 'img', 'aria-label': `Bankroll from ${money(l.start)} to ${money(l.now)} over ${l.steps.length} steps`, className: 'block h-auto w-full' },
        e('line', { x1: 12, x2: 588, y1: chart.start_y, y2: chart.start_y, stroke: '#545454', strokeWidth: 1, strokeDasharray: '4 4' }),
        e('path', { d: chart.path, fill: 'none', stroke: '#0866FF', strokeWidth: 3, strokeLinejoin: 'round', 'data-field': 'ladder-line' })),
      e('figcaption', { className: 'mt-1 text-xs text-muted-foreground' }, `Each step is one buy or one sale. The dashed line is the ${money(l.start)} start.`)) : null,

    e('h2', { className: 'mt-6 text-xl font-semibold' }, 'Every step'),
    l.undated ? e('p', { className: 'mt-1 text-sm text-muted-foreground' }, `${l.undated} step${l.undated === 1 ? ' has' : 's have'} no date in the ledger and ${l.undated === 1 ? 'is' : 'are'} listed last.`) : null,
    e('ol', { className: 'mt-3 grid list-none gap-px overflow-hidden rounded-2xl border border-border bg-border p-0', 'data-field': 'ladder-steps' },
      e('li', { className: 'flex items-baseline justify-between gap-3 bg-card px-4 py-3', 'data-step': 'start' },
        e('span', { className: 'font-semibold' }, 'Start'),
        e('span', { className: 'font-semibold tabular-nums' }, money(l.start))),
      l.steps.map((s, i) => e('li', { key: `${s.kind}-${s.order}-${i}`, className: 'bg-card px-4 py-3', 'data-step': s.kind },
        e('div', { className: 'flex items-baseline justify-between gap-3' },
          e('span', { className: 'min-w-0' },
            e('span', { className: `mr-2 inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-bold uppercase ${s.kind === 'sell' ? 'bg-success/15 text-success' : 'bg-secondary'}` }, s.kind === 'sell' ? 'Sold' : 'Bought'),
            e('span', { className: 'font-medium' }, s.item)),
          e('span', { className: 'shrink-0 text-base font-semibold tabular-nums' }, `${s.change >= 0 ? '+' : '-'}${money(Math.abs(s.change))}`)),
        e('div', { className: 'mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-muted-foreground' },
          e('span', null, [s.date || 'No date', s.note, s.kind === 'sell' ? (s.profit == null ? 'Profit unknown' : `Profit ${money(s.profit)}`) : null].filter(Boolean).join(' · ')),
          e('span', { className: 'tabular-nums text-foreground' }, `Bankroll ${money(s.bankroll_after)}`)))),
      l.steps.length === 0 ? e('li', { className: 'bg-card px-4 py-3 text-sm text-muted-foreground' }, 'No buys or sales in the ledger yet. Add one on the Ledger page and it shows up here.') : null));
}
