import test from 'node:test';
import assert from 'node:assert/strict';
import { readTargets, toggleTarget, refreshTargets, targetRows, TARGETS_KEY } from './targets.js';

// A stand-in for browser storage.
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const tileA = { id: 'ps-1', title: 'Lot one', profit: '+$120', label: 'Buy', decision: 'buy', closes: 'Closes in 2d 3h', href: '/item?id=ps-1' };
const tileB = { id: 'ps-2', title: 'Lot two', profit: '+$40', label: 'Watch', decision: 'watch', closes: 'Closes in 5h 1m', href: '/item?id=ps-2' };

test('starring adds a target with a snapshot, and starring again removes it', () => {
  const s = memory();
  assert.deepEqual(readTargets(s), {});
  assert.equal(toggleTarget(tileA, s, Date.parse('2026-11-19T12:00:00Z')), true);
  assert.equal(readTargets(s)['ps-1'].profit, '+$120');
  assert.equal(readTargets(s)['ps-1'].saved_at, '2026-11-19T12:00:00.000Z');
  assert.equal(toggleTarget(tileA, s), false);
  assert.deepEqual(readTargets(s), {});
});

test('a deal still in the feed shows today\'s numbers; a gone one keeps its last numbers and says so', () => {
  const s = memory();
  toggleTarget(tileA, s, Date.parse('2026-11-18T12:00:00Z'));
  toggleTarget(tileB, s, Date.parse('2026-11-18T12:00:00Z'));
  // Today the feed has lot one at a new profit, and lot two is gone.
  const today = [{ ...tileA, profit: '+$95' }];
  const stored = refreshTargets(today, s);
  assert.equal(stored['ps-1'].profit, '+$95');
  assert.equal(stored['ps-1'].saved_at, '2026-11-18T12:00:00.000Z');
  const rows = targetRows(stored, today);
  assert.deepEqual(rows.map((r) => [r.id, r.gone, r.label]), [['ps-1', false, 'Buy'], ['ps-2', true, 'Gone']]);
  assert.equal(rows[1].profit, '+$40');
  assert.match(rows[1].reason, /Last seen 2026-11-18/);
});

test('broken or blocked storage never throws', () => {
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(readTargets(blocked), {});
  assert.equal(toggleTarget(tileA, blocked), null);
  const junk = memory();
  junk.setItem(TARGETS_KEY, '[1,2');
  assert.deepEqual(readTargets(junk), {});
  junk.setItem(TARGETS_KEY, '[1,2]');
  assert.deepEqual(readTargets(junk), {});
});
