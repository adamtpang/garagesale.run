// The current bankroll, and the rules with it applied. Server only: it reads the locked ledger.
// Only one number leaves the ledger here. Buys, sales and profit stay behind the ledger key.
// Adam allowed this one number to be public on Nov 17, 2026.
import { RULES_CONFIG } from '../config/rules.js';
import { activeRules } from './rules.js';
import { readLedger, totals } from './ledger.js';

const round2 = (n) => Math.round(n * 100) / 100;

// doc: a ledger document, or null when there is none to read.
export function bankrollFrom(doc) {
  const start = RULES_CONFIG.bankroll;
  const used = doc && ((doc.items && doc.items.length) || (doc.decisions && doc.decisions.length) || doc.starting_bankroll != null);
  if (!used) return { bankroll: start, start, source: 'start', note: 'No ledger entries yet, so this is the starting bankroll.' };
  // The ledger's own starting number wins when it has one. The rules file fills in when it does not.
  const base = doc.starting_bankroll != null ? doc.starting_bankroll : start;
  const t = totals({ ...doc, starting_bankroll: base });
  return {
    // Money promised to an open approval is not free to spend again. Never below zero.
    bankroll: Math.max(0, round2(t.bankroll_after_open_approvals)),
    start: base,
    source: 'ledger',
    note: 'Starting bankroll, plus sales, minus buys and open approvals.',
  };
}

export async function currentBankroll() {
  try {
    return bankrollFrom(await readLedger());
  } catch {
    return { bankroll: RULES_CONFIG.bankroll, start: RULES_CONFIG.bankroll, source: 'start', note: 'The ledger could not be read, so this is the starting bankroll.' };
  }
}

// The rules in force right now: the rules file, with the max buy set by the current bankroll.
export async function liveRules() {
  const b = await currentBankroll();
  return activeRules({ bankroll: b.bankroll, bankroll_source: b.source });
}
