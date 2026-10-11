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

/** A Promotion that combines with the other Stackable ones (ADR 0004); anything else applies alone. */
const isStackable = (p) => p.stacking === 'stackable';

/**
 * What the Order may use (CONTEXT.md: Stackable, Exclusive; ADR 0004): one Exclusive Promotion, or every
 * Stackable Promotion together. One option covers the whole Order; a product it does not cover pays the
 * normal price. An option is { kind: 'exclusive', promo } | { kind: 'stack', promos }.
 */
function orderOptions(promotions) {
  const stack = promotions.filter(isStackable).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return [
    ...promotions.filter((p) => !isStackable(p)).map((promo) => ({ kind: 'exclusive', promo })),
    ...(stack.length ? [{ kind: 'stack', promos: stack }] : []),
  ];
}

/** Each line's share of an Order option: the option's Promotions that cover that product, or nothing. */
function lineShares(priced, option) {
  return priced.map((l) => {
    if (!option) return null;
    if (option.kind === 'exclusive') return covers(option.promo, l.product_id) ? option : null;
    const mine = option.promos.filter((p) => covers(p, l.product_id));
    return mine.length ? { kind: 'stack', promos: mine } : null;
  });
}

const optionPromos = (o) => (!o ? [] : o.kind === 'stack' ? o.promos : [o.promo]);
/** How the Cart and checkout name an option: 'stack', or the Exclusive Promotion's id. */
const optionKey = (o) => (!o ? null : o.kind === 'stack' ? 'stack' : o.promo.id);

/**
 * One unit's discount from these Promotions at the tiers they reached: percentages one after another on
 * the reduced price (in a fixed order), then baht off; a unit never goes below zero.
 * @returns {{ total: number, parts: Record<string, number> }} satang, and each Promotion's share
 */
function stackedDiscount(promos, reached, unit) {
  const tiers = promos.map((p) => ({ p, t: reached[p.id] })).filter((x) => x.t);
  tiers.sort((a, b) => (a.t.type === b.t.type ? String(a.p.id).localeCompare(String(b.p.id)) : a.t.type === 'percent' ? -1 : 1));
  let price = unit;
  const parts = {};
  for (const { p, t } of tiers) {
    const d = unitDiscount(t, price);
    parts[p.id] = d;
    price -= d;
  }
  return { total: unit - price, parts };
}

/**
 * What one share per line is worth. A Promotion's tier counts the units of every line using it;
 * Gifts take Available in Promotion order, so two Promotions giving the same product share it.
 */
function evaluate(priced, choice, promotions, giftCtx) {
  const paidQty = { ...giftCtx.paidQty };
  const uses = choice.map(optionPromos);
  const reached = {};
  const groups = [];
  for (const p of promotions) {
    const mine = priced.filter((l, i) => uses[i].includes(p));
    if (!mine.length) continue;
    const units = mine.reduce((n, l) => n + l.quantity, 0);
    reached[p.id] = tierFor(p, units).reached;
    groups.push({ p, mine, units, reached: reached[p.id], discount: 0, gift: null, value: 0 });
  }
  const lineDiscounts = priced.map((l, i) => stackedDiscount(uses[i], reached, l.list));
  let saving = 0;
  for (const g of groups) {
    g.discount = priced.reduce((n, l, i) => n + (lineDiscounts[i].parts[g.p.id] || 0) * l.quantity, 0);
    g.gift = giftPlan(g.p, g.units, { ...giftCtx, paidQty });
    if (g.gift && g.gift.quantity > 0) paidQty[g.gift.product.product_id] = (paidQty[g.gift.product.product_id] || 0) + g.gift.quantity;
    g.value = g.discount + (g.gift ? g.gift.value : 0);
    saving += g.value;
  }
  const used = groups.filter((g) => g.value > 0).length;
  return { saving, used, groups, paidQty, lineDiscounts, choice: [...choice] };
}

const better = (a, b) => !b || a.saving > b.saving || (a.saving === b.saving && a.used < b.used);

/**
 * @param {{ lines: { product_id: string, name: string, unit_price: number, quantity: number }[],
 *           shippingRule?: object|null, fallbackFee?: number,
 *           promotions?: object[], redemptions?: Record<string, { mine: number, customers: number, counted: boolean }>,
 *           giftProducts?: Record<string, { name: string, name_th?: string, price: number, available: number }>,
 *           giftChoices?: Record<string, string>, promotionChoice?: string|null }} input
 *
 * Promotions (CONTEXT.md): units of all products a Promotion covers count together and only the highest
 * tier reached applies. The whole Order uses one option (ADR 0004): one Exclusive Promotion or every
 * Stackable one together; products it does not cover pay the normal price. It is the option that saves
 * the most, counting a Gift at its price, unless the Customer picked another (promotionChoice: 'stack' |
 * Promotion id), which is honoured while it is still on offer. Gifts are free and never count towards
 * the Shipping Fee.
 */
