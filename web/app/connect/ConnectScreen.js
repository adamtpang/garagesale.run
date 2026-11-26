'use client';
// Connect your Garry. Signed out: how to get started. Signed in: what's left to do. The site owner can make
// an invite here with the owner key.
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ownerFetch } from '../../lib/ownerKey';

const GUIDE = 'https://github.com/adamtpang/garagesale.run/blob/main/docs/GARRY.md';
const Step = ({ n, title, done, children }) => <Card className="border-border/60 p-6" data-step={n} data-done={done ? 'yes' : 'no'}>
  <div className="flex items-start gap-4">
    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${done ? 'bg-emerald-500 text-black' : 'bg-secondary text-foreground'}`} aria-hidden="true">{done ? '✓' : n}</div>
    <div className="min-w-0"><div className="text-lg font-semibold">{title}{done ? <span className="sr-only"> (done)</span> : null}</div><div className="mt-1 text-muted-foreground">{children}</div></div>
  </div>
</Card>;

export default function ConnectScreen() {
  const [me, setMe] = useState(undefined);
  const [flag, setFlag] = useState('');
  const [invite, setInvite] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setFlag(q.get('link') === 'expired' ? 'expired' : q.get('welcome') ? 'welcome' : '');
    fetch('/api/me', { cache: 'no-store' }).then((r) => r.json()).then((j) => setMe(j.account || null)).catch(() => setMe(null));
  }, []);
  async function signOut() { await fetch('/api/signout', { method: 'POST' }); window.location.href = '/connect'; }
  async function makeInvite() {
    setBusy(true); setErr(''); setInvite('');
    try {
      const r = await ownerFetch('/api/invites', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note }) });
      const j = await r.json(); if (r.ok) setInvite(j.invite); else setErr(j.error || 'Could not make an invite.');
    } catch (e) { setErr('Could not make an invite.'); }
    setBusy(false);
  }
  const text = invite ? `You're in the Garage Sale beta. Install the Garry bot in Grok Bot, then tell it: "Set me up on Garage Sale. My invite code is ${invite}". Garry does the rest and sends you a sign-in link.` : '';

  return <main className="wrap py-16 md:py-24">
    <section className="mx-auto max-w-2xl">
      <h1 className="!text-4xl !font-semibold !tracking-tight md:!text-6xl">{me ? `Hi ${me.name}.` : 'Connect your Garry.'}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{me
        ? 'Your Garry bot is connected. It prices and posts your items from your own Facebook, and nothing goes out until you approve it.'
        : 'Garry is your own Grok Bot. It signs you in here, prices your items, and posts them from your own Facebook. You approve every step.'}</p>

      {flag === 'expired' && <p role="status" className="mt-6 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm" data-field="expired">That sign-in link was already used or has expired. Ask your Garry for a new one: "Send me a Garage Sale sign-in link."</p>}
      {flag === 'welcome' && me && <p role="status" className="mt-6 rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm" data-field="welcome">You're signed in on this browser for 30 days.</p>}

      {me === undefined ? <p className="mt-10 text-sm text-muted-foreground">Loading...</p> : me ? <div className="mt-10 grid gap-4" data-state="signed-in">
        <Step n={1} title="Garry is connected" done>Signed in as {me.name}.</Step>
        <Step n={2} title="Sign Garry's browser in to Facebook">Ask Garry to open Facebook in its own browser, then sign in there yourself. Garry never sees or stores your password. Posting from your account is your choice and your risk.</Step>
        <Step n={3} title="Snap your first item">Take one photo. Garry identifies it, finds real prices and drafts the listing for you to approve.<div className="mt-4 flex flex-wrap gap-3"><Button asChild><a href="/sell">Sell something</a></Button><Button asChild variant="secondary"><a href="/dashboard">Your dashboard</a></Button></div></Step>
        <div className="mt-2"><button type="button" onClick={signOut} className="border-0 bg-transparent p-0 text-sm text-muted-foreground underline underline-offset-4" style={{ background: 'none' }}>Sign out on this browser</button></div>
      </div> : <div className="mt-10 grid gap-4" data-state="signed-out">
        <Step n={1} title="Get an invite">Garage Sale is in a small beta. You need a one-time invite code from Adam.</Step>
        <Step n={2} title="Install Garry in Grok Bot">Add the Garry bot, then tell it: <span className="text-foreground">"Set me up on Garage Sale. My invite code is ..."</span></Step>
        <Step n={3} title="Open the link Garry sends">Garry creates your account and sends you a sign-in link. One click, no password.</Step>
        <p className="mt-2 text-sm text-muted-foreground">Already set up? Ask your Garry: "Send me a Garage Sale sign-in link." <a className="underline underline-offset-4" href={GUIDE} target="_blank" rel="noreferrer">Garry's setup guide</a></p>
      </div>}

      {me === null && <details className="mt-12 text-sm" data-field="owner-tools">
        <summary className="cursor-pointer text-muted-foreground">For the owner: invite a beta tester</summary>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs font-semibold">Who is it for? (a note for you)
            <input className="h-10 rounded-md border border-border bg-card px-3 text-sm font-normal" value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder="First name" /></label>
          <div><Button type="button" onClick={makeInvite} disabled={busy}>{busy ? 'Making...' : 'Make an invite code'}</Button></div>
          {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
          {invite && <div className="rounded-xl border border-border/60 p-4" data-field="invite"><div className="text-xs font-semibold text-muted-foreground">One-time invite code</div><div className="mt-1 break-all font-mono text-lg">{invite}</div><div className="mt-3 text-xs font-semibold text-muted-foreground">Message to send them</div><p className="mt-1 whitespace-pre-wrap">{text}</p></div>}
        </div>
      </details>}
    </section>
  </main>;
}
