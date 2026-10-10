const express = require('express');
const supabase = require('../config/supabase');
const stripe = require('../config/stripe');
const { authenticate } = require('../middleware/auth');
const { frontendBase } = require('../lib/frontend');
const { asyncHandler, unwrap, notFound, conflict } = require('../lib/http');
const { isPayable } = require('../lib/orderStatus');
const v = require('../lib/validate');
const orders = require('../services/orders');

const router = express.Router();

// Stripe requires a Checkout Session to live 30 min – 24 h. Reserved stock is held at most
// MAX_HOLD_MS after the order was created, so a customer can't keep re-opening checkout to
// park a one-of-a-kind beetle forever (docs/adr/0001-stripe-hosted-checkout.md).
const SESSION_TTL_MS = 31 * 60 * 1000;
const MAX_HOLD_MS = 2 * 60 * 60 * 1000;

const satang = (n) => Math.round(Number(n) * 100);

/**
 * POST /api/payments/checkout-session — Stripe Checkout (hosted page), card + PromptPay.
 * One open session per order (reused on retries). Prices come from the order snapshot.
 * Returns { url } for the browser to redirect to. Paying does NOT mark the order paid;
 * only the signature-verified webhook does.
 */
router.post(
  '/checkout-session',
  authenticate,
  asyncHandler(async (req, res) => {
    const orderId = v.uuid(req.body.order_id, 'order_id');
    const order = await orders.getOrderWithItems(orderId);
    if (!order || order.user_id !== req.user.id) throw notFound('Order not found');
    if (order.payment_status === 'paid') throw conflict('This order is already paid', 'ALREADY_PAID');
    if (!isPayable(order)) throw conflict('This order has expired. Please check out again.', 'ORDER_EXPIRED');

    if (order.stripe_checkout_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
      if (existing.payment_status === 'paid') {
        await orders.markPaidFromCheckoutSession(existing);
        throw conflict('This order is already paid', 'ALREADY_PAID');
      }
      if (existing.status === 'complete') {
        throw conflict('Your payment is processing. Please wait a moment.', 'PAYMENT_PROCESSING');
      }
      if (existing.status === 'open' && existing.expires_at * 1000 > Date.now() + 60_000) {
        return res.json({ url: existing.url, expires_at: order.expires_at });
      }
      // expired (or about to) → create a fresh one
    }

    const sessionExpiresAt = Date.now() + SESSION_TTL_MS;
    if (sessionExpiresAt > new Date(order.created_at).getTime() + MAX_HOLD_MS) {
      throw conflict('This order has expired. Please check out again.', 'ORDER_EXPIRED');
    }

    const lineItems = order.order_items.map((i) => ({
      quantity: i.quantity,
      price_data: {
        currency: 'thb',
        unit_amount: satang(i.unit_price),
        product_data: { name: i.product_name, ...(i.product_image ? { images: [i.product_image] } : {}) },
      },
    }));
    if (Number(order.shipping_fee) > 0) {
      lineItems.push({
        quantity: 1,
        price_data: { currency: 'thb', unit_amount: satang(order.shipping_fee), product_data: { name: 'Shipping / ค่าจัดส่ง' } },
      });
    }

    const base = frontendBase();
    const metadata = { order_id: order.id, order_number: order.order_number, user_id: req.user.id };
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card', 'promptpay'],
        line_items: lineItems,
        customer_email: req.user.email || undefined,
        client_reference_id: order.id,
        metadata,
        payment_intent_data: { metadata, description: `Silver Thief Bug order ${order.order_number}` },
        expires_at: Math.floor(sessionExpiresAt / 1000),
        success_url: `${base}/orders/${order.id}?paid=1`,
        cancel_url: `${base}/orders/${order.id}`,
      },
      { idempotencyKey: `cs-${order.id}-${order.stripe_checkout_session_id || 'first'}` }
    );

    if (session.amount_total !== satang(order.total)) {
      await stripe.checkout.sessions.expire(session.id).catch(() => {});
      throw conflict('Order total changed. Please check out again.', 'AMOUNT_MISMATCH');
    }

    // Link the session only if nobody linked another one meanwhile, and keep the stock
    // reservation alive at least as long as the session can be paid.
    const reserveUntil = new Date(
      Math.max(new Date(order.expires_at).getTime(), sessionExpiresAt + 2 * 60 * 1000)
    ).toISOString();
    let linkQuery = supabase
      .from('orders')
      .update({ stripe_checkout_session_id: session.id, expires_at: reserveUntil })
      .eq('id', order.id)
      .eq('status', 'pending');
    linkQuery = order.stripe_checkout_session_id
      ? linkQuery.eq('stripe_checkout_session_id', order.stripe_checkout_session_id)
      : linkQuery.is('stripe_checkout_session_id', null);
    const linked = unwrap(await linkQuery.select('id'));
    if (!linked.length) {
      await stripe.checkout.sessions.expire(session.id).catch(() => {});
      throw conflict('Payment is already being set up for this order. Please refresh.', 'PAYMENT_IN_PROGRESS');
    }

    res.json({ url: session.url, expires_at: reserveUntil });
  })
);

