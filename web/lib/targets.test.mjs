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

test('last seen is the last day the deal was in the feed, not the day it was starred', () => {
  const s = memory();
  toggleTarget(tileA, s, Date.parse('2026-11-10T12:00:00Z'));
  refreshTargets([tileA], s, Date.parse('2026-11-18T09:00:00Z'));
  const rows = targetRows(readTargets(s), []);
  assert.equal(rows[0].gone, true);
  assert.match(rows[0].reason, /Last seen 2026-11-18/);
  assert.equal(readTargets(s)['ps-1'].saved_at, '2026-11-10T12:00:00.000Z');
});

test('the Targets page draws no rows until the feed has loaded or failed', async () => {
  const fs = await import('fs');
  const src = fs.readFileSync(new URL('../app/targets/TargetsScreen.js', import.meta.url), 'utf8');
  assert.match(src, /const rows = failed \? targetRows\(targets, null\) : live === null \? \[\] : targetRows\(targets, live\);/);
  assert.match(src, /addEventListener\('storage', sync\)/);
  // A failed load sets live to [], so every target then shows its last known numbers.
  assert.match(src, /setFailed\(true\); setLive\(\[\]\)/);
});

test('when the feed fails, no target is called gone', () => {
  const s = memory();
  toggleTarget(tileA, s, Date.parse('2026-11-18T12:00:00Z'));
  const rows = targetRows(readTargets(s), null);
  assert.deepEqual(rows.map((r) => [r.gone, r.stale, r.label, r.closes]), [[false, true, 'Buy', 'Feed not loaded']]);
  assert.match(rows[0].reason, /Could not load today's feed/);
});

test('a gone target opens its original listing, or is not a link at all', () => {
  const s = memory();
  toggleTarget({ ...tileA, listing_url: 'https://www.publicsurplus.com/sms/all,tx/auction/view?auc=1' }, s);
  toggleTarget(tileB, s);
  const rows = targetRows(readTargets(s), []);
  const a = rows.find((r) => r.id === 'ps-1');
  const b = rows.find((r) => r.id === 'ps-2');
  assert.deepEqual([a.href, a.external], ['https://www.publicsurplus.com/sms/all,tx/auction/view?auc=1', true]);
  assert.deepEqual([b.href, b.external], [null, false]);
});
