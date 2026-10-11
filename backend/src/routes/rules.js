const express = require('express');
const { asyncHandler } = require('../lib/http');
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

// GET /api/rules/promotions — Promotions running now, for badges on product cards and tiers on product pages
router.get(
  '/promotions',
  asyncHandler(async (req, res) => {
    const list = await promotions.activePromotions();
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
      }))
    );
  })
);

module.exports = router;
