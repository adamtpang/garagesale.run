// Read-only bridge to Adam's own Helium browser over the Chrome DevTools Protocol.
// It opens one normal tab in his signed-in browser, reads the page, and closes it.
// It never types, clicks, logs in, or stores credentials. Pages load one at a time
// with human-like pauses, and a search is rate limited (see MIN_GAP_MS).
import fs from 'fs';
import path from 'path';
import os from 'os';

const PORT_FILE = process.env.HELIUM_DEVTOOLS_FILE || path.join(os.homedir(), 'AppData', 'Local', 'imput', 'Helium', 'User Data', 'DevToolsActivePort');
const MIN_GAP_MS = 15000;
const G = globalThis.__gsHelium || (globalThis.__gsHelium = { ws: null, seq: 0, waiters: new Map(), events: [], busy: Promise.resolve(), lastAt: 0 });

export function wsUrl() {
  if (process.env.GS_CDP_WS) return process.env.GS_CDP_WS;
  try {
    const [port, p] = fs.readFileSync(PORT_FILE, 'utf8').trim().split(/\r?\n/);
    return port && p ? `ws://127.0.0.1:${port}${p}` : null;
  } catch (e) { return null; }
}

export class BrowserUnavailable extends Error {}

function connect() {
  if (G.ws && G.ws.readyState === 1) return Promise.resolve(G.ws);
  const url = wsUrl();
  if (!url) return Promise.reject(new BrowserUnavailable('Helium is not running with remote debugging on. Open Helium and turn it on at chrome://inspect/#remote-debugging.'));
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    // Helium holds the handshake until Adam clicks Allow, so give him time.
    const t = setTimeout(() => { try { ws.close(); } catch (e) {} reject(new BrowserUnavailable('Helium did not allow the connection. Click Allow in Helium and try again.')); }, 60000);
    ws.onopen = () => { clearTimeout(t); G.ws = ws; resolve(ws); };
    ws.onerror = () => { clearTimeout(t); reject(new BrowserUnavailable('Could not reach Helium. Is it open with remote debugging on?')); };
    ws.onclose = () => { if (G.ws === ws) G.ws = null; for (const [, w] of G.waiters) w.reject(new BrowserUnavailable('Helium connection closed.')); G.waiters.clear(); };
    ws.onmessage = (m) => {
      const msg = JSON.parse(typeof m.data === 'string' ? m.data : m.data.toString());
      if (msg.id && G.waiters.has(msg.id)) {
        const w = G.waiters.get(msg.id); G.waiters.delete(msg.id);
        msg.error ? w.reject(new Error(msg.error.message)) : w.resolve(msg.result);
      }
    };
  });
}

async function send(method, params = {}, sessionId) {
  const ws = await connect();
  const id = ++G.seq;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { G.waiters.delete(id); reject(new Error(`${method} timed out`)); }, 45000);
    G.waiters.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const jitter = (a, b) => a + Math.random() * (b - a);

// Opens a background tab, runs `fn(page)`, and always closes the tab.
// page.goto(url) loads a page; page.eval(expr) returns a JSON-safe value.
async function withTab(fn) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', background: true });
  try {
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const ev = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page script failed');
      return r.result.value;
    };
    const page = {
      eval: ev,
      // Runs a self-contained function in the page. It must not close over local variables.
      run: (fn, ...args) => ev(`(${fn.toString()})(...${JSON.stringify(args)})`),
      async goto(url, settle = 2500) {
        await send('Page.navigate', { url }, sessionId);
        const t0 = Date.now();
        while (Date.now() - t0 < 20000) { await sleep(500); if ((await ev('document.readyState').catch(() => '')) === 'complete') break; }
        await sleep(settle);
        return ev('location.href');
      },
      async scroll(times = 1) { for (let i = 0; i < times; i++) { await ev('window.scrollBy(0, window.innerHeight * 0.9)'); await sleep(jitter(1200, 2200)); } },
    };
    return await fn(page);
  } finally {
    await send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

// One browsing session at a time, with a gap between sessions.
export function browse(fn) {
  const run = G.busy.then(async () => {
    const wait = G.lastAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try { return await withTab(fn); } finally { G.lastAt = Date.now(); }
  });
  G.busy = run.catch(() => {});
  return run;
}

export async function status() {
  if (!wsUrl()) return { ok: false, reason: 'Helium remote debugging is off.' };
  try { await connect(); return { ok: true }; } catch (e) { return { ok: false, reason: e.message }; }
}
