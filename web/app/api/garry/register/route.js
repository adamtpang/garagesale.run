import { json } from '../../../../lib/store';
import { registerGarry, sessionSecret } from '../../../../lib/accounts';
export const dynamic = 'force-dynamic';
// A Garry bot registers itself with a one-time invite. The bot key comes back once: the bot must save it.
export async function POST(req) {
  if (!sessionSecret()) return json({ error: 'Accounts are off: the server has no secret set.' }, 503);
  const body = await req.json().catch(() => ({}));
  const out = await registerGarry({ invite: body && body.invite, name: body && body.name });
  if (out.error) return json({ error: out.error }, out.status);
  return json({
    account: { id: out.account.id, name: out.account.name },
    garry_key: out.key,
    note: 'Save garry_key as a secret now. It is shown only once. Send it as the x-garry-key header. Never print it or put it in a chat.',
    next: 'POST /api/garry/login-link to get a sign-in link for your person.',
  });
}
