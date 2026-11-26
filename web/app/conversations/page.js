'use client';
import { useEffect, useState } from 'react';
import Photo from '../../components/Photo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
const LABEL = { drafting: 'Drafting', writing: 'Drafting', awaiting_approval: 'Your approval', approved: 'Approved', posting: 'Posting', live: 'Live' };
const ago = (ts) => { if (!ts) return ''; const s = Math.round((Date.now() - new Date(ts)) / 1000); if (s < 60) return 'just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`; if (s < 86400) return `${Math.round(s / 3600)} h ago`; return new Date(ts).toLocaleDateString(); };
const STEPS = { sell: ['New message', 'Negotiating', 'Price agreed', 'Pickup set', 'Sold'], buy: ['Seller contacted', 'Negotiating', 'Price agreed', 'Pickup set', 'Bought'] };
const STAGE_KEYS = [['new', 'contacted', 'message'], ['negotiat', 'counter', 'offer'], ['agreed', 'accept'], ['pickup'], ['sold', 'bought', 'done', 'complete']];
function stepOf(q) {
  if (q.deal_stage) { const d = String(q.deal_stage).toLowerCase(); const i = STAGE_KEYS.findIndex((ks) => ks.some((k) => d.includes(k))); if (i >= 0) return i; }
  const offer = q.offer_price !== undefined && q.offer_price !== null;
  if (q.status === 'new' || q.status === 'drafted') return offer ? 1 : 0;
  return 1;
}
const r5 = (n) => Math.round(n / 5) * 5;
function nextStep(q, ask, step) {
  const offer = q.offer_price !== undefined && q.offer_price !== null ? Number(q.offer_price) : null;
  const pk = [q.pickup_place, q.pickup_time].filter(Boolean).join(', ');
  if (step >= 4) return 'Done. Mark it sold.';
  if (q.status === 'sent' || q.status === 'sending') return `Waiting on ${q.buyer_name || 'the buyer'}. Nudge in 24h if no reply`;
  if (offer !== null && ask > 0 && step < 2) return offer < ask * 0.85 ? `Counter at $${r5((offer + ask) / 2).toLocaleString()}` : `Accept and confirm pickup${pk ? ` at ${pk}` : ''}`;
  if (pk && step < 3) return `Confirm pickup at ${pk}`;
  if (q.status === 'sent' || q.status === 'sending') return `Waiting on ${q.buyer_name || 'the buyer'}. Nudge in 24h if no reply`;
  return 'Review the draft and send';
}
export default function Conversations() {
  const [jobs, setJobs] = useState(null); const [full, setFull] = useState({}); const [drafts, setDrafts] = useState({}); const [sending, setSending] = useState(''); const [err, setErr] = useState(''); const [hl, setHl] = useState('');
  useEffect(() => {
    let alive = true;
    try { const h = new URLSearchParams(location.search).get('hl'); if (h) { setHl(h); setTimeout(() => alive && setHl(''), 4000); } } catch (e) {}
    const load = async () => {
      try {
        const j = await (await fetch('/api/jobs?recent=1', { cache: 'no-store' })).json();
        if (!alive || !j.jobs) return; setJobs(j.jobs);
        const withMsgs = j.jobs.filter((x) => Number(x.inquiries) > 0);
        const got = await Promise.all(withMsgs.map(async (x) => { try { return await (await fetch(`/api/jobs/${x.id}`, { cache: 'no-store' })).json(); } catch (e) { return null; } }));
        if (alive) setFull((f) => { const n = { ...f }; got.forEach((g) => { if (g && g.id) n[g.id] = g; }); return n; });
      } catch (e) {}
    };
    load(); const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  async function sendReply(jobId, q) {
    setSending(q.id); setErr('');
    try {
      const r = await fetch(`/api/jobs/${jobId}/replies/${encodeURIComponent(q.id)}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: drafts[q.id] ?? q.draft_reply }) });
      const j = await r.json(); if (r.ok && j && j.id) { setFull((f) => ({ ...f, [j.id]: j })); setHl(q.id); setTimeout(() => setHl(''), 4000); } else setErr((j && j.error) || 'Request failed');
    } catch (e) { setErr('Request failed'); }
    setSending('');
  }
  const sells = (jobs || []).filter((j) => j.kind === 'sell' && !j.test);
  const threads = (jobs || []).filter((j) => !j.test).map((j) => ({ j, f: full[j.id], inqs: (full[j.id] && Array.isArray(full[j.id].inquiries)) ? full[j.id].inquiries : [] })).filter((t) => t.inqs.length > 0);
  const tx = sells.filter((j) => ['writing', 'awaiting_approval', 'approved', 'posting', 'live'].includes(j.stage));
  const thumb = 'shrink-0 overflow-hidden rounded-xl bg-secondary [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>.phx]:h-full [&>.phx]:w-full [&_.phx_span]:text-base';
  const ist = { new: 'brand', drafted: 'warn', sending: 'secondary' };
  return <main className="wrap mx-auto max-w-3xl py-16 md:py-24">
    <p className="text-sm font-medium text-muted-foreground">Inbox</p><h1 className="mt-2 !text-5xl !font-semibold !tracking-tight md:!text-6xl">Messages</h1>
    {tx.length > 0 && <div className="mt-10 flex gap-3 overflow-x-auto pb-2">{tx.map((j) => <a key={j.id} className="flex shrink-0 items-center gap-3 rounded-2xl border border-border/60 bg-card p-2 pr-4 transition-colors hover:bg-accent/40" href={j.listing_url || `/job/${j.id}`} target={j.listing_url ? '_blank' : undefined} rel="noopener">
      <span className={cn(thumb, 'h-10 w-10')}><Photo src={j.image_url} title={j.title} /></span>
      <span className="flex flex-col gap-1"><b className="max-w-[160px] truncate text-sm font-medium">{j.title || 'Item'}</b><Badge variant={j.stage === 'live' ? 'success' : 'secondary'} className="w-fit font-normal">{LABEL[j.stage] || j.stage}</Badge></span>
    </a>)}</div>}
    {err && <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-red-300">{err}</div>}
    {jobs === null ? <div className="mt-12 text-center text-sm text-muted-foreground">Loading...</div> : threads.length === 0 ? <Card className="mt-12 border-border/60 p-10 text-center text-muted-foreground">No buyer messages yet. Grok Bot checks your Marketplace inbox and drafts replies for you to approve.</Card> :
      <div className="mt-12 grid gap-6">{threads.map(({ j, f, inqs }) => <Card key={j.id} className="overflow-hidden border-border/60">
        <div className="flex items-center gap-4 p-5"><a className={cn(thumb, 'h-14 w-14')} href={`/job/${j.id}`}><Photo src={j.image_url} title={j.title} /></a>
          <div className="min-w-0 flex-1"><a href={`/job/${j.id}`} className="block truncate text-lg font-semibold">{j.title || 'Item'}</a>{j.listing_url && <a className="text-sm text-muted-foreground hover:text-foreground" href={j.listing_url} target="_blank" rel="noopener">View listing</a>}</div></div>
        <Separator />
        <div>{inqs.map((q, qi) => <div key={q.id} id={'inq-' + q.id} className={cn('grid gap-4 p-5 transition-colors duration-700', qi > 0 && 'border-t border-border/60', hl === q.id && 'bg-brand/10')}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3"><Avatar className="h-9 w-9"><AvatarFallback className="text-sm">{String(q.buyer_name || 'B').charAt(0).toUpperCase()}</AvatarFallback></Avatar>
              <div><div className="font-medium">{q.buyer_name || 'Buyer'} <span className="text-xs font-normal text-muted-foreground">{q.sent_at ? 'replied ' + ago(q.sent_at) : ''}</span></div>
              <div className="text-xs text-muted-foreground">{j.title || 'Item'} · received {ago(q.ts)}</div></div></div>
            <Badge variant={ist[q.status] || 'success'} className="font-normal">{q.status === 'new' ? 'New' : q.status === 'drafted' ? 'Drafted, awaiting approval' : q.status === 'sending' ? 'Sending...' : 'Sent'}</Badge></div>
          {(() => { const st = stepOf(q); const steps = STEPS[j.kind === 'buy' ? 'buy' : 'sell']; return <>
            <ol className="m-0 flex list-none gap-1.5 p-0">{steps.map((t, i) => <li key={t} className="flex-1"><div className={cn('h-1 rounded-full', i < st ? 'bg-success' : i === st ? 'bg-brand' : 'bg-secondary')} /><div className={cn('mt-1.5 truncate text-[11px]', i === st ? 'text-foreground' : 'text-muted-foreground')}>{t}</div></li>)}</ol>
            <div className="rounded-xl bg-secondary/60 px-4 py-3"><div className="text-xs text-muted-foreground">Recommended next step</div><div className="mt-0.5 font-medium">{nextStep(q, Number(j.price) || 0, st)}</div><div className="mt-1 text-xs text-muted-foreground">Meet in a public place, cash or Zelle on pickup.</div></div>
          </>; })()}
          <div className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-md bg-secondary px-4 py-2.5">{q.message}</div>
          {(q.intent || q.offer_price !== undefined || q.pickup_time || q.pickup_place) && <div className="flex flex-wrap gap-2">
            {q.intent && <Badge variant="outline" className="font-normal">{q.intent}</Badge>}
            {q.offer_price !== undefined && q.offer_price !== null && <Badge variant="success">Offer ${Number(q.offer_price).toLocaleString()}</Badge>}
            {q.pickup_time && <Badge variant="outline" className="font-normal">{q.pickup_time}</Badge>}
            {q.pickup_place && <Badge variant="outline" className="font-normal">{q.pickup_place}</Badge>}
          </div>}
          {q.status === 'drafted' ? <div className="grid gap-3">
            <Textarea rows={3} value={drafts[q.id] ?? q.draft_reply ?? ''} onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })} aria-label="Reply" />
            <Button variant="brand" className="justify-self-end" onClick={() => sendReply(j.id, q)} disabled={sending === q.id}>{sending === q.id ? 'Sending...' : 'Approve & send'}</Button>
          </div> : <div className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-brand px-4 py-2.5 text-white">{q.approved_text || q.draft_reply}</div>}
        </div>)}</div>
      </Card>)}</div>}
  </main>;
}
