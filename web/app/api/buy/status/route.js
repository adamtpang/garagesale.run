import { status } from '../../../../lib/helium.js';
import { json } from '../../../../lib/store.js';
export const dynamic = 'force-dynamic';
export async function GET() { return json(await status()); }