function priceCart({ lines, shippingRule = null, fallbackFee = 0, promotions = [], redemptions = {}, giftProducts = {}, giftChoices = {}, promotionChoice = null }) {
  const priced = lines.map((l) => {
    const unit = toSatang(l.unit_price);
    return { product_id: l.product_id, name: l.name, quantity: l.quantity, list: unit, discount: 0, promotion_ids: [] };
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

  // Each option priced for the whole Order; the Customer's pick is kept while it is still on offer
  const options = orderOptions(usable).map((o) => ({ o, e: evaluate(priced, lineShares(priced, o), usable, giftCtx) }));
  const picked = options.find((x) => optionKey(x.o) === promotionChoice);
  const chosen = picked || options.reduce((top, x) => (better(x.e, top?.e) ? x : top), null);
  const best = chosen ? chosen.e : evaluate(priced, lineShares(priced, null), usable, giftCtx);
  const chosenPromos = chosen ? optionPromos(chosen.o) : [];

  // A Promotion is redeemed when it took money off or gave a Gift
  const gave = (g) => g.discount > 0 || Boolean(g.gift && g.gift.quantity > 0);
  const redeem = best.groups.filter(gave).map((g) => g.p.id);
  priced.forEach((l, i) => {
    l.discount = best.lineDiscounts[i].total;
    l.promotion_ids = optionPromos(best.choice[i])
      .map((p) => p.id)
      .filter((id) => redeem.includes(id));
  });

  const applied = [];
  const gifts = [];
  for (const g of best.groups) {
    if (g.value > 0) {
      applied.push({ id: g.p.id, name_th: g.p.name_th, name_en: g.p.name_en, units: g.units, tier: g.reached, discount_total: toBaht(g.discount) });
    }
    if (g.gift && g.gift.earned > 0 && (g.value > 0 || g.gift.quantity === 0)) gifts.push(giftEntry(g.p, g.gift));
  }

  // "Buy N more" hints, only for the Promotions of the option the Order uses
  const next_tiers = [];
  const next_gifts = [];
  for (const p of chosenPromos) {
    const units = priced.filter((l) => covers(p, l.product_id)).reduce((n, l) => n + l.quantity, 0);
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

  return {
    lines: priced.map((l) => ({
      product_id: l.product_id,
      name: l.name,
      quantity: l.quantity,
      list_price: toBaht(l.list),
      unit_price: toBaht(l.list - l.discount),
      discount_per_unit: toBaht(l.discount),
      line_total: toBaht((l.list - l.discount) * l.quantity),
      promotion_id: l.promotion_ids[0] || null,
      promotion_ids: l.promotion_ids,
    })),
    // The Order's option and every one it could use instead, with what each saves: the Cart's cards
    promotion_option: chosen ? optionKey(chosen.o) : null,
    promotion_options: options.map(({ o, e }) => ({
      key: optionKey(o),
      kind: o.kind,
      promotions: optionPromos(o).map((p) => ({ id: p.id, name_th: p.name_th, name_en: p.name_en })),
      saving: toBaht(e.saving),
      // It earned a Gift that none is Available of, so its card can say why it saves nothing
      gift_out: e.groups.some((g) => Boolean(g.gift && g.gift.earned > 0 && g.gift.quantity === 0)),
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

/** Stripe's smallest charge in Thai Baht: a smaller order could be placed but never paid. */
const MIN_PAYABLE_TOTAL = 10;

/** @returns {{ ok: true } | { ok: false, reason: string, code: string }} */
function checkPayableTotal(total) {
  if (Number(total) >= MIN_PAYABLE_TOTAL) return { ok: true };
  return { ok: false, reason: `Orders must come to at least ฿${MIN_PAYABLE_TOTAL} to be paid by card or PromptPay`, code: 'BELOW_MINIMUM_TOTAL' };
}

/**
 * The Promotions this shopper can still redeem (CONTEXT.md: Promotion): not ones they used up, nor ones
 * that reached their Customer cap unless they are already one of its Customers. Guests pass no standing.
 */
const redeemablePromotions = (promotions, redemptions = {}) => promotions.filter((p) => !blockedReason(p, redemptions));

module.exports = { priceCart, redeemablePromotions, validateShippingRule, checkPayableTotal, MIN_PAYABLE_TOTAL, toSatang };
