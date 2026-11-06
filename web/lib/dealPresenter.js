// Text and layout for the deal board. The numbers come from assessDeal.
import { moneyText } from './decision.js';

export const BOARD_REGIONS = {
  cards: 'grid gap-3 md:hidden',
  table: 'hidden md:block',
};

export const SAMPLE_BANNER = 'SAMPLE FIXTURE — not a live listing and not stored in the scout feed. These rows show the layout. Do not buy them.';
export const PAUSED_SCOUT = 'The scheduled scout is paused. This board reads the stored feed and does not scan listings.';
export const HOME_LINE = 'Pickup is 15 miles from New Braunfels. Austin and San Marcos are not home origins.';

export function layoutForWidth(width) {
  const w = Number(width);
  if (!Number.isFinite(w)) return 'cards';
  return w >= 768 ? 'table' : 'cards';
}

export function ruleSummary(rules) {
  const moneyOr = (v, fallback) => (v == null ? fallback : moneyText(v));
  return {
    bankroll: moneyOr(rules && rules.bankroll, 'bankroll not stored'),
    maxPerFlip: moneyOr(rules && rules.maxPerFlip, 'item cap not stored'),
    minProfit: moneyOr(rules && rules.minProfit, 'min net not stored'),
    maxMiles: rules && rules.maxMiles != null ? `${rules.maxMiles} mi from New Braunfels` : 'mile cap not stored',
    gas: rules && rules.gasPerMile != null ? `${moneyText(rules.gasPerMile)} per mile, round trip × 2` : 'gas rate not stored',
    gasNote: (rules && rules.gasNote) || null,
    filtersReady: !!(rules && rules.filtersReady),
    home: 'New Braunfels',
  };
}

export function netLine(view) {
  if (!view || view.net == null) return { label: 'Expected net', value: 'unknown', tone: 'unknown' };
  if (view.verdict === 'buy') return { label: 'Expected net', value: view.netText, tone: 'buy' };
  return { label: 'Calculated net', value: view.netText, tone: 'calculated' };
}

export function shippingLine(view) {
  if (!view || view.shipping == null) return 'unknown';
  return view.shippingText;
}

export function verdictLabel(view, sample) {
  const word = view.verdict === 'buy' ? 'Buy' : view.verdict === 'skip' ? 'Skip' : 'Incomplete';
  return sample ? `Sample · ${word}` : word;
}

export function filterViews(views, filters) {
  const f = filters || {};
  return (views || []).filter((v) => {
    if (f.verdict && f.verdict !== 'all' && v.verdict !== f.verdict) return false;
    if (f.source && f.source !== 'all' && v.source !== f.source) return false;
    if (f.category && f.category !== 'all') {
      if (f.category === 'unknown') { if (v.categoryId) return false; }
      else if (v.categoryId !== f.category) return false;
    }
    if (f.pickup === 'within' && !(v.pickup && v.pickup.within === true)) return false;
    if (f.pickup === 'outside' && v.pickup && v.pickup.within === true) return false;
    return true;
  });
}

export function tally(views) {
  const list = views || [];
  return {
    all: list.length,
    buy: list.filter((v) => v.verdict === 'buy').length,
    skip: list.filter((v) => v.verdict === 'skip').length,
    incomplete: list.filter((v) => v.verdict === 'incomplete').length,
  };
}

export function sortViews(views) {
  const rank = { buy: 0, skip: 1, incomplete: 2 };
  return [...(views || [])].sort((a, b) => (rank[a.verdict] ?? 9) - (rank[b.verdict] ?? 9) || ((b.net ?? -1e15) - (a.net ?? -1e15)));
}

export function knownBuyNet(views) {
  const buys = (views || []).filter((v) => v.verdict === 'buy' && v.net != null);
  if (!buys.length) return null;
  return Math.round(buys.reduce((n, v) => n + v.net, 0) * 100) / 100;
}

export function boardStatus({ loading, error, sample, count }) {
  if (sample) return { kind: 'sample', title: 'Sample layout', detail: SAMPLE_BANNER };
  if (loading) return { kind: 'loading', title: 'Loading stored deals…', detail: 'Checking the stored scout feed.' };
  if (error) return { kind: 'error', title: 'Could not load the scout feed.', detail: 'Nothing below is filled in with a guess.' };
  if (!count) return { kind: 'empty', title: 'No stored deals.', detail: 'The scout is paused, so this list stays empty until a run is posted. The sample layout is separate and labeled.' };
  return { kind: 'ready', title: 'Stored deals', detail: PAUSED_SCOUT };
}
