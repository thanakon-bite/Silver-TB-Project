/**
 * Prices a cart: one module for the Cart preview, Checkout, order creation and the Stripe session,
 * so every screen and the charge agree. Pure — callers load products, rules and Promotions.
 *
 * Money is kept in satang (integers) inside and returned in baht.
 */

const toSatang = (baht) => Math.round(Number(baht) * 100);
const toBaht = (satang) => satang / 100;

const isInt = (n) => Number.isInteger(n);

/**
 * The Shipping Rule (CONTEXT.md): Shipping Tiers by paid units, contiguous from 1, no gaps or
 * overlaps, the last one open-ended; plus an optional Free Shipping Threshold.
 * An empty tier list is allowed: the flat fallback fee applies.
 * @returns {{ ok: true, rule: object } | { ok: false, reason: string }}
 */
function validateShippingRule(input) {
  const fail = (reason) => ({ ok: false, reason });
  if (!input || typeof input !== 'object' || !Array.isArray(input.tiers)) return fail('tiers must be a list');
  if (input.tiers.length > 50) return fail('at most 50 tiers');

  const tiers = [];
  for (const t of input.tiers) {
    const min = Number(t?.min_units);
    const max = t?.max_units === null || t?.max_units === undefined || t?.max_units === '' ? null : Number(t.max_units);
    const fee = Number(t?.fee);
    if (!isInt(min) || min < 1) return fail('min units must be a whole number from 1');
    if (max !== null && (!isInt(max) || max < min)) return fail('max units must be a whole number not below min units');
    if (!Number.isFinite(fee) || fee < 0 || fee > 100000) return fail('fee must be between 0 and 100,000 baht');
    tiers.push({ min_units: min, max_units: max, fee: toBaht(toSatang(fee)) });
  }
  tiers.sort((a, b) => a.min_units - b.min_units);

  if (tiers.length) {
    if (tiers[0].min_units !== 1) return fail('the first tier must start at 1 unit');
    for (let i = 1; i < tiers.length; i++) {
      const prev = tiers[i - 1];
      if (prev.max_units === null) return fail('only the last tier can be open-ended');
      if (tiers[i].min_units <= prev.max_units) return fail(`tiers overlap at ${tiers[i].min_units} units`);
      if (tiers[i].min_units > prev.max_units + 1) return fail(`there is a gap after ${prev.max_units} units`);
    }
    if (tiers[tiers.length - 1].max_units !== null) return fail('the last tier must be open-ended ("N or more")');
  }

  let free = input.free_threshold;
  if (free === '' || free === undefined) free = null;
  if (free !== null) {
    free = Number(free);
    if (!Number.isFinite(free) || free < 0) return fail('the free shipping threshold must be 0 or more');
    free = toBaht(toSatang(free));
  }
  return { ok: true, rule: { tiers, free_threshold: free } };
}

/** Shipping Fee in satang for this many paid units and item total (after discounts). */
function shippingFeeSatang(rule, paidUnits, itemTotalSatang, fallbackFee) {
  if (paidUnits <= 0) return 0;
  const tiers = rule?.tiers || [];
  if (rule?.free_threshold !== null && rule?.free_threshold !== undefined && itemTotalSatang >= toSatang(rule.free_threshold)) return 0;
  if (!tiers.length) return toSatang(fallbackFee || 0);
  const tier = tiers.find((t) => paidUnits >= t.min_units && (t.max_units === null || paidUnits <= t.max_units));
  return toSatang(tier ? tier.fee : tiers[tiers.length - 1].fee);
}

const covers = (promo, productId) => promo.applies_to_all || (promo.product_ids || []).includes(productId);

/** The highest Discount Tier reached with this many covered units, or null below the first. */
function tierFor(promo, units) {
  const tiers = [...(promo.discount_tiers || [])].sort((a, b) => a.min_units - b.min_units);
  let reached = null;
  for (const t of tiers) if (units >= t.min_units) reached = t;
  const next = tiers.find((t) => t.min_units > units) || null;
  return { reached, next };
}

/** Discount on one unit in satang: percent rounds to the satang; baht never takes a unit below zero. */
function unitDiscount(tier, unitSatang) {
  if (!tier) return 0;
  const d = tier.type === 'percent' ? Math.round((unitSatang * Number(tier.value)) / 100) : toSatang(tier.value);
  return Math.max(0, Math.min(unitSatang, d));
}

/**
 * Can this Customer redeem the Promotion? redemptions[promo.id] = { mine, customers, counted }:
 * their own Redemptions, distinct Customers so far, and whether they are already one of them.
 */
function blockedReason(promo, redemptions) {
  const u = redemptions?.[promo.id] || { mine: 0, customers: 0, counted: false };
  if (promo.per_customer_limit != null && u.mine >= promo.per_customer_limit) return 'per_customer';
  if (promo.customer_limit != null && !u.counted && u.customers >= promo.customer_limit) return 'customer_limit';
  return null;
}

