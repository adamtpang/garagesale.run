'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const KEY = 'gs_ledger_key';
const PLATFORMS = ['fb', 'craigslist', 'ebay', 'offerup'];
const $ = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? '—' : '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ item: '', date_bought: today(), buy_price: '', source_link: '', gas: '', fees: '', repairs: '', saved_deal_id: '' });

export default function LedgerPage() {
  const [key, setKey] = useState('');
  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(false);
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [selling, setSelling] = useState(null);
  const [sale, setSale] = useState({ sell_price: '', sell_date: today(), platform: 'ebay' });
  const [bankroll, setBankroll] = useState('');

  useEffect(() => {
    let stored = '';
    try { stored = sessionStorage.getItem(KEY) || ''; } catch (e) {}
    setKey(stored);
    setDraft(stored);
    setReady(true);
    const q = new URLSearchParams(window.location.search);
    if (q.get('item') || q.get('saved_deal_id') || q.get('buy_price')) {
      setForm((f) => ({
        ...f,
        item: q.get('item') || f.item,
        buy_price: q.get('buy_price') || f.buy_price,
        source_link: q.get('source_link') || f.source_link,
        saved_deal_id: q.get('saved_deal_id') || f.saved_deal_id,
      }));
    }
  }, []);

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      cache: 'no-store',
      headers: { 'content-type': 'application/json', 'x-ledger-key': key, ...(opts.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
  const load = useCallback(async (k) => {
    setErr('');
    const res = await fetch('/api/ledger', { cache: 'no-store', headers: { 'x-ledger-key': k || key } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setDoc(null); setErr(data.error || 'Request failed'); return; }
    setDoc(data);
    setBankroll(data.starting_bankroll == null ? '' : String(data.starting_bankroll));
  }, [key]);
  useEffect(() => { if (ready && key) load(key); }, [ready, key, load]);

  function unlock(e) {
    e.preventDefault();
    const next = draft.trim();
    try { sessionStorage.setItem(KEY, next); } catch (err) {}
    setKey(next);
  }
  function forget() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    setKey(''); setDraft(''); setDoc(null);
  }
  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function addBuy(e) {
    e.preventDefault();
    setErr('');
    try {
      await api('/api/ledger', { method: 'POST', body: JSON.stringify({
        item: form.item, date_bought: form.date_bought || null, buy_price: form.buy_price,
        source_link: form.source_link || null, saved_deal_id: form.saved_deal_id || null,
        costs: { gas: form.gas || 0, fees: form.fees || 0, repairs: form.repairs || 0 },
      }) });
      setForm(emptyForm());
      await load();
    } catch (e2) { setErr(e2.message); }
  }
  async function saveBankroll(e) {
    e.preventDefault();
    setErr('');
    try { await api('/api/ledger', { method: 'POST', body: JSON.stringify({ starting_bankroll: bankroll === '' ? null : Number(bankroll) }) }); await load(); }
    catch (e2) { setErr(e2.message); }
  }
  async function markSold(e) {
    e.preventDefault();
    setErr('');
    try {
      await api(`/api/ledger/${encodeURIComponent(selling)}`, { method: 'PATCH', body: JSON.stringify({ status: 'sold', sell_price: sale.sell_price, sell_date: sale.sell_date || null, platform: sale.platform }) });
      setSelling(null);
      await load();
    } catch (e2) { setErr(e2.message); }
  }
  async function remove(id) {
    setErr('');
    try { await api(`/api/ledger/${encodeURIComponent(id)}`, { method: 'DELETE' }); await load(); }
    catch (e2) { setErr(e2.message); }
  }

  const totals = (doc && doc.totals) || {};
  return <main className="wrap py-16 md:py-24">
    <div className="mb-6 flex items-center justify-between gap-3">
      <h1 className="text-3xl font-semibold tracking-tight">Ledger</h1>
      <Button asChild variant="secondary" size="sm"><a href="/dashboard">Dashboard</a></Button>
    </div>
    {!key && <Card className="max-w-md border-border/60 p-6">
      <form onSubmit={unlock} className="grid gap-3">
        <label className="text-sm font-medium" htmlFor="ledger-key">Ledger key</label>
        <Input id="ledger-key" type="password" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Stays in this tab only" />
        <p className="text-xs text-muted-foreground">Saved in sessionStorage for this tab. It is not written to the ledger.</p>
        <Button type="submit" variant="brand">Unlock</Button>
      </form>
    </Card>}
    {key && <>
      <div className="mb-4 flex justify-end"><Button variant="ghost" size="sm" onClick={forget}>Forget key</Button></div>
      {err && <p className="mb-4 text-sm text-red-400">{err}</p>}
      {doc && <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 p-5"><div className="text-xs text-muted-foreground">Bankroll</div><div className="mt-2 text-2xl font-semibold tabular-nums">{$(totals.bankroll)}</div></Card>
        <Card className="border-border/60 p-5"><div className="text-xs text-muted-foreground">Realized profit</div><div className="mt-2 text-2xl font-semibold tabular-nums text-success">{$(totals.realized_profit)}</div></Card>
        <Card className="border-border/60 p-5"><div className="text-xs text-muted-foreground">On hand</div><div className="mt-2 text-2xl font-semibold tabular-nums">{totals.on_hand_count ?? 0}</div></Card>
        <Card className="border-border/60 p-5"><div className="text-xs text-muted-foreground">On-hand value</div><div className="mt-2 text-2xl font-semibold tabular-nums">{$(totals.on_hand_value)}</div></Card>
      </div>}
      {doc && <form onSubmit={saveBankroll} className="mb-8 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Starting bankroll</span>
          <Input className="w-36" inputMode="decimal" value={bankroll} onChange={(e) => setBankroll(e.target.value)} aria-label="Starting bankroll" /></label>
        <Button type="submit" variant="secondary" size="sm">Save</Button>
      </form>}
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Add buy</h2>
      <Card className="mb-10 border-border/60 p-4">
        <form onSubmit={addBuy} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-sm sm:col-span-2"><span className="text-muted-foreground">Item</span><Input value={form.item} onChange={(e) => setField('item', e.target.value)} required aria-label="Item" /></label>
          <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Date bought</span><Input type="date" value={form.date_bought} onChange={(e) => setField('date_bought', e.target.value)} aria-label="Date bought" /></label>
          <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Buy price</span><Input inputMode="decimal" value={form.buy_price} onChange={(e) => setField('buy_price', e.target.value)} required aria-label="Buy price" /></label>
          <label className="grid gap-1 text-sm sm:col-span-2"><span className="text-muted-foreground">Source link</span><Input value={form.source_link} onChange={(e) => setField('source_link', e.target.value)} aria-label="Source link" /></label>
          <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Gas</span><Input inputMode="decimal" value={form.gas} onChange={(e) => setField('gas', e.target.value)} aria-label="Gas" /></label>
          <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Fees</span><Input inputMode="decimal" value={form.fees} onChange={(e) => setField('fees', e.target.value)} aria-label="Fees" /></label>
          <label className="grid gap-1 text-sm"><span className="text-muted-foreground">Repairs</span><Input inputMode="decimal" value={form.repairs} onChange={(e) => setField('repairs', e.target.value)} aria-label="Repairs" /></label>
          {form.saved_deal_id && <p className="text-xs text-muted-foreground sm:col-span-3">Linked saved deal {form.saved_deal_id}</p>}
          <div className="sm:col-span-3"><Button type="submit" variant="brand">Add buy</Button></div>
        </form>
      </Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-muted-foreground"><tr>
            <th className="py-2 pr-3 font-medium">Item</th><th className="py-2 pr-3 font-medium">Bought</th><th className="py-2 pr-3 font-medium">Buy</th>
            <th className="py-2 pr-3 font-medium">Costs</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Sold</th><th className="py-2 pr-3 font-medium">Net</th><th className="py-2 font-medium" />
          </tr></thead>
          <tbody>
            {doc && doc.items.length === 0 && <tr><td colSpan={8} className="py-6 text-muted-foreground">No buys yet.</td></tr>}
            {doc && doc.items.map((it) => {
              const c = it.costs || {};
              const cost = (Number(c.gas) || 0) + (Number(c.fees) || 0) + (Number(c.repairs) || 0);
              return <tr key={it.id} className="border-t border-border/60 align-top">
                <td className="py-3 pr-3"><div className="font-medium">{it.item}</div>{it.source_link && <a className="text-xs text-muted-foreground underline-offset-4 hover:underline" href={it.source_link} target="_blank" rel="noopener">Listing</a>}</td>
                <td className="py-3 pr-3 text-muted-foreground">{it.date_bought || '—'}</td>
                <td className="py-3 pr-3 tabular-nums">{$(it.buy_price)}</td>
                <td className="py-3 pr-3 tabular-nums">{$(cost)}</td>
                <td className="py-3 pr-3"><Badge variant={it.status === 'sold' ? 'success' : 'secondary'} className="font-normal">{it.status}</Badge></td>
                <td className="py-3 pr-3">{it.status === 'sold' ? <span className="tabular-nums">{$(it.sell_price)}{it.platform ? ` · ${it.platform}` : ''}</span> : '—'}</td>
                <td className="py-3 pr-3 tabular-nums">{it.net_profit == null ? '—' : $(it.net_profit)}</td>
                <td className="py-3 text-right">
                  {it.status !== 'sold' && <Button size="sm" variant="secondary" className="mr-2" onClick={() => { setSelling(it.id); setSale({ sell_price: '', sell_date: today(), platform: 'ebay' }); }}>Mark sold</Button>}
                  <Button size="sm" variant="ghost" onClick={() => remove(it.id)}>Delete</Button>
                  {selling === it.id && <form onSubmit={markSold} className="mt-3 grid justify-items-end gap-2">
                    <Input className="w-28" inputMode="decimal" placeholder="Sell price" aria-label={`Sell price for ${it.item}`} value={sale.sell_price} onChange={(e) => setSale((s) => ({ ...s, sell_price: e.target.value }))} required />
                    <Input className="w-36" type="date" aria-label={`Sell date for ${it.item}`} value={sale.sell_date} onChange={(e) => setSale((s) => ({ ...s, sell_date: e.target.value }))} />
                    <select className="h-10 w-36 rounded-md border border-input bg-background px-2 text-sm [color-scheme:dark]" aria-label={`Platform for ${it.item}`} value={sale.platform} onChange={(e) => setSale((s) => ({ ...s, platform: e.target.value }))}>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                    <Button type="submit" size="sm" variant="brand">Save sale</Button>
                  </form>}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </>}
  </main>;
}
