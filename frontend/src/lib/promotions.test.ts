import { bestPromotion, type ActivePromotion } from './promotions';

const promo = (id: string, over: Partial<ActivePromotion> = {}): ActivePromotion => ({
  id,
  name_th: id,
  name_en: null,
  ends_at: '2026-11-30T16:59:59.999Z',
  applies_to_all: true,
  product_ids: [],
  discount_tiers: [],
  gift_every: null,
  gift_quantity: null,
  stacking: 'exclusive',
  gift_prices: [],
  ...over,
});

const beetle = { id: 'b1', price: 1000 };

test('no Promotion covers the product: no Best Promotion', () => {
  expect(bestPromotion(beetle, [])).toBeNull();
  expect(bestPromotion(beetle, [promo('other', { applies_to_all: false, product_ids: ['x'] })])).toBeNull();
});

test('worth most when buying one unit wins, whatever the list order', () => {
  const fivePercent = promo('5%', { discount_tiers: [{ min_units: 1, type: 'percent', value: 5 }] });
  const eightyBaht = promo('฿80', { discount_tiers: [{ min_units: 1, type: 'baht', value: 80 }] });
  expect(bestPromotion(beetle, [fivePercent, eightyBaht])?.id).toBe('฿80');
  // At ฿1,000, 10% (฿100) beats ฿80
  const tenPercent = promo('10%', { discount_tiers: [{ min_units: 1, type: 'percent', value: 10 }] });
  expect(bestPromotion(beetle, [eightyBaht, tenPercent])?.id).toBe('10%');
});

test('a big discount that needs more units loses to a small one that applies to one unit', () => {
  const bulk = promo('bulk', { discount_tiers: [{ min_units: 3, type: 'percent', value: 50 }] });
  const small = promo('small', { discount_tiers: [{ min_units: 1, type: 'percent', value: 2 }] });
  expect(bestPromotion(beetle, [bulk, small])?.id).toBe('small');
});

test('when none gives anything for one unit, each is compared at its own lowest tier', () => {
  const buy3 = promo('buy3', { discount_tiers: [{ min_units: 3, type: 'percent', value: 10 }, { min_units: 5, type: 'percent', value: 30 }] });
  const buy2 = promo('buy2', { discount_tiers: [{ min_units: 2, type: 'baht', value: 150 }] });
  // buy3's lowest tier is 10% = ฿100 a unit; buy2's is ฿150 a unit
  expect(bestPromotion(beetle, [buy3, buy2])?.id).toBe('buy2');
});

test('a Gift is valued at its cheapest gift price shared over the units it takes', () => {
  // Buy 2 get 1 of a ฿300 or ฿500 gift: worth ฿300 × 1 / 2 = ฿150 a unit
  const gift = promo('gift', { gift_every: 2, gift_quantity: 1, gift_prices: [500, 300] });
  const buy2 = promo('buy2', { discount_tiers: [{ min_units: 2, type: 'percent', value: 10 }] }); // ฿100 a unit
  expect(bestPromotion(beetle, [buy2, gift])?.id).toBe('gift');
  const buy2more = promo('buy2more', { discount_tiers: [{ min_units: 2, type: 'percent', value: 20 }] }); // ฿200 a unit
  expect(bestPromotion(beetle, [gift, buy2more])?.id).toBe('buy2more');
});

test('a Gift earned on one unit competes with one-unit Discounts', () => {
  const giftEach = promo('giftEach', { gift_every: 1, gift_quantity: 1, gift_prices: [120] });
  const tenBaht = promo('฿10', { discount_tiers: [{ min_units: 1, type: 'baht', value: 10 }] });
  expect(bestPromotion(beetle, [tenBaht, giftEach])?.id).toBe('giftEach');
});

test('a baht Discount is worth no more than the price', () => {
  const cheap = { id: 'c1', price: 50 };
  const hugeBaht = promo('฿500', { discount_tiers: [{ min_units: 1, type: 'baht', value: 500 }] });
  const sixtyPercent = promo('60%', { discount_tiers: [{ min_units: 1, type: 'percent', value: 60 }] });
  // ฿500 off a ฿50 product is worth ฿50; 60% is ฿30
  expect(bestPromotion(cheap, [sixtyPercent, hugeBaht])?.id).toBe('฿500');
});

test('equal worth keeps the list order; a Promotion worth nothing known still shows when it is the only one', () => {
  const a = promo('a', { discount_tiers: [{ min_units: 1, type: 'percent', value: 10 }] });
  const b = promo('b', { discount_tiers: [{ min_units: 1, type: 'baht', value: 100 }] });
  expect(bestPromotion(beetle, [a, b])?.id).toBe('a');
  const unpriced = promo('unpriced', { gift_every: 2, gift_quantity: 1, gift_prices: [] });
  expect(bestPromotion(beetle, [unpriced])?.id).toBe('unpriced');
});

test('only Promotions covering the product compete', () => {
  const elsewhere = promo('elsewhere', { applies_to_all: false, product_ids: ['x'], discount_tiers: [{ min_units: 1, type: 'percent', value: 90 }] });
  const here = promo('here', { applies_to_all: false, product_ids: ['b1'], discount_tiers: [{ min_units: 1, type: 'percent', value: 1 }] });
  expect(bestPromotion(beetle, [elsewhere, here])?.id).toBe('here');
});
