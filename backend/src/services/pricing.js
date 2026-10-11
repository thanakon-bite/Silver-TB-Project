/**
 * Loads what the pricing module needs (products, the Shipping Rule) and prices a cart.
 * Every price shown before checkout and every order total come from here.
 */
const supabase = require('../config/supabase');
const { unwrap, badRequest } = require('../lib/http');
const { priceCart } = require('../lib/pricing');
const promotions = require('./promotions');

const FALLBACK_SHIPPING_FEE = Number(process.env.SHIPPING_FEE_THB || 0);
const FREE_THRESHOLD_KEY = 'free_shipping_threshold';

/** The Shipping Rule: tiers from shipping_tiers, the Free Shipping Threshold from app_settings. */
async function getShippingRule() {
  const [tiers, free] = await Promise.all([
    supabase.from('shipping_tiers').select('min_units, max_units, fee').order('min_units'),
    supabase.from('app_settings').select('value').eq('key', FREE_THRESHOLD_KEY).maybeSingle(),
  ]);
  const threshold = unwrap(free)?.value;
  return {
    tiers: unwrap(tiers).map((t) => ({ min_units: t.min_units, max_units: t.max_units, fee: Number(t.fee) })),
    free_threshold: threshold == null ? null : Number(threshold),
  };
}

/** The Shipping Rule as the Cart, the shipping page and the admin Rules page read it. */
async function shippingRuleView() {
  return { ...(await getShippingRule()), fallback_fee: FALLBACK_SHIPPING_FEE };
}

/** Replaces the whole rule in one transaction (set_shipping_rule). `rule` is already validated. */
async function saveShippingRule(rule) {
  unwrap(await supabase.rpc('set_shipping_rule', { p_tiers: rule.tiers, p_free_threshold: rule.free_threshold }));
  return rule;
}

/**
 * Prices cart items [{ product_id, quantity }] for a Customer with today's prices, Shipping Rule and
 * Promotions (and that Customer's Redemptions). Unknown or inactive products are refused, as create_order would.
 */
async function priceItems(items, userId = null, giftChoices = {}, promotionChoices = {}) {
  const ids = [...new Set(items.map((i) => i.product_id))];
  const [products, shippingRule, active] = await Promise.all([
    supabase.from('products').select('id, name, name_th, price, available, is_active, images').in('id', ids),
    getShippingRule(),
    promotions.activePromotions(),
  ]);
  if (products.error) throw products.error;
  const byId = Object.fromEntries(products.data.map((p) => [p.id, p]));

  const qty = {};
  for (const i of items) qty[i.product_id] = (qty[i.product_id] || 0) + i.quantity;
  const lines = Object.entries(qty).map(([id, quantity]) => {
    const p = byId[id];
    if (!p || !p.is_active) throw badRequest('A product in your cart is no longer available', 'PRODUCT_UNAVAILABLE');
    return { product_id: id, name: p.name, unit_price: Number(p.price), quantity };
  });

  // Gift products may be ones not for sale (inactive); only their Available matters
  const giftIds = [...new Set(active.flatMap((p) => p.gift_product_ids || []))];
  const giftProducts = {};
  if (giftIds.length) {
    const rows = unwrap(await supabase.from('products').select('id, name, name_th, price, available').in('id', giftIds));
    for (const g of rows) giftProducts[g.id] = { name: g.name, name_th: g.name_th, price: Number(g.price), available: g.available };
  }

  const redemptions = userId ? await promotions.redemptionsFor(userId, active.map((p) => p.id)) : {};
  const priced = priceCart({ lines, shippingRule, fallbackFee: FALLBACK_SHIPPING_FEE, promotions: active, redemptions, giftProducts, giftChoices, promotionChoices });
  // Each line carries today's Available so the Cart can keep its quantities within it
  const lines_ = priced.lines.map((l) => ({ ...l, available: Math.max(0, Number(byId[l.product_id].available || 0)) }));
  return { ...priced, lines: lines_, shipping_rule: shippingRule };
}

/** The create_order payload for a priced cart: one line per product with its discount and Promotion, then the Gifts. */
const orderLines = (priced) => [
  ...priced.lines.map((l) => ({
    product_id: l.product_id,
    quantity: l.quantity,
    discount_per_unit: l.discount_per_unit,
    promotion_id: l.promotion_id,
    promotion_ids: l.promotion_ids,
  })),
  ...priced.gifts
    .filter((g) => g.quantity > 0)
    .map((g) => ({ product_id: g.product_id, quantity: g.quantity, is_gift: true, promotion_id: g.promotion_id })),
];

module.exports = { getShippingRule, shippingRuleView, saveShippingRule, priceItems, orderLines, FALLBACK_SHIPPING_FEE };
