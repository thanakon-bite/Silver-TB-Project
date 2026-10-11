const test = require('node:test');
const assert = require('node:assert/strict');
const { fromDbError, conflict } = require('../../src/lib/http');

test('setting On Hand below what is Reserved says the minimum, for the client to word', () => {
  const err = fromDbError({ message: 'BELOW_RESERVED', details: '3' });
  assert.equal(err.status, 409);
  assert.equal(err.code, 'BELOW_RESERVED');
  assert.deepEqual(err.params, { reserved: 3 });
  assert.match(err.message, /3 unit\(s\) reserved/);
});

test('a database error without numbers to word carries no params', () => {
  const err = fromDbError({ message: 'SYSTEM_CATEGORY' });
  assert.equal(err.status, 409);
  assert.equal(err.params, undefined);
});

test('a conflict can carry the count the client shows, e.g. products still in a Category', () => {
  const err = conflict('2 product(s) are still in this Category', 'CATEGORY_IN_USE', { count: 2 });
  assert.equal(err.status, 409);
  assert.deepEqual(err.params, { count: 2 });
  assert.equal(conflict('x', 'Y').params, undefined);
});
