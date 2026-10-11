const test = require('node:test');
const assert = require('node:assert/strict');
const { priceCart } = require('../../src/lib/pricing');

const line = (product_id, unit_price, quantity) => ({ product_id, name: product_id, unit_price, quantity });
const promo = (over = {}) => ({
  id: 'p1',
  name_th: 'ลดรับหน้าฝน',
  name_en: 'Rainy season sale',
  applies_to_all: false,
  product_ids: ['food-a', 'food-b'],
  discount_tiers: [
    { min_units: 1, type: 'percent', value: 5 },
    { min_units: 3, type: 'percent', value: 10 },
  ],
  per_customer_limit: null,
  customer_limit: null,
  ...over,
});
const noRedemptions = {};

test('units of every product in the same Promotion count together; only the highest tier reached applies', () => {
  const r = priceCart({ lines: [line('food-a', 100, 2), line('food-b', 200, 1)], promotions: [promo()], redemptions: noRedemptions });
  // 3 covered units → 10% off each
  assert.deepEqual(r.lines.map((l) => [l.product_id, l.list_price, l.unit_price, l.discount_per_unit, l.promotion_id]), [
    ['food-a', 100, 90, 10, 'p1'],
    ['food-b', 200, 180, 20, 'p1'],
  ]);
  assert.equal(r.items_subtotal, 400);
  assert.equal(r.discount_total, 40);
  assert.equal(r.item_total, 360);
  assert.deepEqual(r.promotions_applied.map((p) => [p.id, p.units, p.discount_total]), [['p1', 3, 40]]);
});

test('a lower tier applies until the next is reached, and the Cart is told how many more units unlock it', () => {
  const r = priceCart({ lines: [line('food-a', 100, 2)], promotions: [promo()], redemptions: noRedemptions });
  assert.equal(r.lines[0].discount_per_unit, 5);
  assert.deepEqual(r.next_tiers, [{ promotion_id: 'p1', name_th: 'ลดรับหน้าฝน', name_en: 'Rainy season sale', units_needed: 1, tier: { min_units: 3, type: 'percent', value: 10 } }]);
});

test('below the first tier nothing is discounted, but the hint still shows', () => {
  const p = promo({ discount_tiers: [{ min_units: 3, type: 'percent', value: 5 }] });
  const r = priceCart({ lines: [line('food-a', 100, 1)], promotions: [p], redemptions: noRedemptions });
  assert.equal(r.discount_total, 0);
  assert.equal(r.lines[0].promotion_id, null);
  assert.equal(r.next_tiers[0].units_needed, 2);
});

test('baht discounts are per unit and never make a unit cost less than zero', () => {
  const p = promo({ discount_tiers: [{ min_units: 1, type: 'baht', value: 30 }] });
  const r = priceCart({ lines: [line('food-a', 100, 2), line('food-b', 20, 1)], promotions: [p], redemptions: noRedemptions });
  assert.deepEqual(r.lines.map((l) => l.unit_price), [70, 0]);
  assert.equal(r.discount_total, 80);
});

test('percent discounts round to the satang per unit', () => {
  const p = promo({ discount_tiers: [{ min_units: 1, type: 'percent', value: 7 }] });
  const r = priceCart({ lines: [line('food-a', 99.99, 3)], promotions: [p], redemptions: noRedemptions });
  assert.equal(r.lines[0].discount_per_unit, 7); // 6.9993 → 7.00
  assert.equal(r.lines[0].line_total, 278.97);
});

test('Promotions never stack: each line gets the single Promotion that saves the customer most', () => {
  const small = promo({ id: 'small', product_ids: ['food-a'], discount_tiers: [{ min_units: 1, type: 'percent', value: 5 }] });
  const big = promo({ id: 'big', applies_to_all: true, product_ids: [], discount_tiers: [{ min_units: 1, type: 'percent', value: 20 }] });
  const r = priceCart({ lines: [line('food-a', 100, 1), line('log-x', 50, 1)], promotions: [small, big], redemptions: noRedemptions });
  assert.deepEqual(r.lines.map((l) => [l.product_id, l.promotion_id, l.discount_per_unit]), [['food-a', 'big', 20], ['log-x', 'big', 10]]);
});

test('a Customer who has used up their per-Customer limit pays normal prices and is told why', () => {
  const p = promo({ per_customer_limit: 1 });
  const r = priceCart({ lines: [line('food-a', 100, 3)], promotions: [p], redemptions: { p1: { mine: 1, customers: 5, counted: true } } });
  assert.equal(r.discount_total, 0);
  assert.deepEqual(r.limited, [{ promotion_id: 'p1', name_th: 'ลดรับหน้าฝน', name_en: 'Rainy season sale', reason: 'per_customer' }]);
});

test('a Promotion full of Customers stays open to those already counted, closed to newcomers', () => {
  const p = promo({ customer_limit: 2 });
  const full = { p1: { mine: 0, customers: 2, counted: false } };
  assert.equal(priceCart({ lines: [line('food-a', 100, 1)], promotions: [p], redemptions: full }).limited[0].reason, 'customer_limit');
  const returning = { p1: { mine: 1, customers: 2, counted: true } };
  assert.equal(priceCart({ lines: [line('food-a', 100, 1)], promotions: [p], redemptions: returning }).discount_total, 5);
});

test('the Promotions to redeem are those that discounted something', () => {
  const other = promo({ id: 'p2', product_ids: ['gear-z'] });
  const r = priceCart({ lines: [line('food-a', 100, 1)], promotions: [promo(), other], redemptions: noRedemptions });
  assert.deepEqual(r.redeem, ['p1']);
});

test('the Free Shipping Threshold looks at the item total after discounts', () => {
  const rule = { tiers: [{ min_units: 1, max_units: null, fee: 50 }], free_threshold: 1000 };
  const p = promo({ applies_to_all: true, discount_tiers: [{ min_units: 1, type: 'percent', value: 10 }] });
  const r = priceCart({ lines: [line('x', 1000, 1)], shippingRule: rule, promotions: [p], redemptions: noRedemptions });
  assert.equal(r.item_total, 900);
  assert.equal(r.shipping_fee, 50);
});

test('the best combination wins, even when the single biggest Promotion is not part of it', () => {
  // Everything 10% at 3 units saves 30; 25% on a and 25% on b save 50 together
  const all = promo({ id: 'all', applies_to_all: true, discount_tiers: [{ min_units: 3, type: 'percent', value: 10 }] });
  const onA = promo({ id: 'onA', product_ids: ['a'], discount_tiers: [{ min_units: 1, type: 'percent', value: 25 }] });
  const onB = promo({ id: 'onB', product_ids: ['b'], discount_tiers: [{ min_units: 1, type: 'percent', value: 25 }] });
  const r = priceCart({ lines: [line('a', 100, 1), line('b', 100, 1), line('c', 100, 1)], promotions: [all, onA, onB], redemptions: noRedemptions });
  assert.deepEqual(r.lines.map((l) => [l.product_id, l.promotion_id]), [['a', 'onA'], ['b', 'onB'], ['c', null]]);
  assert.equal(r.discount_total, 50);
  assert.deepEqual([...r.redeem].sort(), ['onA', 'onB']);
});

test('per-Customer Redemptions are read from `redemptions`', () => {
  const p = promo({ per_customer_limit: 1 });
  const r = priceCart({ lines: [line('food-a', 100, 3)], promotions: [p], redemptions: { p1: { mine: 1, customers: 5, counted: true } } });
  assert.equal(r.discount_total, 0);
  assert.equal(r.limited[0].reason, 'per_customer');
});
