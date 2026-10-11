-- Silver Thief Bug: delete EVERY product, with its Stock History, Favorites and Promotion links.
-- Run in the Supabase SQL Editor once migration 006 has run. It cannot be undone: export first if unsure.
--
-- What happens:
--   products                  all deleted
--   stock_changes             deleted with them (Stock History: On Hand / Available records)
--   favorites                 deleted with them
--   promotion_products,
--   promotion_gift_products   deleted with them (the Promotions stay; one that named only these
--                             products now covers nothing until an Admin edits it)
--   order_items               KEPT: product_id becomes NULL; the name, price and photo copied at
--                             checkout stay, so past Orders still read correctly
--   categories, beetle_families, orders, Members   untouched
--
-- Product photos in Storage (bucket product-images) are not removed by SQL: delete them in the
-- Supabase Dashboard → Storage if you want the space back.
--
-- Supabase refuses UPDATE / DELETE without WHERE (pg-safeupdate), hence the WHERE on each.

BEGIN;

-- How much will go (shown in the results panel)
SELECT
  (SELECT count(*) FROM public.products)                AS products,
  (SELECT count(*) FROM public.stock_changes)           AS stock_changes,
  (SELECT count(*) FROM public.favorites)               AS favorites,
  (SELECT count(*) FROM public.promotion_products)      AS promotion_products,
  (SELECT count(*) FROM public.promotion_gift_products) AS promotion_gift_products,
  (SELECT count(*) FROM public.order_items WHERE product_id IS NOT NULL) AS order_items_unlinked;

-- Removed explicitly too, so the result does not depend on how each foreign key cascades
DELETE FROM public.stock_changes WHERE product_id IS NOT NULL;
DELETE FROM public.favorites WHERE product_id IS NOT NULL;
DELETE FROM public.promotion_products WHERE product_id IS NOT NULL;
DELETE FROM public.promotion_gift_products WHERE product_id IS NOT NULL;
DELETE FROM public.products WHERE id IS NOT NULL;

COMMIT;

-- ---------------------------------------------------------------------------------------------
-- OPTIONAL: also clear every Order (for a clean demo). Uncomment the block to run it.
-- Order Items, Redemptions and order Notifications go with their Orders; Stripe's payment log
-- keeps its rows with the order link emptied. Revenue on the Overview starts from zero.
-- ---------------------------------------------------------------------------------------------
-- BEGIN;
-- DELETE FROM public.notifications WHERE order_id IS NOT NULL;
-- DELETE FROM public.promotion_redemptions WHERE order_id IS NOT NULL;
-- DELETE FROM public.order_items WHERE order_id IS NOT NULL;
-- DELETE FROM public.orders WHERE id IS NOT NULL;
-- COMMIT;
