const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePromotion, editablePromotionFields, bangkokRange } = require('../../src/lib/promotions');

const input = (over = {}) => ({
  name_th: 'ลดรับหน้าฝน',
  name_en: '',
  start_date: '2026-11-01',
  end_date: '2026-11-30',
  applies_to_all: false,
  product_ids: ['11111111-1111-1111-1111-111111111111'],
  discount_tiers: [
    { min_units: 3, type: 'percent', value: 10 },
    { min_units: 1, type: 'percent', value: 5 },
  ],
  per_customer_limit: '',
  customer_limit: 50,
  is_active: true,
  ...over,
});

test('dates are Thai time and both days are included', () => {
  assert.deepEqual(bangkokRange('2026-11-01', '2026-11-30'), {
    starts_at: '2026-10-31T17:00:00.000Z',
    ends_at: '2026-11-30T16:59:59.999Z',
  });
});

test('a valid Promotion is normalised: tiers sorted, empty limits mean unlimited, empty English name is null', () => {
  const r = validatePromotion(input());
  assert.equal(r.ok, true);
  assert.deepEqual(r.promotion, {
    name_th: 'ลดรับหน้าฝน',
    name_en: null,
    starts_at: '2026-10-31T17:00:00.000Z',
    ends_at: '2026-11-30T16:59:59.999Z',
    applies_to_all: false,
    product_ids: ['11111111-1111-1111-1111-111111111111'],
    discount_tiers: [
      { min_units: 1, type: 'percent', value: 5 },
      { min_units: 3, type: 'percent', value: 10 },
    ],
    gift_every: null,
    gift_quantity: null,
    gift_product_ids: [],
    per_customer_limit: null,
    customer_limit: 50,
    is_active: true,
  });
});

test('what a Promotion needs', () => {
  const bad = (over) => validatePromotion(input(over)).reason;
  assert.match(bad({ name_th: '' }), /Thai name/);
  assert.match(bad({ end_date: '2026-10-01' }), /end/);
  assert.match(bad({ start_date: '2026-13-01' }), /date/);
  assert.match(bad({ product_ids: [] }), /product/);
  assert.match(bad({ discount_tiers: [] }), /discount or a gift/);
  assert.match(bad({ discount_tiers: [{ min_units: 1, type: 'percent', value: 120 }] }), /percent/);
  assert.match(bad({ discount_tiers: [{ min_units: 1, type: 'baht', value: 0 }] }), /baht/);
  assert.match(bad({ discount_tiers: [{ min_units: 2, type: 'percent', value: 5 }, { min_units: 2, type: 'percent', value: 9 }] }), /same number of units/);
  assert.match(bad({ per_customer_limit: 0 }), /limit/);
  assert.equal(validatePromotion(input({ applies_to_all: true, product_ids: [] })).ok, true, 'all products needs no list');
});

test('once a Promotion has started only its names, end date and on/off can change', () => {
  const started = { starts_at: '2026-10-01T00:00:00Z' };
  const notYet = { starts_at: '2026-12-01T00:00:00Z' };
  const now = new Date('2026-10-15T00:00:00Z');
  assert.deepEqual(editablePromotionFields(started, now), ['name_th', 'name_en', 'ends_at', 'is_active']);
  assert.equal(editablePromotionFields(notYet, now), null, 'everything is editable before the start');
});