/**
 * The Gift a Promotion earns on this many paid covered units (CONTEXT.md: Gift): every gift_every
 * units earn gift_quantity free units, repeatable. The Customer's choice is used when it has enough
 * Available, otherwise the first gift product that does; with none, the Gift is simply left out.
 */
function giftPlan(promo, units, { giftProducts, giftChoices, paidQty }) {
  if (!promo.gift_every || !promo.gift_quantity) return null;
  const quantity = Math.floor(units / promo.gift_every) * promo.gift_quantity;
  const options = (promo.gift_product_ids || [])
    .filter((id) => giftProducts[id])
    .map((id) => ({
      product_id: id,
      name: giftProducts[id].name,
      name_th: giftProducts[id].name_th || null,
      available: Math.max(0, Number(giftProducts[id].available || 0) - (paidQty[id] || 0)),
      price: toSatang(giftProducts[id].price || 0),
    }));
  const wanted = options.find((o) => o.product_id === giftChoices?.[promo.id] && o.available >= quantity);
  const chosen = quantity > 0 ? wanted || options.find((o) => o.available >= quantity) || null : null;
  return {
    quantity: chosen ? quantity : 0,
    earned: quantity,
    product: chosen,
    options,
    value: chosen ? chosen.price * quantity : 0,
  };
}

/**
 * What one choice of Promotion per line is worth. choice[i] is the Promotion for line i, or null.
 * Gifts take Available in Promotion order, so two Promotions giving the same product share it.
 */
function evaluate(priced, choice, promotions, giftCtx) {
  const paidQty = { ...giftCtx.paidQty };
  const groups = [];
  let saving = 0;
  for (const p of promotions) {
    const mine = priced.filter((l, i) => choice[i] === p);
    if (!mine.length) continue;
    const units = mine.reduce((n, l) => n + l.quantity, 0);
    const { reached } = tierFor(p, units);
    const discount = mine.reduce((n, l) => n + unitDiscount(reached, l.list) * l.quantity, 0);
    const gift = giftPlan(p, units, { ...giftCtx, paidQty });
    if (gift && gift.quantity > 0) paidQty[gift.product.product_id] = (paidQty[gift.product.product_id] || 0) + gift.quantity;
    const value = discount + (gift ? gift.value : 0);
    saving += value;
    groups.push({ p, mine, units, reached, discount, gift, value });
  }
  const used = groups.filter((g) => g.value > 0).length;
  return { saving, used, groups, paidQty };
}

const better = (a, b) => !b || a.saving > b.saving || (a.saving === b.saving && a.used < b.used);

/** Above this many combinations the search falls back to greedy: biggest saving first, then the rest. */
const MAX_COMBINATIONS = 20000;

/**
 * The choice of one Promotion (or none) per line that saves the Customer the most in total, Gifts
 * counted at their price; on a tie, the one that redeems fewer Promotions.
 */
function bestChoice(priced, promotions, giftCtx) {
  const options = priced.map((l) => [null, ...promotions.filter((p) => covers(p, l.product_id))]);
  const combinations = options.reduce((n, o) => n * o.length, 1);
  let best = null;
  if (combinations <= MAX_COMBINATIONS) {
    const choice = new Array(priced.length).fill(null);
    const walk = (i) => {
      if (i === priced.length) {
        const e = evaluate(priced, choice, promotions, giftCtx);
        if (better(e, best)) best = e;
        return;
      }
      for (const p of options[i]) {
        choice[i] = p;
        walk(i + 1);
      }
    };
    walk(0);
    return best;
  }
  const choice = new Array(priced.length).fill(null);
  best = evaluate(priced, choice, promotions, giftCtx);
  for (let remaining = [...promotions]; remaining.length; ) {
    let step = null;
    for (const p of remaining) {
      const trial = choice.map((c, i) => c || (covers(p, priced[i].product_id) ? p : null));
      const e = evaluate(priced, trial, promotions, giftCtx);
      if (e.saving > best.saving && (!step || e.saving > step.e.saving)) step = { p, trial, e };
    }
    if (!step) break;
    step.trial.forEach((c, i) => (choice[i] = c));
    best = step.e;
    remaining = remaining.filter((p) => p !== step.p);
  }
  return best;
}

/**
 * @param {{ lines: { product_id: string, name: string, unit_price: number, quantity: number }[],
 *           shippingRule?: object|null, fallbackFee?: number,
 *           promotions?: object[], redemptions?: Record<string, { mine: number, customers: number, counted: boolean }>,
 *           giftProducts?: Record<string, { name: string, name_th?: string, price: number, available: number }>,
 *           giftChoices?: Record<string, string> }} input
 *
 * Promotions (CONTEXT.md): applied automatically; units of all products a Promotion covers count
 * together and only the highest tier reached applies; Promotions never stack — each line gets one
 * Promotion, chosen so the whole Cart saves the most, counting a Gift at its price. Gifts are free
 * and never count towards the Shipping Fee.
 */
