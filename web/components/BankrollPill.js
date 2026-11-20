'use client';
// The bankroll on every page, like a balance that is always on screen. It is the one ledger number that
// is public (GET /api/bankroll). It links to the bankroll ladder.
import React, { useEffect, useState } from 'react';

const e = React.createElement;

export function pillText(b) {
  if (!b || typeof b.bankroll !== 'number' || !Number.isFinite(b.bankroll)) return 'Bankroll unknown';
  return `$${Math.round(b.bankroll).toLocaleString('en-US')}`;
}

export function BankrollPillView({ data }) {
  const title = data && data.note ? data.note : 'The current bankroll. It is also the most one flip can cost.';
  return e('a', {
    href: '/ladder',
    title,
    'data-field': 'bankroll-pill',
    className: 'ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border-2 border-border bg-card px-2.5 py-1 text-[13px] font-semibold shadow-tag-sm',
  },
  e('span', { className: 'text-[10px] font-semibold uppercase tracking-wide text-muted-foreground' }, 'Bankroll'),
  e('span', { className: 'font-marker text-base font-normal leading-none text-price tabular-nums' }, data === undefined ? '…' : pillText(data)));
}

export default function BankrollPill() {
  const [data, setData] = useState(undefined);
  useEffect(() => {
    let dead = false;
    fetch('/api/bankroll', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (!dead) setData(b); })
      .catch(() => { if (!dead) setData(null); });
    return () => { dead = true; };
  }, []);
  return e(BankrollPillView, { data });
}
