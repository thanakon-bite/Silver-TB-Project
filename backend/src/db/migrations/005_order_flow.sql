-- ============================================================================
-- Silver Thief Bug — Migration 005: order flow
-- Run AFTER 004_favorites_rls.sql. Safe to re-run. (001–004 must not be re-run after this one.)
--
-- What it does (section numbers below match the headings in this file)
--   1.  One Order Status field: awaiting_payment → paid → waiting_shipping → shipping → confirmed,
--       or cancelled. payment_status is removed; paid_at / refunded_at record the money.
--       Existing orders: pending → awaiting_payment, paid → waiting_shipping, shipped → shipping,
--       delivered → confirmed. Refunded orders keep a refunded_at.
--   1b. Stock split (ADR 0003): products.stock becomes `available` (what can still be ordered) and
--       `on_hand` (what the shop is still responsible for) = old stock + units in open orders.
--       Ordering takes Available, cancelling returns it, Confirmed takes On Hand.
--   1c. Promotions: promotions, their products and gift products, Redemptions; order lines keep the
--       list price, the discount, the Promotion and whether they are a Gift (one Gift line per
--       product and Promotion).
--   1d. Shipping Rule: table shipping_tiers (Shipping Tiers by paid units) + app_settings
--       'free_shipping_threshold', replaced together by set_shipping_rule() (service role only).
--       An older app_settings 'shipping_rule' JSON is moved into the table and removed.
--   2.  create_order (discounts, Gift lines, Redemptions under lock) / cancel_order (always returns
--       Available; the p_restock switch is removed) / mark_order_paid speak the new statuses.
--   3.  Confirmed: confirm_order (customer / admin) and auto_confirm_orders (7 days after Shipping).
--   4.  Stock adjustments move On Hand and Available together.
--   5.  Notifications: a Member's bell. Order events write them in the same transaction (trigger),
--       every cancellation included; the job asks for confirmation 3 days after Shipping
--       (send_confirm_requests).
--   6.  profiles.deactivated_at: a removed Member who has orders can no longer sign in; and
--       announce_started_promotions() tells every active Customer about a Promotion once.
--   7.  admin_order_stats(): Overview numbers counted in the database.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Order Status
-- ---------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by      TEXT;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_confirmed_by_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_confirmed_by_check CHECK (confirmed_by IS NULL OR confirmed_by IN ('customer', 'admin', 'auto'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_status') THEN
    UPDATE public.orders SET refunded_at = COALESCE(cancelled_at, updated_at, NOW())
    WHERE payment_status = 'refunded' AND refunded_at IS NULL;
    UPDATE public.orders SET payment_failed_at = COALESCE(updated_at, NOW())
    WHERE payment_status = 'failed' AND payment_failed_at IS NULL;
    ALTER TABLE public.orders DROP COLUMN payment_status;
  END IF;
END $$;

UPDATE public.orders SET status = CASE status
    WHEN 'pending'   THEN 'awaiting_payment'
    WHEN 'paid'      THEN 'waiting_shipping'
    WHEN 'shipped'   THEN 'shipping'
    WHEN 'delivered' THEN 'confirmed'
    ELSE status END
WHERE status IN ('pending', 'paid', 'shipped', 'delivered');

-- Delivered was set by the admin
UPDATE public.orders
SET confirmed_at = COALESCE(delivered_at, updated_at, NOW()), confirmed_by = 'admin'
WHERE status = 'confirmed' AND confirmed_at IS NULL;

ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'awaiting_payment';
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('awaiting_payment', 'paid', 'waiting_shipping', 'shipping', 'confirmed', 'cancelled'));

DROP INDEX IF EXISTS public.orders_pending_expiry_idx;
CREATE INDEX IF NOT EXISTS orders_awaiting_expiry_idx ON public.orders (expires_at) WHERE status = 'awaiting_payment';

-- ---------------------------------------------------------------------------
-- 1b. On Hand / Available
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'stock') THEN
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS on_hand INTEGER NOT NULL DEFAULT 0;
    UPDATE public.products p
    SET on_hand = p.stock + COALESCE((
      SELECT SUM(oi.quantity)
      FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.product_id = p.id
        AND o.status IN ('awaiting_payment', 'paid', 'waiting_shipping', 'shipping')
        AND NOT o.stock_released
    ), 0);
    ALTER TABLE public.products RENAME COLUMN stock TO available;
  END IF;
