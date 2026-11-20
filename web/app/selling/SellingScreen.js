'use client';
// Selling: what Adam bought and is selling, from the private ledger. Needs the ledger key, like /ledger,
// and shares it through the same sessionStorage slot. Nothing here posts a listing anywhere: "Mark
// listed" only records in the ledger that Adam listed it himself.
import React, { useCallback, useEffect, useState } from 'react';
import { sellingRows, SLOW_DAYS } from '@/lib/selling';

const KEY = 'gs_ledger_key';
const $ = (v) => (v == null ? 'unknown' : `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`);
// Today in the viewer's own time zone, like the date picker. toISOString would give the UTC date, a day ahead
// on a US evening.
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => localDay();
const FIELD = 'h-10 w-28 rounded-md border-2 border-border bg-card px-2 text-sm';

export function SellingTable({ rows, onList }) {
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ list_price: '', floor_price: '', date_listed: today() });
  if (rows.length === 0) return <p className="mt-6 rounded-lg border-2 border-border bg-card p-6 text-base">Nothing on hand or listed. Buys show up here once they are in the <a className="underline" href="/ledger">ledger</a>.</p>;
  return <div className="mt-6 grid gap-4">{rows.map((r) => <article key={r.id} data-row={r.id} data-status={r.status} className="rounded-lg border-2 border-border bg-card p-4 shadow-tag">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h2 className="text-lg font-semibold">{r.item}</h2>
      <span className={`rounded-md border-2 border-border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${r.slow ? 'bg-amber-200 text-amber-950' : r.status === 'listed' ? 'bg-[#9be8b8]' : 'bg-secondary'}`} data-field="state">{r.slow ? `Slow: ${r.days_listed} days` : r.status === 'listed' ? `Listed ${r.days_listed == null ? '' : `${r.days_listed} day${r.days_listed === 1 ? '' : 's'}`}` : 'Not listed yet'}</span>
    </div>
    <dl className="mt-3 grid grid-cols-2 gap-[2px] overflow-hidden rounded-md border-2 border-border bg-foreground sm:grid-cols-4">
      {[['Paid', $(r.paid), 'Price plus gas, fees and repairs'], ['List price', r.list_price == null ? 'not set' : $(r.list_price), r.platform || null], ['Floor', r.floor_price == null ? 'not set' : $(r.floor_price), 'Lowest you would take'], ['Profit at list', r.profit_at_list == null ? 'unknown' : $(r.profit_at_list), 'Before selling fees']].map(([k, v, note]) => <div key={k} className="bg-card px-3 py-2">
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
        <dd className="text-base font-semibold tabular-nums">{v}</dd>
        {note ? <dd className="text-xs text-muted-foreground">{note}</dd> : null}
      </div>)}
    </dl>
    {r.slow ? <p className="mt-2 text-sm" data-field="slow-note">Up {r.days_listed} days, past the {SLOW_DAYS}-day mark.{r.profit_at_floor != null ? ` At your floor you would make ${$(r.profit_at_floor)} before fees.` : ''}</p> : null}
    {r.status === 'on_hand' && onList ? (open === r.id
      ? <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(ev) => { ev.preventDefault(); onList(r.id, form); setOpen(null); }}>
        <label className="grid gap-1 text-xs font-semibold">List price ($)<input className={FIELD} inputMode="decimal" required value={form.list_price} onChange={(ev) => setForm((f) => ({ ...f, list_price: ev.target.value }))} /></label>
        <label className="grid gap-1 text-xs font-semibold">Floor ($)<input className={FIELD} inputMode="decimal" value={form.floor_price} onChange={(ev) => setForm((f) => ({ ...f, floor_price: ev.target.value }))} /></label>
        <label className="grid gap-1 text-xs font-semibold">Listed on<input className={`${FIELD} w-40`} type="date" value={form.date_listed} onChange={(ev) => setForm((f) => ({ ...f, date_listed: ev.target.value }))} /></label>
        <button type="submit" className="h-10 rounded-md border-2 border-border bg-brand px-4 text-sm font-semibold text-white">Save</button>
        <button type="button" className="h-10 px-2 text-sm underline" onClick={() => setOpen(null)}>Cancel</button>
      </form>
      : <button type="button" className="mt-3 text-sm font-semibold underline underline-offset-4" onClick={() => { setOpen(r.id); setForm({ list_price: '', floor_price: '', date_listed: today() }); }}>I listed it</button>) : null}
  </article>)}</div>;
}

export default function SellingScreen() {
  const [key, setKey] = useState('');
  const [draft, setDraft] = useState('');
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { let s = ''; try { s = sessionStorage.getItem(KEY) || ''; } catch {} setKey(s); setDraft(s); }, []);
  const load = useCallback(async () => {
    if (!key) return;
    setErr('');
    const res = await fetch('/api/ledger', { cache: 'no-store', headers: { 'x-ledger-key': key } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setDoc(null); setErr(data.error || 'Could not open the ledger.'); return; }
    setDoc(data);
  }, [key]);
  useEffect(() => { load(); }, [load]);

  // Clears the key from this tab, so a wrong key can be replaced.
  function forget() {
    try { sessionStorage.removeItem(KEY); } catch {}
    setKey(''); setDraft(''); setDoc(null); setErr('');
  }

  async function onList(id, form) {
    setErr('');
    const res = await fetch(`/api/ledger/${encodeURIComponent(id)}`, { method: 'PATCH', cache: 'no-store', headers: { 'content-type': 'application/json', 'x-ledger-key': key }, body: JSON.stringify({ status: 'listed', list_price: form.list_price, floor_price: form.floor_price || null, date_listed: form.date_listed || today() }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || 'Could not save.'); return; }
    load();
  }

  return <section>
    <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Selling</h1>
    <p className="mt-2 max-w-2xl text-base">What you bought and are selling, from your ledger. A listing up {SLOW_DAYS} days or more is flagged Slow. Nothing here posts a listing; you list it yourself, then mark it here.</p>
    {!key && <form className="mt-6 flex flex-wrap items-end gap-2" onSubmit={(ev) => { ev.preventDefault(); const k = draft.trim(); try { sessionStorage.setItem(KEY, k); } catch {} setKey(k); }}>
      <label className="grid gap-1 text-sm font-semibold">Ledger key<input type="password" autoComplete="off" className="h-10 w-64 rounded-md border-2 border-border bg-card px-2" value={draft} onChange={(ev) => setDraft(ev.target.value)} /></label>
      <button type="submit" className="h-10 rounded-md border-2 border-border bg-brand px-4 text-sm font-semibold text-white">Open</button>
      <p className="basis-full text-xs text-muted-foreground">The same key as the Ledger page. It stays in this tab only.</p>
    </form>}
    {err && <p role="alert" className="mt-4 border-l-4 border-red-400 bg-red-50 px-3 py-2 text-sm">{err}</p>}
    {key && <p className="mt-4"><button type="button" className="text-sm font-medium underline underline-offset-4" data-field="forget-key" onClick={forget}>{doc ? 'Forget key' : 'Use a different key'}</button></p>}
    {key && !doc && !err && <p role="status" className="mt-6">Opening the ledger…</p>}
    {doc && <SellingTable rows={sellingRows(doc.items, Date.now())} onList={onList} />}
  </section>;
}
