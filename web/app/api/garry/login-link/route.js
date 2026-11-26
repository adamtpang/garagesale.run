import { json } from '../../../../lib/store';
import { botPrincipal, createLoginCode, LOGIN_CODE_MINUTES } from '../../../../lib/accounts';
export const dynamic = 'force-dynamic';
// Garry asks for a one-time link that signs its person's browser in.
export async function POST(req) {
  const who = await botPrincipal(req);
  if (!who || !who.account) return json({ error: 'unauthorized', hint: 'Send your garry_key as the x-garry-key header.' }, 401);
  const { code, expires_at } = await createLoginCode(who.account);
  const origin = process.env.GARAGESALE_BASE_URL || new URL(req.url).origin;
  return json({ url: `${origin}/enter/${code}`, expires_at, minutes: LOGIN_CODE_MINUTES, note: 'Give this link only to your person. It works once.' });
}
