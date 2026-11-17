// Adam's flip rules. This is the one place they live.
// The surplus board reads this file. Change a rule here, not in the code that applies it.
// Approved by Adam on Nov 3, 2026 (see docs/HANDOFF.md).
export const RULES_CONFIG = Object.freeze({
  approved_on: '2026-11-03',
  home: 'New Braunfels, TX',
  // Most Adam will pay for one flip, counting the bid, buyer's premium, tax and gas.
  max_per_flip: 100,
  bankroll: 100,
  // Least profit a flip must make after fees and gas.
  min_profit: 100,
  // Pickup radius, measured from home.
  max_pickup_miles: 15,
  categories: Object.freeze(['electronics', 'game consoles', 'tools', 'furniture', 'bikes', 'cameras']),
  gas_per_mile: 0.18,
  gas_per_mile_confirmed: false,
  gas_per_mile_note: 'Estimate: about 20 MPG at $3.50 a gallon. Adam has not confirmed it.',
  // Used only when a seller says tax is added but gives no rate.
  tax_assumption_rate: 0.0825,
  // Where the scout looks. New Braunfels is home. San Marcos and Austin are search areas only.
  sites: Object.freeze(['fb', 'craigslist', 'ebay', 'offerup']),
  areas: Object.freeze([
    Object.freeze({ name: 'New Braunfels', lat: 29.703, lng: -98.1245 }),
    Object.freeze({ name: 'San Marcos', lat: 29.8833, lng: -97.9414 }),
    Object.freeze({ name: 'Austin', lat: 30.2672, lng: -97.7431 }),
  ]),
  run_hours: 'daily daytime',
  // What each site takes when Adam sells there. "confirmed" is Adam's own sign-off, and he has given none yet.
  fees: Object.freeze({
    fb: Object.freeze({ rate: 0, flat: null, plus_shipping: false, confirmed: false, note: 'Local pickup. Default, to be confirmed.' }),
    craigslist: Object.freeze({ rate: 0, flat: null, plus_shipping: false, confirmed: false, note: 'Default, to be confirmed.' }),
    offerup: Object.freeze({ rate: 0, flat: null, plus_shipping: false, confirmed: false, note: 'Local pickup. Default, to be confirmed.' }),
    ebay: Object.freeze({ rate: 0.136, flat: 0.4, plus_shipping: true, confirmed: false, note: 'eBay selling fees page, most categories: 13.6% plus $0.40 per order. Read Nov 15, 2026. Plus shipping.' }),
  }),
  // Proposed, NOT approved. Each stays off until Adam turns it on.
  optional: Object.freeze({
    lot_roi: Object.freeze({
      enabled: false,
      min_roi: 3,
      note: 'Proposed: judge a lot by return, about 3x the all-in cost.',
    }),
    surplus_radius: Object.freeze({
      enabled: false,
      miles: 60,
      note: 'Proposed: a wider pickup radius for surplus lots.',
    }),
  }),
});
