'use client';
import { useEffect, useRef, useState } from 'react';
import Photo from './Photo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export const PRESETS = ['Used Mac with Apple silicon under $500', 'Herman Miller chair to flip', 'Nintendo Switch under $200', 'Road bike under $300'];
const RADII = [5, 10, 20, 40, 60];
const STEPS = [[0, 'Opening Marketplace in your Helium browser'], [12, 'Reading listings'], [22, 'Checking eBay sold prices'], [32, 'Opening the best few to check age and condition'], [70, 'Ranking deals']];
const $ = (v) => (v === null || v === undefined || isNaN(Number(v)) ? '-' : '$' + Math.round(Number(v)).toLocaleString());
const CONF = { high: 'success', medium: 'brand', low: 'warn' };
const KEY = 'gs-last-search';

function draft(kind, d, target) {
  const name = String(d.title || 'item').replace(/!+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return kind === 'offer' ? `Hi! I'm interested in the ${name}. Would you take $${target} cash? I can pick it up this week. Thanks!` : `Hi! Is the ${name} still available? I could pick it up this week. Thanks!`;
}

function savedFields(d, target, opener, query) {
  const e = d.estimate || {};
  return { id: d.id, title: d.title, photo_url: d.photo_url, location: d.location, listed: d.listed, condition: d.condition, query, ask: d.ask, target, value: e.value, confidence: e.confidence, comps_n: e.n, discount: d.discount, reason: d.reason, comps: d.comps, opener };
}

function Deal({ d, rank, query, saved, onSaved }) {
  const e = d.estimate || {};
  const [open, setOpen] = useState('');
  const [target, setTarget] = useState(d.target);
  const [kind, setKind] = useState('availability');
  const [text, setText] = useState(() => draft('availability', d, d.target));
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!edited) setText(draft(kind, d, target)); }, [kind, target]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    setBusy(true);
    try {
      const r = await fetch('/api/saved', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(savedFields(d, Number(target) || d.target, open === 'opener' ? text : (saved && saved.opener) || null, query)) });
      const j = await r.json(); if (r.ok) { onSaved(j); window.dispatchEvent(new Event('gs-saved')); }
    } catch (err) {}
    setBusy(false);
  }
  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) {} }
  return <Card className="overflow-hidden border-border/60" data-deal={d.id}>
    <div className="flex gap-4 p-4">
      <a href={d.fb_url} target="_blank" rel="noopener" className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>.phx]:h-full [&>.phx]:w-full"><Photo src={d.photo_url} title={d.title} /></a>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><div className="text-xs text-muted-foreground">#{rank}</div><a href={d.fb_url} target="_blank" rel="noopener" className="block truncate font-medium hover:underline">{d.title}</a></div>
          <div className="shrink-0 text-right"><div className="text-xl font-semibold tabular-nums">{$(d.ask)}</div>{d.was ? <div className="text-xs text-muted-foreground line-through">{$(d.was)}</div> : null}</div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{d.location || 'Location not shown'}</span><span>{d.listed ? d.listed.replace(/ in .*/, '') : 'Age not checked'}</span>{d.condition && <span>{d.condition}</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {e.value ? <><Badge variant="secondary" className="font-normal">Worth about {$(e.value)}</Badge><Badge variant={CONF[e.confidence] || 'secondary'} className="font-normal">{e.confidence} confidence</Badge>
            {d.discount !== null && (d.discount > 60 ? <Badge variant="warn">Too cheap to trust</Badge> : <Badge variant={d.discount > 0 ? 'success' : 'secondary'}>{d.discount >= 0 ? `${d.discount}% under` : `${-d.discount}% over`}</Badge>)}</> : <Badge variant="warn" className="font-normal">Not enough comps</Badge>}
          {saved && <Badge variant="brand" className="font-normal">Saved · {saved.status}</Badge>}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{d.reason}</p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2 border-t border-border/60 px-4 py-3">
      <Button size="sm" variant={open === 'evidence' ? 'secondary' : 'outline'} onClick={() => setOpen(open === 'evidence' ? '' : 'evidence')}>Price evidence ({e.n || 0})</Button>
      <Button size="sm" variant={open === 'opener' ? 'secondary' : 'outline'} onClick={() => setOpen(open === 'opener' ? '' : 'opener')}>Draft opener</Button>
      <Button size="sm" variant="brand" onClick={save} disabled={busy}>{busy ? 'Saving...' : saved ? 'Update saved deal' : 'Save deal'}</Button>
      <Button size="sm" variant="ghost" asChild><a href={d.fb_url} target="_blank" rel="noopener">Open on Facebook</a></Button>
    </div>
    {open === 'evidence' && <div className="border-t border-border/60 px-4 py-3 text-sm">
      {e.value ? <p className="text-muted-foreground">Median of {e.n} matching eBay sold listings is <b className="text-foreground">{$(e.value)}</b>. The middle half sold between {$(e.low)} and {$(e.high)}. eBay prices are before shipping and fees; this listing is local pickup.</p>
        : <p className="text-muted-foreground">Only {e.n || 0} eBay sold listings matched this exact item, so there is no honest market value. Check sold listings yourself before you offer.</p>}
      {d.comps && d.comps.length > 0 && <ul className="mt-3 grid gap-1.5">{d.comps.map((c) => <li key={c.id || c.url} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2">
        <a href={c.url} target="_blank" rel="noopener" className="min-w-0 truncate hover:underline">{c.title}</a>
        <span className="shrink-0 text-xs text-muted-foreground">{c.condition ? c.condition + ' · ' : ''}sold {c.sold_on}</span><b className="shrink-0 tabular-nums">{$(c.price)}</b></li>)}</ul>}
    </div>}
    {open === 'opener' && <div className="grid gap-3 border-t border-border/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button size="sm" variant={kind === 'availability' ? 'secondary' : 'outline'} onClick={() => { setEdited(false); setKind('availability'); }}>Ask if available</Button>
        <Button size="sm" variant={kind === 'offer' ? 'secondary' : 'outline'} onClick={() => { setEdited(false); setKind('offer'); }}>Make an offer</Button>
        <label className="ml-auto flex items-center gap-2 text-muted-foreground">Target $<Input className="h-8 w-24" inputMode="decimal" value={target} onChange={(ev) => setTarget(ev.target.value.replace(/[^0-9.]/g, ''))} aria-label="Target price" /></label>
      </div>
      <Textarea rows={3} value={text} onChange={(ev) => { setEdited(true); setText(ev.target.value); }} aria-label="Opener message" />
      <p className="text-xs text-muted-foreground">Garage Sale never messages sellers. Copy this, open the listing, and send it yourself if you like it.</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={copy}>{copied ? 'Copied' : 'Copy message'}</Button>
        <Button size="sm" variant="outline" asChild><a href={d.fb_url} target="_blank" rel="noopener">Open listing to send</a></Button>
        <Button size="sm" variant="brand" onClick={save} disabled={busy}>{saved ? 'Save draft to deal' : 'Save deal with this draft'}</Button></div>
    </div>}
  </Card>;
}