/**
 * POST /api/payments/webhook — Stripe webhook (raw body, signature-verified).
 * This is the ONLY place (besides server-side reconciliation) that marks orders as paid.
 * Subscribe to: checkout.session.completed, checkout.session.async_payment_succeeded,
 * checkout.session.async_payment_failed, payment_intent.succeeded,
 * payment_intent.payment_failed, charge.refunded.
 */
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send('Webhook signature verification failed');
  }

  // Already processed? (Stripe retries and may deliver the same event more than once)
  const { data: seen } = await supabase.from('payment_events').select('id').eq('id', event.id).maybeSingle();
  if (seen) return res.json({ received: true, duplicate: true });

  const obj = event.data.object;
  const record = {
    id: event.id,
    type: event.type,
    payment_intent_id: obj.object === 'payment_intent' ? obj.id : obj.payment_intent || null,
    order_id: v.isUuid(obj.metadata?.order_id) ? obj.metadata.order_id : null,
    amount: obj.amount_received ?? obj.amount_total ?? obj.amount ?? null,
    currency: obj.currency || null,
    result: 'ignored',
  };

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        record.result = await orders.markPaidFromCheckoutSession(obj);
        break;

      case 'payment_intent.succeeded':
        record.result = await orders.markPaidFromIntent(obj);
        break;

      case 'checkout.session.async_payment_failed':
      case 'payment_intent.payment_failed':
        if (record.order_id) {
          unwrap(
            await supabase
              .from('orders')
              .update({ payment_status: 'failed' })
              .eq('id', record.order_id)
              .eq('payment_status', 'unpaid')
          );
        }
        record.result = 'marked_failed';
        break;

      case 'charge.refunded': {
        const fullyRefunded = obj.amount_refunded >= obj.amount;
        const { data: order } = await supabase
          .from('orders')
          .select('id, status, payment_status')
          .eq('stripe_payment_intent_id', obj.payment_intent)
          .maybeSingle();
        if (order) {
          record.order_id = order.id;
          if (fullyRefunded && order.payment_status === 'paid') {
            // Refund made in the Stripe Dashboard: flag it so an admin cancels/restocks in the app
            unwrap(
              await supabase
                .from('orders')
                .update({
                  payment_status: 'refunded',
                  needs_attention: order.status !== 'cancelled',
                  admin_note: order.status !== 'cancelled' ? 'Refunded in Stripe — cancel or update this order.' : undefined,
                })
                .eq('id', order.id)
            );
          } else if (!fullyRefunded) {
            unwrap(
              await supabase
                .from('orders')
                .update({ needs_attention: true, admin_note: `Partial refund of ฿${obj.amount_refunded / 100} made in Stripe.` })
                .eq('id', order.id)
            );
          }
        }
        record.result = fullyRefunded ? 'refunded' : 'partial_refund';
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Webhook ${event.type} (${event.id}) failed:`, err.message);
    // Not recorded → Stripe will retry the event
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  const { error: logError } = await supabase.from('payment_events').upsert(record, { onConflict: 'id' });
  if (logError) console.error('payment_events insert failed:', logError.message);

  res.json({ received: true });
});

module.exports = router;
