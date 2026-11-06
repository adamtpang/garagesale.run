'use client';
import { useEffect, useMemo, useState } from 'react';
import { assessDeal, cleanDeal, rulesFrom, CATEGORIES, CATEGORY_LABEL, SOURCE_LABEL } from '@/lib/decision';
import { SAMPLE_CONFIG, SAMPLE_DEALS } from '@/lib/decision.sample';
import { scoutFreshness } from '@/lib/ago';
import {
  BOARD_REGIONS, HOME_LINE, PAUSED_SCOUT, SAMPLE_BANNER, boardStatus, filterViews, knownBuyNet, ruleSummary, sortViews, tally,
} from '@/lib/dealPresenter';
import { DealCard, DealTableRow, TABLE_HEAD } from './DealFacts';
import { Button } from '@/components/ui/button';

const EMPTY_FILTERS = { verdict: 'all', source: 'all', category: 'all', pickup: 'all' };

function Chip({ on, children, onClick }) {
  return <button type="button" onClick={onClick} aria-pressed={on} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${on ? 'border-[#0866FF] bg-[#0866FF] text-white' : 'border-white/10 bg-white/5 text-muted-foreground hover:text-foreground'}`}>{children}</button>;
}

export default function DealBoard() {
  const [feed, setFeed] = useState(undefined);
  const [config, setConfig] = useState(undefined);
  const [failed, setFailed] = useState(false);
  const [sample, setSample] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('sample') === '1') setSample(true);
  }, []);

  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const [dealsRes, configRes] = await Promise.all([
          fetch('/api/deals', { cache: 'no-store', signal: AbortSignal.timeout(10000) }),
          fetch('/api/scout/config', { cache: 'no-store', signal: AbortSignal.timeout(10000) }),
        ]);
        if (!dealsRes.ok) throw new Error(String(dealsRes.status));
        const dealsJson = await dealsRes.json();
        const configJson = configRes.ok ? await configRes.json() : null;
        if (!dead) { setFeed(dealsJson); setConfig(configJson); setFailed(false); }
      } catch (err) {
        if (!dead) { setFailed(true); setFeed({ deals: [], updated_at: null, filters_set: null }); setConfig(null); }
      }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { dead = true; clearInterval(timer); };
  }, []);

  const loading = feed === undefined;
  const activeConfig = sample ? SAMPLE_CONFIG : (config || {});
  const rules = rulesFrom(activeConfig);
  const summary = ruleSummary(rules);
  const fresh = scoutFreshness(sample ? null : feed && feed.updated_at);
  const views = useMemo(() => {
    if (sample) {
      return SAMPLE_DEALS.map((d) => ({ ...assessDeal(cleanDeal(d), SAMPLE_CONFIG), href: null }));
    }
    const rows = ((feed && feed.deals) || []).map((d, i) => ({ ...assessDeal(d, config || {}), href: `/deal/feed/${i}` }));
    if (feed && feed.test) {
      return rows.map((view) => view.verdict !== 'buy' ? view : {
        ...view,
        verdict: 'incomplete',
        netLabel: 'Calculated net',
        reasonText: `This stored feed is marked test, so it is not a buy. ${view.reasonText || ''}`.trim(),
      });
    }
    return rows;
  }, [sample, feed, config]);
  const shown = sortViews(filterViews(views, filters));
  const counts = tally(views);
  const buyNet = knownBuyNet(views);
  const status = boardStatus({ loading, error: failed && !sample, sample, count: views.length });
  const feeConfirmed = !!(activeConfig.fees && activeConfig.fees.ebay && activeConfig.fees.ebay.confirmed === true);

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return <section>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Deals</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{PAUSED_SCOUT}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={sample ? 'brand' : 'secondary'} size="sm" onClick={() => setSample((v) => !v)}>{sample ? 'Show stored feed' : 'Show sample layout'}</Button>
        <Button asChild variant="secondary" size="sm"><a href="/buy">Find deals</a></Button>
        <Button asChild variant="secondary" size="sm"><a href="/ledger">Ledger</a></Button>
      </div>
    </div>

    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {[
        ['Bankroll', summary.bankroll],
        ['Max per item', summary.maxPerFlip],
        ['Minimum net', summary.minProfit],
        ['Pickup', summary.maxMiles],
        ['Gas', summary.gas],
      ].map(([k, v]) => <div key={k} className="rounded-2xl border border-white/10 bg-[#141416] px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</div><div className="mt-1 text-sm font-medium">{v}</div></div>)}
    </div>
    <p className="mb-4 text-sm text-muted-foreground">{HOME_LINE} {summary.gasNote || ''} Cash already spent stays in the encrypted ledger and is not loaded here.</p>
    {!sample && config && Array.isArray(config.areas) && config.areas.length > 0 && <p className="mb-4 text-sm text-muted-foreground">Stored search areas: {config.areas.map((a) => a.name).filter(Boolean).join(', ')}. Those names are not pickup origins.</p>}
    {!sample && !loading && !failed && activeConfig.fees && activeConfig.fees.ebay && activeConfig.fees.ebay.rate != null && activeConfig.fees.ebay.confirmed !== true && <p className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">The eBay fee on file is an unconfirmed default ({Math.round(Number(activeConfig.fees.ebay.rate) * 10000) / 100}%). Calculated nets stay off the buy list until that rate is confirmed.</p>}
    {!sample && rules.filtersReady === false && !loading && !failed && <p className="mb-4 text-sm font-medium">Filters not set. Nothing is a buy until min net, the mile cap, sources, and fee rates are stored.</p>}

    <div className="mb-4 text-sm text-muted-foreground">
      {sample ? 'Sample clock is off. These rows are not from the stored feed.' : fresh.label ? `Stored feed updated ${fresh.label}${feed && feed.updated_at ? ` (${new Date(feed.updated_at).toLocaleString()})` : ''}.` : 'No stored scout feed yet.'}
      {!sample && fresh.stale && <div role="status" className="mt-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-foreground">This stored feed is more than 2 hours old. Listings may already be gone.</div>}
    </div>

    {status.kind !== 'ready' && status.kind !== 'sample' && <div role="status" className="mb-4 rounded-2xl border border-white/10 bg-[#141416] p-6 text-sm"><p className="font-medium text-foreground">{status.title}</p><p className="mt-1 text-muted-foreground">{status.detail}</p>{failed && <button type="button" className="mt-3 underline" onClick={() => window.location.reload()}>Retry</button>}</div>}
    {sample && <div role="status" className="mb-4 rounded-2xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm font-medium">{SAMPLE_BANNER} Sample fee rates are marked confirmed inside this fixture only.</div>}

    <div className="mb-3 flex flex-wrap gap-2" aria-label="Filters">
      {[['all', 'All'], ['buy', 'Buy'], ['skip', 'Skip'], ['incomplete', 'Incomplete']].map(([id, label]) => <Chip key={id} on={filters.verdict === id} onClick={() => setFilter('verdict', id)}>{label}{id === 'all' ? ` ${counts.all}` : id === 'buy' ? ` ${counts.buy}` : id === 'skip' ? ` ${counts.skip}` : ` ${counts.incomplete}`}</Chip>)}
      <span className="mx-1 hidden h-6 w-px bg-white/10 sm:inline-block" />
      {[['all', 'Any source'], ...Object.entries(SOURCE_LABEL).map(([id, label]) => [id, label])].map(([id, label]) => <Chip key={id} on={filters.source === id} onClick={() => setFilter('source', id)}>{label}</Chip>)}
    </div>
    <div className="mb-5 flex flex-wrap gap-2">
      {[['all', 'Any category'], ...CATEGORIES.map((id) => [id, CATEGORY_LABEL[id]]), ['unknown', 'Category unknown']].map(([id, label]) => <Chip key={id} on={filters.category === id} onClick={() => setFilter('category', id)}>{label}</Chip>)}
      <Chip on={filters.pickup === 'all'} onClick={() => setFilter('pickup', 'all')}>Any distance</Chip>
      <Chip on={filters.pickup === 'within'} onClick={() => setFilter('pickup', 'within')}>Within New Braunfels</Chip>
      <Chip on={filters.pickup === 'outside'} onClick={() => setFilter('pickup', 'outside')}>Outside or unconfirmed</Chip>
    </div>

    <p className="mb-4 text-sm text-muted-foreground">{sample ? 'Sample buys are layout only.' : buyNet == null ? 'No buy on this board. Known net is not shown as $0.' : `Expected net on buys: ${buyNet < 0 ? '-$' : '$'}${Math.abs(buyNet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`}</p>

    {!loading && shown.length === 0 && views.length > 0 && <p className="mb-4 text-sm text-muted-foreground">No deals match these filters.</p>}

    {shown.length > 0 && <div className={`${BOARD_REGIONS.cards} grid gap-3 md:hidden`}>
      {shown.map((view, i) => <div key={view.href || view.title + i}>{view.href ? <a href={view.href} className="mb-1 block text-xs text-[#8eb7ff] underline-offset-4 hover:underline">Open decision</a> : null}<DealCard view={view} sample={sample} /></div>)}
    </div>}
    {shown.length > 0 && <div className={`${BOARD_REGIONS.table} hidden overflow-x-auto rounded-2xl border border-white/10 md:block`}>
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-muted-foreground"><tr>{TABLE_HEAD.map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{shown.map((view, i) => <DealTableRow key={view.href || view.title + i} view={view} sample={sample} />)}</tbody>
      </table>
    </div>}
  </section>;
}
