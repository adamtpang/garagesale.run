import { redeemLoginCode, sessionCookie } from '../../../lib/accounts';
export const dynamic = 'force-dynamic';
// Opening a sign-in link from Garry. The code works once. A used or expired one goes back to the connect page.
export async function GET(req, { params }) {
  const origin = new URL(req.url).origin;
  const account = await redeemLoginCode(params.code);
  if (!account) return new Response(null, { status: 303, headers: { location: `${origin}/connect?link=expired`, 'cache-control': 'no-store' } });
  return new Response(null, { status: 303, headers: { location: `${origin}/connect?welcome=1`, 'set-cookie': sessionCookie(account.id), 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
}
