const test = require('node:test');
const assert = require('node:assert/strict');
const { orderForViewer, ordersForCustomer } = require('../../src/lib/orderView');

const order = () => ({
  id: 'o1', user_id: 'u1', status: 'awaiting_payment', total: 100,
  admin_note: 'call the courier', needs_attention: true, admin_notified_at: '2026-10-11T00:00:00Z', received_notified_at: '2026-10-11T00:00:00Z', client_request_id: 'r1',
});
const ADMIN_ONLY = ['admin_note', 'needs_attention', 'admin_notified_at', 'received_notified_at', 'client_request_id'];

test('a customer never sees admin-only fields and gets what they may do', () => {
  const seen = orderForViewer(order(), { id: 'u1', role: 'user' });
  for (const k of ADMIN_ONLY) assert.equal(k in seen, false, k);
  assert.deepEqual(seen.actions, { customer: { cancel: true, confirm: false }, admin: null });
});

test('an admin sees the admin fields and the admin actions', () => {
  const seen = orderForViewer(order(), { id: 'a1', role: 'admin' });
  for (const k of ADMIN_ONLY) assert.equal(k in seen, true, k);
  assert.equal(seen.actions.customer, null);
  assert.equal(seen.actions.admin.cancel, true);
});

test("a customer's order history hides the admin fields too", () => {
  const [seen] = ordersForCustomer([order()]);
  for (const k of ADMIN_ONLY) assert.equal(k in seen, false, k);
  assert.equal(seen.total, 100);
});