export default function BuySearch() {
  const [q, setQ] = useState(''); const [max, setMax] = useState(''); const [city, setCity] = useState('Austin'); const [radius, setRadius] = useState(20);
  const [busy, setBusy] = useState(false); const [secs, setSecs] = useState(0);
  const [err, setErr] = useState(null); const [res, setRes] = useState(null);
  const [saved, setSaved] = useState({}); const [showOff, setShowOff] = useState(false);
  const timer = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // dev strict mode runs effects twice
    started.current = true;
    try { const last = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (last) { setRes(last); setQ(last.query || ''); if (last.city) setCity(last.city); if (last.radius_mi) setRadius(last.radius_mi); setMax(last.max && !/under|below|max/i.test(last.query || '') ? String(last.max) : ''); } } catch (e) {}
    fetch('/api/saved', { cache: 'no-store' }).then((r) => r.json()).then((j) => setSaved(Object.fromEntries((j.deals || []).map((d) => [d.id, d])))).catch(() => {});
    const sp = new URLSearchParams(location.search);
    if (sp.get('q')) { setQ(sp.get('q')); if (sp.get('max')) setMax(sp.get('max')); run(sp.get('q'), sp.get('max') || ''); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(query, maxPrice) {
    query = String(query || '').trim();
    if (!query) { setErr({ message: 'Tell us what you are looking for.' }); return; }
    setErr(null); setBusy(true); setSecs(0); setShowOff(false);
    const t0 = Date.now(); timer.current = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 1000);
    try {
      const r = await fetch('/api/buy/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, max_price: maxPrice || undefined, city, radius_mi: radius }) });
      const j = await r.json();
      if (!r.ok) setErr({ message: j.error || 'Search failed', browser: j.browser === 'unavailable', query, max: maxPrice });
      else { setRes(j); try { sessionStorage.setItem(KEY, JSON.stringify(j)); } catch (e) {} }
    } catch (e) { setErr({ message: 'Could not reach the search. Is the dev server running?' }); }
    clearInterval(timer.current); setBusy(false);
  }

  async function queueWorker() {
    try {
      const body = { kind: 'buy', query: err.query }; if (err.max) body.max_price = Number(err.max);
      const r = await fetch('/api/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json(); if (r.ok && j.id) location.href = `/job/${j.id}`; else setErr({ message: j.error || 'Could not queue it' });
    } catch (e) { setErr({ message: 'Could not queue it' }); }
  }

  const deals = (res && res.deals) || [];
  const good = deals.filter((d) => d.relevant && d.relevant.ok);
  const off = deals.filter((d) => !(d.relevant && d.relevant.ok));
  const step = [...STEPS].reverse().find(([s]) => secs >= s)[1];

  return <div className="grid gap-6">
    <Card className="border-border/70 bg-card/80 p-5 backdrop-blur md:p-6">
      <form onSubmit={(e) => { e.preventDefault(); run(q, max); }} className="grid gap-4">
        <Input className="h-14 rounded-2xl px-5 text-lg" placeholder="What do you want? e.g. Herman Miller chair" value={q} onChange={(e) => setQ(e.target.value)} aria-label="What are you looking for?" disabled={busy} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[8rem_1fr_8rem_auto]">
          <Input className="h-12" placeholder="Max $" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Max price" disabled={busy} />
          <Input className="h-12" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" disabled={busy} />
          <select className="h-12 rounded-md border border-input bg-background px-3 text-sm text-foreground [color-scheme:dark]" value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Radius" disabled={busy}>{RADII.map((r) => <option key={r} value={r}>Within {r} mi</option>)}</select>
          <Button size="lg" variant="brand" className="h-12" disabled={busy}>{busy ? 'Searching...' : 'Find deals'}</Button>
        </div>
        <div className="flex flex-wrap gap-2">{PRESETS.map((t) => <Button type="button" key={t} variant="outline" size="sm" disabled={busy} className="h-8 border-border/70 px-3 text-xs font-normal text-muted-foreground" onClick={() => { setQ(t); run(t, max); }}>{t}</Button>)}</div>
      </form>
    </Card>

    {busy && <Card className="border-border/60 p-5" aria-live="polite"><div className="flex items-center justify-between text-sm"><span className="font-medium">{step}...</span><span className="tabular-nums text-muted-foreground">{secs}s</span></div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-brand transition-all duration-1000" style={{ width: `${Math.min(95, secs * 1.2)}%` }} /></div>
      <p className="mt-3 text-xs text-muted-foreground">Read-only, in your own browser, at a human pace. Usually one to two minutes. If Helium asks, click Allow.</p></Card>}

    {err && <Card className="border-destructive/40 bg-destructive/10 p-5 text-sm"><p>{err.message}</p>
      {err.browser && <div className="mt-3 grid gap-2 text-muted-foreground"><p>Live search reads Marketplace through your own Helium browser, so it only works when this app runs on your computer with Helium open.</p>
        <div><Button size="sm" variant="secondary" onClick={queueWorker}>Send it to the Grok Bot worker instead</Button></div></div>}</Card>}

    {res && !busy && <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="!text-2xl !font-semibold !tracking-tight">{good.length} match{good.length === 1 ? '' : 'es'} for "{res.core}"{res.max ? ` under ${$(res.max)}` : ''}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{res.area || res.city}. Priced against {res.sold_seen} eBay sold listings. Checked age and condition on the top {res.details_checked}{res.gone_removed ? `, dropped ${res.gone_removed} already sold` : ''}. Searched {new Date(res.searched_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{res.cached ? ' (cached)' : ''}.</p></div>
        <div className="flex gap-3 text-xs"><a className="text-muted-foreground underline-offset-4 hover:underline" href={res.fb_search_url} target="_blank" rel="noopener">Marketplace search</a><a className="text-muted-foreground underline-offset-4 hover:underline" href={res.ebay_search_url} target="_blank" rel="noopener">eBay sold search</a></div></div>
      {good.length === 0 && <Card className="border-border/60 p-8 text-center text-muted-foreground">No listings matched. Try a wider radius or a simpler search.</Card>}
      {good.map((d, i) => <Deal key={d.id} d={d} rank={i + 1} query={res.query} saved={saved[d.id]} onSaved={(s) => setSaved((m) => ({ ...m, [s.id]: s }))} />)}
      {off.length > 0 && <div><Button variant="ghost" size="sm" onClick={() => setShowOff(!showOff)}>{showOff ? 'Hide' : 'Show'} {off.length} listing{off.length === 1 ? '' : 's'} that are not a match</Button>
        {showOff && <ul className="mt-2 grid gap-1 text-sm">{off.map((d) => <li key={d.id} className="flex justify-between gap-3 rounded-lg px-3 py-2 hover:bg-accent/30"><a href={d.fb_url} target="_blank" rel="noopener" className="min-w-0 truncate">{d.title}</a><span className="shrink-0 text-muted-foreground">{$(d.ask)} · {d.reason}</span></li>)}</ul>}</div>}
    </section>}
  </div>;
}
