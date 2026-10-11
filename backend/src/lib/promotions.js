/**
 * Promotion rules (CONTEXT.md: Promotion, Discount, Gift, Redemption) that do not need the database.
 */

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Start at 00:00 on the start date and end at 23:59:59.999 on the end date, Thai time (UTC+7, no DST). */
function bangkokRange(startDate, endDate) {
  return {
    starts_at: new Date(`${startDate}T00:00:00.000+07:00`).toISOString(),
    ends_at: new Date(`${endDate}T23:59:59.999+07:00`).toISOString(),
  };
}

/** The Thai calendar date (YYYY-MM-DD) of a timestamp, for showing a stored range back in the form. */
const bangkokDate = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

const limit = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 1000000 ? n : NaN;
};

/**
 * Validates and normalises an admin's Promotion form.
 * @returns {{ ok: true, promotion: object } | { ok: false, reason: string }}
 */
function validatePromotion(body, { requireBenefit = true } = {}) {
  const fail = (reason) => ({ ok: false, reason });
  if (!body || typeof body !== 'object') return fail('Promotion is required');

  const name_th = typeof body.name_th === 'string' ? body.name_th.trim() : '';
  if (!name_th || name_th.length > 120) return fail('A Thai name (up to 120 characters) is required');
  const name_en = typeof body.name_en === 'string' && body.name_en.trim() ? body.name_en.trim().slice(0, 120) : null;

  if (!DATE.test(body.start_date || '') || !DATE.test(body.end_date || '')) return fail('Start and end date must be valid dates');
  const range = bangkokRange(body.start_date, body.end_date);
  if (Number.isNaN(Date.parse(range.starts_at)) || Number.isNaN(Date.parse(range.ends_at))) return fail('Start and end date must be valid dates');
  if (range.ends_at < range.starts_at) return fail('The end date cannot be before the start date');

  const applies_to_all = body.applies_to_all === true;
  const product_ids = applies_to_all ? [] : [...new Set(Array.isArray(body.product_ids) ? body.product_ids : [])];
  if (!applies_to_all && (product_ids.length === 0 || product_ids.some((id) => !UUID.test(String(id))))) {
    return fail('Choose all products or at least one product');
  }

  const rawTiers = Array.isArray(body.discount_tiers) ? body.discount_tiers : [];
  const discount_tiers = [];
  for (const t of rawTiers) {
    const min_units = Number(t?.min_units);
    const value = Number(t?.value);
    if (!Number.isInteger(min_units) || min_units < 1 || min_units > 999) return fail('Discount tier units must be a whole number from 1');
    if (t?.type === 'percent') {
      if (!(value > 0 && value <= 100)) return fail('A percent discount must be more than 0 and at most 100');
    } else if (t?.type === 'baht') {
      if (!(value > 0 && value <= 100000)) return fail('A baht discount must be more than 0');
    } else {
      return fail('A discount is either percent or baht');
    }
    discount_tiers.push({ min_units, type: t.type, value: Math.round(value * 100) / 100 });
  }
  discount_tiers.sort((a, b) => a.min_units - b.min_units);
  for (let i = 1; i < discount_tiers.length; i++) {
    if (discount_tiers[i].min_units === discount_tiers[i - 1].min_units) return fail('Two discount tiers have the same number of units');
  }
  // Gift: every gift_every paid units earn gift_quantity free units of a ticked gift product
  const blank = (v) => v === '' || v === null || v === undefined;
  let gift_every = null;
  let gift_quantity = null;
  let gift_product_ids = [];
  if (!blank(body.gift_every) || !blank(body.gift_quantity)) {
    gift_every = Number(body.gift_every);
    gift_quantity = Number(body.gift_quantity);
    if (![gift_every, gift_quantity].every((n) => Number.isInteger(n) && n >= 1 && n <= 999)) {
      return fail('A gift needs both "every X units" and "Y free", as whole numbers from 1');
    }
    gift_product_ids = [...new Set(Array.isArray(body.gift_product_ids) ? body.gift_product_ids : [])];
    if (gift_product_ids.length === 0 || gift_product_ids.some((id) => !UUID.test(String(id)))) {
      return fail('Tick at least one gift product');
    }
  }
  if (requireBenefit && discount_tiers.length === 0 && !gift_every) return fail('A Promotion needs a discount or a gift');

  const per_customer_limit = limit(body.per_customer_limit);
  const customer_limit = limit(body.customer_limit);
  if (Number.isNaN(per_customer_limit) || Number.isNaN(customer_limit)) return fail('A limit must be a whole number from 1, or empty for unlimited');

  return {
    ok: true,
    promotion: {
      name_th,
      name_en,
      ...range,
      applies_to_all,
      product_ids,
      discount_tiers,
      gift_every,
      gift_quantity,
      gift_product_ids,
      per_customer_limit,
      customer_limit,
      is_active: body.is_active !== false,
    },
  };
}

/**
 * Once a Promotion has started, Customers may already have redeemed it, so only its names, end date
 * and on/off may change. Returns the editable fields, or null when everything still is.
 */
function editablePromotionFields(existing, now = new Date()) {
  return new Date(existing.starts_at) <= now ? ['name_th', 'name_en', 'ends_at', 'is_active'] : null;
}

module.exports = { validatePromotion, editablePromotionFields, bangkokRange, bangkokDate };
