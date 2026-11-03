# Eval ground truth

Fetched 2026-11-03. `items.json` has 11 verified rows of a target of 20. There are no furniture, bikes, or cameras rows yet.

Every row was checked against the public eBay item page. The page showed "This listing sold on <date>", "Sold", and a USD price. `actual_sold_price` is the item only. Shipping is a separate field and is not part of that price.

eBay omits the year on the sold date. The year on each row is inferred from the weekday.

Some prices may be the "or Best Offer" list price, not the offer the seller accepted.

`gs-001` is the charging case only. `gs-006` is a bundle.

eBay blocks automated fetches of sold listings, and the Exa index is mostly older or non-US pages, so furniture, bikes, and cameras have no rows.
