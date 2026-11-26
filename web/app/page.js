'use client';
import { useEffect, useRef, useState } from 'react';
import GarageScene from '../components/GarageScene';
import Photo, { prox } from '../components/Photo';
import ModeFeed from '../components/ModeFeed';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const TILES = [
  ['chair', 'Ergonomic office chair', 140, 260], ['airpods', 'AirPods Pro', 95, 160], ['lamp', 'Desk lamp', 15, 30], ['guitar', 'Acoustic guitar', 120, 210],
  ['sofa', 'Fabric sofa', 220, 380], ['camera', 'Mirrorless camera body', 900, 1250], ['drill', 'Cordless drill', 45, 85], ['cooler', 'Soft cooler bag', 110, 200],
];
const FEED = ['Scanning new Austin listings', 'Comparing with eBay sold', 'Checking Amazon price', 'Found 3 local comps', 'Flagged under-market listing', 'Drafting listing copy'];

const EXAMPLES = TILES.map(([ic, nm, ask, mkt]) => ({ photo: `/items/${ic}.jpg`, name: nm, ask, mkt }));
const r0 = (v) => (v === undefined || v === null || isNaN(Number(v)) ? undefined : Math.round(Number(v)));
function toTile(d, href) {
  return { href, photo: d.photo_url || d.image_url || d.image || null, name: d.title || 'Deal', ask: r0(d.ask_price ?? d.buy_price ?? d.price), mkt: r0(d.resale_price ?? d.resell_price ?? d.est_market_price), link: d.fb_url || d.source_url || d.link || d.url || null };
}
function useRealTiles() {
  const [tiles, setTiles] = useState(null);
  useEffect(() => {
    let stop = false;
    (async () => {
      const out = [];
      try { const f = await (await fetch('/api/deals', { cache: 'no-store' })).json(); if (f && !f.test) (f.deals || []).forEach((d, i) => { if (!d.example) out.push(toTile(d, `/deal/feed/${i}`)); }); } catch (e) {}
      try { const r = await (await fetch('/api/jobs?recent=1', { cache: 'no-store' })).json(); (r.jobs || []).filter((j) => j.kind === 'buy' && j.stage === 'done').forEach((j) => (j.deals || []).forEach((d, i) => out.push(toTile(d, `/deal/${j.id}/${i}`)))); } catch (e) {}
      if (!stop) setTiles(out.filter((x, i, a) => x.name && x.photo && a.findIndex((y) => y.photo === x.photo) === i).slice(0, 6));
    })();
    return () => { stop = true; };
  }, []);
  return tiles;
}

