// The Selling page rows: what Adam bought and is selling, from the ledger. No network and no disk.
// Browser-safe: it must not import lib/ledger.js, which reads the disk. The sums repeat ledger.js costOf,
// and lib/selling.test.mjs checks they agree.
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round2 = (n) => Math.round(n * 100) / 100;

// A listing up this many days is flagged Slow. A display flag from the spec, not one of the flip rules.
export const SLOW_DAYS = 14;

const paidFor = (it) => {
  const c = it.costs || {};
  if (num(it.buy_price) == null) return null;
  return round2(it.buy_price + (num(c.gas) || 0) + (num(c.fees) || 0) + (num(c.repairs) || 0));
};

function daysSince(date, nowMs) {
  const t = Date.parse(`${date || ''}T12:00:00Z`);
  if (!Number.isFinite(t) || nowMs == null) return null;
  return Math.max(0, Math.floor((nowMs - t) / 86400000));
}

// items: ledger items. Returns the ones on hand or listed, listed first, oldest listing first.
export function sellingRows(items, nowMs, slowDays = SLOW_DAYS) {
  const rows = (items || []).filter((it) => it && (it.status === 'listed' || it.status === 'on_hand')).map((it) => {
    const paid = paidFor(it);
    const listed = it.status === 'listed';
    const days = listed ? daysSince(it.date_listed, nowMs) : null;
    const list = num(it.list_price);
    return {
      id: it.id,
      item: it.item,
      status: it.status,
      paid,
      list_price: list,
      floor_price: num(it.floor_price),
      date_listed: it.date_listed || null,
      days_listed: days,
      slow: days != null && days >= slowDays,
      // Before selling fees: the ledger records those only once it sells.
      profit_at_list: list != null && paid != null ? round2(list - paid) : null,
      profit_at_floor: num(it.floor_price) != null && paid != null ? round2(it.floor_price - paid) : null,
      platform: it.platform || null,
      source_link: it.source_link || null,
    };
  });
  return rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'listed' ? -1 : 1;
    return (b.days_listed ?? -1) - (a.days_listed ?? -1);
  });
}
