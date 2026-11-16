// Worker key check for the write endpoints. No disk and no network.
// The key itself is never logged, returned or compared with ===.
import { createHash, timingSafeEqual } from 'crypto';

// Two slots, so a key can be rotated without locking the worker out:
// set the new key in GST_WORKER_KEY_NEXT, move the worker to it, then make it GST_WORKER_KEY.
const SLOTS = ['GST_WORKER_KEY', 'GST_WORKER_KEY_NEXT'];
export const MIN_KEY_LENGTH = 24;

// A key pasted into a dashboard or piped from a shell often carries a trailing newline or quotes.
// That is the usual reason a correct key gets a 401.
function tidy(v) {
  if (typeof v !== 'string') return '';
  return v.trim().replace(/^(["'])(.*)\1$/, '$2').trim();
}
const digest = (s) => createHash('sha256').update(s, 'utf8').digest();
// Compares hashes, so the time taken does not depend on how much of the key matched or on its length.
const same = (a, b) => timingSafeEqual(digest(a), digest(b));

function serverKeys(env) {
  return SLOTS.map((name) => tidy(env[name])).filter(Boolean);
}

// The key a request presents: the x-worker-key header, or Authorization: Bearer <key>.
export function presentedKey(req) {
  const direct = tidy(req.headers.get('x-worker-key'));
  if (direct) return direct;
  const auth = tidy(req.headers.get('authorization'));
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? tidy(m[1]) : '';
}

// { ok, reason }. The reason says what is wrong without saying anything about the key.
export function workerCheck(req, env = process.env) {
  const keys = serverKeys(env);
  if (!keys.length) return { ok: false, reason: 'server-has-no-key', hint: 'GST_WORKER_KEY is not set on this deployment. Set it in the Vercel project and redeploy.' };
  const sent = presentedKey(req);
  if (!sent) return { ok: false, reason: 'no-key-sent', hint: 'Send the key in the x-worker-key header, or as Authorization: Bearer <key>.' };
  if (!keys.some((k) => same(k, sent))) return { ok: false, reason: 'key-does-not-match', hint: 'The key sent is not the one set on this deployment. A key changed in Vercel only applies after a redeploy.' };
  const weak = keys.some((k) => k.length < MIN_KEY_LENGTH);
  return { ok: true, reason: 'ok', hint: weak ? `The key on this deployment is shorter than ${MIN_KEY_LENGTH} characters. Use a longer random one.` : null };
}

export const workerOk = (req, env = process.env) => workerCheck(req, env).ok;