function MarketViz({ items, real }) {
  const box = useRef(null);
  const [scan, setScan] = useState(items.length > 3 ? [0, 5, 2] : items.map((_, i) => i).slice(0, Math.max(1, items.length - 1)));
  const [pos, setPos] = useState([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const place = (s) => {
      const el = box.current; if (!el) return;
      const tiles = el.querySelectorAll('.t');
      setPos(s.map((i) => { const t = tiles[i]; if (!t || !t.offsetParent) return null; return { left: t.offsetLeft + t.offsetWidth - 20, top: t.offsetTop - 8 }; }));
    };
    place(scan);
    if (reduce) return;
    let cur = scan;
    const id = setInterval(() => {
      const visible = [...box.current.querySelectorAll('.t')].map((t, i) => (t.offsetParent ? i : -1)).filter((i) => i >= 0);
      cur = cur.map((c, k) => { const opts = visible.filter((v) => !cur.includes(v)); const pool = opts.length ? opts : visible; return pool[Math.floor(Math.random() * pool.length)]; });
      setScan(cur); place(cur); setTick((x) => x + 1);
    }, 1900);
    const onR = () => place(cur);
    window.addEventListener('resize', onR);
    return () => { clearInterval(id); window.removeEventListener('resize', onR); };
  }, []);
  return (
    <div className="viz" aria-label="Illustration of AI agents scanning Marketplace listings">
      <div className="vizbar"><span className="live"><i />{real ? 'Deals Grok Bot found on Marketplace' : 'Grok Bot agents scanning Marketplace'}</span><span>Austin, TX</span></div>
      <div className="tiles" ref={box}>
        {items.map((it, i) => (
          <div key={i} className={'t' + (scan.includes(i) ? ' scan' : '')}>
            <a className="ph" href={it.href || it.link || undefined} target={!it.href && it.link ? '_blank' : undefined} rel="noopener">
              {real ? <Photo src={it.photo} title={it.name} fb={it.link} /> : <img src={it.photo} alt={it.name} loading="eager" />}
              {real ? <span className="realtag">Real</span> : <span className="extag">Example</span>}
              {it.mkt ? <div className="cmp">${it.ask} vs <b>${it.mkt}</b> market</div> : null}
            </a>
            <div className="meta"><div className="pr">{it.ask !== undefined && it.ask !== null ? '$' + it.ask : ''}</div><div className="nm">{it.name}</div>{it.link && <a className="vom" href={it.link} target="_blank" rel="noopener">View on Marketplace</a>}</div>
          </div>
        ))}
        {pos.map((p, k) => p && <div key={k} className="agent" style={p}>{['G', 'R', 'K'][k]}</div>)}
      </div>
      <div className="vizfoot"><span className="cursor" /> {FEED[tick % FEED.length]}... <span style={{ float: 'right' }}>{real ? 'Real deals found by Grok Bot scouts' : 'Example items and prices, not live listings'}</span></div>
    </div>
  );
}

