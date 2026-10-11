# 10: Promotion — Discount

**What to build:** Admins create Promotions on the Rules page: Thai / optional English name, start–end dates (Thai time, both days included), all or chosen products, Discount Tiers (percent or baht per unit), a per-Customer cap and a distinct-Customer cap. Edits after start are limited to name, end date and on/off; delete only with no Redemptions. Shoppers see a badge on product cards and all tiers on the product page; the Cart shows discounts per line and "เพิ่มอีก X ชิ้น" hints; Checkout, Stripe and the order show the same discounted total. Redemptions are counted at order creation and released on cancel; a Customer over a cap sees normal prices with a short explanation.

**Blocked by:** 09

**Status:** done

- [x] Promotion CRUD with edit/delete rules and redemption counts
- [x] Pricing: covered units count together, highest tier only, best Promotion per line, no stacking, caps and dates respected
- [x] Badge, product-page tiers, cart lines and next-tier hint
- [x] Order Items snapshot the discount; the Stripe total equals the order total
- [x] Redemptions recorded atomically with cap checks, released on cancel
- [x] Tests at DB, unit, HTTP and frontend seams
