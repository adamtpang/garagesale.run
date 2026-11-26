import { redeemLoginCode, sessionCookie } from '../../../lib/accounts';
export const dynamic = 'force-dynamic';
// Signs a browser in with a one-time code from Garry. POST only: the code is used up here, and only when the
// person presses the button on /enter/<code>. Opening the link (a chat preview, a scanner, a prefetch) is a GET
// to that page and uses nothing up.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const account = await redeemLoginCode(body && body.code);
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (!account) return new Response(JSON.stringify({ ok: false, error: 'That sign-in link was already used or has expired.' }), { status: 410, headers });
  return new Response(JSON.stringify({ ok: true, account: { id: account.id, name: account.name } }), { status: 200, headers: { ...headers, 'set-cookie': sessionCookie(account.id) } });
}
