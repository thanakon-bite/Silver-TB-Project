const express = require('express');
const supabase = require('../config/supabase');
const stripe = require('../config/stripe');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, unwrap, notFound, conflict } = require('../lib/http');
const { isPayable } = require('../lib/orderStatus');
const v = require('../lib/validate');
const orders = require('../services/orders');

const router = express.Router();

const REUSABLE_INTENT_STATUSES = ['requires_payment_method', 'requires_confirmation', 'requires_action'];

// POST /api/payments/create-payment-intent — one PaymentIntent per order (reused on retries)
// Card and PromptPay are offered automatically by Stripe's PaymentElement when enabled in the
// Stripe Dashboard (Settings → Payment methods).
router.post(
  '/create-payment-intent',
  authenticate,
  asyncHandler(async (req, res) => {
    const orderId = v.uuid(req.body.order_id, 'order_id');
    const order = unwrap(await supabase.from('orders').select('*').eq('id', orderId).maybeSingle());
    if (!order || order.user_id !== req.user.id) throw notFound('Order not found');
    if (order.payment_status === 'paid') throw conflict('This order is already paid', 'ALREADY_PAID');
    if (!isPayable(order)) throw conflict('This order has expired. Please check out again.', 'ORDER_EXPIRED');

    if (order.stripe_payment_intent_id) {
      const existing = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
      if (existing.status === 'succeeded') {
        await orders.markPaidFromIntent(existing);
        throw conflict('This order is already paid', 'ALREADY_PAID');
      }
      if (existing.status === 'processing') {
        throw conflict('Your payment is processing. Please wait a moment.', 'PAYMENT_PROCESSING');
      }
      if (REUSABLE_INTENT_STATUSES.includes(existing.status)) {
        return res.json({
          client_secret: existing.client_secret,
          payment_intent_id: existing.id,
          amount: order.total,
          expires_at: order.expires_at,
        });
      }
      // canceled → fall through and create a fresh one
    }

    const intent = await stripe.paymentIntents.create(
      {
        amount: Math.round(Number(order.total) * 100), // THB in satang
        currency: 'thb',
        automatic_payment_methods: { enabled: true },
        description: `Silver Thief Bug order ${order.order_number}`,
        receipt_email: req.user.email || undefined,
        metadata: { order_id: order.id, order_number: order.order_number, user_id: req.user.id },
      },
      { idempotencyKey: `pi-${order.id}-${order.stripe_payment_intent_id || 'first'}` }
    );

    // Link the intent to the order only if nobody linked another one in the meantime
    let linkQuery = supabase.from('orders').update({ stripe_payment_intent_id: intent.id }).eq('id', order.id);
    linkQuery = order.stripe_payment_intent_id
      ? linkQuery.eq('stripe_payment_intent_id', order.stripe_payment_intent_id)
      : linkQuery.is('stripe_payment_intent_id', null);
    const linked = unwrap(await linkQuery.select('id'));
    if (!linked.length) {
      await stripe.paymentIntents.cancel(intent.id).catch(() => {});
      throw conflict('Payment is already being set up for this order. Please refresh.', 'PAYMENT_IN_PROGRESS');
    }

    res.json({
      client_secret: intent.client_secret,
      payment_intent_id: intent.id,
      amount: order.total,
      expires_at: order.expires_at,
    });
  })
);

/**
 * POST /api/payments/webhook — Stripe webhook (raw body, signature-verified).
 * This is the ONLY place (besides server-side reconciliation) that marks orders as paid.
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
    amount: obj.amount_received ?? obj.amount ?? null,
    currency: obj.currency || null,
    result: 'ignored',
  };

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        record.result = await orders.markPaidFromIntent(obj);
        break;

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
