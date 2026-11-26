import { json } from '../../../../lib/store';
import { botPrincipal } from '../../../../lib/accounts';
import { setWebhook, clearWebhook, webhookState } from '../../../../lib/wake';
export const dynamic = 'force-dynamic';
// A Garry registers the webhook of its own worker routine, so the site can wake it when there is work.
// The url and key are stored encrypted and are never returned.
const who = async (req) => { const p = await botPrincipal(req); return p && p.account ? p : null; };
const no = () => json({ error: 'unauthorized', hint: 'Send your garry_key as the x-garry-key header.' }, 401);

export async function GET(req) {
  const p = await who(req); if (!p) return no();
  return json(await webhookState(p.account));
}
export async function POST(req) {
  const p = await who(req); if (!p) return no();
  const body = await req.json().catch(() => ({}));
  const out = await setWebhook(p.account, { url: body && body.url, key: body && body.key });
  if (out.error) return json({ error: out.error }, out.status);
  return json({ ok: true, set: true, host: out.host, note: 'Garage Sale will POST {job_id, kind, event, payload} here, with Authorization: Bearer <key>, when your person queues work.' });
}
export async function DELETE(req) {
  const p = await who(req); if (!p) return no();
  await clearWebhook(p.account);
  return json({ ok: true, set: false });
}