function priceCart({ lines, shippingRule = null, fallbackFee = 0, promotions = [], redemptions = {}, giftProducts = {}, giftChoices = {} }) {
  const priced = lines.map((l) => {
    const unit = toSatang(l.unit_price);
    return { product_id: l.product_id, name: l.name, quantity: l.quantity, list: unit, discount: 0, promotion_id: null };
  });
  const paidQty = Object.fromEntries(priced.map((l) => [l.product_id, l.quantity]));
  const giftCtx = { giftProducts, giftChoices, paidQty };

  const limited = [];
  const usable = [];
  for (const p of promotions) {
    if (!priced.some((l) => covers(p, l.product_id))) continue;
    const reason = blockedReason(p, redemptions);
    if (reason) limited.push({ promotion_id: p.id, name_th: p.name_th, name_en: p.name_en, reason });
    else usable.push(p);
  }

  const best = bestChoice(priced, usable, giftCtx);
  const applied = [];
  const gifts = [];
  for (const g of best.groups) {
    if (g.value > 0) {
      for (const l of g.mine) {
        l.discount = unitDiscount(g.reached, l.list);
        l.promotion_id = g.p.id;
      }
      applied.push({ id: g.p.id, name_th: g.p.name_th, name_en: g.p.name_en, units: g.units, tier: g.reached, discount_total: toBaht(g.discount) });
    }
    if (g.gift && g.gift.earned > 0 && (g.value > 0 || g.gift.quantity === 0)) gifts.push(giftEntry(g.p, g.gift));
  }

  // Earned Gifts that could not be given (none Available) are still shown, as "out of stock"
  const finalCtx = { ...giftCtx, paidQty: best.paidQty };
  for (const p of usable) {
    if (best.groups.some((g) => g.p === p)) continue;
    const units = priced.filter((l) => !l.promotion_id && covers(p, l.product_id)).reduce((n, l) => n + l.quantity, 0);
    const gift = giftPlan(p, units, finalCtx);
    if (gift && gift.earned > 0 && gift.quantity === 0) gifts.push(giftEntry(p, gift));
  }

  // "Buy N more" hints, for every usable Promotion that covers something in the Cart
  const next_tiers = [];
  const next_gifts = [];
  for (const p of usable) {
    const units = priced.filter((l) => covers(p, l.product_id) && (!l.promotion_id || l.promotion_id === p.id)).reduce((n, l) => n + l.quantity, 0);
    if (!units) continue;
    const { next } = tierFor(p, units);
    if (next) next_tiers.push({ promotion_id: p.id, name_th: p.name_th, name_en: p.name_en, units_needed: next.min_units - units, tier: next });
    if (p.gift_every && p.gift_quantity && units % p.gift_every !== 0) {
      next_gifts.push({ promotion_id: p.id, name_th: p.name_th, name_en: p.name_en, units_needed: p.gift_every - (units % p.gift_every), gift_quantity: p.gift_quantity });
    }
  }

  const paidUnits = priced.reduce((n, l) => n + l.quantity, 0);
  const subtotal = priced.reduce((n, l) => n + l.list * l.quantity, 0);
  const itemTotal = priced.reduce((n, l) => n + (l.list - l.discount) * l.quantity, 0);
  const shipping = shippingFeeSatang(shippingRule, paidUnits, itemTotal, fallbackFee);
  // A Promotion is redeemed when it took money off or gave a Gift
  const redeem = applied.filter((a) => toSatang(a.discount_total) > 0 || gifts.some((g) => g.promotion_id === a.id && g.quantity > 0)).map((a) => a.id);

  return {
    lines: priced.map((l) => ({
      product_id: l.product_id,
      name: l.name,
      quantity: l.quantity,
      list_price: toBaht(l.list),
      unit_price: toBaht(l.list - l.discount),
      discount_per_unit: toBaht(l.discount),
      line_total: toBaht((l.list - l.discount) * l.quantity),
      promotion_id: redeem.includes(l.promotion_id) ? l.promotion_id : null,
    })),
    gifts,
    promotions_applied: applied.filter((a) => redeem.includes(a.id)),
    next_tiers,
    next_gifts,
    limited,
    redeem,
    paid_units: paidUnits,
    items_subtotal: toBaht(subtotal),
    discount_total: toBaht(subtotal - itemTotal),
    item_total: toBaht(itemTotal),
    shipping_fee: toBaht(shipping),
    total: toBaht(itemTotal + shipping),
  };
}

function giftEntry(promo, gift) {
  return {
    promotion_id: promo.id,
    name_th: promo.name_th,
    name_en: promo.name_en,
    product_id: gift.product ? gift.product.product_id : null,
    name: gift.product ? gift.product.name : null,
    name_th_product: gift.product ? gift.product.name_th : null,
    quantity: gift.quantity,
    out_of_stock: gift.quantity === 0,
    options: gift.options.map(({ price, ...o }) => o),
  };
}

module.exports = { priceCart, validateShippingRule, toSatang };
