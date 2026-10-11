/**
 * Promotions as the pricing module and the admin page need them (CONTEXT.md: Promotion, Redemption).
 */
const supabase = require('../config/supabase');
const { unwrap } = require('../lib/http');

const PROMO_FIELDS =
  'id, name_th, name_en, starts_at, ends_at, applies_to_all, discount_tiers, gift_every, gift_quantity, per_customer_limit, customer_limit, is_active, announced_at, created_at, promotion_products(product_id), promotion_gift_products(product_id)';

/** Flatten the join tables into product_ids / gift_product_ids. */
const shape = (p) => {
  const { promotion_products, promotion_gift_products, ...rest } = p;
  return {
    ...rest,
    product_ids: (promotion_products || []).map((x) => x.product_id),
    gift_product_ids: (promotion_gift_products || []).map((x) => x.product_id),
  };
};

/** Promotions running right now (active, between start and end). */
async function activePromotions(now = new Date()) {
  const iso = now.toISOString();
  const rows = unwrap(
    await supabase.from('promotions').select(PROMO_FIELDS).eq('is_active', true).lte('starts_at', iso).gte('ends_at', iso)
  );
  return rows.map(shape);
}

/**
 * How a Customer stands with each Promotion: their own active Redemptions, the distinct Customers
 * redeeming it so far, and whether they are already one of them.
 */
async function redemptionsFor(userId, promotionIds) {
  const standing = {};
  if (!promotionIds.length) return standing;
  const rows = unwrap(
    await supabase.from('promotion_redemptions').select('promotion_id, user_id').in('promotion_id', promotionIds).is('released_at', null)
  );
  for (const id of promotionIds) {
    const mineRows = rows.filter((r) => r.promotion_id === id);
    const people = new Set(mineRows.map((r) => r.user_id));
    const mine = mineRows.filter((r) => r.user_id === userId).length;
    standing[id] = { mine, customers: people.size, counted: people.has(userId) };
  }
  return standing;
}

async function listAll() {
  const rows = unwrap(await supabase.from('promotions').select(PROMO_FIELDS).order('starts_at', { ascending: false }));
  const ids = rows.map((r) => r.id);
  const redemptions = ids.length
    ? unwrap(await supabase.from('promotion_redemptions').select('promotion_id, user_id').in('promotion_id', ids).is('released_at', null))
    : [];
  return rows.map((r) => {
    const mine = redemptions.filter((x) => x.promotion_id === r.id);
    return { ...shape(r), redemptions: mine.length, customers: new Set(mine.map((x) => x.user_id)).size };
  });
}

async function getOne(id) {
  const row = unwrap(await supabase.from('promotions').select(PROMO_FIELDS).eq('id', id).maybeSingle());
  return row ? shape(row) : null;
}

async function redemptionCount(id) {
  const { count, error } = await supabase.from('promotion_redemptions').select('id', { count: 'exact', head: true }).eq('promotion_id', id);
  if (error) throw error;
  return count || 0;
}

/** Replace a Promotion's product list (and gift list) to match the form. */
async function setProducts(id, productIds, giftProductIds) {
  unwrap(await supabase.from('promotion_products').delete().eq('promotion_id', id));
  if (productIds.length) {
    unwrap(await supabase.from('promotion_products').insert(productIds.map((product_id) => ({ promotion_id: id, product_id }))));
  }
  if (giftProductIds) {
    unwrap(await supabase.from('promotion_gift_products').delete().eq('promotion_id', id));
    if (giftProductIds.length) {
      unwrap(await supabase.from('promotion_gift_products').insert(giftProductIds.map((product_id) => ({ promotion_id: id, product_id }))));
    }
  }
}

module.exports = { activePromotions, redemptionsFor, listAll, getOne, redemptionCount, setProducts };
