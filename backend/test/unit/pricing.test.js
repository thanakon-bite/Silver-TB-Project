const test = require('node:test');
const assert = require('node:assert/strict');
const { priceCart, validateShippingRule, checkPayableTotal } = require('../../src/lib/pricing');

// The example from the shop owner: 1 unit 10 baht, 2–5 units 50 baht, 6+ 80 baht
const rule = {
  tiers: [
    { min_units: 1, max_units: 1, fee: 10 },
    { min_units: 2, max_units: 5, fee: 50 },
    { min_units: 6, max_units: null, fee: 80 },
  ],
  free_threshold: null,
};
const line = (product_id, unit_price, quantity) => ({ product_id, name: product_id, unit_price, quantity });

test('the Shipping Fee comes from the tier the paid units fall in', () => {
  assert.equal(priceCart({ lines: [line('a', 100, 1)], shippingRule: rule }).shipping_fee, 10);
  assert.equal(priceCart({ lines: [line('a', 100, 2), line('b', 50, 3)], shippingRule: rule }).shipping_fee, 50);
  assert.equal(priceCart({ lines: [line('a', 100, 6)], shippingRule: rule }).shipping_fee, 80);
  assert.equal(priceCart({ lines: [line('a', 100, 40)], shippingRule: rule }).shipping_fee, 80, 'the last tier is open-ended');
});

test('totals: item total plus Shipping Fee, in baht with satang precision', () => {
  const r = priceCart({ lines: [line('a', 199.5, 2), line('b', 0.25, 1)], shippingRule: rule });
  assert.equal(r.items_subtotal, 399.25);
  assert.equal(r.discount_total, 0);
  assert.equal(r.item_total, 399.25);
  assert.equal(r.paid_units, 3);
  assert.equal(r.total, 449.25);
  assert.deepEqual(r.lines.map((l) => [l.product_id, l.unit_price, l.line_total]), [['a', 199.5, 399], ['b', 0.25, 0.25]]);
});

test('a Free Shipping Threshold makes the fee zero at or above the item total', () => {
  const free = { ...rule, free_threshold: 1000 };
  assert.equal(priceCart({ lines: [line('a', 999, 1)], shippingRule: free }).shipping_fee, 10);
  assert.equal(priceCart({ lines: [line('a', 1000, 1)], shippingRule: free }).shipping_fee, 0);
});

test('with no tiers set up the flat fallback fee applies', () => {
  assert.equal(priceCart({ lines: [line('a', 100, 3)], shippingRule: { tiers: [], free_threshold: null }, fallbackFee: 45 }).shipping_fee, 45);
  assert.equal(priceCart({ lines: [line('a', 100, 3)], shippingRule: null }).shipping_fee, 0);
});

test('a valid Shipping Rule runs from 1 unit with no gaps or overlaps and ends open', () => {
  assert.deepEqual(validateShippingRule(rule), { ok: true, rule });
  const bad = (tiers, free_threshold = null) => validateShippingRule({ tiers, free_threshold });
  assert.match(bad([{ min_units: 2, max_units: null, fee: 10 }]).reason, /start at 1/);
  assert.match(bad([{ min_units: 1, max_units: 1, fee: 10 }, { min_units: 3, max_units: null, fee: 20 }]).reason, /gap/);
  assert.match(bad([{ min_units: 1, max_units: 3, fee: 10 }, { min_units: 2, max_units: null, fee: 20 }]).reason, /overlap/);
  assert.match(bad([{ min_units: 1, max_units: 3, fee: 10 }]).reason, /last tier/);
  assert.match(bad([{ min_units: 1, max_units: null, fee: 10 }, { min_units: 5, max_units: null, fee: 20 }]).reason, /last tier/);
  assert.match(bad([{ min_units: 1, max_units: null, fee: -1 }]).reason, /fee/);
  assert.match(bad([{ min_units: 1, max_units: 0, fee: 1 }, { min_units: 1, max_units: null, fee: 1 }]).reason, /max/);
  assert.match(bad([{ min_units: 1, max_units: null, fee: 10 }], -5).reason, /threshold/);
  assert.equal(bad([]).ok, true, 'an empty rule falls back to the flat fee');
});

test('tiers given out of order are sorted before checking', () => {
  const r = validateShippingRule({ tiers: [rule.tiers[2], rule.tiers[0], rule.tiers[1]], free_threshold: null });
  assert.equal(r.ok, true);
  assert.deepEqual(r.rule.tiers.map((t) => t.min_units), [1, 2, 6]);
});

test('an order total Stripe cannot charge (under ฿10 in THB) is refused before the order is made', () => {
  assert.deepEqual(checkPayableTotal(10), { ok: true });
  assert.deepEqual(checkPayableTotal(4275), { ok: true });
  for (const total of [9, 9.99, 0]) {
    const check = checkPayableTotal(total);
    assert.equal(check.ok, false);
    assert.equal(check.code, 'BELOW_MINIMUM_TOTAL');
  }
});
