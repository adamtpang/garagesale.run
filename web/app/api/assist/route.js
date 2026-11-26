import { DOCS, DOCS_TEXT } from '../../../lib/docs';
import { json } from '../../../lib/store';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const KW = { garry: ['garry', 'install', 'start', 'set up', 'setup', 'sign up', 'sign in', 'connect', 'begin'], account: ['account', 'my facebook', 'own facebook', 'password', 'sign-in link', 'log in', 'login', 'risk'], cost: ['cost', 'free', 'pay', 'charge', 'how much', 'pricing', 'credits'], replies: ['reply', 'replies', 'buyer', 'message'], sell: ['sell', 'photo', 'list', 'listing', 'price', 'comps'], approve: ['approve', 'post', 'facebook account', 'api', 'browser', 'publish'], bulk: ['bulk', 'many', 'multiple', 'moving', 'batch'], buy: ['buy', 'find', 'search', 'scout', 'looking'], arbitrage: ['arbitrage', 'profit', 'resell', 'flip', 'ebay', 'amazon'], deals: ['deals', 'feed'], cant: ['cant', "can't", 'cannot', 'not do', 'limit'], privacy: ['privacy', 'data', 'photo stored', 'private'], what: ['what is', 'garage sale', 'how does', 'help'], grok: ['grok', 'agent', 'bot', 'ai'] };

function lookup(q) {
  const s = q.toLowerCase();
  const scored = DOCS.map(([k, t, b]) => [(KW[k] || []).reduce((n, w) => n + (s.includes(w) ? 1 : 0), 0), t, b]).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 2);
  const hits = scored.length ? scored : [[0, DOCS[0][1], DOCS[0][2]], [0, DOCS[1][1], DOCS[1][2]]];
  return hits.map(([, t, b]) => `${t}: ${b}`).join('\n\n');
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const msgs = (Array.isArray(body.messages) ? body.messages : []).filter((m) => m && typeof m.content === 'string').slice(-10).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content.slice(0, 2000) }));
  const last = [...msgs].reverse().find((m) => m.role === 'user');
  if (!last) return json({ error: 'messages required' }, 400);
  const key = process.env.XAI_API_KEY;
  if (key) {
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 20000);
      const r = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST', signal: ac.signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: process.env.XAI_MODEL || 'grok-4-fast-non-reasoning', temperature: 0.3, max_tokens: 400, messages: [
          { role: 'system', content: `You are Garry, the helper on the Garage Sale site. You answer questions about how Garage Sale works. You are not the person's own Garry bot: you cannot see their account, items or Facebook, and you cannot post, price or message anything from here. Answer briefly and only from these docs. If the docs do not cover it, say so. Never state a price or a number that is not in the docs. Never use em dashes.\n\n${DOCS_TEXT}` }, ...msgs] }),
      });
      clearTimeout(t);
      const j = await r.json();
      const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (r.ok && text) return json({ answer: text, mode: 'grok' });
    } catch (e) {}
  }
  return json({ answer: lookup(last.content), mode: 'docs', note: 'Answered from the Garage Sale docs (no live model connected).' });
}
