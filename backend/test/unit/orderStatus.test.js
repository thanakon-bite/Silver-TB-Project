const test = require('node:test');
const assert = require('node:assert/strict');
const { checkAdminTransition, checkCustomerCancel, checkCustomerConfirm, isPayable, orderActions, checkRefund } = require('../../src/lib/orderStatus');

const order = (status, extra = {}) => ({ status, ...extra });

test('admins cannot mark orders paid by hand', () => {
  assert.equal(checkAdminTransition(order('awaiting_payment'), 'paid').ok, false);
  assert.equal(checkAdminTransition(order('awaiting_payment'), 'waiting_shipping').ok, false);
});

test('only Waiting Shipping orders can ship', () => {
  assert.equal(checkAdminTransition(order('waiting_shipping'), 'shipping').ok, true);
  assert.equal(checkAdminTransition(order('awaiting_payment'), 'shipping').ok, false);
  assert.equal(checkAdminTransition(order('paid'), 'shipping').ok, false);
});

test('an admin cancels before Shipping; a paid order is refunded as part of it', () => {
  assert.deepEqual(checkAdminTransition(order('awaiting_payment'), 'cancelled'), { ok: true, refund: false });
  for (const s of ['paid', 'waiting_shipping']) {
    assert.deepEqual(checkAdminTransition(order(s), 'cancelled'), { ok: true, refund: true }, s);
  }
});

test('no going backwards or out of a final status', () => {
  assert.equal(checkAdminTransition(order('shipping'), 'waiting_shipping').ok, false);
  assert.equal(checkAdminTransition(order('confirmed'), 'shipping').ok, false);
  assert.equal(checkAdminTransition(order('cancelled'), 'awaiting_payment').ok, false);
  assert.equal(checkAdminTransition(order('shipping'), 'cancelled').ok, false);
});

test('old status names are rejected', () => {
  for (const s of ['pending', 'shipped', 'delivered']) {
    assert.equal(checkAdminTransition(order('waiting_shipping'), s).ok, false, s);
  }
});

test('isPayable respects expiry and status', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  assert.equal(isPayable({ status: 'awaiting_payment', expires_at: '2026-01-01T00:10:00Z' }, now), true);
  assert.equal(isPayable({ status: 'awaiting_payment', expires_at: '2025-12-31T23:59:00Z' }, now), false);
  assert.equal(isPayable({ status: 'waiting_shipping', expires_at: null }, now), false);
  assert.equal(isPayable({ status: 'cancelled', expires_at: null }, now), false);
});

test('customers can cancel only Awaiting Payment orders', () => {
  assert.equal(checkCustomerCancel(order('awaiting_payment')).ok, true);
  for (const s of ['paid', 'waiting_shipping', 'shipping', 'confirmed', 'cancelled']) {
    const r = checkCustomerCancel(order(s));
    assert.equal(r.ok, false, s);
    assert.equal(r.code, 'ORDER_NOT_CANCELLABLE');
  }
});

test('an admin can confirm a Shipping order, nothing else', () => {
  assert.equal(checkAdminTransition(order('shipping'), 'confirmed').ok, true);
  for (const s of ['awaiting_payment', 'waiting_shipping', 'cancelled']) {
    assert.equal(checkAdminTransition(order(s), 'confirmed').ok, false, s);
  }
});

test('customers can confirm receipt only of their Shipping orders', () => {
  assert.equal(checkCustomerConfirm(order('shipping')).ok, true);
  for (const s of ['awaiting_payment', 'paid', 'waiting_shipping', 'confirmed', 'cancelled']) {
    const r = checkCustomerConfirm(order(s));
    assert.equal(r.ok, false, s);
    assert.equal(r.code, 'ORDER_NOT_CONFIRMABLE');
  }
});

test('an order already refunded (e.g. in the Stripe Dashboard) is cancelled without a second refund', () => {
  assert.deepEqual(checkAdminTransition(order('waiting_shipping', { refunded_at: '2026-10-11T00:00:00Z' }), 'cancelled'), { ok: true, refund: false });
});

test('a typed Cancel Reason may not be one of the system codes the UI translates', () => {
  const { checkCancelReason } = require('../../src/lib/orderStatus');
  for (const code of ['payment_timeout', 'customer_cancelled', 'replaced_by_new_checkout', ' Payment_Timeout ']) {
    assert.equal(checkCancelReason(code).ok, false, code);
  }
  assert.deepEqual(checkCancelReason('สินค้าหมด'), { ok: true });
  assert.deepEqual(checkCancelReason('payment timeout, customer asked'), { ok: true });
});

test('orderActions tells each viewer what they may do, from the same rules the routes enforce', () => {
  const owner = { owner: true, admin: false };
  const admin = { owner: false, admin: true };
  assert.deepEqual(orderActions(order('awaiting_payment'), owner), { customer: { cancel: true, confirm: false }, admin: null });
  assert.deepEqual(orderActions(order('shipping'), owner), { customer: { cancel: false, confirm: true }, admin: null });
  assert.deepEqual(orderActions(order('awaiting_payment'), admin).admin, { ship: false, confirm: false, cancel: true, refund_on_cancel: false });
  assert.deepEqual(orderActions(order('waiting_shipping'), admin).admin, { ship: true, confirm: false, cancel: true, refund_on_cancel: true });
  assert.deepEqual(orderActions(order('waiting_shipping', { refunded_at: '2026-10-11T00:00:00Z' }), admin).admin.refund_on_cancel, false);
  assert.deepEqual(orderActions(order('shipping'), admin).admin, { ship: false, confirm: true, cancel: false, refund_on_cancel: false });
  assert.equal(orderActions(order('shipping'), admin).customer, null);
  assert.deepEqual(orderActions(order('confirmed'), { owner: true, admin: true }), {
    customer: { cancel: false, confirm: false },
    admin: { ship: false, confirm: false, cancel: false, refund_on_cancel: false },
  });
});

test('an order is cancelled as refunded only once Stripe says the refund succeeded', () => {
  assert.deepEqual(checkRefund({ status: 'succeeded' }), { ok: true });
  for (const status of ['pending', 'requires_action']) {
    assert.equal(checkRefund({ status }).ok, false);
    assert.equal(checkRefund({ status }).code, 'REFUND_PENDING');
  }
  for (const status of ['failed', 'canceled', undefined]) {
    assert.equal(checkRefund({ status }).ok, false);
    assert.equal(checkRefund({ status }).code, 'REFUND_FAILED');
  }
});

test('the Admin countdown: Reservation end while Awaiting Payment, automatic Confirmed 7 days after Shipping', () => {
  const { orderDeadline } = require('../../src/lib/orderStatus');
  assert.deepEqual(orderDeadline(order('awaiting_payment', { expires_at: '2026-10-11T03:30:00.000Z' })), { kind: 'payment', at: '2026-10-11T03:30:00.000Z' });
  assert.deepEqual(orderDeadline(order('shipping', { shipped_at: '2026-10-01T00:00:00.000Z' })), { kind: 'auto_confirm', at: '2026-10-08T00:00:00.000Z' });
  for (const s of ['paid', 'waiting_shipping', 'confirmed', 'cancelled']) assert.equal(orderDeadline(order(s, { expires_at: '2026-10-11T03:30:00.000Z' })), null, s);
});
