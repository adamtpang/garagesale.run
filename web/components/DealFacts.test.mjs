import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { assessDeal, cleanDeal } from '../lib/decision.js';
import { SAMPLE_CONFIG, SAMPLE_DEALS } from '../lib/decision.sample.js';
import { DealCard, DealTableRow } from './DealFacts.js';

const e = React.createElement;
const views = SAMPLE_DEALS.map((d) => assessDeal(cleanDeal(d), SAMPLE_CONFIG));
const buy = views[0];
const austin = views[1];
const missingShip = views[2];

function markup(view) {
  return renderToStaticMarkup(e('div', null,
    e(DealCard, { view, sample: true }),
    e('table', null, e('tbody', null, e(DealTableRow, { view, sample: true })))));
}

test('deal facts render a mobile card and a desktop row', () => {
  const html = markup(buy);
  assert.match(html, /data-region="card"/);
  assert.match(html, /md:hidden/);
  assert.match(html, /data-region="row"/);
  assert.match(html, /md:table-row/);
  assert.match(html, /Sample · Buy/);
  assert.match(html, /Facebook Marketplace/);
  assert.match(html, /eBay/);
  assert.match(html, /Expected net/);
  assert.match(html, /Open listing/);
  assert.match(html, /example\.com\/sample\/listing-camera/);
  assert.match(html, /Open comp/);
  assert.equal((html.match(/data-sample="true"/g) || []).length >= 1, true);
});

test('unknown shipping and a skip reason stay visible on both layouts', () => {
  const ship = markup(missingShip);
  assert.match(ship, /Shipping/);
  assert.match(ship, />unknown</);
  assert.match(ship, /not treated as \$0|not counted as \$0/);
  assert.equal(ship.includes('Shipping $0'), false);
  assert.equal(ship.includes('>$0.00<'), false);
  assert.match(ship, /Expected net/);
  assert.match(ship, /Sample · Incomplete/);

  const skip = markup(austin);
  assert.match(skip, /Sample · Skip/);
  assert.match(skip, /Austin is not a pickup origin/);
  assert.match(skip, /New Braunfels/);
  assert.match(skip, /example\.com\/sample\/listing-austin/);
  assert.equal(skip.includes('Expected net'), true);
  assert.match(skip, /data-net="unknown"/);
});