END $$;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_on_hand_check;
ALTER TABLE public.products ADD CONSTRAINT products_on_hand_check CHECK (on_hand >= 0);
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_available_within_on_hand;
ALTER TABLE public.products ADD CONSTRAINT products_available_within_on_hand CHECK (available >= 0 AND available <= on_hand);

-- ---------------------------------------------------------------------------
-- 1c. Promotions (CONTEXT.md: Promotion, Discount, Gift, Redemption)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.promotions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_th            TEXT NOT NULL,
  name_en            TEXT,
  starts_at          TIMESTAMPTZ NOT NULL,
  ends_at            TIMESTAMPTZ NOT NULL,
  applies_to_all     BOOLEAN NOT NULL DEFAULT FALSE,
  discount_tiers     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ min_units, type: 'percent'|'baht', value }]
  gift_every         INTEGER,                             -- every X paid covered units ...
  gift_quantity      INTEGER,                             -- ... earn Y free units
  per_customer_limit INTEGER,                             -- NULL = unlimited
  customer_limit     INTEGER,                             -- distinct Customers; NULL = unlimited
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  announced_at       TIMESTAMPTZ,                         -- when every Customer was notified
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT promotions_dates CHECK (ends_at >= starts_at),
  CONSTRAINT promotions_tiers_array CHECK (jsonb_typeof(discount_tiers) = 'array'),
  CONSTRAINT promotions_gift_pair CHECK ((gift_every IS NULL) = (gift_quantity IS NULL) AND COALESCE(gift_every, 1) >= 1 AND COALESCE(gift_quantity, 1) >= 1),
  CONSTRAINT promotions_limits CHECK (COALESCE(per_customer_limit, 1) >= 1 AND COALESCE(customer_limit, 1) >= 1)
);
DROP TRIGGER IF EXISTS promotions_updated_at ON public.promotions;
CREATE TRIGGER promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.promotion_products (
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.promotion_gift_products (
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.promotion_redemptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE RESTRICT,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  released_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (promotion_id, order_id)
);
CREATE INDEX IF NOT EXISTS promotion_redemptions_active_idx ON public.promotion_redemptions (promotion_id, user_id) WHERE released_at IS NULL;

-- Backend-only tables: the API serves what shoppers need.
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_gift_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promotions, public.promotion_products, public.promotion_gift_products, public.promotion_redemptions FROM anon, authenticated;

-- Order lines remember the price before the Promotion, which Promotion applied, and whether the line is a Gift.
-- unit_price stays what the customer pays per unit, so line_total and the order total need no change.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS list_price        NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS discount_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotion_id      UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_gift           BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_product_id_key;
-- One bought line per product; one Gift line per product and Promotion
DROP INDEX IF EXISTS public.order_items_order_product_gift_key;
CREATE UNIQUE INDEX IF NOT EXISTS order_items_order_product_promo_key ON public.order_items
  (order_id, product_id, is_gift, (COALESCE(CASE WHEN is_gift THEN promotion_id END, '00000000-0000-0000-0000-000000000000'::UUID)));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_total NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 1d. Shipping Rule (CONTEXT.md): Shipping Tiers by paid units + an optional Free Shipping Threshold
--     (app_settings 'free_shipping_threshold'). The backend checks the tiers are contiguous from 1
--     and end open; the table guards each row.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shipping_tiers (
  min_units  INTEGER PRIMARY KEY,
  max_units  INTEGER,                 -- NULL = "min_units or more" (the last tier)
  fee        NUMERIC(10, 2) NOT NULL,
  CONSTRAINT shipping_tiers_min_check CHECK (min_units >= 1),
  CONSTRAINT shipping_tiers_max_check CHECK (max_units IS NULL OR max_units >= min_units),
  CONSTRAINT shipping_tiers_fee_check CHECK (fee >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS shipping_tiers_one_open_key ON public.shipping_tiers ((max_units IS NULL)) WHERE max_units IS NULL;
ALTER TABLE public.shipping_tiers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shipping_tiers FROM anon, authenticated;

-- Replaces the whole Shipping Rule in one transaction: a refused tier leaves the old rule in place.
CREATE OR REPLACE FUNCTION public.set_shipping_rule(p_tiers JSONB, p_free_threshold NUMERIC)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_tiers IS NULL OR jsonb_typeof(p_tiers) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_SHIPPING_RULE';
  END IF;
  DELETE FROM public.shipping_tiers WHERE TRUE; -- WHERE: Supabase pg-safeupdate refuses a bare DELETE
  INSERT INTO public.shipping_tiers (min_units, max_units, fee)
  SELECT (t ->> 'min_units')::INTEGER, NULLIF(t ->> 'max_units', '')::INTEGER, (t ->> 'fee')::NUMERIC
  FROM jsonb_array_elements(p_tiers) t;
  IF p_free_threshold IS NULL THEN
    DELETE FROM public.app_settings WHERE key = 'free_shipping_threshold';
  ELSE
    INSERT INTO public.app_settings (key, value, updated_at) VALUES ('free_shipping_threshold', to_jsonb(p_free_threshold), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_shipping_rule(JSONB, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_shipping_rule(JSONB, NUMERIC) TO service_role;

-- Earlier drafts kept the rule as one JSON setting: move it into the table
DO $$
DECLARE
  v_rule JSONB;
BEGIN
  SELECT value INTO v_rule FROM public.app_settings WHERE key = 'shipping_rule';
  IF FOUND THEN
    PERFORM public.set_shipping_rule(COALESCE(v_rule -> 'tiers', '[]'::jsonb), NULLIF(v_rule ->> 'free_threshold', '')::NUMERIC);
    DELETE FROM public.app_settings WHERE key = 'shipping_rule';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Order functions
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_order(UUID, JSONB, JSONB, UUID, NUMERIC, INTEGER);

-- Creates an order, reserves Available and records Redemptions in ONE transaction.
-- Prices come from the products table, never from the client. The backend's pricing module decides
-- each line's discount / Gift; this function checks it stays within the price and that every
-- Promotion used is live and within its limits (re-checked here under lock).
-- Same (user, client_request_id) returns the existing order => no duplicates.
CREATE OR REPLACE FUNCTION public.create_order(
  p_user_id           UUID,
  p_items             JSONB,      -- [{ product_id, quantity, discount_per_unit?, promotion_id?, is_gift? }, ...]
  p_shipping_address  JSONB,
  p_client_request_id UUID,
  p_shipping_fee      NUMERIC DEFAULT 0,
  p_ttl_minutes       INTEGER DEFAULT 30,
  p_redeem            UUID[] DEFAULT '{}'
)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_order    public.orders;
  v_item     RECORD;
  v_promo    public.promotions;
  v_subtotal NUMERIC(10, 2) := 0;
  v_discount NUMERIC(10, 2) := 0;
  v_mine     INTEGER;
  v_people   INTEGER;
  v_counted  BOOLEAN;
  v_pid      UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED';
  END IF;

  IF p_client_request_id IS NOT NULL THEN
    SELECT * INTO v_order FROM public.orders
    WHERE user_id = p_user_id AND client_request_id = p_client_request_id;
    IF FOUND THEN
      RETURN v_order;
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'INVALID_ITEMS';
  END IF;
  IF p_shipping_address IS NULL OR jsonb_typeof(p_shipping_address) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_ADDRESS';
  END IF;
  IF p_shipping_fee IS NULL OR p_shipping_fee < 0 THEN
    RAISE EXCEPTION 'INVALID_SHIPPING_FEE';
  END IF;
  p_redeem := COALESCE(p_redeem, '{}');

  CREATE TEMP TABLE IF NOT EXISTS _order_lines (
    product_id UUID, qty INTEGER, discount NUMERIC(10, 2), promotion_id UUID, is_gift BOOLEAN
  ) ON COMMIT DROP;
  TRUNCATE _order_lines;
  INSERT INTO _order_lines
  SELECT (e ->> 'product_id')::UUID,
         SUM((e ->> 'quantity')::INTEGER)::INTEGER,
         MAX(COALESCE((e ->> 'discount_per_unit')::NUMERIC, 0)),
         (array_agg(NULLIF(e ->> 'promotion_id', '')::UUID))[1],
         COALESCE((e ->> 'is_gift')::BOOLEAN, FALSE)
  FROM jsonb_array_elements(p_items) e
  -- A product bought is one line; a Gift is one line per Promotion that gives it
  GROUP BY 1, 5, CASE WHEN COALESCE((e ->> 'is_gift')::BOOLEAN, FALSE) THEN NULLIF(e ->> 'promotion_id', '') END;

  IF EXISTS (SELECT 1 FROM _order_lines WHERE product_id IS NULL OR qty IS NULL OR qty < 1 OR qty > 99) THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;
  -- A discount or Gift must name a Promotion being redeemed in this order
  IF EXISTS (SELECT 1 FROM _order_lines
             WHERE discount < 0
                OR ((discount > 0 OR is_gift) AND (promotion_id IS NULL OR NOT promotion_id = ANY (p_redeem)))) THEN
    RAISE EXCEPTION 'INVALID_DISCOUNT';
  END IF;

  -- Lock product rows in a stable order (prevents overselling and deadlocks)
  PERFORM 1 FROM public.products
  WHERE id IN (SELECT product_id FROM _order_lines)
  ORDER BY id
  FOR UPDATE;

  FOR v_item IN
    SELECT l.product_id, SUM(l.qty) AS qty, p.id AS found_id, p.name, p.available, p.is_active,
           BOOL_AND(l.is_gift) AS only_gift
    FROM _order_lines l LEFT JOIN public.products p ON p.id = l.product_id
    GROUP BY l.product_id, p.id, p.name, p.available, p.is_active
  LOOP
    -- A Gift may be a product that is not for sale; anything bought must be active
    IF v_item.found_id IS NULL OR (NOT v_item.is_active AND NOT v_item.only_gift) THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE' USING DETAIL = v_item.product_id::TEXT;
    END IF;
    IF v_item.available < v_item.qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING DETAIL = v_item.name;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM _order_lines l JOIN public.products p ON p.id = l.product_id
             WHERE NOT l.is_gift AND l.discount > p.price) THEN
    RAISE EXCEPTION 'INVALID_DISCOUNT';
  END IF;

  SELECT COALESCE(SUM(CASE WHEN l.is_gift THEN 0 ELSE (p.price - l.discount) * l.qty END), 0),
         COALESCE(SUM(CASE WHEN l.is_gift THEN 0 ELSE l.discount * l.qty END), 0)
  INTO v_subtotal, v_discount
  FROM _order_lines l JOIN public.products p ON p.id = l.product_id;

  INSERT INTO public.orders (
    user_id, items, subtotal, discount_total, shipping_fee, total, currency, shipping_address,
    status, client_request_id, expires_at
  ) VALUES (
    p_user_id, NULL, v_subtotal, v_discount, p_shipping_fee, v_subtotal + p_shipping_fee, 'thb', p_shipping_address,
    'awaiting_payment', p_client_request_id,
    NOW() + make_interval(mins => GREATEST(LEAST(p_ttl_minutes, 1440), 5))
  )
  RETURNING * INTO v_order;

  -- Redemptions: each Promotion must be live; its limits are re-checked with the Promotion row locked
  FOREACH v_pid IN ARRAY COALESCE((SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_redeem) x), '{}'::UUID[]) LOOP
    SELECT * INTO v_promo FROM public.promotions WHERE id = v_pid FOR UPDATE;
    IF NOT FOUND OR NOT v_promo.is_active OR NOW() < v_promo.starts_at OR NOW() > v_promo.ends_at THEN
      RAISE EXCEPTION 'PROMOTION_UNAVAILABLE' USING DETAIL = v_pid::TEXT;
    END IF;
    SELECT COUNT(*) FILTER (WHERE user_id = p_user_id),
           COUNT(DISTINCT user_id),
           BOOL_OR(user_id = p_user_id)
    INTO v_mine, v_people, v_counted
    FROM public.promotion_redemptions
    WHERE promotion_id = v_pid AND released_at IS NULL;
    IF (v_promo.per_customer_limit IS NOT NULL AND v_mine >= v_promo.per_customer_limit)
       OR (v_promo.customer_limit IS NOT NULL AND NOT COALESCE(v_counted, FALSE) AND v_people >= v_promo.customer_limit) THEN
      RAISE EXCEPTION 'PROMOTION_LIMIT_REACHED' USING DETAIL = v_promo.name_th;
    END IF;
    INSERT INTO public.promotion_redemptions (promotion_id, user_id, order_id) VALUES (v_pid, p_user_id, v_order.id);
  END LOOP;

  INSERT INTO public.order_items (
    order_id, product_id, product_name, product_image, unit_price, quantity, list_price, discount_per_unit, promotion_id, is_gift
  )
  SELECT v_order.id, p.id, p.name, p.images[1],
         CASE WHEN l.is_gift THEN 0 ELSE p.price - l.discount END,
         l.qty, p.price,
         CASE WHEN l.is_gift THEN p.price ELSE l.discount END,
         l.promotion_id, l.is_gift
  FROM _order_lines l JOIN public.products p ON p.id = l.product_id;

  UPDATE public.products p
  SET available = p.available - l.qty
  FROM (SELECT product_id, SUM(qty) AS qty FROM _order_lines GROUP BY 1) l
  WHERE p.id = l.product_id;

  RETURN v_order;
END;
$$;

-- Cancels an order. Its reserved units return to Available exactly once (spec story 29: every
-- cancel does; a beetle that died is cancelled and then written off with a stock correction of -1).
-- Paid orders (Paid / Waiting Shipping) can only be cancelled after a refund (p_refunded = TRUE).
-- The old 4-argument version (with p_restock) is dropped so no caller can skip the restock.
DROP FUNCTION IF EXISTS public.cancel_order(UUID, TEXT, BOOLEAN, BOOLEAN);
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id UUID,
  p_reason   TEXT,
  p_refunded BOOLEAN DEFAULT FALSE
)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF v_order.status IN ('shipping', 'confirmed') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING DETAIL = v_order.status;
  END IF;
  IF v_order.paid_at IS NOT NULL AND v_order.refunded_at IS NULL AND NOT p_refunded THEN
    RAISE EXCEPTION 'REFUND_REQUIRED';
  END IF;

  IF NOT v_order.stock_released THEN
    PERFORM 1 FROM public.products
    WHERE id IN (SELECT product_id FROM public.order_items WHERE order_id = p_order_id)
    ORDER BY id
    FOR UPDATE;

    UPDATE public.products p
    SET available = p.available + oi.quantity
    FROM (SELECT product_id, SUM(quantity) AS quantity FROM public.order_items WHERE order_id = p_order_id GROUP BY 1) oi
    WHERE p.id = oi.product_id;
  END IF;

  -- The Promotions this order used can be used again
  UPDATE public.promotion_redemptions SET released_at = NOW() WHERE order_id = p_order_id AND released_at IS NULL;

  UPDATE public.orders
  SET status          = 'cancelled',
      stock_released  = TRUE,
      cancelled_at    = COALESCE(cancelled_at, NOW()),
      cancel_reason   = COALESCE(p_reason, cancel_reason),
      refunded_at     = CASE WHEN p_refunded AND paid_at IS NOT NULL THEN COALESCE(refunded_at, NOW()) ELSE refunded_at END,
      needs_attention = CASE WHEN p_refunded THEN FALSE ELSE needs_attention END,
      expires_at      = NULL
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

-- Called ONLY from the verified Stripe webhook (or the reconciliation job, which reads
-- the payment from Stripe). Verifies amount + currency. Idempotent.
-- A paid order moves straight on to waiting_shipping until the LINE OA alert is automated.
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

  IF v_order.paid_at IS NOT NULL THEN
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
    SET paid_at = NOW(),
        stripe_payment_intent_id = p_payment_intent_id,
        needs_attention = TRUE,
        admin_note = concat_ws(E'\n', admin_note,
          'Payment arrived after the order was cancelled — refund it, or restore the order manually.')
    WHERE id = p_order_id;
    RETURN 'paid_after_cancel';
  END IF;

  UPDATE public.orders
  SET status = 'waiting_shipping',
      paid_at = NOW(),
      payment_failed_at = NULL,
      stripe_payment_intent_id = p_payment_intent_id,
      expires_at = NULL
  WHERE id = p_order_id;

  RETURN 'paid';
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Confirmed
-- ---------------------------------------------------------------------------

-- The customer received a Shipping order: they said so, an admin did, or the auto-confirm job.
-- Confirming an already Confirmed order returns it unchanged.
CREATE OR REPLACE FUNCTION public.confirm_order(p_order_id UUID, p_by TEXT)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
BEGIN
  IF p_by IS NULL OR p_by NOT IN ('customer', 'admin', 'auto') THEN
    RAISE EXCEPTION 'INVALID_CONFIRMER';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF v_order.status = 'confirmed' THEN
    RETURN v_order;
  END IF;
  IF v_order.status <> 'shipping' THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING DETAIL = v_order.status;
  END IF;

  -- The units have reached the customer: they leave On Hand (their Available went at ordering)
  PERFORM 1 FROM public.products
  WHERE id IN (SELECT product_id FROM public.order_items WHERE order_id = p_order_id)
  ORDER BY id
  FOR UPDATE;
  UPDATE public.products p
  SET on_hand = p.on_hand - oi.quantity
  FROM (SELECT product_id, SUM(quantity) AS quantity FROM public.order_items WHERE order_id = p_order_id GROUP BY 1) oi
  WHERE p.id = oi.product_id;

  UPDATE public.orders
  SET status = 'confirmed', confirmed_at = NOW(), confirmed_by = p_by
  WHERE id = p_order_id
  RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;

-- Background job: confirm Shipping orders shipped more than p_days ago. Returns how many.
CREATE OR REPLACE FUNCTION public.auto_confirm_orders(p_days INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_id    UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.orders
    WHERE status = 'shipping' AND shipped_at < NOW() - make_interval(days => p_days)
    ORDER BY shipped_at
    LIMIT 200
  LOOP
    PERFORM public.confirm_order(v_id, 'auto');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Stock adjustments
-- ---------------------------------------------------------------------------

-- Receiving stock (positive delta) or correcting a count (negative): moves On Hand and Available
-- together, so reserved units are never touched. Neither may go below zero.
CREATE OR REPLACE FUNCTION public.adjust_product_stock(p_product_id UUID, p_delta INTEGER)
RETURNS public.products
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_product public.products;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 OR abs(p_delta) > 100000 THEN
    RAISE EXCEPTION 'INVALID_DELTA';
  END IF;
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
  END IF;
  IF v_product.available + p_delta < 0 OR v_product.on_hand + p_delta < 0 THEN
    RAISE EXCEPTION 'STOCK_BELOW_ZERO';
  END IF;
  UPDATE public.products
  SET on_hand = on_hand + p_delta, available = available + p_delta
  WHERE id = p_product_id
  RETURNING * INTO v_product;
  RETURN v_product;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_product_stock(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(UUID, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.create_order(UUID, JSONB, JSONB, UUID, NUMERIC, INTEGER, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_order(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_order_paid(UUID, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(UUID, JSONB, JSONB, UUID, NUMERIC, INTEGER, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(UUID, TEXT, BIGINT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.confirm_order(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_confirm_orders(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_confirm_orders(INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Notifications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  order_id   UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('awaiting_payment', 'shipping', 'confirm_request', 'cancelled', 'promotion'));

-- Each order event notifies once
CREATE UNIQUE INDEX IF NOT EXISTS notifications_order_type_key ON public.notifications (order_id, type) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Order events → the customer's bell. Every cancellation is notified with its reason, the
-- customer's own too (a record of it, and "replaced by a new checkout" explains a vanished order).
CREATE OR REPLACE FUNCTION public.notify_order_event()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_type TEXT;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'awaiting_payment' THEN v_type := 'awaiting_payment'; END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'shipping' THEN
      v_type := 'shipping';
    ELSIF NEW.status = 'cancelled' THEN
      v_type := 'cancelled';
    END IF;
  END IF;

  IF v_type IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, order_id, data)
    VALUES (NEW.user_id, v_type, NEW.id, jsonb_strip_nulls(jsonb_build_object(
      'order_number', NEW.order_number,
      'carrier', CASE WHEN v_type = 'shipping' THEN NEW.carrier END,
      'tracking_number', CASE WHEN v_type = 'shipping' THEN NEW.tracking_number END,
      'cancel_reason', CASE WHEN v_type = 'cancelled' THEN NEW.cancel_reason END,
      'refunded', CASE WHEN v_type = 'cancelled' AND NEW.refunded_at IS NOT NULL THEN TRUE END
    )))
    ON CONFLICT (order_id, type) WHERE order_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_notify ON public.orders;
CREATE TRIGGER orders_notify
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_event();

-- Background job: Shipping orders shipped more than p_days ago get one "please confirm receipt".
CREATE OR REPLACE FUNCTION public.send_confirm_requests(p_days INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.notifications (user_id, type, order_id, data)
  SELECT o.user_id, 'confirm_request', o.id, jsonb_build_object('order_number', o.order_number)
  FROM public.orders o
  WHERE o.status = 'shipping' AND o.user_id IS NOT NULL
    AND o.shipped_at < NOW() - make_interval(days => p_days)
  ON CONFLICT (order_id, type) WHERE order_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Deactivated Members (removed from the admin page but they have orders)
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- Background job: each Promotion that has started (and is on, and not over) is announced once to
-- every active Customer. Returns how many Promotions were announced.
CREATE OR REPLACE FUNCTION public.announce_started_promotions()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_promo public.promotions;
  v_count INTEGER := 0;
BEGIN
  FOR v_promo IN
    SELECT * FROM public.promotions
    WHERE announced_at IS NULL AND is_active AND starts_at <= NOW() AND ends_at >= NOW()
    ORDER BY starts_at
    FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.notifications (user_id, type, data)
    SELECT p.id, 'promotion', jsonb_strip_nulls(jsonb_build_object('promotion_id', v_promo.id, 'name_th', v_promo.name_th, 'name_en', v_promo.name_en))
    FROM public.profiles p
    WHERE p.role = 'user' AND p.deactivated_at IS NULL;
    UPDATE public.promotions SET announced_at = NOW() WHERE id = v_promo.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_order_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_confirm_requests(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_confirm_requests(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.announce_started_promotions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.announce_started_promotions() TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Overview numbers, counted in the database (any number of orders)
-- ---------------------------------------------------------------------------

-- Orders per status, how many are Confirmed, and Revenue: totals of Confirmed orders not refunded.
CREATE OR REPLACE FUNCTION public.admin_order_stats()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'by_status', COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) AS n FROM public.orders GROUP BY status) s), '{}'::jsonb),
    'confirmed', (SELECT count(*) FROM public.orders WHERE status = 'confirmed'),
    'revenue', (SELECT COALESCE(SUM(total), 0) FROM public.orders WHERE status = 'confirmed' AND refunded_at IS NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.admin_order_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_order_stats() TO service_role;
