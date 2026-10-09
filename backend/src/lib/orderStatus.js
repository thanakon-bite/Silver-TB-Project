/**
 * Order fulfilment rules.
 *
 *   pending ──(Stripe webhook)──▶ paid ──▶ shipped ──▶ delivered (optional)
 *      │                                    │
 *      └──▶ cancelled (stock released)      └──▶ cancelled (only via refund)
 *
 * "paid" is set ONLY by the verified Stripe webhook / reconciliation, never by a person.
 */

const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['unpaid', 'paid', 'failed', 'refunded'];

// Transitions an admin may trigger manually through PATCH /orders/:id/status
const ADMIN_TRANSITIONS = {
  pending: ['cancelled'],
  paid: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/**
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function checkAdminTransition(order, next) {
  if (!ORDER_STATUSES.includes(next)) return { ok: false, reason: `Unknown status "${next}"` };
  if (order.status === next) return { ok: false, reason: `Order is already ${next}` };
  if (next === 'paid') {
    return { ok: false, reason: 'Orders become paid automatically when Stripe confirms the payment' };
  }
  if (order.status === 'paid' && next === 'cancelled') {
    return { ok: false, reason: 'Paid orders must be refunded (use Refund), not just cancelled' };
  }
  const allowed = ADMIN_TRANSITIONS[order.status] || [];
  if (!allowed.includes(next)) {
    return { ok: false, reason: `Cannot change status from ${order.status} to ${next}` };
  }
  if ((next === 'shipped' || next === 'delivered') && order.payment_status !== 'paid') {
    return { ok: false, reason: 'Only paid orders can be shipped' };
  }
  return { ok: true };
}

function isPayable(order, now = new Date()) {
  if (order.status !== 'pending') return false;
  if (!['unpaid', 'failed'].includes(order.payment_status)) return false;
  if (order.expires_at && new Date(order.expires_at) <= now) return false;
  return true;
}

module.exports = { ORDER_STATUSES, PAYMENT_STATUSES, ADMIN_TRANSITIONS, checkAdminTransition, isPayable };
