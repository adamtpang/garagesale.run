'use client';
import { useEffect, useState } from 'react';
import Photo from '../../../../components/Photo';
const num = (x) => (x === null || x === undefined || x === '' || isNaN(Number(x)) ? null : Number(x));
const $ = (v) => (num(v) === null ? '-' : '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }));
function srcName(x) { const s = String(x || '').toLowerCase(); if (s.includes('ebay')) return 'eBay'; if (s.includes('amazon')) return 'Amazon'; if (s.includes('facebook') || s.includes('marketplace')) return 'Facebook'; return x ? String(x) : 'Resale'; }
export default function Deal({ params }) {
  const { src, idx } = params;
  const [d, setD] = useState(undefined); const [ctx, setCtx] = useState('');
  useEffect(() => {
    (async () => {
      try {
        if (src === 'feed') { const f = await (await fetch('/api/deals', { cache: 'no-store' })).json(); setCtx('Scout feed'); setD(((f && f.deals) || [])[Number(idx)] || null); }
        else { const j = await (await fetch(`/api/jobs/${encodeURIComponent(src)}`, { cache: 'no-store' })).json(); setCtx(j && j.query ? `For "${j.query}"` : ''); setD(((j && j.results && j.results.deals) || [])[Number(idx)] || null); }
      } catch (e) { setD(null); }
    })();
  }, [src, idx]);
  if (d === undefined) return <main className="wrap dealp"><p className="muted">Loading deal...</p></main>;
  if (!d) return <main className="wrap dealp"><h1>Deal not found</h1><p><a href="/dashboard" className="pill gray">Back to dashboard</a></p></main>;
  const comps = Array.isArray(d.comps) ? d.comps : [];
  const ask = num(d.ask_price ?? d.buy_price ?? d.price);
  const resell = num(d.resale_price ?? d.resell_price ?? d.est_market_price);
  const rsrcRaw = d.resale_source || d.resell_source || d.resell_platform || (comps[0] && comps[0].source) || '';
  const rsrc = srcName(rsrcRaw);
  const rurl = d.resale_url || d.resell_url || (comps[0] && comps[0].url) || null;
  const buyUrl = d.fb_url || d.source_url || d.link || d.url || null;
  const profit = num(d.est_profit) ?? (ask !== null && resell !== null ? resell - ask : null);
  let disc = num(d.discount_pct); if (disc !== null && disc > 0 && disc <= 1) disc *= 100;
  if (disc === null && ask !== null && resell) disc = (1 - ask / resell) * 100;
  const isEbay = /ebay/i.test(rsrcRaw);
  const photo = d.photo_url || d.image_url || d.image;
  return <main className="wrap dealp">
    <p className="eyebrow"><a href="/dashboard">Dashboard</a> · {ctx || 'Deal'}</p>
    <div className="dhero">
      <div className="dph"><Photo src={photo} title={d.title} fb={(d.fb_url || d.source_url || d.link || d.url)} /></div>
      <h1>{d.title}</h1>
    </div>
    <div className="legs3">
      <div className="lg buy"><span>Buy here</span><small>Facebook Marketplace</small><b>{$(ask)}</b>{buyUrl && <a className="pill blue" href={buyUrl} target="_blank" rel="noopener">Open listing</a>}</div>
      <div className="lg sell"><span>Sell here</span><small>{rsrc}</small><b>{$(resell)}</b>{rurl && <a className="pill gray" href={rurl} target="_blank" rel="noopener">Open comp</a>}</div>
      <div className="lg spread"><span>Your spread</span><small>{disc !== null && isFinite(disc) ? `${Math.round(disc)}% under market` : 'Estimated'}</small><b className="green">{profit !== null ? `${profit >= 0 ? '+' : '-'}$${Math.abs(Math.round(profit)).toLocaleString()}` : '-'}</b>
        {isEbay && resell !== null && ask !== null && <em>about {$(resell * 0.87 - ask)} after eBay's ~13% fee</em>}</div>
    </div>
    {comps.length > 0 && <section className="dsec"><h2>Comps <span className="muted small">{comps.length}</span></h2>
      {comps.map((c, k) => <a key={k} className="comp" href={c.url || c.link || undefined} target="_blank" rel="noopener"><span><b>{c.title || c.source}</b><small>{c.source}</small></span><b>{$(c.price)}</b></a>)}</section>}
    {d.rationale && <section className="dsec"><h2>Why it is a deal</h2><p className="muted">{d.rationale}</p></section>}
    <section className="howflip"><h2>How to flip IRL</h2><div className="hf">
      <div><i>1</i><b>Message the seller</b><p>Tap Open listing, say it is still available and offer the asking price or a little under.</p></div>
      <div><i>2</i><b>Pick it up</b><p>Meet somewhere public, check it works, pay cash or with a payment app.</p></div>
      <div><i>3</i><b>List it with Garage Sale</b><p>Snap a photo on the <a href="/sell">Sell</a> page. Grok Bot prices it from the comps and posts it for you.</p></div>
    </div></section>
  </main>;
}
