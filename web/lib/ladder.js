// The bankroll ladder: the starting bankroll, then every buy and sale in order, with the bankroll after each.
// No network and no disk. It reads a ledger document and adds nothing that is not in it.
import { RULES_CONFIG } from '../config/rules.js';
// This file runs in the browser, so it cannot import lib/ledger.js (that one reads disk and Blob storage).
// The few sums it needs are repeated here, and a test checks they match the ledger's own totals.

const round2 = (n) => Math.round(n * 100) / 100;
const num0 = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const costOf = (it) => { const c = (it && it.costs) || {}; return round2(num0(c.gas) + num0(c.fees) + num0(c.repairs)); };
export const money = (v) => `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`;

// doc: a ledger document as GET /api/ledger returns it.
export function buildLadder(doc) {
  const items = (doc && Array.isArray(doc.items)) ? doc.items : [];
  // The ledger's own starting number wins when it has one. The rules file fills in when it does not.
  const start = doc && doc.starting_bankroll != null ? doc.starting_bankroll : RULES_CONFIG.bankroll;
  const events = [];
  items.forEach((it, i) => {
    const cost = round2(num0(it.buy_price) + costOf(it));
    events.push({
      kind: 'buy', item: it.item, date: it.date_bought || null, order: i, change: -cost, profit: null,
      note: costOf(it) > 0 ? `${money(num0(it.buy_price))} plus ${money(costOf(it))} of gas, fees and repairs` : null,
    });
    if (it.status === 'sold') {
      events.push({
        kind: 'sell', item: it.item, date: it.sell_date || null, order: i, change: num0(it.sell_price),
        profit: it.net_profit != null ? it.net_profit : null,
        note: it.platform ? `Sold on ${it.platform}` : null,
      });
    }
  });
  // Dated steps in date order. A step with no date goes after them, in the order it was entered.
  // On the same day a buy comes before a sale.
  events.sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (!!a.date !== !!b.date) return a.date ? -1 : 1;
    if (a.kind !== b.kind) return a.kind === 'buy' ? -1 : 1;
    return a.order - b.order;
  });
  let bankroll = start;
  const steps = events.map((ev) => {
    bankroll = round2(bankroll + ev.change);
    return { ...ev, bankroll_after: bankroll };
  });
  const onHand = items.filter((it) => it.status === 'on_hand' || it.status === 'listed');
  const open = ((doc && doc.decisions) || []).filter((d) => d.decision === 'approved' && d.outcome === 'pending');
  const committed = round2(open.reduce((s, d) => s + num0(d.max_bid), 0));
  const t = {
    realized_profit: round2(items.reduce((s, it) => s + (it.status === 'sold' && it.net_profit != null ? it.net_profit : 0), 0)),
    on_hand_count: onHand.length,
    on_hand_value: round2(onHand.reduce((s, it) => s + num0(it.buy_price) + costOf(it), 0)),
    committed,
    open_approvals: open.length,
    bankroll_after_open_approvals: round2(bankroll - committed),
  };
  const growth = round2(bankroll - start);
  return {
    start,
    start_source: doc && doc.starting_bankroll != null ? 'ledger' : 'rules file',
    steps,
    now: bankroll,
    growth,
    growth_pct: start > 0 ? Math.round((growth / start) * 1000) / 10 : null,
    realized_profit: t.realized_profit,
    on_hand_count: t.on_hand_count,
    on_hand_value: t.on_hand_value,
    committed: t.committed,
    open_approvals: t.open_approvals,
    // The most one flip can cost right now: the bankroll less money promised to open approvals.
    max_buy: Math.max(0, t.bankroll_after_open_approvals),
    undated: steps.filter((s) => !s.date).length,
  };
}

// Points for a step chart: the bankroll after each step, starting from the starting bankroll.
export function chartPoints(ladder, width = 600, height = 160, pad = 12) {
  const values = [ladder.start, ...ladder.steps.map((s) => s.bankroll_after)];
  const lo = Math.min(0, ...values);
  const hi = Math.max(...values, 1);
  const x = (i) => (values.length === 1 ? pad : pad + (i * (width - 2 * pad)) / (values.length - 1));
  const y = (v) => round2(height - pad - ((v - lo) / (hi - lo)) * (height - 2 * pad));
  let d = `M ${round2(x(0))} ${y(values[0])}`;
  for (let i = 1; i < values.length; i++) d += ` H ${round2(x(i))} V ${y(values[i])}`;
  return { path: d, zero_y: y(0), start_y: y(ladder.start), lo, hi, count: values.length };
}
