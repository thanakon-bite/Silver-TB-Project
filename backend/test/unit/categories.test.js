const test = require('node:test');
const assert = require('node:assert/strict');
const { slugFor, validateCategory, validateFamilyName } = require('../../src/lib/categories');

test('a Category slug comes from its English name, and a taken one gets a number', () => {
  assert.equal(slugFor('Breeding Kits & Tools'), 'breeding-kits-tools');
  assert.equal(slugFor('  Food  ', ['food']), 'food-2');
  assert.equal(slugFor('Food', ['food', 'food-2']), 'food-3');
  assert.equal(slugFor('ด้วง'), 'category', 'no Latin letters: a placeholder slug');
  assert.ok(slugFor('x'.repeat(80)).length <= 36);
});

test('a Category needs a Thai and an English name; a rename may change either', () => {
  assert.deepEqual(validateCategory({ name_th: ' หนังสือ ', name_en: 'Books' }), { ok: true, category: { name_th: 'หนังสือ', name_en: 'Books' } });
  assert.equal(validateCategory({ name_th: '', name_en: 'Books' }).ok, false);
  assert.equal(validateCategory({ name_th: 'x'.repeat(61), name_en: 'Books' }).ok, false);
  assert.deepEqual(validateCategory({ name_en: 'Books' }, { partial: true }), { ok: true, category: { name_en: 'Books' } });
  assert.equal(validateCategory({ sort_order: -1 }, { partial: true }).ok, false);
});

test('a Family needs a name', () => {
  assert.deepEqual(validateFamilyName(' Stag '), { ok: true, name: 'Stag' });
  assert.equal(validateFamilyName('').ok, false);
  assert.equal(validateFamilyName(null).ok, false);
});
