/**
 * Order fulfilment rules. One status field; there is no separate payment status.
 *
 *   awaiting_payment ──(Stripe webhook)──▶ paid ──▶ waiting_shipping ──▶ shipping ──▶ confirmed
 *          │                                 │              │
 *          └──▶ cancelled (units released)   └──────────────┴──▶ cancelled (admin, with a full refund)
 *
 * "paid" is set ONLY by the verified Stripe webhook / reconciliation, never by a person.
 * Until the LINE OA alert is automated, paid moves straight on to waiting_shipping.
 */

const ORDER_STATUSES = ['awaiting_payment', 'paid', 'waiting_shipping', 'shipping', 'confirmed', 'cancelled'];

// Transitions an admin may trigger manually through PATCH /orders/:id/status
const ADMIN_TRANSITIONS = {
  awaiting_payment: ['cancelled'],
  paid: ['cancelled'],
  waiting_shipping: ['shipping', 'cancelled'],
  shipping: ['confirmed'],
  confirmed: [],
  cancelled: [],
};

/** Units leave On Hand and money counts as Revenue only at Confirmed: customer, admin, or 7 days after Shipping. */
const AUTO_CONFIRM_DAYS = 7;
/** A customer who hasn't confirmed CONFIRM_REQUEST_DAYS after Shipping gets one reminder Notification. */
const CONFIRM_REQUEST_DAYS = 3;

/** Statuses in which the customer has paid and the money has not been refunded. */
const PAID_STATUSES = ['paid', 'waiting_shipping', 'shipping', 'confirmed'];

/**
 * Cancelling a paid order (Paid / Waiting Shipping) refunds it in full first: `refund: true`.
 * @returns {{ ok: true, refund?: boolean } | { ok: false, reason: string }}
 */
function checkAdminTransition(order, next) {
  if (!ORDER_STATUSES.includes(next)) return { ok: false, reason: `Unknown status "${next}"` };
  if (order.status === next) return { ok: false, reason: `Order is already ${next}` };
  if (next === 'paid' || next === 'waiting_shipping') {
    return { ok: false, reason: 'Orders become paid automatically when Stripe confirms the payment' };
  }
  const allowed = ADMIN_TRANSITIONS[order.status] || [];
  if (!allowed.includes(next)) {
    return { ok: false, reason: `Cannot change status from ${order.status} to ${next}` };
  }
  // Already refunded (e.g. in the Stripe Dashboard): cancel without refunding twice
  if (next === 'cancelled') return { ok: true, refund: PAID_STATUSES.includes(order.status) && !order.refunded_at };
  return { ok: true };
}

/**
 * Customers may cancel their own order only while it is Awaiting Payment; paid orders go through the shop.
 * @returns {{ ok: true } | { ok: false, reason: string, code: string }}
 */
function checkCustomerCancel(order) {
  if (order.status === 'awaiting_payment') return { ok: true };
  return {
    ok: false,
    reason: 'Only unpaid orders can be cancelled. Contact us for help with paid orders.',
    code: 'ORDER_NOT_CANCELLABLE',
  };
}

/**
 * Customers confirm receipt (Confirmed) of their own order once it is Shipping.
 * @returns {{ ok: true } | { ok: false, reason: string, code: string }}
 */
function checkCustomerConfirm(order) {
  if (order.status === 'shipping') return { ok: true };
  return { ok: false, reason: 'Only orders in Shipping can be confirmed as received.', code: 'ORDER_NOT_CONFIRMABLE' };
}

/**
 * An admin's refund-then-cancel goes ahead only when Stripe reports the refund `succeeded` (spec: "Only
 * when it succeeds"). A pending refund finishes later through the charge.refunded webhook, which marks
 * the order refunded so the admin can then cancel it without refunding twice.
 * @returns {{ ok: true } | { ok: false, reason: string, code: string }}
 */
function checkRefund(refund) {
  if (refund?.status === 'succeeded') return { ok: true };
  if (refund?.status === 'pending' || refund?.status === 'requires_action') {
    return { ok: false, reason: 'Stripe is still processing the refund. Cancel the order once it has gone through.', code: 'REFUND_PENDING' };
  }
  return { ok: false, reason: 'Stripe could not refund this payment. Check the Stripe Dashboard.', code: 'REFUND_FAILED' };
}

/** Cancel Reasons the system writes; the UI shows them translated (frontend lib/format.ts). */
const SYSTEM_CANCEL_REASONS = ['payment_timeout', 'customer_cancelled', 'replaced_by_new_checkout', 'admin_cancelled', 'refunded_by_admin'];

/**
 * A Cancel Reason typed by an admin is shown as written, so it may not be a system code.
 * @returns {{ ok: true } | { ok: false, reason: string, code: string }}
 */
function checkCancelReason(reason) {
  if (!SYSTEM_CANCEL_REASONS.includes(String(reason).trim().toLowerCase())) return { ok: true };
  return { ok: false, reason: 'Write the reason in your own words', code: 'RESERVED_CANCEL_REASON' };
}

/**
 * What the viewer may do with this order, sent with it so screens never re-derive the rules above.
 * `customer` is for the order's owner, `admin` for an Admin; null when the viewer is not that.
 */
function orderActions(order, { owner, admin }) {
  const cancel = checkAdminTransition(order, 'cancelled');
  return {
    customer: owner ? { cancel: checkCustomerCancel(order).ok, confirm: checkCustomerConfirm(order).ok } : null,
    admin: admin
      ? {
          ship: checkAdminTransition(order, 'shipping').ok,
          confirm: checkAdminTransition(order, 'confirmed').ok,
          cancel: cancel.ok,
          refund_on_cancel: Boolean(cancel.ok && cancel.refund),
        }
      : null,
  };
}

/**
 * When an order's clock runs out, for the Admin's countdown: an Awaiting Payment order's Reservation
 * ends at expires_at; a Shipping order becomes Confirmed AUTO_CONFIRM_DAYS after it shipped (the job's own number).
 */
function orderDeadline(order) {
  if (order.status === 'awaiting_payment' && order.expires_at) return { kind: 'payment', at: order.expires_at };
  if (order.status === 'shipping' && order.shipped_at) {
    return { kind: 'auto_confirm', at: new Date(new Date(order.shipped_at).getTime() + AUTO_CONFIRM_DAYS * 86400000).toISOString() };
  }
  return null;
}

function isPayable(order, now = new Date()) {
  if (order.status !== 'awaiting_payment') return false;
  if (order.expires_at && new Date(order.expires_at) <= now) return false;
  return true;
}

module.exports = { ORDER_STATUSES, AUTO_CONFIRM_DAYS, CONFIRM_REQUEST_DAYS, PAID_STATUSES, ADMIN_TRANSITIONS, checkAdminTransition, checkCustomerCancel, checkCustomerConfirm, checkCancelReason, SYSTEM_CANCEL_REASONS, orderActions, checkRefund, isPayable, orderDeadline };
