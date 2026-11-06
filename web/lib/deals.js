// Scout ingest. Profit and the buy/skip verdict come from decision.js.
// Comps that are not explicitly sold are dropped. Unknown shipping and unknown gas stay null.
import { assessDeal, cleanComp, cleanDeal } from './decision.js';
import { emptyConfig, filtersReady } from './scoutConfig.js';

export { cleanComp, cleanDeal };

export function scoreDeal(deal, config) {
  const view = assessDeal(deal, config);
  const buy = view.verdict === 'buy';
  return {
    ...deal,
    resale: view.resale,
    resale_venue: view.venue,
    shipping: view.shipping,
    fee: view.fee,
    gas: view.gas,
    profit: view.net,
    flags: view.flags,
    decision: view.verdict,
    decision_reasons: view.reasons.map((r) => r.code),
    ranked: false,
    rank: null,
    unranked_reason: buy ? null : (view.reasons[0] ? view.reasons[0].text : 'not a buy'),
  };
}

function rejectReason(deal) {
  if (deal.decision === 'buy') return null;
  return deal.unranked_reason || 'not a buy';
}

// Clean, score, and rank. When a required filter is null, deals are stored and left unranked.
export function buildFeed(rawDeals, config) {
  const cfg = config || emptyConfig();
  const ready = filtersReady(cfg);
  const deals = (Array.isArray(rawDeals) ? rawDeals : []).slice(0, 100).map(cleanDeal).filter(Boolean).map((d) => scoreDeal(d, cfg));
  if (!ready) return { filters_set: false, deals: deals.map((d) => ({ ...d, ranked: false, rank: null })) };
  const ranked = [];
  const rest = [];
  for (const d of deals) {
    const why = rejectReason(d);
    if (why) rest.push({ ...d, ranked: false, rank: null, unranked_reason: why });
    else ranked.push({ ...d, ranked: true, unranked_reason: null });
  }
  ranked.sort((a, b) => b.profit - a.profit || (a.ask ?? 0) - (b.ask ?? 0));
  ranked.forEach((d, i) => { d.rank = i + 1; });
  return { filters_set: true, deals: [...ranked, ...rest] };
}
