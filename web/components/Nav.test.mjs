import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

const src = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('the nav leads with the Market and keeps the listing tools in the footer', () => {
  const layout = src('../app/layout.js');
  const nav = layout.slice(layout.indexOf('<nav'), layout.indexOf('</nav>'));
  const links = [...nav.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(links, [['/', 'Market'], ['/surplus', 'Surplus'], ['/ladder', 'Bankroll'], ['/ledger', 'Ledger']]);
  const foot = layout.slice(layout.indexOf('<footer'));
  for (const href of ['/buy', '/sell', '/about']) assert.ok(foot.includes(`href="${href}"`), href);
  assert.ok(foot.includes('<NavMsgs />'));
});

test('the home page is the Market, and /dashboard sends old links there', () => {
  assert.match(src('../app/page.js'), /MarketHome/);
  assert.match(src('../app/MarketHome.js'), /DealFeedScreen/);
  assert.match(src('../app/dashboard/page.js'), /redirect\('\/'\)/);
  // Nothing links to the old dashboard address any more.
  for (const p of ['../app/ladder/page.js', '../app/ledger/page.js', './SurplusBoard.js', './ModeFeed.js', './SellHome.js', '../app/deal/[src]/[idx]/page.js']) {
    assert.equal(src(p).includes('/dashboard'), false, p);
  }
});

test('no page shows the old made-up example prices', () => {
  const sell = src('./SellHome.js');
  for (const word of ['TILES', 'EXAMPLES', 'Example items and prices']) assert.equal(sell.includes(word), false, word);
  assert.match(src('../app/sell/page.js'), /SellHome mode="sell"/);
});
