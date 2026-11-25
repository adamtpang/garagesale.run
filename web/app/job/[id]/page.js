'use client';
import { useEffect, useRef, useState } from 'react';
import DealCard from '../../../components/DealCard';
import Photo, { prox } from '../../../components/Photo';

const STAGES = {
  sell: ['received', 'identifying', 'researching', 'writing', 'awaiting_approval', 'approved', 'posting', 'live'],
  buy: ['received', 'scouting', 'comparing', 'done'],
};
const LABEL = { received: 'Received', identifying: 'Identifying', researching: 'Researching', writing: 'Writing', awaiting_approval: 'Your approval', approved: 'Approved', posting: 'Posting', live: 'Live', scouting: 'Scouting', comparing: 'Comparing', done: 'Done' };
const money = (v) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? (v ?? '') : '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }));
const t = (ts) => { try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return ''; } };
function badge(src) {
  const s = String(src || '').toLowerCase();
  if (s.includes('fb') || s.includes('facebook') || s.includes('marketplace')) return ['FB', 'b-fb'];
  if (s.includes('ebay')) return ['eBay', 'b-ebay'];
  if (s.includes('amazon')) return ['Amazon', 'b-amazon'];
  return [src || 'Web', 'b-other'];
}
const pct = (v) => { const n = Number(v); if (isNaN(n)) return ''; return Math.round(n <= 1 && n > 0 ? n * 100 : n) + '%'; };

function AgentScreen({ snaps, active }) {
  const [sel, setSel] = useState(-1);
  const i = sel >= 0 && sel < snaps.length ? sel : snaps.length - 1;
  const cur = snaps[i];
  return <div className={'panel snapp ' + (active ? 'o00' : 'o2b')}>
    <h3><span className="live"><i />Grok Bot is filling in Facebook live</span> <span>{snaps.length}</span></h3>
    <div className="shot"><img src={cur.url} alt={cur.caption || 'Agent screen'} /></div>
    <div className="scap"><span>{cur.caption || 'Agent screen'}</span><span className="small muted">{t(cur.at)}</span></div>
    {snaps.length > 1 && <div className="strip">{snaps.map((s, k) => <button key={s.url} className={k === i ? 'on' : ''} onClick={() => setSel(k === snaps.length - 1 ? -1 : k)} aria-label={`Snapshot ${k + 1}`}><img src={s.url} alt="" loading="lazy" /></button>)}</div>}
  </div>;
}

const EST = {
  sell: { phases: [['received', 0], ['identifying', 30], ['researching', 120], ['writing', 30]], post: [['approved', 0], ['posting', 120]] },
  buy: { phases: [['received', 0], ['scouting', 90], ['comparing', 90]] },
};
function Eta({ job }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const e = EST[job.kind] || EST.sell;
  const list = e.post && e.post.some(([s]) => s === job.stage) ? e.post : e.phases;
  const i = list.findIndex(([s]) => s === job.stage);
  if (i < 0) return null;
  const logs = Array.isArray(job.logs) ? job.logs : [];
  const first = logs.find((l) => l && l.stage === job.stage);
  const start = new Date((first && first.ts) || job.updated_at || job.created_at).getTime();
  const total = list.reduce((n, [, v]) => n + v, 0);
  const before = list.slice(0, i).reduce((n, [, v]) => n + v, 0);
  const curEst = list[i][1];
  const inStage = Math.max(0, (now - start) / 1000);
  const done = before + Math.min(inStage, curEst);
  const left = Math.max(0, total - before - inStage);
  const over = curEst > 0 ? inStage > curEst : false;
  const pct = Math.min(98, Math.max(3, (done / total) * 100));
  const label = over || left < 5 ? 'Almost there, still working' : left >= 90 ? `About ${Math.round(left / 60)} min left` : left >= 50 ? 'About 1 min left' : `About ${Math.max(5, Math.round(left / 5) * 5)} sec left`;
  return <div className="eta"><div className="etar"><span>{label}</span><small>{list === e.post ? 'Posting to Marketplace' : job.kind === 'buy' ? 'Finding deals' : 'Drafting your listing'}</small></div><div className="etab"><i style={{ width: `${pct}%` }} /></div></div>;
}

function Stepper({ kind, stage }) {
  const list = STAGES[kind] || STAGES.sell;
  const i = list.indexOf(stage);
  return <div className="stepper">{list.map((s, k) => (
    <div key={s} className={'st' + (k < i || (k === i && (s === 'live' || s === 'done')) ? ' done' : k === i ? ' cur' : '')}><i>{k < i || (k === i && (s === 'live' || s === 'done')) ? '✓' : k + 1}</i>{LABEL[s] || s}</div>
  ))}{i < 0 && stage ? <div className="st cur"><i>•</i>{stage}</div> : null}</div>;
}

