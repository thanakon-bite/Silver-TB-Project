const test = require('node:test');
const assert = require('node:assert/strict');
const { checkAdminTransition, isPayable } = require('../../src/lib/orderStatus');

const order = (status, payment_status) => ({ status, payment_status });

test('admins cannot mark orders paid/confirmed by hand', () => {
  assert.equal(checkAdminTransition(order('pending', 'unpaid'), 'confirmed').ok, false);
});

test('only paid orders can ship', () => {
  assert.equal(checkAdminTransition(order('confirmed', 'paid'), 'shipped').ok, true);
  assert.equal(checkAdminTransition(order('pending', 'unpaid'), 'shipped').ok, false);
});

test('paid orders must be refunded, not cancelled', () => {
  const r = checkAdminTransition(order('confirmed', 'paid'), 'cancelled');
  assert.equal(r.ok, false);
  assert.match(r.reason, /refund/i);
});

test('no going backwards', () => {
  assert.equal(checkAdminTransition(order('delivered', 'paid'), 'shipped').ok, false);
  assert.equal(checkAdminTransition(order('shipped', 'paid'), 'delivered').ok, true);
  assert.equal(checkAdminTransition(order('cancelled', 'unpaid'), 'pending').ok, false);
});

test('isPayable respects expiry and status', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  assert.equal(isPayable({ status: 'pending', payment_status: 'unpaid', expires_at: '2026-01-01T00:10:00Z' }, now), true);
  assert.equal(isPayable({ status: 'pending', payment_status: 'failed', expires_at: '2026-01-01T00:10:00Z' }, now), true);
  assert.equal(isPayable({ status: 'pending', payment_status: 'unpaid', expires_at: '2025-12-31T23:59:00Z' }, now), false);
  assert.equal(isPayable({ status: 'cancelled', payment_status: 'unpaid', expires_at: null }, now), false);
});
