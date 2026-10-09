const express = require('express');
const rateLimit = require('express-rate-limit');
const supabase = require('../config/supabase');
const stripe = require('../config/stripe');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler, unwrap, badRequest, notFound, conflict, forbidden, fromDbError } = require('../lib/http');
const { checkAdminTransition, ORDER_STATUSES, PAYMENT_STATUSES } = require('../lib/orderStatus');
const { buildSnapshot } = require('../lib/thaiAddress');
const v = require('../lib/validate');
const addresses = require('../services/addresses');
const orders = require('../services/orders');

const router = express.Router();

const SHIPPING_FEE = Number(process.env.SHIPPING_FEE_THB || 0);
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
      return res.status(200).json(existing);
    }

    const shipping = await resolveShipping(req);
    await orders.releaseOtherPendingOrders(req.user.id, requestId);

    const { data: order, error } = await supabase.rpc('create_order', {
      p_user_id: req.user.id,
      p_items: items,
      p_shipping_address: shipping,
      p_client_request_id: requestId,
      p_shipping_fee: SHIPPING_FEE,
      p_ttl_minutes: RESERVATION_MINUTES,
    });

    if (error) {
      if (error.code === '23505') {
        // Concurrent duplicate request won the race — return its order
        const again = await orders.getOrderWithItems(
          (await supabase.from('orders').select('id').eq('user_id', req.user.id).eq('client_request_id', requestId).single()).data.id
        );
        return res.status(200).json(again);
      }
      throw fromDbError(error);
    }

    res.status(201).json(await orders.getOrderWithItems(order.id));
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
    res.json(data);
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
    if (req.query.payment_status) {
      query = query.eq('payment_status', v.oneOf(req.query.payment_status, 'payment_status', PAYMENT_STATUSES));
    }
    if (req.query.needs_attention === 'true') query = query.eq('needs_attention', true);
    if (req.query.search) query = query.ilike('order_number', v.likePattern(req.query.search));

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ orders: data, total: count, page, limit });
  })
);

async function loadOrderFor(req) {
  const id = v.uuid(req.params.id, 'id');
  const order = await orders.getOrderWithItems(id);
  if (!order) throw notFound('Order not found');
  if (order.user_id !== req.user.id && req.user.role !== 'admin') throw notFound('Order not found');
  return order;
}

// GET /api/orders/:id — owner or admin. Used by the checkout page to poll server-verified status.
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await loadOrderFor(req);
    // Never expose internal admin fields to customers
    if (req.user.role !== 'admin') {
      delete order.admin_note;
      delete order.needs_attention;
      delete order.admin_notified_at;
      delete order.client_request_id;
    }
    res.json(order);
  })
);

// POST /api/orders/:id/cancel — customer cancels their own unpaid order (stock is released)
router.post(
  '/:id/cancel',
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await loadOrderFor(req);
    if (order.user_id !== req.user.id) throw forbidden();
    if (order.status !== 'pending' || order.payment_status === 'paid') {
      throw conflict('Only unpaid orders can be cancelled. Contact us for help with paid orders.');
    }
    await orders.cancelUnpaidOrder(order, 'customer_cancelled');
    res.json(await orders.getOrderWithItems(order.id));
  })
);

// PATCH /api/orders/:id/status — admin fulfilment: pending→cancelled, confirmed→shipped, shipped→delivered
router.patch(
  '/:id/status',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const order = await loadOrderFor(req);
    const next = v.oneOf(req.body.status, 'status', ORDER_STATUSES);
    const check = checkAdminTransition(order, next);
    if (!check.ok) throw conflict(check.reason, 'INVALID_TRANSITION');

    if (next === 'cancelled') {
      await orders.cancelUnpaidOrder(order, v.str(req.body.reason, 'reason', { required: false, max: 200 }) || 'admin_cancelled');
      return res.json(await orders.getOrderWithItems(order.id));
    }

    const updates = { status: next };
    if (next === 'shipped') {
      updates.carrier = v.str(req.body.carrier, 'carrier', { max: 50 });
      updates.tracking_number = v.str(req.body.tracking_number, 'tracking_number', { max: 100 });
      updates.shipped_at = new Date().toISOString();
    }
    if (next === 'delivered') updates.delivered_at = new Date().toISOString();

    // Optimistic concurrency: only update if the status hasn't changed underneath us
    const updated = unwrap(
      await supabase.from('orders').update(updates).eq('id', order.id).eq('status', order.status).select('id')
    );
    if (!updated.length) throw conflict('Order changed while you were editing. Refresh and try again.');
    res.json(await orders.getOrderWithItems(order.id));
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
    res.json(await orders.getOrderWithItems(order.id));
  })
);

// POST /api/orders/:id/refund — admin: full refund through Stripe, then cancel (optionally restock)
router.post(
  '/:id/refund',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const order = await loadOrderFor(req);
    const restock = v.bool(req.body.restock, 'restock') ?? true;
    const reason = v.str(req.body.reason, 'reason', { required: false, max: 200 }) || 'refunded_by_admin';

    if (order.payment_status !== 'paid') throw conflict('Only paid orders can be refunded');
    if (['shipped', 'delivered'].includes(order.status)) {
      throw conflict('Shipped orders must be handled as returns — refund them in the Stripe dashboard.');
    }
    if (!order.stripe_payment_intent_id) throw conflict('No Stripe payment is linked to this order');

    await stripe.refunds.create(
      { payment_intent: order.stripe_payment_intent_id, reason: 'requested_by_customer', metadata: { order_id: order.id } },
      { idempotencyKey: `refund-${order.id}` }
    );

    unwrap(
      await supabase.rpc('cancel_order', {
        p_order_id: order.id,
        p_reason: reason,
        p_restock: restock,
        p_refunded: true,
      })
    );
    res.json(await orders.getOrderWithItems(order.id));
  })
);

module.exports = router;
