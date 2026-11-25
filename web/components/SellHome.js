'use client';
import { useEffect, useRef, useState } from 'react';
import GarageScene from './GarageScene';
import Photo, { prox } from './Photo';
import ModeFeed from './ModeFeed';
import { PRESETS } from './BuySearch';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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

function Drop({ children, className, over, busy }) { return <label className={cn('relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-background/40 px-6 py-12 text-center transition-colors hover:border-muted-foreground/50 hover:bg-accent/30', over && 'border-brand bg-accent', busy && 'pointer-events-none opacity-70', className)}>{children}</label>; }

export default function Home({ mode: initMode }) {
  const [mode, setMode] = useState(initMode === 'buy' ? 'buy' : 'sell');
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
  // The live search, pricing and ranking run on /buy.
  function buy(e, query = q) {
    if (e) e.preventDefault();
    if (!String(query).trim()) { setErr('Tell us what you are looking for.'); return; }
    setBusy('buy');
    location.href = `/buy?q=${encodeURIComponent(String(query).trim())}${max ? `&max=${max}` : ''}`;
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
          <h1 className="!text-5xl !font-semibold !tracking-tight md:!text-7xl">Snap it.<br /><span className="text-brand">Grok Bot sells it.</span></h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground md:text-xl">Photo in, Facebook Marketplace listing out. You approve every step.</p></>}
          <div className="mt-10 grid gap-4 text-left">
            <Card id={mode} className={cn('min-w-0 border-border bg-card p-5 backdrop-blur md:p-6', mode === 'sell' && over && 'border-brand')}
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
                <div className="flex flex-wrap gap-2">{['Headphones', 'Game console', 'Office chair', 'Old iPhone'].map((t) => <Badge key={t} variant="outline" className="border-border px-3 py-1 font-normal text-muted-foreground">{t}</Badge>)}</div>
              </div> : <form onSubmit={buy} className="mt-5 grid gap-4">
                <Input className="h-14 rounded-2xl px-5 text-lg" placeholder="What do you want? e.g. Herman Miller chair" value={q} onChange={(e) => setQ(e.target.value)} aria-label="What are you looking for?" />
                <div className="flex gap-3">
                  <Input className="h-12 w-32 shrink-0" placeholder="Max $" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Max price" />
                  <Button size="lg" variant="brand" className="flex-1" disabled={!!busy}>{busy === 'buy' ? 'Opening...' : 'Find deals'}</Button>
                </div>
                <div className="flex flex-wrap gap-2">{PRESETS.map((t) => <Button type="button" key={t} variant="outline" size="sm" className="h-8 border-border px-3 text-xs font-normal text-muted-foreground" onClick={() => { setQ(t); buy(null, t); }}>{t}</Button>)}</div>
              </form>}
            </Card>
            {err && <p className="text-sm text-red-300">{err}</p>}
            <a href="/" className="group flex items-center justify-between rounded-2xl border border-border px-5 py-4 transition-colors hover:bg-accent/40">
              <span className="flex flex-col"><span className="font-medium">Market</span><span className="text-sm text-muted-foreground">Deals, best profit first</span></span>
              <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></a>
          </div>
        </div>
      </div>{!initMode && <div className="wrap mt-16"><GarageScene /></div>}</section>
      {initMode && <ModeFeed mode={initMode} />}

      {!initMode && <section id="how" className="py-24"><div className="wrap">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="!text-4xl !font-semibold !tracking-tight md:!text-6xl">How it works</h2>
        </div>
        <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-5">
          {howSteps.map(([n, t, p]) => <Card key={n} className="border-border p-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium">{n}</div>
            <div className="mt-6 text-lg font-semibold">{t}</div><p className="mt-1 text-sm text-muted-foreground">{p}</p></Card>)}
        </div>
        <Card className="mt-4 flex items-center gap-4 border-border p-6">
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
            <p><b>Code</b> <a href="https://github.com/adamtpang/garagesale.run" target="_blank" rel="noreferrer">github.com/adamtpang/garagesale.run</a></p>
          </div>
        </div>
      </div></section>}
    </main>
  );
}
