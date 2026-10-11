const express = require('express');
const supabase = require('../config/supabase');
const { asyncHandler, unwrap } = require('../lib/http');
const { optionalAuth } = require('../middleware/auth');
const { redeemablePromotions } = require('../lib/pricing');
const pricing = require('../services/pricing');
const promotions = require('../services/promotions');

const router = express.Router();

// GET /api/rules/shipping — the Shipping Rule shoppers see on the shipping page and in the Cart
router.get(
  '/shipping',
  asyncHandler(async (req, res) => {
    res.json(await pricing.shippingRuleView());
  })
);

// GET /api/rules/promotions — Promotions running now that this shopper can still redeem, for badges on
// product cards and tiers on product pages. Signed in, the Customer's own Redemptions count.
router.get(
  '/promotions',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const active = await promotions.activePromotions();
    const standing = await promotions.redemptionsFor(req.user?.id || null, active.map((p) => p.id));
    const list = redeemablePromotions(active, standing);
    // Gift products' prices, so a Gift can be valued against a Discount (Best Promotion). One none is
    // Available of is left out, as the Cart leaves it out, so the product page and the Cart agree.
    const giftIds = [...new Set(list.flatMap((p) => p.gift_product_ids || []))];
    const giftPrices = giftIds.length
      ? Object.fromEntries(
          unwrap(await supabase.from('products').select('id, price, available').in('id', giftIds))
            .filter((g) => Number(g.available) > 0)
            .map((g) => [g.id, Number(g.price)])
        )
      : {};
    res.json(
      list.map((p) => ({
        id: p.id,
        name_th: p.name_th,
        name_en: p.name_en,
        ends_at: p.ends_at,
        applies_to_all: p.applies_to_all,
        product_ids: p.product_ids,
        discount_tiers: p.discount_tiers,
        gift_every: p.gift_every,
        gift_quantity: p.gift_quantity,
        gift_prices: (p.gift_product_ids || []).map((id) => giftPrices[id]).filter((n) => n !== undefined),
        stacking: p.stacking || 'exclusive',
      }))
    );
  })
);

module.exports = router;
