const express = require('express');
const rateLimit = require('express-rate-limit');
const supabase = require('../config/supabase');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler, unwrap, badRequest, notFound, conflict, forbidden, fromDbError } = require('../lib/http');
const { checkAdminTransition, checkCancelReason, checkCustomerCancel, checkCustomerConfirm, ORDER_STATUSES, orderDeadline } = require('../lib/orderStatus');
const { orderForViewer, ordersForCustomer } = require('../lib/orderView');
const { checkPayableTotal } = require('../lib/pricing');
const { buildSnapshot } = require('../lib/thaiAddress');
const v = require('../lib/validate');
const addresses = require('../services/addresses');
const orders = require('../services/orders');
const pricing = require('../services/pricing');

const router = express.Router();

const RESERVATION_MINUTES = Number(process.env.ORDER_RESERVATION_MINUTES || 30);

const createOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many checkout attempts. Please wait a few minutes.' },
});

const ADMIN_ORDER_SELECT = `${orders.ORDER_WITH_ITEMS}, profiles(full_name, email, phone)`;

/** Resolve the shipping snapshot from a saved address id or a new address in the body. */
async function resolveShipping(req) {
  const { address_id, address, save_address } = req.body;
  if (address_id) {
    const saved = await addresses.getAddress(req.user.id, v.uuid(address_id, 'address_id'));
    return buildSnapshot(saved, saved);
  }
  if (!address || typeof address !== 'object') throw badRequest('Choose a saved address or enter a new one');
  const { fields, geo } = await addresses.parseAddressInput(address);
  if (save_address === true) {
    await addresses.createAddress(req.user.id, fields).catch((err) => {
      // Saving to the address book is a convenience; never block checkout on it.
      console.warn('Could not save address:', err.message);
    });
  }
  return buildSnapshot(fields, geo);
}

// POST /api/orders — create an order and reserve stock (idempotent per client_request_id)
router.post(
  '/',
  authenticate,
  createOrderLimiter,
  asyncHandler(async (req, res) => {
    const items = v.cartItems(req.body.items);
    const requestId = v.uuid(req.body.client_request_id, 'client_request_id');

    // Same checkout attempt (double-click, retry, refresh) → return the existing order
    const { data: existing } = await supabase
      .from('orders')
      .select(orders.ORDER_WITH_ITEMS)
      .eq('user_id', req.user.id)
      .eq('client_request_id', requestId)
      .maybeSingle();
    if (existing) {
      if (existing.status === 'cancelled') {
        throw conflict('This checkout expired. Please review your cart and try again.', 'ORDER_EXPIRED');
      }
      return res.status(200).json(orderForViewer(await fetchOrder(existing.id, req.user), req.user));
    }

    const shipping = await resolveShipping(req);
    // Priced with today's prices and Shipping Rule; the order keeps this fee even if the rule changes later
    const priced = await pricing.priceItems(items, req.user.id, v.giftChoices(req.body.gift_choices), v.promotionChoices(req.body.promotion_choices));
    const payable = checkPayableTotal(priced.total);
    if (!payable.ok) throw badRequest(payable.reason, payable.code);
    await orders.releaseOtherPendingOrders(req.user.id, requestId);

    const { data: order, error } = await supabase.rpc('create_order', {
      p_user_id: req.user.id,
      p_items: pricing.orderLines(priced),
      p_shipping_address: shipping,
      p_client_request_id: requestId,
      p_shipping_fee: priced.shipping_fee,
      p_ttl_minutes: RESERVATION_MINUTES,
      p_redeem: priced.redeem,
    });

    if (error) {
      if (error.code === '23505') {
        // Concurrent duplicate request won the race — return its order
        const again = await orders.getOrderWithItems(
          (await supabase.from('orders').select('id').eq('user_id', req.user.id).eq('client_request_id', requestId).single()).data.id
        );
        return res.status(200).json(orderForViewer(again, req.user));
      }
      throw fromDbError(error);
    }

    res.status(201).json(orderForViewer(await fetchOrder(order.id, req.user), req.user));
  })
);

// POST /api/orders/price-preview — what these cart items cost today: lines, discounts, Shipping Fee, total.
// The Cart and Checkout show exactly this; order creation prices the same way.
router.post(
  '/price-preview',
  authenticate,
  asyncHandler(async (req, res) => {
    const items = v.cartItems(req.body.items);
    res.json(await pricing.priceItems(items, req.user.id, v.giftChoices(req.body.gift_choices), v.promotionChoices(req.body.promotion_choices)));
  })
);

// GET /api/orders — my order history
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { from, to } = v.pagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const data = unwrap(
      await supabase
        .from('orders')
        .select(orders.ORDER_WITH_ITEMS)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .range(from, to)
    );
    res.json(ordersForCustomer(data));
  })
);

// GET /api/orders/admin/all — admin: all orders with filters
router.get(
  '/admin/all',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, from, to } = v.pagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    let query = supabase
      .from('orders')
      .select(ADMIN_ORDER_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.query.status) query = query.eq('status', v.oneOf(req.query.status, 'status', ORDER_STATUSES));
    if (req.query.needs_attention === 'true') query = query.eq('needs_attention', true);
    if (req.query.search) query = query.ilike('order_number', v.likePattern(req.query.search));

    const { data, error, count } = await query;
    if (error) throw error;
    // Each order's countdown: Reservation end (Awaiting Payment) or automatic Confirmed (Shipping)
    res.json({ orders: data.map((o) => ({ ...o, deadline: orderDeadline(o) })), total: count, page, limit });
  })
);