const ICON = { received: '📥', identifying: '🔍', researching: '📊', writing: '✍️', awaiting_approval: '✋', approved: '✅', posting: '🚀', live: '🟢', scouting: '🛰️', comparing: '⚖️', done: '🏁' };
function Log({ logs, active }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs.length]);
  return <><div className="termbar"><i /><i /><i /><span style={{ marginLeft: 8 }}>grok-bot agent · live</span></div><div className="term" ref={ref}>{logs.length === 0 && <div className="ln">waiting for the first event...</div>}
    {logs.map((l, k) => <div key={k} className={'ln ' + (l.source || '') + (k === logs.length - 1 ? ' new' : '')}>
      <span className="ts">{t(l.ts)}</span> <span className="ic">{ICON[l.stage] || '•'}</span> <span className="sg">{l.source === 'worker' ? 'agent' : 'app'}:{l.stage || '-'}</span> {l.message}</div>)}
    {active && <div className="ln"><span className="ts">{t(new Date().toISOString())}</span> <span className="cursor" /></div>}</div></>;
}

function Price({ p }) {
  const lo = Number(p.low), hi = Number(p.high);
  const at = (v) => (hi > lo ? Math.min(100, Math.max(0, ((Number(v) - lo) / (hi - lo)) * 100)) : 50);
  return <div>
    {p.recommended !== undefined && <div className="rec-p">{money(p.recommended)}<small>recommended</small></div>}
    {!isNaN(lo) && !isNaN(hi) && <><div className="range">
      {p.median !== undefined && <div className="mk" style={{ left: at(p.median) + '%' }}><span>median {money(p.median)}</span></div>}
      {p.recommended !== undefined && <div className="mk rec" style={{ left: at(p.recommended) + '%' }} />}
    </div><div className="rlbl"><span>Low {money(p.low)}</span><span>High {money(p.high)}</span></div></>}
    {p.rationale && <p className="rat">{p.rationale}</p>}
  </div>;
}

