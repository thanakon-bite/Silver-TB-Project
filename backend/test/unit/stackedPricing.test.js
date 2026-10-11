// Stackable / Exclusive Promotions (CONTEXT.md; ADR 0004), through the pricing module's one entry point.
const test = require('node:test');
const assert = require('node:assert/strict');
const { priceCart, redeemablePromotions } = require('../../src/lib/pricing');

const line = (product_id, unit_price, quantity) => ({ product_id, name: product_id, unit_price, quantity });
const promo = (id, tiers, over = {}) => ({
  id,
  name_th: id,
  name_en: null,
  applies_to_all: true,
  product_ids: [],
  discount_tiers: tiers,
  per_customer_limit: null,
  customer_limit: null,
  stacking: 'exclusive',
  ...over,
});
const pct = (value, min_units = 1) => ({ min_units, type: 'percent', value });
const baht = (value, min_units = 1) => ({ min_units, type: 'baht', value });

test('Stackable Promotions combine: percentages compound on the reduced price, then baht come off', () => {
  const r = priceCart({
    lines: [line('jelly', 100, 1)],
    promotions: [promo('a', [pct(10)], { stacking: 'stackable' }), promo('b', [pct(5)], { stacking: 'stackable' }), promo('c', [baht(20)], { stacking: 'stackable' })],
  });
  // 100 → −10% = 90 → −5% = 85.5 → −฿20 = 65.5
  assert.equal(r.lines[0].unit_price, 65.5);
  assert.equal(r.lines[0].option, 'stack');
  assert.deepEqual(r.lines[0].promotion_ids, ['a', 'b', 'c']);
  assert.deepEqual([...r.redeem].sort(), ['a', 'b', 'c'], 'one Redemption per Promotion used');
  assert.deepEqual(
    r.promotions_applied.map((p) => [p.id, p.discount_total]),
    [['a', 10], ['b', 4.5], ['c', 20]]
  );
});

test('a stack never takes a unit below zero', () => {
  const r = priceCart({
    lines: [line('jelly', 30, 2)],
    promotions: [promo('a', [baht(20)], { stacking: 'stackable' }), promo('b', [baht(25)], { stacking: 'stackable' })],
  });
  assert.equal(r.lines[0].unit_price, 0);
  assert.equal(r.discount_total, 60);
});

test('an Exclusive Promotion is never combined; the line gets whichever option saves more', () => {
  const stackSmall = [promo('a', [pct(5)], { stacking: 'stackable' }), promo('b', [pct(5)], { stacking: 'stackable' })];
  let r = priceCart({ lines: [line('jelly', 100, 1)], promotions: [promo('x', [pct(20)]), ...stackSmall] });
  assert.equal(r.lines[0].option, 'x');
  assert.equal(r.lines[0].unit_price, 80);
  assert.deepEqual(r.redeem, ['x']);

  r = priceCart({ lines: [line('jelly', 100, 1)], promotions: [promo('x', [pct(8)]), ...stackSmall] });
  assert.equal(r.lines[0].option, 'stack', '5% then 5% (9.75) beats 8%');
  assert.equal(r.lines[0].unit_price, 90.25);
});

test('the Cart lists every option of a line with what it would save, and honours the Customer\'s pick', () => {
  const promotions = [promo('x', [pct(20)]), promo('a', [pct(5)], { stacking: 'stackable' }), promo('b', [pct(5)], { stacking: 'stackable' })];
  let r = priceCart({ lines: [line('jelly', 100, 1)], promotions });
  assert.deepEqual(
    r.lines[0].options.map((o) => [o.key, o.saving]),
    [['x', 20], ['stack', 9.75]]
  );
  assert.deepEqual(r.lines[0].options[1].promotions.map((p) => p.id), ['a', 'b']);

  r = priceCart({ lines: [line('jelly', 100, 1)], promotions, promotionChoices: { jelly: 'stack' } });
  assert.equal(r.lines[0].option, 'stack');
  assert.equal(r.lines[0].unit_price, 90.25);

  // A pick that is no longer on offer falls back to the best option
  r = priceCart({ lines: [line('jelly', 100, 1)], promotions, promotionChoices: { jelly: 'gone' } });
  assert.equal(r.lines[0].option, 'x');
});

test('a line with a single Promotion option gets no radio list', () => {
  const r = priceCart({ lines: [line('jelly', 100, 1)], promotions: [promo('x', [pct(20)])] });
  assert.deepEqual(r.lines[0].options, []);
});

test('a used-up Promotion drops out of the stack; the others still apply', () => {
  const r = priceCart({
    lines: [line('jelly', 100, 1)],
    promotions: [promo('a', [pct(10)], { stacking: 'stackable', per_customer_limit: 1 }), promo('b', [pct(5)], { stacking: 'stackable' })],
    redemptions: { a: { mine: 1, customers: 1, counted: true } },
  });
  assert.equal(r.lines[0].unit_price, 95);
  assert.deepEqual(r.redeem, ['b']);
  assert.deepEqual(r.limited.map((l) => [l.promotion_id, l.reason]), [['a', 'per_customer']]);
});

test('every Gift of a stack is earned', () => {
  const gift = (id) => promo(id, [], { stacking: 'stackable', gift_every: 1, gift_quantity: 1, gift_product_ids: [`${id}-gift`] });
  const giftProducts = { 'g1-gift': { name: 'Spoon', price: 10, available: 5 }, 'g2-gift': { name: 'Sticker', price: 5, available: 5 } };
  const r = priceCart({ lines: [line('jelly', 100, 1)], promotions: [gift('g1'), gift('g2')], giftProducts });
  assert.deepEqual(r.gifts.map((g) => [g.promotion_id, g.product_id, g.quantity]), [['g1', 'g1-gift', 1], ['g2', 'g2-gift', 1]]);
  assert.deepEqual([...r.redeem].sort(), ['g1', 'g2']);
});

test('shoppers are shown only the Promotions they can still redeem', () => {
  const mine = promo('mine', [pct(5)], { per_customer_limit: 1 });
  const full = promo('full', [pct(5)], { customer_limit: 2 });
  const open = promo('open', [pct(5)]);
  const standing = { mine: { mine: 1, customers: 1, counted: true }, full: { mine: 0, customers: 2, counted: false } };
  assert.deepEqual(redeemablePromotions([mine, full, open], standing).map((p) => p.id), ['open']);
  // One of the full Promotion's Customers keeps seeing it while under their own limit
  assert.deepEqual(
    redeemablePromotions([full], { full: { mine: 1, customers: 2, counted: true } }).map((p) => p.id),
    ['full']
  );
  assert.deepEqual(redeemablePromotions([mine, full, open], {}).map((p) => p.id), ['mine', 'full', 'open'], 'no standing: all shown');
});