/** One order with its lines; an Admin also gets the Member's name, email and phone (as in the admin list). */
async function fetchOrder(id, user) {
  const select = user.role === 'admin' ? ADMIN_ORDER_SELECT : orders.ORDER_WITH_ITEMS;
  return unwrap(await supabase.from('orders').select(select).eq('id', id).maybeSingle());
}

async function loadOrderFor(req) {
  const id = v.uuid(req.params.id, 'id');
  const order = await fetchOrder(id, req.user);
  if (!order) throw notFound('Order not found');
  if (order.user_id !== req.user.id && req.user.role !== 'admin') throw notFound('Order not found');
  return order;
}

// GET /api/orders/:id — owner or admin. Used by the checkout page to poll server-verified status.
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(orderForViewer(await loadOrderFor(req), req.user));
  })
);

// POST /api/orders/:id/cancel — customer cancels their own unpaid order (stock is released)
router.post(
  '/:id/cancel',
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await loadOrderFor(req);
    if (order.user_id !== req.user.id) throw forbidden();
    const check = checkCustomerCancel(order);
    if (!check.ok) throw conflict(check.reason, check.code);
    await orders.cancelUnpaidOrder(order, 'customer_cancelled');
    res.json(orderForViewer(await fetchOrder(order.id, req.user), req.user));
  })
);

// POST /api/orders/:id/confirm — customer confirms they received their Shipping order
router.post(
  '/:id/confirm',
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await loadOrderFor(req);
    if (order.user_id !== req.user.id) throw forbidden();
    const check = checkCustomerConfirm(order);
    if (!check.ok) throw conflict(check.reason, check.code);
    unwrap(await supabase.rpc('confirm_order', { p_order_id: order.id, p_by: 'customer' }));
    // The Admins' bells are notified by the database; the Owner also gets a LINE message
    orders.notifyAdminsOrderReceived(order.id).catch((err) => console.error('LINE (order received) failed:', err.message));
    res.json(orderForViewer(await fetchOrder(order.id, req.user), req.user));
  })
);

// PATCH /api/orders/:id/status — admin fulfilment: waiting_shipping→shipping, shipping→confirmed, and
// cancel (with a reason) before Shipping — a paid order is refunded in full through Stripe first
router.patch(
  '/:id/status',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const next = v.oneOf(req.body.status, 'status', ORDER_STATUSES);
    // The customer is told why (Cancel Reason), so an admin always gives one
    const reason = next === 'cancelled' ? v.str(req.body.reason, 'reason', { max: 500 }) : null;
    if (reason) {
      const typed = checkCancelReason(reason);
      if (!typed.ok) throw badRequest(typed.reason, typed.code);
    }
    const order = await loadOrderFor(req);
    const check = checkAdminTransition(order, next);
    if (!check.ok) throw conflict(check.reason, 'INVALID_TRANSITION');

    if (next === 'cancelled') {
      if (check.refund) await orders.refundAndCancel(order, reason);
      else if (order.refunded_at) unwrap(await supabase.rpc('cancel_order', { p_order_id: order.id, p_reason: reason, p_refunded: true }));
      else await orders.cancelUnpaidOrder(order, reason);
      return res.json(orderForViewer(await fetchOrder(order.id, req.user), req.user));
    }

    if (next === 'confirmed') {
      unwrap(await supabase.rpc('confirm_order', { p_order_id: order.id, p_by: 'admin' }));
      return res.json(orderForViewer(await fetchOrder(order.id, req.user), req.user));
    }

    const updates = { status: next };
    if (next === 'shipping') {
      updates.carrier = v.str(req.body.carrier, 'carrier', { max: 50 });
      updates.tracking_number = v.str(req.body.tracking_number, 'tracking_number', { max: 100 });
      updates.shipped_at = new Date().toISOString();
    }

    // Optimistic concurrency: only update if the status hasn't changed underneath us
    const updated = unwrap(
      await supabase.from('orders').update(updates).eq('id', order.id).eq('status', order.status).select('id')
    );
    if (!updated.length) throw conflict('Order changed while you were editing. Refresh and try again.');
    res.json(orderForViewer(await fetchOrder(order.id, req.user), req.user));
  })
);

// PATCH /api/orders/:id/admin — admin notes / resolve "needs attention" / fix tracking
router.patch(
  '/:id/admin',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const order = await loadOrderFor(req);
    const updates = {};
    if (req.body.admin_note !== undefined) updates.admin_note = v.str(req.body.admin_note, 'admin_note', { required: false, max: 2000 });
    if (req.body.needs_attention !== undefined) updates.needs_attention = v.bool(req.body.needs_attention, 'needs_attention');
    if (req.body.carrier !== undefined) updates.carrier = v.str(req.body.carrier, 'carrier', { required: false, max: 50 });
    if (req.body.tracking_number !== undefined) {
      updates.tracking_number = v.str(req.body.tracking_number, 'tracking_number', { required: false, max: 100 });
    }
    if (!Object.keys(updates).length) throw badRequest('Nothing to update');
    unwrap(await supabase.from('orders').update(updates).eq('id', order.id));
    res.json(orderForViewer(await fetchOrder(order.id, req.user), req.user));
  })
);

module.exports = router;
