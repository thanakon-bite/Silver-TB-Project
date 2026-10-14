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
  assert.equal(r.promotion_option, 'stack');
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

test('an Exclusive Promotion is never combined; the Order gets whichever option saves more', () => {
  const stackSmall = [promo('a', [pct(5)], { stacking: 'stackable' }), promo('b', [pct(5)], { stacking: 'stackable' })];
  let r = priceCart({ lines: [line('jelly', 100, 1)], promotions: [promo('x', [pct(20)]), ...stackSmall] });
  assert.equal(r.promotion_option, 'x');
  assert.equal(r.lines[0].unit_price, 80);
  assert.deepEqual(r.redeem, ['x']);

  r = priceCart({ lines: [line('jelly', 100, 1)], promotions: [promo('x', [pct(8)]), ...stackSmall] });
  assert.equal(r.promotion_option, 'stack', '5% then 5% (9.75) beats 8%');
  assert.equal(r.lines[0].unit_price, 90.25);
});

test('the Cart lists every option of the Order with what it would save, and honours the Customer\'s pick', () => {
  const promotions = [promo('x', [pct(20)]), promo('a', [pct(5)], { stacking: 'stackable' }), promo('b', [pct(5)], { stacking: 'stackable' })];
  let r = priceCart({ lines: [line('jelly', 100, 1)], promotions });
  assert.deepEqual(
    r.promotion_options.map((o) => [o.key, o.kind, o.saving]),
    [['x', 'exclusive', 20], ['stack', 'stack', 9.75]]
  );
  assert.deepEqual(r.promotion_options[1].promotions.map((p) => p.id), ['a', 'b']);

  r = priceCart({ lines: [line('jelly', 100, 1)], promotions, promotionChoice: 'stack' });
  assert.equal(r.promotion_option, 'stack');
  assert.equal(r.lines[0].unit_price, 90.25);

  // A pick that is no longer on offer falls back to the best option
  r = priceCart({ lines: [line('jelly', 100, 1)], promotions, promotionChoice: 'gone' });
  assert.equal(r.promotion_option, 'x');
});

test('one option covers the whole Order: products the picked Promotion does not cover pay the normal price', () => {
  const onJelly = promo('jellyDeal', [pct(10)], { applies_to_all: false, product_ids: ['jelly'] });
  const onLog = promo('logDeal', [pct(50)], { applies_to_all: false, product_ids: ['log'] });
  // Best: 50% on the ฿300 log (150) over 10% on the ฿100 jelly (10); the jelly pays full price
  let r = priceCart({ lines: [line('jelly', 100, 1), line('log', 300, 1)], promotions: [onJelly, onLog] });
  assert.equal(r.promotion_option, 'logDeal');
  assert.deepEqual(r.lines.map((l) => [l.product_id, l.unit_price, l.promotion_id]), [['jelly', 100, null], ['log', 150, 'logDeal']]);
  assert.deepEqual(r.redeem, ['logDeal'], 'only the picked Promotion is redeemed');

  r = priceCart({ lines: [line('jelly', 100, 1), line('log', 300, 1)], promotions: [onJelly, onLog], promotionChoice: 'jellyDeal' });
  assert.deepEqual(r.lines.map((l) => [l.product_id, l.unit_price]), [['jelly', 90], ['log', 300]]);
  assert.deepEqual(r.redeem, ['jellyDeal']);
});

test('the "buy N more" hints are only for the Promotions of the option in use', () => {
  const tenFor10 = promo('bulk', [pct(5, 10)]);
  const gift3 = promo('gift', [], { gift_every: 3, gift_quantity: 1, gift_product_ids: ['spoon'] });
  const giftProducts = { spoon: { name: 'Spoon', price: 10, available: 5 } };
  let r = priceCart({ lines: [line('jelly', 100, 2)], promotions: [tenFor10, gift3], giftProducts, promotionChoice: 'gift' });
  assert.deepEqual(r.next_tiers, []);
  assert.deepEqual(r.next_gifts.map((h) => [h.promotion_id, h.units_needed]), [['gift', 1]]);

  r = priceCart({ lines: [line('jelly', 100, 2)], promotions: [tenFor10, gift3], giftProducts, promotionChoice: 'bulk' });
  assert.deepEqual(r.next_tiers.map((h) => [h.promotion_id, h.units_needed]), [['bulk', 8]]);
  assert.deepEqual(r.next_gifts, []);
});

test('with no Promotion to use, the Order has no option', () => {
  const r = priceCart({ lines: [line('jelly', 100, 1)], promotions: [] });
  assert.equal(r.promotion_option, null);
  assert.deepEqual(r.promotion_options, []);
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
