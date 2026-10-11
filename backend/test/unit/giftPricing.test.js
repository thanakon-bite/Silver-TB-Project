const test = require('node:test');
const assert = require('node:assert/strict');
const { priceCart } = require('../../src/lib/pricing');
const { validatePromotion } = require('../../src/lib/promotions');

const line = (product_id, unit_price, quantity) => ({ product_id, name: product_id, unit_price, quantity });
const giftPromo = (over = {}) => ({
  id: 'g1',
  name_th: 'ซื้อ 2 แถม 1',
  name_en: null,
  applies_to_all: false,
  product_ids: ['jelly'],
  discount_tiers: [],
  gift_every: 2,
  gift_quantity: 1,
  gift_product_ids: ['sticker', 'spoon'],
  per_customer_limit: null,
  customer_limit: null,
  ...over,
});
const giftProducts = {
  sticker: { name: 'Sticker', name_th: 'สติกเกอร์', price: 20, available: 10 },
  spoon: { name: 'Spoon', name_th: 'ช้อน', price: 35, available: 10 },
};

test('every X paid units earn Y free units, repeatedly; the first gift product is the default', () => {
  const r = priceCart({ lines: [line('jelly', 50, 5)], promotions: [giftPromo()], giftProducts });
  assert.equal(r.gifts.length, 1);
  assert.deepEqual(
    { product_id: r.gifts[0].product_id, quantity: r.gifts[0].quantity, out_of_stock: r.gifts[0].out_of_stock },
    { product_id: 'sticker', quantity: 2, out_of_stock: false }
  );
  assert.deepEqual(r.gifts[0].options.map((o) => o.product_id), ['sticker', 'spoon']);
  assert.equal(r.total, 250, 'gifts are free');
  assert.deepEqual(r.redeem, ['g1']);
});

test('the Customer picks which gift product they get', () => {
  const r = priceCart({ lines: [line('jelly', 50, 2)], promotions: [giftPromo()], giftProducts, giftChoices: { g1: 'spoon' } });
  assert.equal(r.gifts[0].product_id, 'spoon');
});

test('below X paid units there is no gift yet, and the Cart says how many more', () => {
  const r = priceCart({ lines: [line('jelly', 50, 1)], promotions: [giftPromo()], giftProducts });
  assert.equal(r.gifts.length, 0);
  assert.deepEqual(r.redeem, []);
  assert.deepEqual(r.next_gifts, [{ promotion_id: 'g1', name_th: 'ซื้อ 2 แถม 1', name_en: null, units_needed: 1, gift_quantity: 1 }]);
});

test('when no gift is Available the order still goes through without it', () => {
  const none = { sticker: { ...giftProducts.sticker, available: 0 }, spoon: { ...giftProducts.spoon, available: 0 } };
  const r = priceCart({ lines: [line('jelly', 50, 2)], promotions: [giftPromo()], giftProducts: none });
  assert.equal(r.gifts[0].out_of_stock, true);
  assert.equal(r.gifts[0].quantity, 0);
  assert.deepEqual(r.redeem, [], 'nothing given, nothing redeemed');
  assert.equal(r.total, 100);
  // Its card says the Gift ran out, not that the Order has not reached it
  assert.deepEqual(r.promotion_options.map((o) => [o.key, o.saving, o.gift_out]), [['g1', 0, true]]);
});

test('an option whose Gift is still in stock, or not yet earned, is not marked out', () => {
  assert.equal(priceCart({ lines: [line('jelly', 50, 2)], promotions: [giftPromo()], giftProducts }).promotion_options[0].gift_out, false);
  const none = { sticker: { ...giftProducts.sticker, available: 0 }, spoon: { ...giftProducts.spoon, available: 0 } };
  assert.equal(priceCart({ lines: [line('jelly', 50, 1)], promotions: [giftPromo()], giftProducts: none }).promotion_options[0].gift_out, false);
});

test('gifts never count towards the Shipping Fee', () => {
  const rule = { tiers: [{ min_units: 1, max_units: 2, fee: 10 }, { min_units: 3, max_units: null, fee: 50 }], free_threshold: null };
  const r = priceCart({ lines: [line('jelly', 50, 2)], promotions: [giftPromo()], giftProducts, shippingRule: rule });
  assert.equal(r.gifts[0].quantity, 1);
  assert.equal(r.shipping_fee, 10);
});

test('a gift counts as a saving when choosing the best Promotion, and only one Promotion applies to a line', () => {
  const discount = { ...giftPromo({ id: 'd1', gift_every: null, gift_quantity: null, gift_product_ids: [] }), discount_tiers: [{ min_units: 1, type: 'baht', value: 5 }] };
  // 2 jellies: discount saves 10, gift (sticker ฿20) saves 20 → the gift wins
  const r = priceCart({ lines: [line('jelly', 50, 2)], promotions: [discount, giftPromo()], giftProducts });
  assert.deepEqual(r.redeem, ['g1']);
  assert.equal(r.discount_total, 0);
  assert.equal(r.lines[0].promotion_id, 'g1');
});

test('a Promotion may give a gift with no discount, and needs gift products when it does', () => {
  const base = {
    name_th: 'แถม', start_date: '2026-11-01', end_date: '2026-11-02', applies_to_all: true, product_ids: [],
    discount_tiers: [], per_customer_limit: '', customer_limit: '', is_active: true,
  };
  const ok = validatePromotion({ ...base, gift_every: 2, gift_quantity: 1, gift_product_ids: ['11111111-1111-1111-1111-111111111111'] });
  assert.equal(ok.ok, true);
  assert.deepEqual([ok.promotion.gift_every, ok.promotion.gift_quantity, ok.promotion.gift_product_ids], [2, 1, ['11111111-1111-1111-1111-111111111111']]);
  assert.match(validatePromotion({ ...base, gift_every: 2, gift_quantity: 1, gift_product_ids: [] }).reason, /gift product/);
  assert.match(validatePromotion({ ...base, gift_every: 2, gift_quantity: '' }).reason, /gift/);
  assert.match(validatePromotion({ ...base }).reason, /discount or a gift/);
});

test('two Stackable Promotions giving the same gift product give one gift line each, sharing its Available', () => {
  const a = giftPromo({ id: 'gA', product_ids: ['jelly'], gift_every: 1, gift_product_ids: ['sticker'], stacking: 'stackable' });
  const b = giftPromo({ id: 'gB', product_ids: ['log'], gift_every: 1, gift_product_ids: ['sticker'], stacking: 'stackable' });
  const few = { sticker: { ...giftProducts.sticker, available: 3 } };
  const r = priceCart({ lines: [line('jelly', 50, 2), line('log', 80, 2)], promotions: [a, b], giftProducts: few });
  const given = r.gifts.map((g) => [g.promotion_id, g.product_id, g.quantity]).sort();
  // 4 earned, 3 Available: one Promotion gives 2, the other cannot fit its 2 and shows "out of stock"
  assert.equal(given.length, 2);
  assert.equal(given.reduce((n, g) => n + g[2], 0), 2);
  assert.ok(r.gifts.some((g) => g.out_of_stock));
});
