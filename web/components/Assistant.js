'use client';
import { useEffect, useRef, useState } from 'react';
export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: "Hi, I'm Garry. Ask me how Garage Sale works, how to get set up, or what it costs." }]);
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => { if (end.current) end.current.scrollIntoView({ block: 'end' }); }, [msgs, open]);
  useEffect(() => { if (typeof location !== 'undefined' && location.hash === '#assist') setOpen(true); }, []);
  async function send(e) {
    e.preventDefault(); const text = q.trim(); if (!text || busy) return;
    const next = [...msgs, { role: 'user', content: text }]; setMsgs(next); setQ(''); setBusy(true);
    try {
      const r = await fetch('/api/assist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next.slice(1) }) });
      const j = await r.json();
      setMsgs([...next, { role: 'assistant', content: j.answer || 'Sorry, something went wrong.', note: j.mode === 'docs' ? j.note : '' }]);
    } catch (e2) { setMsgs([...next, { role: 'assistant', content: 'Network error. Try again.' }]); }
    setBusy(false);
  }
  const chips = ['How do I get started?', 'Does it post without me?', 'What does it cost?'];
  return <>
    {open && <div className="asst" role="dialog" aria-label="Chat with Garry">
      <div className="asth"><span className="gbi sm" />Garry<button onClick={() => setOpen(false)} aria-label="Close">×</button></div>
      <div className="astb">{msgs.map((m, k) => <div key={k} className={'msg ' + m.role}>{m.content}{m.note && <small>{m.note}</small>}</div>)}
        {busy && <div className="msg assistant"><span className="dots3"><i /><i /><i /></span></div>}
        {msgs.length === 1 && <div className="chips2">{chips.map((c) => <button key={c} onClick={() => setQ(c)}>{c}</button>)}</div>}
        <div ref={end} /></div>
      <form className="astf" onSubmit={send}><input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask Garry about Garage Sale" aria-label="Ask Garry" /><button className="pill blue" disabled={busy}>Send</button></form>
    </div>}
    <button className="fab" onClick={() => setOpen(!open)} aria-label="Chat with Garry" data-field="garry-chat"><span className="gbi" /></button>
  </>;
}