async function shrink(file) {
  try {
    const img = await createImageBitmap(file);
    const max = 1600, s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch (e) { return file; }
}

function Drop({ children, className, over, busy }) { return <label className={cn('relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-background/40 px-6 py-12 text-center transition-colors hover:border-muted-foreground/50 hover:bg-accent/30', over && 'border-brand bg-brand/10', busy && 'pointer-events-none opacity-70', className)}>{children}</label>; }

export default function Home({ mode: initMode }) {
  const [mode, setMode] = useState(initMode === 'buy' ? 'buy' : 'sell');
  const real = useRealTiles();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [over, setOver] = useState(false);
  const [q, setQ] = useState(''); const [max, setMax] = useState('');

  const [prog, setProg] = useState('');
  async function sell(fileList) {
    const files = [...(fileList || [])].filter((f) => /^image\//.test(f.type)).slice(0, 30);
    if (!files.length) { setErr('Please choose an image.'); return; }
    setErr(''); setBusy('sell');
    const test = new URLSearchParams(location.search).get('test') === '1';
    const batchId = files.length > 1 ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : '';
    const ids = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setProg(files.length > 1 ? `Uploading ${i + 1} of ${files.length}...` : 'Uploading...');
        const f = await shrink(files[i]);
        const fd = new FormData(); fd.append('image', f, f.name || 'photo.jpg');
        if (batchId) fd.append('batch_id', batchId);
        if (test) fd.append('test', '1');
        const r = await fetch('/api/jobs', { method: 'POST', body: fd });
        const j = await r.json();
        if (!r.ok || !j.id) throw new Error(j.error || 'Upload failed');
        ids.push(j.id);
      }
      if (ids.length === 1) { location.href = `/job/${ids[0]}`; return; }
      const r = await fetch('/api/batches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: batchId, job_ids: ids }) });
      const b = await r.json();
      location.href = `/batch/${b.id || batchId}`;
    } catch (e) { setErr(String(e.message || e) + (ids.length ? ` (${ids.length} uploaded)` : '')); setBusy(''); setProg(''); }
  }
  async function buy(e) {
    e.preventDefault();
    if (!q.trim()) { setErr('Tell us what you are looking for.'); return; }
    setErr(''); setBusy('buy');
    try {
      const body = { kind: 'buy', query: q.trim() }; if (max) body.max_price = Number(max); if (new URLSearchParams(location.search).get('test') === '1') body.test = 1;
      const r = await fetch('/api/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok || !j.id) throw new Error(j.error || 'Request failed');
      location.href = `/job/${j.id}`;
    } catch (e2) { setErr(String(e2.message || e2)); setBusy(''); }
  }
  const pick = (e) => { const f = e.target.files; sell(f); e.target.value = ''; };

  const howSteps = [['1', 'Identify', 'What is it?'], ['2', 'Price', 'What is it worth?'], ['3', 'Write', 'Title, price, details.'], ['4', 'Approve', 'You say yes.'], ['5', 'Live', 'On Marketplace.']];
  const feats = ['Photo to listing', 'Honest item ID', 'Real prices', '24/7 deal scout', 'Profit dashboard', 'Buyer replies drafted', 'You approve everything'];

  return (
    <main>
      <section className="hero home-hero !pb-16 !pt-16 md:!pt-24"><div className={cn('wrap', initMode ? 'mx-auto max-w-2xl' : 'hgrid')}>
        <div className={cn(initMode && 'text-center')}>
          {initMode ? <><h1 className="!text-5xl !font-semibold !tracking-tight md:!text-7xl">{initMode === 'sell' ? 'Sell anything.' : 'Find flips.'}</h1>
          <p className="mx-auto mt-5 max-w-md text-lg text-muted-foreground md:text-xl">{initMode === 'sell' ? 'One photo. Grok Bot writes and posts the listing.' : 'Say what you want. Grok Bot finds it under market.'}</p></> : <>
          <Badge variant="secondary" className="desk-only mb-6 px-3 py-1 text-[12px] font-normal text-muted-foreground">Garage Sale · Grok Bot Hackathon · Austin</Badge>
          <h1 className="!text-5xl !font-semibold !tracking-tight md:!text-7xl">Snap it.<br /><span className="text-muted-foreground">Grok Bot sells it.</span></h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground md:text-xl">Photo in, Facebook Marketplace listing out. You approve every step.</p></>}
          <div className="mt-10 grid gap-4 text-left">
            <Card id={mode} className={cn('min-w-0 border-border/70 bg-card/80 p-5 backdrop-blur md:p-6', mode === 'sell' && over && 'border-brand')}
              onDragOver={(e) => { if (mode !== 'sell') return; e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={(e) => { if (mode !== 'sell') return; e.preventDefault(); setOver(false); sell(e.dataTransfer.files); }}>
              <Tabs value={mode} onValueChange={(v) => setMode(v)}>
                <TabsList className="grid w-full grid-cols-2 md:w-64">
                  <TabsTrigger value="buy">Buy</TabsTrigger>
                  <TabsTrigger value="sell">Sell</TabsTrigger>
                </TabsList>
              </Tabs>
              {mode === 'sell' ? <div className="mt-5 grid gap-4">
                <Drop over={over} busy={busy}><input className="sr-only" type="file" accept="image/*" multiple onChange={pick} disabled={!!busy} />
                  <span className="text-lg font-medium">{busy === 'sell' ? (prog || 'Uploading...') : 'Drop photos or tap to add'}</span>
                  <span className="text-sm text-muted-foreground">Each photo becomes a listing</span></Drop>
                <div className="grid grid-cols-2 gap-3">
                  <Button asChild size="lg" variant="brand" className={cn('w-full', busy && 'pointer-events-none opacity-50')}><label><input className="sr-only" type="file" accept="image/*" capture="environment" onChange={pick} disabled={!!busy} />{busy === 'sell' ? (prog || 'Uploading...') : 'Take photo'}</label></Button>
                  <Button asChild size="lg" variant="secondary" className={cn('w-full', busy && 'pointer-events-none opacity-50')}><label><input className="sr-only" type="file" accept="image/*" multiple onChange={pick} disabled={!!busy} />Attach photos</label></Button>
                </div>
                <div className="flex flex-wrap gap-2">{['Headphones', 'Game console', 'Office chair', 'Old iPhone'].map((t) => <Badge key={t} variant="outline" className="border-border/70 px-3 py-1 font-normal text-muted-foreground">{t}</Badge>)}</div>
              </div> : <form onSubmit={buy} className="mt-5 grid gap-4">
                <Input className="h-14 rounded-2xl px-5 text-lg" placeholder="What do you want? e.g. Herman Miller chair" value={q} onChange={(e) => setQ(e.target.value)} aria-label="What are you looking for?" />
                <div className="flex gap-3">
                  <Input className="h-12 w-32 shrink-0" placeholder="Max $" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Max price" />
                  <Button size="lg" variant="brand" className="flex-1" disabled={!!busy}>{busy === 'buy' ? 'Starting...' : 'Find deals'}</Button>
                </div>
                <div className="flex flex-wrap gap-2">{['Used Mac with Apple silicon under $500', 'Herman Miller chair to flip', 'Nintendo Switch under $200', 'Road bike under $300'].map((t) => <Button type="button" key={t} variant="outline" size="sm" className="h-8 border-border/70 px-3 text-xs font-normal text-muted-foreground" onClick={() => setQ(t)}>{t}</Button>)}</div>
              </form>}
            </Card>
            {err && <p className="text-sm text-red-400">{err}</p>}
            <a href="/dashboard" className="group flex items-center justify-between rounded-2xl border border-border/70 px-5 py-4 transition-colors hover:bg-accent/40">
              <span className="flex flex-col"><span className="font-medium">Dashboard</span><span className="text-sm text-muted-foreground">Your money, live</span></span>
              <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></a>
          </div>
        </div>
        {!initMode && (real && real.length >= 3 ? <MarketViz key="real" items={real} real /> : <MarketViz key="ex" items={EXAMPLES} />)}
      </div>{!initMode && <div className="wrap mt-16"><GarageScene /></div>}</section>
      {initMode && <ModeFeed mode={initMode} />}

      {!initMode && <section id="how" className="py-24"><div className="wrap">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="!text-4xl !font-semibold !tracking-tight md:!text-6xl">How it works</h2>
        </div>
        <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-5">
          {howSteps.map(([n, t, p]) => <Card key={n} className="border-border/60 p-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium">{n}</div>
            <div className="mt-6 text-lg font-semibold">{t}</div><p className="mt-1 text-sm text-muted-foreground">{p}</p></Card>)}
        </div>
        <Card className="mt-4 flex items-center gap-4 border-border/60 p-6">
          <Badge variant="brand">Buy</Badge><div><div className="text-lg font-semibold">Scouts find deals</div><p className="text-sm text-muted-foreground">Cheap finds near you.</p></div>
        </Card>
        <div className="mt-28">
          <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">About</h3>
          <p className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Snap it. Grok Bot sells it.</p>
          <div className="mt-10 flex flex-wrap gap-2">{feats.map((f) => <Badge key={f} variant="secondary" className="px-4 py-2 text-sm font-normal">{f}</Badge>)}</div>
          <Separator className="my-12" />
          <div className="grid gap-3 text-sm text-muted-foreground [&_a]:text-foreground [&_a]:underline-offset-4 hover:[&_a]:underline [&_b]:font-medium [&_b]:text-foreground">
            <p><b>Built in 2.5 hours with Grok Bot.</b></p>
            <p><b>Built at</b> <a href="https://luma.com/x0qss5av?tk=Mdaf1N" target="_blank" rel="noreferrer">Grok Bot Hackathon</a>, Austin, TX, Oct 19, 2026</p>
            <p><b>Team</b> <a href="https://adampang.com" target="_blank" rel="noreferrer">Adam Pang</a> (<a href="https://github.com/adamtpang" target="_blank" rel="noreferrer">GitHub</a>), Pranav, Isaac</p>
            <p><b>Code</b> <a href="https://github.com/adamtpang/grokbothackathon" target="_blank" rel="noreferrer">github.com/adamtpang/grokbothackathon</a></p>
          </div>
        </div>
      </div></section>}
    </main>
  );
}
