-- ============================================================================
-- Silver Thief Bug — Migration 002: spec alignment
-- Run AFTER 001_secure_commerce.sql. Safe to re-run.
--
-- What it does
--   1. Products: Thai name/description columns + beetle `attributes` JSONB
--      (species, sex, stage, size_mm) — shape is validated by the backend
--   2. Order status "confirmed" renamed to "paid" (pending → paid → shipped | cancelled;
--      "delivered" stays as an optional final step after shipped)
--   3. Stripe Checkout (hosted): orders.stripe_checkout_session_id
--   4. LINE: admin target now comes only from env vars — drop the group captured by
--      the old webhook (anyone who invited the bot to a group could receive order PII)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Products
-- ---------------------------------------------------------------------------

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_th        TEXT,
  ADD COLUMN IF NOT EXISTS description_th TEXT,
  ADD COLUMN IF NOT EXISTS attributes     JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_attributes_object;
ALTER TABLE public.products
  ADD CONSTRAINT products_attributes_object CHECK (jsonb_typeof(attributes) = 'object');

CREATE INDEX IF NOT EXISTS products_attributes_gin ON public.products USING GIN (attributes);

-- ---------------------------------------------------------------------------
-- 2. Order status: confirmed → paid
-- ---------------------------------------------------------------------------

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
UPDATE public.orders SET status = 'paid' WHERE status = 'confirmed';
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled'));

-- Called ONLY from the verified Stripe webhook (or the reconciliation job, which reads
-- the payment from Stripe). Verifies amount + currency. Idempotent.
-- Returns: 'paid' (first time) | 'already_paid' | 'order_not_found'
--          | 'intent_mismatch' | 'amount_mismatch' | 'paid_after_cancel'
CREATE OR REPLACE FUNCTION public.mark_order_paid(
  p_order_id          UUID,
  p_payment_intent_id TEXT,
  p_amount            BIGINT,
  p_currency          TEXT
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'order_not_found';
  END IF;

  IF v_order.payment_status IN ('paid', 'refunded') THEN
    RETURN 'already_paid';
  END IF;

  IF v_order.stripe_payment_intent_id IS NOT NULL
     AND v_order.stripe_payment_intent_id <> p_payment_intent_id THEN
    UPDATE public.orders
    SET needs_attention = TRUE,
        admin_note = concat_ws(E'\n', admin_note,
          'Payment received on unexpected PaymentIntent ' || p_payment_intent_id || ' — check Stripe and refund if duplicate.')
    WHERE id = p_order_id;
    RETURN 'intent_mismatch';
  END IF;

  IF p_amount IS DISTINCT FROM ROUND(v_order.total * 100)::BIGINT
     OR lower(p_currency) IS DISTINCT FROM v_order.currency THEN
    UPDATE public.orders
    SET needs_attention = TRUE,
        admin_note = concat_ws(E'\n', admin_note,
          format('Amount mismatch: Stripe %s %s vs order %s %s', p_amount, p_currency, ROUND(v_order.total * 100), v_order.currency))
    WHERE id = p_order_id;
    RETURN 'amount_mismatch';
  END IF;

  IF v_order.status = 'cancelled' THEN
    UPDATE public.orders
    SET payment_status = 'paid',
        paid_at = NOW(),
        stripe_payment_intent_id = p_payment_intent_id,
        needs_attention = TRUE,
        admin_note = concat_ws(E'\n', admin_note,
          'Payment arrived after the order was cancelled — refund it, or restore the order manually.')
    WHERE id = p_order_id;
    RETURN 'paid_after_cancel';
  END IF;

  UPDATE public.orders
  SET payment_status = 'paid',
      status = 'paid',
      paid_at = NOW(),
      stripe_payment_intent_id = p_payment_intent_id,
      expires_at = NULL
  WHERE id = p_order_id;

  RETURN 'paid';
END;
$$;

REVOKE ALL ON FUNCTION public.mark_order_paid(UUID, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(UUID, TEXT, BIGINT, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Stripe Checkout Session per order
-- ---------------------------------------------------------------------------

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_session_key
  ON public.orders (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. LINE target is env-only (LINE_OWNER_USER_ID)
-- ---------------------------------------------------------------------------

DELETE FROM public.app_settings WHERE key = 'line_admin_group';
