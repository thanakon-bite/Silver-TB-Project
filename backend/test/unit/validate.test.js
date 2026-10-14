const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../../src/lib/validate');

const PID = '0b4e7a0e-5b2b-4b8e-9a51-3f1f0f1b2c3d';

test('cartItems rejects negative, zero, fractional and huge quantities', () => {
  for (const quantity of [-1, 0, 1.5, 100, '2; drop table', null]) {
    assert.throws(() => v.cartItems([{ product_id: PID, quantity }]), /quantity/);
  }
});

test('cartItems never passes a client price through', () => {
  const [item] = v.cartItems([{ product_id: PID, quantity: 2, price: 1 }]);
  assert.deepEqual(item, { product_id: PID, quantity: 2 });
});

test('cartItems rejects bad ids and empty carts', () => {
  assert.throws(() => v.cartItems([]), /non-empty/);
  assert.throws(() => v.cartItems([{ product_id: 'abc', quantity: 1 }]), /product_id/);
  assert.throws(() => v.cartItems(new Array(51).fill({ product_id: PID, quantity: 1 })), /Too many/);
});

test('phone accepts Thai formats and normalises', () => {
  assert.equal(v.phone('081-234 5678'), '0812345678');
  assert.equal(v.phone('+66812345678'), '+66812345678');
  assert.throws(() => v.phone('12345'), /Thai phone/);
});

test('email trims, lower-cases and rejects non-addresses', () => {
  assert.equal(v.email('  Mali@Example.COM '), 'mali@example.com');
  assert.throws(() => v.email('mali@'), /email address/);
  assert.throws(() => v.email(''), /required/);
});

test('money allows 2 decimals only', () => {
  assert.equal(v.money('12.34', 'price'), 12.34);
  assert.equal(v.money(8500, 'price'), 8500);
  assert.throws(() => v.money(12.345, 'price'), /2 decimals/);
  assert.throws(() => v.money(-1, 'price'), /between/);
});

test('imageUrls requires https', () => {
  assert.deepEqual(v.imageUrls(['https://x.supabase.co/a.png']), ['https://x.supabase.co/a.png']);
  assert.throws(() => v.imageUrls(['http://x/a.png']), /https/);
  assert.throws(() => v.imageUrls(['javascript:alert(1)']), /https/);
});

test('likePattern escapes wildcards', () => {
  assert.equal(v.likePattern('50%_off'), '%50\\%\\_off%');
});

test('pagination clamps limit and page', () => {
  assert.deepEqual(v.pagination({ page: '-3', limit: '100000' }, { maxLimit: 100 }), { page: 1, limit: 100, from: 0, to: 99 });
});

test('productAttributes keeps known beetle fields and rejects the rest', () => {
  assert.deepEqual(v.productAttributes({ family: 'Stag', species: ' Dorcus titanus ', sex: 'trio', stage: 'L3', size_mm: '72.36' }), {
    family: 'Stag',
    species: 'Dorcus titanus',
    sex: 'trio',
    stage: 'L3',
    size_mm: 72.4,
  });
  assert.throws(() => v.productAttributes({ colour: 'red' }), /unknown keys/);
  assert.throws(() => v.productAttributes({ sex: 'yes' }), /must be one of/);
  assert.throws(() => v.productAttributes({ size_mm: -1 }), /size_mm/);
  assert.throws(() => v.productAttributes([]), /must be an object/);
});

test('gift choices keep only promotion → product pairs of ids', () => {
  const other = '1b4e7a0e-5b2b-4b8e-9a51-3f1f0f1b2c3d';
  assert.deepEqual(v.giftChoices({ [PID]: other, nope: other, [other]: 'x' }), { [PID]: other });
  assert.deepEqual(v.giftChoices(null), {});
  assert.deepEqual(v.giftChoices([PID]), {});
});

test('timestamp keeps an ISO time exactly (microseconds included) and refuses anything that could break a filter', () => {
  assert.equal(v.timestamp('2026-10-11T03:00:00.123456+00:00', 'before'), '2026-10-11T03:00:00.123456+00:00');
  assert.equal(v.timestamp('2026-10-11T03:00:00Z', 'before'), '2026-10-11T03:00:00Z');
  for (const bad of ['yesterday', '2026-10-11', '2026-13-40T99:00:00Z', '2026-10-11T03:00:00Z,id.gt.0', '2026-10-11T03:00:00Z)', 42]) {
    assert.throws(() => v.timestamp(bad, 'before'), /before/);
  }
});
