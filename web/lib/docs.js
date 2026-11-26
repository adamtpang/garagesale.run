export const DOCS = [
  ['what', 'What is Garage Sale', 'Garage Sale is a web app where Grok Bot agents help you buy and sell on Facebook Marketplace in Austin, TX. To sell, snap a photo. To buy, say what you want and your max price.'],
  ['sell', 'How selling works', 'Upload one photo (or many at once). For each photo an agent: 1) identifies the item (name, brand, model, condition), 2) researches prices, local Facebook Marketplace comps first, and if there are fewer than 3 it widens to eBay sold listings, Amazon and other sites, 3) writes a detailed listing with a recommended price, 4) waits for your approval, 5) posts it to Facebook Marketplace and shows a link plus a QR code.'],
  ['approve', 'Approval and posting', 'Nothing is posted without your approval. On the job page you can change the price, then press "Approve and post to Marketplace". Grok Bot then posts from your connected Facebook account. Facebook has no public listing API, so the agent posts by driving a real browser session, and it verifies the live listing before showing the link.'],
  ['bulk', 'Bulk selling', 'Moving out? Choose many photos at once. Each photo becomes its own sell job, and a batch page shows every job with its stage and link.'],
  ['buy', 'How buying and scouting works', 'Type what you want and an optional max price. Scout agents search Facebook Marketplace in Austin, compare each listing with eBay sold prices, Amazon and other sites, and show deals priced under market with the comps that prove it. Each deal links to the real Marketplace listing.'],
  ['arbitrage', 'Arbitrage', 'For resale deals the agent shows the buy price on Marketplace, where it could resell (for example eBay sold comps or Amazon) and an estimated profit. Estimates are not guarantees: check condition, fees and shipping before you buy.'],
  ['deals', 'Deals feed', 'The /deals page shows the latest scout feed with the time it was last scouted.'],
  ['local', 'Location', 'Garage Sale is focused on Austin, TX for now. Local comps and scouting use Austin Marketplace listings.'],
  ['cant', 'What it cannot do', 'Garage Sale does not message buyers or sellers for you, does not take payments, does not guarantee prices or profit, and does not post anything without your approval. It only works on Facebook Marketplace for posting today.'],
  ['privacy', 'Photos and data', 'Photos you upload are stored so the agent can see them and so the listing can use them. Job pages are viewable by anyone with the link.'],
  ['grok', 'Grok Bot', 'The work is done by Grok Bot agents. The app shows a live activity log on each job page so you can watch every step.'],
];
export const DOCS_TEXT = DOCS.map(([, t, b]) => `## ${t}\n${b}`).join('\n\n');
