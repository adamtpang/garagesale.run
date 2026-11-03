// Re-encrypt the ledger after GS_LEDGER_KEY changes.
// Env: OLD_KEY, NEW_KEY. Uses BLOB_READ_WRITE_TOKEN when it is set, otherwise web/.data/ledger.json.
// A failed decrypt leaves the stored ledger untouched.
// Rotating GS_LEDGER_KEY without running this makes the old ledger unreadable.
import { rekeyLedger } from '../web/lib/ledger.js';

const oldKey = process.env.OLD_KEY;
const newKey = process.env.NEW_KEY;
if (!oldKey || !newKey) {
  console.error('OLD_KEY and NEW_KEY are required');
  process.exit(1);
}

try {
  const n = await rekeyLedger(oldKey, newKey);
  console.log(`rekeyed ${n} item${n === 1 ? '' : 's'}`);
} catch (e) {
  console.error(e && e.message === 'ledger decrypt failed' ? 'ledger decrypt failed' : 'rekey failed');
  process.exit(1);
}
