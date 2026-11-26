'use client';
// Approving a listing or sending a reply acts on the owner's Facebook, so those calls carry the owner key.
// The key is asked for once and kept for this browser tab only (sessionStorage). It is never put in a URL.
const STORE = 'gs_owner_key';
const read = () => { try { return window.sessionStorage.getItem(STORE) || ''; } catch (e) { return ''; } };
const write = (k) => { try { if (k) window.sessionStorage.setItem(STORE, k); else window.sessionStorage.removeItem(STORE); } catch (e) {} };

// fetch() for an owner-only route. On "owner key needed" it asks for the key and tries once more.
export async function ownerFetch(url, init = {}) {
  const send = (key) => fetch(url, { ...init, headers: { ...(init.headers || {}), ...(key ? { 'x-owner-key': key } : {}) } });
  let r = await send(read());
  if (r.status !== 401) return r;
  write('');
  const typed = (window.prompt('Owner key needed to approve. Paste it here:') || '').trim();
  if (!typed) return r;
  r = await send(typed);
  if (r.status !== 401) write(typed);
  return r;
}
