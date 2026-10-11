# 09: Pricing module and Shipping Rule

**What to build:** A pure pricing module prices a cart (lines, Shipping Rule, later Promotions) and is exposed through a price-preview endpoint. The admin Rules page has a Shipping Rule section: Shipping Tiers by paid units (contiguous from 1, no overlap, open-ended last tier, validated on save) and an optional Free Shipping Threshold. Cart, Checkout, order creation and the Stripe Checkout Session all use the computed Shipping Fee, which is stored on the order. The env flat fee is only a fallback when no tiers exist.

**Blocked by:** 03

**Status:** done

- [x] Pricing module unit tests: tiers, open-ended tier, threshold after discount, gift units excluded
- [x] The Rules page saves and validates tiers and threshold
- [x] Cart and Checkout show the fee from the preview endpoint
- [x] Order creation reprices server-side; the Stripe total equals the order total
- [x] Tests at unit, HTTP and frontend seams