function Listing({ l, img }) {
  const tags = Array.isArray(l.tags) ? l.tags : typeof l.tags === 'string' ? l.tags.split(',') : [];
  return <div className="mp">
    {img && <img src={prox(img)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
    <div className="bd">
      <h2>{l.title}</h2><div className="mpp">{money(l.price)}</div>
      <div className="sm">Listed just now in Austin, TX</div>
      <h5>Details</h5>
      <div className="det">{l.condition && <><span>Condition</span><span>{l.condition}</span></>}{l.category && <><span>Category</span><span>{l.category}</span></>}</div>
      {l.description && <p className="desc">{l.description}</p>}
      {tags.length > 0 && <div className="chips">{tags.map((x, k) => <span key={k}>{String(x).trim()}</span>)}</div>}
    </div>
  </div>;
}

export default function JobPage({ params }) {
  const { id } = params;
  const [job, setJob] = useState(null);
  const [err, setErr] = useState('');
  const [price, setPrice] = useState('');
  const [approving, setApproving] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const priceTouched = useRef(false);
  const [spot, setSpot] = useState(''); const [times, setTimes] = useState('');
  const [ans, setAns] = useState(''); const [sending, setSending] = useState('');
  const [drafts, setDrafts] = useState({});
  async function post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
    const j = await r.json(); if (r.ok) setJob(j); else setErr(j.error || 'Request failed'); return r.ok;
  }
  async function answer(e) { e.preventDefault(); if (!ans.trim()) return; setSending('answer'); if (await post(`/api/jobs/${id}/answer`, { answer: ans.trim() })) setAns(''); setSending(''); }
  async function sendReply(q) { setSending(q.id); const ok = await post(`/api/jobs/${id}/replies/${encodeURIComponent(q.id)}/approve`, { text: drafts[q.id] ?? q.draft_reply }); if (ok) { location.href = `/conversations?hl=${encodeURIComponent(q.id)}`; return; } setSending(''); }

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/jobs/${id}`, { cache: 'no-store' });
        if (r.status === 404) { setErr('Job not found.'); return; }
        const j = await r.json(); if (!stop) { setJob(j); setErr(''); }
      } catch (e) { if (!stop) setErr('Reconnecting...'); }
    };
    load();
    const a = setInterval(load, 5000), b = setInterval(() => setTick(Date.now()), 5000);
    return () => { stop = true; clearInterval(a); clearInterval(b); };
  }, [id]);

  const R = (job && job.results) || {};
  useEffect(() => {
    if (priceTouched.current) return;
    const v = (R.listing && R.listing.price) ?? (R.price && R.price.recommended);
    if (v !== undefined && v !== null) setPrice(String(v));
  }, [job]);

  async function approve() {
    setApproving(true);
    try {
      const r = await fetch(`/api/jobs/${id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...(price !== '' ? { price: Number(price) } : {}), ...(spot || times ? { pickup: { spot: spot || 'A public spot near you, like a coffee shop', times } } : {}) }) });
      const j = await r.json(); if (r.ok) setJob(j); else setErr(j.error || 'Approve failed');
    } finally { setApproving(false); }
  }

  if (!job) return <main className="wrap"><div className="jobhead"><h1>{err || 'Loading job...'}</h1></div></main>;
  const logs = job.logs || [];
  const workerSeen = logs.some((l) => l.source === 'worker') || job.stage !== 'received';
  const age = (tick - new Date(job.created_at).getTime()) / 1000;
  const listingUrl = job.listing_url || R.listing_url;
  const deals = Array.isArray(R.deals) ? [...R.deals].filter((d) => { const a = Number(d.ask_price ?? d.buy_price ?? d.price); const r = Number(d.resale_price ?? d.resell_price ?? d.est_market_price); const p = d.est_profit !== undefined && d.est_profit !== null && d.est_profit !== '' ? Number(d.est_profit) : r - a; return isFinite(p) && p > 0; }).sort((a, b) => Number(b.discount_pct || 0) - Number(a.discount_pct || 0)) : [];
  const idf = R.identification;
  const comps = Array.isArray(R.comps) ? R.comps : [];
  const conf = idf && idf.confidence !== undefined && idf.confidence !== null && !isNaN(Number(idf.confidence)) ? Math.max(0, Math.min(100, Number(idf.confidence) <= 1 && Number(idf.confidence) > 0 ? Number(idf.confidence) * 100 : Number(idf.confidence))) : null;
  const unsure = conf !== null && conf < 60;

  const stages = STAGES[job.kind] || STAGES.sell;
  const si = Math.max(0, stages.indexOf(job.stage));
  const doneAll = job.stage === 'live' || job.stage === 'done';
  const awaiting = job.stage === 'awaiting_approval' && job.kind === 'sell';
  const inqs = Array.isArray(job.inquiries) ? job.inquiries : [];
  const title = job.kind === 'buy' ? `${job.query}${job.max_price ? ` under ${money(job.max_price)}` : ''}` : (R.listing && R.listing.title) || (idf && idf.name) || 'Your item';
  return <main className={'wrap jobmain' + (awaiting ? ' has-sticky' : '')}>
    <div className="jobhead">
      <div><p className="eyebrow">{job.kind === 'buy' ? 'Buying' : 'Selling'}{job.test ? ' · test' : ''}{job.batch_id ? <> · <a href={`/batch/${job.batch_id}`} style={{ textDecoration: 'underline' }}>batch</a></> : null}</p>
        <h1>{title}{conf !== null && <span className={'confchip ' + (conf >= 80 ? 'hi' : conf >= 60 ? 'mid' : 'lo')}>{Math.round(conf)}% sure</span>}</h1></div>
      <span className="jid">job {job.id}</span>
    </div>
    <div className="desk-only"><Stepper kind={job.kind} stage={job.stage} /></div>
    <div className="mprog mob-only"><div className="mprow"><b>{LABEL[job.stage] || job.stage}</b><span>{si + 1}/{stages.length}</span></div>
      <div className="mbar"><i style={{ width: `${doneAll ? 100 : Math.max(6, ((si + 0.5) / stages.length) * 100)}%` }} /></div></div>
    <Eta job={job} />
    {!workerSeen && <div className="wait"><span className="spin" /><div>Grok Bot is picking this up...
      {age > 60 && <small>Still starting. This page updates on its own.</small>}</div></div>}
    {err && <p className="err">{err}</p>}

    <div className="jgrid">
      <div className="col">
        {Array.isArray(job.snapshots) && job.snapshots.length > 0 && <AgentScreen snaps={job.snapshots} active={['approved', 'posting', 'live'].includes(job.stage)} />}
        {unsure && !job.question && <div className="panel o1"><div className="unsure" style={{ margin: 0 }}>Not sure what this is. Retake the photo or add details below.</div></div>}
        {job.question && <div className="panel qpanel o1"><h3>Grok Bot needs a detail</h3>
          {unsure && <div className="unsure">Not sure what this is. Retake the photo or add details below.</div>}
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>{job.question.message}</p>
          <form className="row" onSubmit={answer}><input className="field" style={{ flex: '1 1 200px' }} value={ans} onChange={(e) => setAns(e.target.value)} placeholder={job.question.field || 'Your answer'} aria-label="Answer" />
            <button className="pill blue" disabled={sending === 'answer'}>{sending === 'answer' ? 'Sending...' : 'Send'}</button></form></div>}
        {awaiting && <div className="panel approve o4">
          <h3>Ready to post</h3>
          <div className="prow">
            <input className="field" value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="Pickup spot: a public spot near you, like a coffee shop" aria-label="Pickup spot" />
            <input className="field" value={times} onChange={(e) => setTimes(e.target.value)} placeholder="Available times, e.g. weekdays after 6" aria-label="Available times" />
          </div>
          <div className="arow">
            <input className="field pricef" inputMode="decimal" value={price} onChange={(e) => { priceTouched.current = true; setPrice(e.target.value.replace(/[^0-9.]/g, '')); }} aria-label="Price" placeholder="$" />
            <button className="pill blue big" onClick={approve} disabled={approving}>{approving ? 'Approving...' : 'Approve & post'}</button>
          </div>
        </div>}
        {listingUrl && <div className="panel livep o0">
          {job.stage === 'live' && <div className="confetti" aria-hidden="true">{Array.from({ length: 60 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 12) * 0.06}s`, background: ['#1877f2', '#30d158', '#ffd60a', '#ff375f', '#ffffff', '#bf5af2'][i % 6], transform: `rotate(${i * 29}deg)` }} />)}</div>}
          <h3 style={{ justifyContent: 'center', fontSize: 26 }}>🎉 It's live on Marketplace</h3>
          <a className="pill blue big" href={listingUrl} target="_blank" rel="noopener">Open the real listing</a>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=440x440&margin=0&data=${encodeURIComponent(listingUrl)}`} alt="QR code to the listing" />
          <p className="small muted" style={{ wordBreak: 'break-all' }}>{listingUrl}</p>
        </div>}
        {inqs.length > 0 && <div className="panel o0b"><h3>Buyer messages <span>{inqs.length}</span></h3>
          <div className="inqs">{inqs.map((q) => <div key={q.id} className="inq">
            <div className="inqh"><b>{q.buyer_name}</b><span className={'ist ' + q.status}>{q.status}</span></div>
            <div className="bmsg">{q.message}</div>
            {q.status === 'drafted' ? <>
              <textarea className="field ta" rows={3} value={drafts[q.id] ?? q.draft_reply} onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })} aria-label="Reply" />
              <button className="pill blue sm" onClick={() => sendReply(q)} disabled={sending === q.id}>{sending === q.id ? 'Sending...' : 'Send reply'}</button>
            </> : <div className="rmsg">{q.approved_text || q.draft_reply}</div>}
          </div>)}</div></div>}
        {R.listing && <div className="panel o3"><h3>Listing</h3><Listing l={R.listing} img={job.image_url} /></div>}
        {job.kind === 'buy' && <div className="panel o2"><h3>Deals {deals.length > 0 && <span>{deals.length}</span>}</h3>
          {deals.length === 0 ? <p className="muted">{job.stage === 'done' ? 'No profitable flips at current asking prices. The scout keeps looking every 30 minutes.' : 'Scouting. Deals show up here.'}</p> :
            <div className="dgrid">{deals.map((d, k) => <DealCard key={k} d={d} example={!!job.test} />)}</div>}
        </div>}
        {R.price && <div className="panel o2"><h3>Price</h3><Price p={R.price} /></div>}
        {comps.length > 0 && <div className="panel o2b"><h3>Comps <span>{comps.length}</span></h3><div className="comps">
          {comps.map((c, k) => { const [b, cl] = badge(c.source); return <a key={k} className="comp" href={c.link || c.url || '#'} target="_blank" rel="noopener">
            <span className={'badge ' + cl}>{b}</span><div className="ct">{c.title}</div><div className="cp">{money(c.price)}</div></a>; })}
        </div></div>}
      </div>
      <div className="col">
        {job.image_url && <div className="panel o1a"><h3>Photo</h3><Photo className="photo" src={job.image_url} title={job.title || 'Item photo'} /></div>}
        {idf && <div className="panel o1b"><h3>Identified</h3><dl className="kv">
          {['name', 'brand', 'model', 'condition'].map((k) => idf[k] ? [<dt key={k + 't'}>{k[0].toUpperCase() + k.slice(1)}</dt>, <dd key={k}>{String(idf[k])}</dd>] : null)}
          {idf.details && <><dt>Details</dt><dd>{typeof idf.details === 'string' ? idf.details : Array.isArray(idf.details) ? idf.details.join(', ') : JSON.stringify(idf.details)}</dd></>}
        </dl></div>}
        <div className="panel o9"><h3>Agent activity <span className="small">{logs.length}</span></h3><Log logs={logs} active={!doneAll} /></div>
      </div>
    </div>
  </main>;
}
