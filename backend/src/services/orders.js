/**
 * Order / payment lifecycle shared by routes, the Stripe webhook and the background job.
 *
 * Trust model: an order becomes "paid" ONLY through markPaidFromCheckoutSession() /
 * markPaidFromIntent(), which are fed a Checkout Session or PaymentIntent that came from a
 * signature-verified Stripe webhook or was fetched directly from the Stripe API by this server.
 * The browser's redirect back from Stripe is never trusted.
 */
const supabase = require('../config/supabase');
const stripe = require('../config/stripe');
const line = require('../lib/line');
const { conflict, unwrap } = require('../lib/http');
const { AUTO_CONFIRM_DAYS, CONFIRM_REQUEST_DAYS, checkRefund } = require('../lib/orderStatus');

const ORDER_WITH_ITEMS =
  '*, order_items(id, product_id, product_name, product_image, unit_price, quantity, line_total, list_price, discount_per_unit, promotion_id, is_gift)';

async function getOrderWithItems(orderId) {
  const { data, error } = await supabase.from('orders').select(ORDER_WITH_ITEMS).eq('id', orderId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Notify admins on LINE exactly once per paid order.
 * Claims the order by setting admin_notified_at; resets it if the push fails so the job retries.
 */
async function notifyAdminsOrderPaid(orderId) {
  const { data: claimed, error } = await supabase
    .from('orders')
    .update({ admin_notified_at: new Date().toISOString() })
    .eq('id', orderId)
    .not('paid_at', 'is', null)
    .is('admin_notified_at', null)
    .select('id');
  if (error) throw new Error(error.message);
  if (!claimed?.length) return false; // already notified (or not paid)

  try {
    const order = await getOrderWithItems(orderId);
    await line.pushToAdmins(line.buildOrderPaidMessage(order, order.order_items));
    return true;
  } catch (err) {
    await supabase.from('orders').update({ admin_notified_at: null }).eq('id', orderId);
    throw err;
  }
}

/** LINE to the Owner when a customer confirms receiving their order (ADR 0002 targets). Never throws for "not configured". */
async function notifyAdminsOrderReceived(orderId) {
  if (!line.isConfigured()) return false;
  const order = await getOrderWithItems(orderId);
  // Only a Customer's own confirmation goes to LINE (an Admin's or the automatic one never does)
  if (!order || order.status !== 'confirmed' || order.confirmed_by !== 'customer') return false;
  await line.pushToAdmins(line.buildOrderReceivedMessage(order));
  return true;
}

async function warnAdmins(text) {
  try {
    await line.pushToAdmins(`⚠️ ${text}`);
  } catch (err) {
    console.error('LINE warning failed:', err.message);
  }
}

/**
 * Apply a succeeded PaymentIntent (from Stripe) to its order. Idempotent.
 * @returns {Promise<string>} result of mark_order_paid
 */
async function markPaidFromIntent(intent) {
  return applyPayment({
    orderId: intent.metadata?.order_id,
    paymentIntentId: intent.id,
    amount: intent.amount_received || intent.amount,
    currency: intent.currency,
  });
}

/**
 * Apply a paid Checkout Session (from Stripe) to its order. Idempotent.
 * Async methods (PromptPay) complete the session first and pay later — those are ignored
 * here until checkout.session.async_payment_succeeded arrives with payment_status "paid".
 */
async function markPaidFromCheckoutSession(session) {
  if (session.payment_status !== 'paid') return 'not_paid_yet';
  return applyPayment({
    orderId: session.metadata?.order_id || session.client_reference_id,
    paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
    amount: session.amount_total,
    currency: session.currency,
  });
}

async function applyPayment({ orderId, paymentIntentId, amount, currency }) {
  if (!orderId) return 'no_order_metadata';
  if (!paymentIntentId) return 'no_payment_intent';

  const { data: result, error } = await supabase.rpc('mark_order_paid', {
    p_order_id: orderId,
    p_payment_intent_id: paymentIntentId,
    p_amount: amount,
    p_currency: currency,
  });
  if (error) throw new Error(`mark_order_paid failed: ${error.message}`);

  if (result === 'paid') {
    await notifyAdminsOrderPaid(orderId).catch((err) => console.error('LINE notify failed (will retry):', err.message));
  } else if (['amount_mismatch', 'intent_mismatch', 'paid_after_cancel'].includes(result)) {
    const order = await getOrderWithItems(orderId);
    await warnAdmins(`Payment needs review (${result}) for order ${order?.order_number || orderId}. Check the admin dashboard.`);
  }
  return result;
}

/**
 * The order's Checkout Session, or null when Stripe no longer has it AND it can no longer be paid.
 * Stripe answers "resource_missing" when the session was made with the other key mode (live vs test)
 * or deleted. The reservation always outlives the session by at least two minutes (payments route),
 * so once it has passed the session has expired at Stripe too. Before that we keep refusing.
 */
async function retrieveSessionOrNull(order) {
  try {
    return await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
  } catch (err) {
    const gone = err.code === 'resource_missing' && order.expires_at && new Date(order.expires_at).getTime() < Date.now();
    if (!gone) throw err;
    console.warn(`Checkout Session for order ${order.order_number || order.id} is unknown to this Stripe key and past its reservation; cancelling.`);
    return null;
  }
}

/**
 * Cancel an unpaid order: expire its Stripe Checkout Session / cancel its PaymentIntent first
 * (so it can't be paid later), then release reserved stock atomically.
 * If Stripe says the payment already succeeded, the order is marked paid instead.
 */
async function cancelUnpaidOrder(order, reason) {
  if (order.stripe_checkout_session_id) {
    let session = await retrieveSessionOrNull(order);
    if (!session) return unwrap(await supabase.rpc('cancel_order', { p_order_id: order.id, p_reason: reason }));
    if (session.status === 'open') {
      try {
        session = await stripe.checkout.sessions.expire(session.id);
      } catch (err) {
        session = await stripe.checkout.sessions.retrieve(session.id);
        if (session.status === 'open') throw err;
      }
    }
    if (session.payment_status === 'paid') {
      await markPaidFromCheckoutSession(session);
      throw conflict('This order has already been paid.', 'ALREADY_PAID');
    }
    if (session.status === 'complete') {
      // Completed but not yet paid = async payment (PromptPay) still settling
      throw conflict('A payment for this order is still processing. Please wait a moment.', 'PAYMENT_PROCESSING');
    }
  }
  if (order.stripe_payment_intent_id) {
    let intent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
    if (intent.status === 'succeeded') {
      await markPaidFromIntent(intent);
      throw conflict('This order has already been paid.', 'ALREADY_PAID');
    }
    if (intent.status === 'processing') {
      throw conflict('A payment for this order is still processing. Please wait a moment.', 'PAYMENT_PROCESSING');
    }
    if (intent.status !== 'canceled') {
      try {
        intent = await stripe.paymentIntents.cancel(intent.id);
      } catch (err) {
        intent = await stripe.paymentIntents.retrieve(intent.id);
        if (intent.status === 'succeeded') {
          await markPaidFromIntent(intent);
          throw conflict('This order has already been paid.', 'ALREADY_PAID');
        }
        if (intent.status !== 'canceled') throw err;
      }
    }
  }
  return unwrap(await supabase.rpc('cancel_order', { p_order_id: order.id, p_reason: reason }));
}

/**
 * Admin cancels a paid order (Paid / Waiting Shipping): full refund through Stripe first, then cancel.
 * If the refund fails or is still pending nothing changes, so the money and the Order Status never disagree.
 */
async function refundAndCancel(order, reason) {
  if (!order.stripe_payment_intent_id) throw conflict('No Stripe payment is linked to this order');
  const created = await stripe.refunds.create(
    { payment_intent: order.stripe_payment_intent_id, reason: 'requested_by_customer', metadata: { order_id: order.id } },
    { idempotencyKey: `refund-${order.id}` }
  );
  // A retry replays the first response (idempotency key), so read the refund's current status
  const refund = created.status === 'succeeded' ? created : await stripe.refunds.retrieve(created.id);
  const check = checkRefund(refund);
  if (!check.ok) throw conflict(check.reason, check.code);
  return unwrap(await supabase.rpc('cancel_order', { p_order_id: order.id, p_reason: reason, p_refunded: true }));
}

/** One open checkout per customer: release their other unpaid orders before reserving new stock. */
async function releaseOtherPendingOrders(userId, keepRequestId) {
  const { data: pending, error } = await supabase
    .from('orders')
    .select('id, order_number, status, stripe_payment_intent_id, stripe_checkout_session_id, client_request_id, expires_at')
    .eq('user_id', userId)
    .eq('status', 'awaiting_payment');
  if (error) throw new Error(error.message);

  for (const order of pending || []) {
    if (order.client_request_id === keepRequestId) continue;
    try {
      await cancelUnpaidOrder(order, 'replaced_by_new_checkout');
    } catch (err) {
      if (err.code === 'ALREADY_PAID') continue; // it was paid meanwhile — nothing to release
      if (err.code === 'PAYMENT_PROCESSING') {
        throw conflict('Your previous order is still being paid. Please wait a minute and check My orders.', 'PAYMENT_PROCESSING');
      }
      throw err;
    }
  }
}

/**
 * Background job: expire unpaid orders past their reservation window and release stock.
 * Also reconciles payments whose webhook was missed.
 */
async function expireStaleOrders() {
  const { data: stale, error } = await supabase
    .from('orders')
    .select('id, order_number, status, stripe_payment_intent_id, stripe_checkout_session_id, expires_at')
    .eq('status', 'awaiting_payment')
    .lt('expires_at', new Date().toISOString())
    .limit(50);
  if (error) throw new Error(error.message);

  let expired = 0;
  for (const order of stale || []) {
    try {
      await cancelUnpaidOrder(order, 'payment_timeout');
      expired += 1;
    } catch (err) {
      if (!['ALREADY_PAID', 'PAYMENT_PROCESSING'].includes(err.code)) {
        console.error(`Expire ${order.order_number} failed:`, err.message);
      }
    }
  }
  return expired;
}

/** Background job: Shipping orders nobody confirmed within AUTO_CONFIRM_DAYS become Confirmed. */
async function autoConfirmOrders() {
  const { data, error } = await supabase.rpc('auto_confirm_orders', { p_days: AUTO_CONFIRM_DAYS });
  if (error) throw new Error(error.message);
  return data || 0;
}

/** Background job: one "please confirm receipt" Notification for orders still Shipping after CONFIRM_REQUEST_DAYS. */
async function sendConfirmRequests() {
  const { data, error } = await supabase.rpc('send_confirm_requests', { p_days: CONFIRM_REQUEST_DAYS });
  if (error) throw new Error(error.message);
  return data || 0;
}

/**
 * Background job, also run right after a Promotion is created or switched on: every active Customer is
 * told once that a Promotion is coming (with its dates) and once that it has started (CONTEXT.md: Notification).
 */
async function announcePromotions() {
  const { data, error } = await supabase.rpc('announce_promotions');
  if (error) throw new Error(error.message);
  return data || 0;
}

/** Background job: retry LINE notifications for paid orders that were not delivered. */
async function retryAdminNotifications() {
  if (!line.isConfigured()) return 0;
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .not('paid_at', 'is', null)
    .is('admin_notified_at', null)
    .gte('paid_at', since)
    .limit(20);
  if (error) throw new Error(error.message);
  let sent = 0;
  for (const { id } of data || []) {
    try {
      if (await notifyAdminsOrderPaid(id)) sent += 1;
    } catch (err) {
      console.error('LINE retry failed:', err.message);
      break; // LINE is probably down or misconfigured; try again next run
    }
  }
  return sent;
}

function startOrderJobs({ intervalMs = 60_000 } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const expired = await expireStaleOrders();
      const asked = await sendConfirmRequests();
      const confirmed = await autoConfirmOrders();
      const announced = await announcePromotions();
      const notified = await retryAdminNotifications();
      if (expired || asked || confirmed || announced || notified) {
        console.log(
          `🧹 jobs: expired ${expired}, asked ${asked} to confirm, auto-confirmed ${confirmed} order(s), announced ${announced} promotion(s), sent ${notified} LINE notification(s)`
        );
      }
    } catch (err) {
      console.error('Order job error:', err.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  setTimeout(tick, 5_000).unref();
  return timer;
}

module.exports = {
  ORDER_WITH_ITEMS,
  getOrderWithItems,
  notifyAdminsOrderPaid,
  notifyAdminsOrderReceived,
  markPaidFromIntent,
  markPaidFromCheckoutSession,
  cancelUnpaidOrder,
  refundAndCancel,
  releaseOtherPendingOrders,
  expireStaleOrders,
  autoConfirmOrders,
  sendConfirmRequests,
  announcePromotions,
  retryAdminNotifications,
  startOrderJobs,
};
