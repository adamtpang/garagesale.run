import React from 'react';
import { netLine, shippingLine, verdictLabel } from '../lib/dealPresenter.js';

const e = React.createElement;
const TONE = {
  buy: 'bg-success/15 text-success',
  skip: 'bg-destructive/15 text-red-300',
  incomplete: 'bg-amber-500/15 text-amber-300',
};

function pill(view, sample) {
  return e('span', {
    className: `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[view.verdict] || TONE.incomplete}`,
    'data-verdict': view.verdict,
  }, verdictLabel(view, sample));
}

function fact(label, value, extra) {
  return e('div', { className: 'min-w-0' },
    e('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' }, label),
    e('div', { className: 'mt-0.5 text-sm font-medium text-foreground' }, value),
    extra ? e('div', { className: 'mt-0.5 text-xs text-muted-foreground' }, extra) : null);
}

function link(href, text) {
  if (!href) return e('span', { className: 'text-muted-foreground' }, 'no link');
  return e('a', { href, target: '_blank', rel: 'noopener', className: 'text-[#8eb7ff] underline-offset-4 hover:underline' }, text);
}

function compList(view) {
  const rows = [
    ...(view.comps || []).map((c, i) => e('li', { key: `c${i}`, className: 'border-t border-white/10 py-2' },
      e('div', { className: 'flex items-start justify-between gap-3' },
        e('span', { className: 'min-w-0' },
          e('span', { className: 'block font-medium' }, c.title || 'Sold comp'),
          e('span', { className: 'mt-0.5 block text-xs text-muted-foreground' }, [c.soldText, c.conditionText, c.modelText, c.dateText].filter(Boolean).join(' · ')),
          c.note ? e('span', { className: 'mt-0.5 block text-xs text-muted-foreground' }, c.note) : null),
        e('span', { className: 'shrink-0 text-right' },
          e('span', { className: 'block font-semibold tabular-nums' }, c.priceText),
          e('span', { className: 'block text-xs' }, link(c.url, 'Open comp')))),
    )),
    ...(view.rejected || []).map((r, i) => e('li', { key: `r${i}`, className: 'border-t border-white/10 py-2 text-xs text-muted-foreground' },
      e('div', null, 'Not used as a sold comp. ', r.reason),
      e('div', { className: 'mt-1' }, link(r.url, 'Open link')))),
  ];
  if (!rows.length) return e('p', { className: 'text-xs text-muted-foreground' }, 'No comp links on this deal.');
  return e('details', { className: 'mt-3' },
    e('summary', { className: 'cursor-pointer text-xs font-medium text-[#8eb7ff]' }, `${(view.comps || []).length} comp row${(view.comps || []).length === 1 ? '' : 's'} · ${(view.rejected || []).length} unused link${(view.rejected || []).length === 1 ? '' : 's'}`),
    e('ul', { className: 'mt-1' }, rows));
}

function moneyBlock(view) {
  const net = netLine(view);
  const tone = net.tone === 'buy' ? 'text-success' : net.tone === 'unknown' ? 'text-amber-200' : 'text-foreground';
  return e('div', { className: 'rounded-xl bg-black/40 p-3' },
    e('div', { className: 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground' }, net.label),
    e('div', { className: `mt-1 text-2xl font-semibold tabular-nums ${tone}`, 'data-net': net.value }, net.value),
    e('p', { className: 'mt-2 text-xs leading-5 text-muted-foreground' }, view.reasonText || 'Passes the stored rules.'),
    view.riskNote ? e('p', { className: 'mt-1 text-xs text-muted-foreground' }, view.riskNote) : null);
}

export function DealCard({ view, sample, stacked }) {
  const ship = shippingLine(view);
  return e('article', {
    className: stacked
      ? 'rounded-2xl border border-white/10 bg-[#141416] p-4'
      : 'rounded-2xl border border-white/10 bg-[#141416] p-4 md:hidden',
    'data-region': 'card',
    'data-sample': sample ? 'true' : 'false',
  },
  e('div', { className: 'flex items-start justify-between gap-3' },
    e('div', { className: 'min-w-0' },
      e('h3', { className: 'text-base font-semibold leading-snug' }, view.title),
      e('p', { className: 'mt-1 text-xs text-muted-foreground' }, [view.categoryText, view.modelText, view.conditionText].join(' · '))),
    pill(view, sample)),
  e('div', { className: 'mt-4 grid grid-cols-2 gap-3' },
    fact('Buy', `${view.sourceLabel} · ${view.askText}`, link(view.buyUrl, 'Open listing')),
    fact('Pickup', view.pickup.text, view.storedDistanceText),
    fact('Resale venue', `${view.venueLabel} · ${view.resaleText}`, view.uncertainty),
    fact('Fee', view.feeText, view.feeNote),
    fact('Shipping', ship, ship === 'unknown' ? 'Missing shipping is not treated as $0.' : null),
    fact('Gas', view.gasText, view.gasNote)),
  e('div', { className: 'mt-3' }, moneyBlock(view)),
  compList(view));
}

export function DealTableRow({ view, sample }) {
  const net = netLine(view);
  const ship = shippingLine(view);
  return e('tr', { className: 'hidden border-t border-white/10 align-top md:table-row', 'data-region': 'row', 'data-verdict': view.verdict },
    e('td', { className: 'px-3 py-3' }, pill(view, sample)),
    e('td', { className: 'px-3 py-3' },
      e('div', { className: 'font-medium' }, view.href ? e('a', { href: view.href, className: 'hover:underline' }, view.title) : view.title),
      e('div', { className: 'mt-1 text-xs text-muted-foreground' }, [view.categoryText, view.modelText, view.conditionText].join(' · ')),
      compList(view)),
    e('td', { className: 'px-3 py-3' },
      e('div', null, view.sourceLabel),
      e('div', { className: 'tabular-nums' }, view.askText),
      e('div', { className: 'mt-1 text-xs' }, link(view.buyUrl, 'Open listing'))),
    e('td', { className: 'px-3 py-3 text-xs leading-5 text-muted-foreground' }, view.pickup.text),
    e('td', { className: 'px-3 py-3' },
      e('div', null, view.venueLabel),
      e('div', { className: 'tabular-nums' }, view.resaleText),
      e('div', { className: 'mt-1 text-xs text-muted-foreground' }, view.uncertainty)),
    e('td', { className: 'px-3 py-3 text-xs leading-5' },
      e('div', null, `Fee ${view.feeText}`),
      e('div', null, `Shipping ${ship}`),
      e('div', null, `Gas ${view.gasText}`),
      view.feeNote ? e('div', { className: 'mt-1 text-muted-foreground' }, view.feeNote) : null),
    e('td', { className: 'px-3 py-3' },
      e('div', { className: 'text-[11px] uppercase tracking-wide text-muted-foreground' }, net.label),
      e('div', { className: 'text-lg font-semibold tabular-nums', 'data-net': net.value }, net.value),
      e('p', { className: 'mt-1 max-w-xs text-xs leading-5 text-muted-foreground' }, view.reasonText || 'Passes the stored rules.')));
}

export const TABLE_HEAD = ['Decision', 'Item', 'Buy', 'Pickup', 'Resale', 'Costs', 'Net'];
