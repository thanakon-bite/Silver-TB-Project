/**
 * How an order leaves the API: customers never see the admin-only fields, and a single order carries
 * what the viewer may do with it (orderActions), so screens never re-derive the status rules.
 */
const { orderActions } = require('./orderStatus');

const ADMIN_ONLY_FIELDS = ['admin_note', 'needs_attention', 'admin_notified_at', 'client_request_id'];

function withoutAdminFields(order) {
  const rest = { ...order };
  for (const field of ADMIN_ONLY_FIELDS) delete rest[field];
  return rest;
}

/** One order as the signed-in viewer may see it. */
function orderForViewer(order, user) {
  const admin = user.role === 'admin';
  const shown = admin ? { ...order } : withoutAdminFields(order);
  return { ...shown, actions: orderActions(order, { owner: order.user_id === user.id, admin }) };
}

/** A customer's own order history (no actions: lists only link to the order). */
const ordersForCustomer = (list) => list.map(withoutAdminFields);

module.exports = { orderForViewer, ordersForCustomer };
