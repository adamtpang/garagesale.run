import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES_CONFIG } from '../config/rules.js';
import { activeRules, rulesAsConfig } from './rules.js';
import { bankrollFrom } from './bankroll.js';
import { assessLot } from './surplus.js';
import { cleanItem, cleanDecision, emptyLedger } from './ledger.js';

test('with no ledger entries the bankroll is the starting number from the rules file', () => {
  for (const doc of [null, emptyLedger()]) {
    const b = bankrollFrom(doc);
    assert.deepEqual([b.bankroll, b.start, b.source], [RULES_CONFIG.bankroll, RULES_CONFIG.bankroll, 'start']);
  }
});

test('the bankroll follows buys, sales and open approvals in the ledger', () => {
  const doc = emptyLedger();
  // Bought for $40 with $5 gas, sold for $120: 100 - 45 + 120 = 175.
  doc.items.push(cleanItem({ item: 'Camera', buy_price: 40, costs: { gas: 5 }, status: 'sold', sell_price: 120 }, 'a1'));
  assert.deepEqual([bankrollFrom(doc).bankroll, bankrollFrom(doc).source], [175, 'ledger']);
  // Bought for $60 and still on hand: 175 - 60 = 115.
  doc.items.push(cleanItem({ item: 'Drill', buy_price: 60, status: 'on_hand' }, 'a2'));
  assert.equal(bankrollFrom(doc).bankroll, 115);
  // An open approval of $30 is promised money: 115 - 30 = 85.
  doc.decisions.push(cleanDecision({ title: 'Lot', decision: 'approved', max_bid: 30, outcome: 'pending' }, 'd1'));
  assert.equal(bankrollFrom(doc).bankroll, 85);
  // The ledger's own starting number wins when it has one.
  assert.equal(bankrollFrom({ ...doc, starting_bankroll: 200 }).bankroll, 185);
  // Never below zero.
  doc.items.push(cleanItem({ item: 'Sofa', buy_price: 500, status: 'on_hand' }, 'a3'));
  assert.equal(bankrollFrom(doc).bankroll, 0);
});

test('the max buy per flip is the current bankroll, not a fixed number', () => {
  assert.equal(activeRules().max_cost, RULES_CONFIG.bankroll);
  const grown = activeRules({ bankroll: 260, bankroll_source: 'ledger' });
  assert.deepEqual([grown.max_cost, grown.bankroll, grown.bankroll_start, grown.bankroll_source], [260, 260, 100, 'ledger']);
  assert.equal(rulesAsConfig(grown).max_per_flip, 260);
  assert.equal(activeRules({ bankroll: 35 }).max_cost, 35);
  // A fixed cap still works when one is set, and the smaller number wins.
  assert.equal(activeRules({ bankroll: 260, max_per_flip: 150 }).max_cost, 150);
  // A broken value falls back to the starting bankroll.
  assert.equal(activeRules({ bankroll: -5 }).max_cost, RULES_CONFIG.bankroll);
  assert.equal(activeRules({ bankroll: 'lots' }).max_cost, RULES_CONFIG.bankroll);
});

test('a lot over the starting $100 passes the cost rule once the bankroll has grown', () => {
  const lot = { id: 'x', title: 'Lot', current_bid: 150, premium_pct: 0, tax_rate: 0, tax_basis: 'stated', miles_from_home: 5, quantity: 1 };
  const ruleOf = (view) => view.rule_checks.find((c) => c.rule === 'max_cost').result;
  assert.equal(ruleOf(assessLot(lot, null)), 'fail');
  assert.equal(ruleOf(assessLot(lot, null, activeRules({ bankroll: 260 }))), 'pass');
});
