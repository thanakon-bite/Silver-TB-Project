-- ============================================================================
-- Silver Thief Bug — Migration 001: secure commerce
-- Run AFTER schema.sql, in the Supabase SQL Editor (or `psql`), once.
-- Safe to re-run: every statement is guarded (IF NOT EXISTS / DROP ... IF EXISTS).
--
-- What it does
--   1. is_admin() helper + auto-create profile on sign-up (Supabase Auth)
--   2. Locks down profiles so users can never change their own role
--   3. Thai geography tables (province / district / subdistrict + postal code)
--   4. Saved shipping addresses
--   5. Orders: order number, order_items table, idempotency key, stock
--      reservation expiry, fulfilment fields; removes client-side order inserts
--   6. payment_events (Stripe webhook audit) and app_settings (LINE target)
--   7. Atomic functions: create_order, cancel_order, mark_order_paid,
--      adjust_product_stock, increment_product_views — callable by the backend (service_role) only
--   8. Storage bucket `product-images` writable by admins only
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Helpers & profiles
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND p.email IS DISTINCT FROM u.email;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_full_name_len;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_len CHECK (char_length(full_name) BETWEEN 1 AND 120) NOT VALID;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_len;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_len CHECK (phone IS NULL OR char_length(phone) <= 30) NOT VALID;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- New Supabase Auth user -> profile row (role is ALWAYS 'user'; promote admins manually)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(left(btrim(NEW.raw_user_meta_data ->> 'full_name'), 120), ''), split_part(NEW.email, '@', 1)),
    NULLIF(left(btrim(NEW.raw_user_meta_data ->> 'phone'), 30), ''),
    NEW.email,
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_change();

-- Users may edit only their name and phone — never role / email / line_user_id
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, phone) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Products
-- ---------------------------------------------------------------------------

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_name_len;
ALTER TABLE public.products
  ADD CONSTRAINT products_name_len CHECK (char_length(name) BETWEEN 1 AND 200) NOT VALID;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_images_max;
ALTER TABLE public.products
  ADD CONSTRAINT products_images_max CHECK (cardinality(images) <= 10) NOT VALID;

CREATE INDEX IF NOT EXISTS products_active_category_idx ON public.products (is_active, category);

DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.products FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Thai geography (seed with: npm run seed:thai-geo)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.th_provinces (
  id      INTEGER PRIMARY KEY,
  name_th TEXT NOT NULL,
  name_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.th_districts (
  id          INTEGER PRIMARY KEY,
  province_id INTEGER NOT NULL REFERENCES public.th_provinces(id),
  name_th     TEXT NOT NULL,
  name_en     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS th_districts_province_idx ON public.th_districts (province_id);

CREATE TABLE IF NOT EXISTS public.th_subdistricts (
  id          INTEGER PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES public.th_districts(id),
  name_th     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  postal_code TEXT NOT NULL CHECK (postal_code ~ '^[0-9]{5}$')
);
CREATE INDEX IF NOT EXISTS th_subdistricts_district_idx ON public.th_subdistricts (district_id);
CREATE INDEX IF NOT EXISTS th_subdistricts_postal_idx ON public.th_subdistricts (postal_code);

ALTER TABLE public.th_provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.th_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.th_subdistricts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read provinces" ON public.th_provinces;
CREATE POLICY "Public read provinces" ON public.th_provinces FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Public read districts" ON public.th_districts;
CREATE POLICY "Public read districts" ON public.th_districts FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Public read subdistricts" ON public.th_subdistricts;
CREATE POLICY "Public read subdistricts" ON public.th_subdistricts FOR SELECT USING (TRUE);

-- ---------------------------------------------------------------------------
-- 4. Saved addresses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.addresses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label          TEXT CHECK (label IS NULL OR char_length(label) <= 50),
  recipient_name TEXT NOT NULL CHECK (char_length(recipient_name) BETWEEN 1 AND 120),
  phone          TEXT NOT NULL CHECK (phone ~ '^[0-9+ -]{9,20}$'),
  address_line   TEXT NOT NULL CHECK (char_length(address_line) BETWEEN 1 AND 300),
  subdistrict_id INTEGER NOT NULL REFERENCES public.th_subdistricts(id),
  postal_code    TEXT NOT NULL CHECK (postal_code ~ '^[0-9]{5}$'),
  is_default     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS addresses_user_idx ON public.addresses (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_per_user
  ON public.addresses (user_id) WHERE is_default;

DROP TRIGGER IF EXISTS addresses_updated_at ON public.addresses;
CREATE TRIGGER addresses_updated_at BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own addresses" ON public.addresses;
CREATE POLICY "Users manage own addresses" ON public.addresses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view addresses" ON public.addresses;
CREATE POLICY "Admins can view addresses" ON public.addresses
  FOR SELECT USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Orders
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE sql VOLATILE SET search_path = public
AS $$
  SELECT 'STB-' || to_char(NOW() AT TIME ZONE 'Asia/Bangkok', 'YYMMDD') || '-'
         || lpad(nextval('public.order_number_seq')::TEXT, 5, '0');
$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number      TEXT,
  ADD COLUMN IF NOT EXISTS subtotal          NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS shipping_fee      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency          TEXT NOT NULL DEFAULT 'thb',
  ADD COLUMN IF NOT EXISTS client_request_id UUID,
  ADD COLUMN IF NOT EXISTS expires_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stock_released    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason     TEXT,
  ADD COLUMN IF NOT EXISTS carrier           TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number   TEXT,
  ADD COLUMN IF NOT EXISTS admin_note        TEXT,
  ADD COLUMN IF NOT EXISTS needs_attention   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ;

UPDATE public.orders SET order_number = public.generate_order_number() WHERE order_number IS NULL;
UPDATE public.orders SET subtotal = total WHERE subtotal IS NULL;

-- Unpaid orders from before this migration reserved stock with no expiry: give them a 24h grace period
UPDATE public.orders
SET expires_at = NOW() + INTERVAL '24 hours'
WHERE status = 'pending' AND payment_status IN ('unpaid', 'failed') AND expires_at IS NULL;

ALTER TABLE public.orders ALTER COLUMN order_number SET DEFAULT public.generate_order_number();
ALTER TABLE public.orders ALTER COLUMN order_number SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN subtotal SET NOT NULL;
-- schema.sql declared user_id NOT NULL + ON DELETE SET NULL, which blocks deleting users.
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
-- Line items now live in order_items; the JSONB column is kept read-only for history.
ALTER TABLE public.orders ALTER COLUMN items DROP NOT NULL;
COMMENT ON COLUMN public.orders.items IS 'DEPRECATED — use order_items. Kept for orders created before migration 001.';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_amounts_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_amounts_check CHECK (subtotal >= 0 AND shipping_fee >= 0 AND total = subtotal + shipping_fee) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders (order_number);
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_intent_key
  ON public.orders (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_user_request_key
  ON public.orders (user_id, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_user_created_idx ON public.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_pending_expiry_idx ON public.orders (expires_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,
  product_image TEXT,
  unit_price    NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  line_total    NUMERIC(10, 2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
  UNIQUE (order_id, product_id)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_idx ON public.order_items (product_id);

-- Backfill order_items from the old JSONB column
INSERT INTO public.order_items (order_id, product_id, product_name, unit_price, quantity)
SELECT
  o.id,
  (SELECT p.id FROM public.products p
    WHERE (i ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND p.id = (i ->> 'product_id')::UUID),
  COALESCE(NULLIF(i ->> 'name', ''), 'Unknown item'),
  GREATEST(COALESCE((i ->> 'price')::NUMERIC, 0), 0),
  GREATEST(COALESCE((i ->> 'quantity')::INTEGER, 1), 1)
FROM public.orders o
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::JSONB END
) AS i
WHERE NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
ON CONFLICT DO NOTHING;

-- Orders are created only by the backend (create_order). Drop the client insert policy.
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (public.is_admin());

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon, authenticated;
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    OR public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 6. Payment events & settings (backend-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_events (
  id                TEXT PRIMARY KEY,          -- Stripe event id (evt_...)
  type              TEXT NOT NULL,
  payment_intent_id TEXT,
  order_id          UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount            BIGINT,
  currency          TEXT,
  result            TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payment_events_order_idx ON public.payment_events (order_id);
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_events FROM anon, authenticated;
DROP POLICY IF EXISTS "Admins can view payment events" ON public.payment_events;
CREATE POLICY "Admins can view payment events" ON public.payment_events
  FOR SELECT USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Atomic order functions (service_role only)
-- ---------------------------------------------------------------------------

-- Creates an order and reserves stock in ONE transaction.
-- Prices come from the products table, never from the client.
-- Same (user, client_request_id) returns the existing order => no duplicates.
CREATE OR REPLACE FUNCTION public.create_order(
  p_user_id           UUID,
  p_items             JSONB,      -- [{ "product_id": uuid, "quantity": int }, ...]
  p_shipping_address  JSONB,
  p_client_request_id UUID,
  p_shipping_fee      NUMERIC DEFAULT 0,
  p_ttl_minutes       INTEGER DEFAULT 30
)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_order    public.orders;
  v_item     RECORD;
  v_subtotal NUMERIC(10, 2) := 0;
  v_ids      UUID[];
  v_qtys     INTEGER[];
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

  SELECT array_agg(product_id ORDER BY product_id), array_agg(qty ORDER BY product_id)
  INTO v_ids, v_qtys
  FROM (
    SELECT (e ->> 'product_id')::UUID AS product_id, SUM((e ->> 'quantity')::INTEGER)::INTEGER AS qty
    FROM jsonb_array_elements(p_items) e
    GROUP BY 1
  ) s;

  IF EXISTS (SELECT 1 FROM unnest(v_ids, v_qtys) AS r(product_id, qty)
             WHERE r.product_id IS NULL OR r.qty IS NULL OR r.qty < 1 OR r.qty > 99) THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;

  -- Lock product rows in a stable order (prevents overselling and deadlocks)
  PERFORM 1 FROM public.products
  WHERE id = ANY (v_ids)
  ORDER BY id
  FOR UPDATE;

  FOR v_item IN
    SELECT r.product_id, r.qty, p.id AS found_id, p.name, p.price, p.stock, p.is_active
    FROM unnest(v_ids, v_qtys) AS r(product_id, qty)
    LEFT JOIN public.products p ON p.id = r.product_id
  LOOP
    IF v_item.found_id IS NULL OR NOT v_item.is_active THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE' USING DETAIL = v_item.product_id::TEXT;
    END IF;
    IF v_item.stock < v_item.qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING DETAIL = v_item.name;
    END IF;
    v_subtotal := v_subtotal + (v_item.price * v_item.qty);
  END LOOP;

  INSERT INTO public.orders (
    user_id, items, subtotal, shipping_fee, total, currency, shipping_address,
    status, payment_status, client_request_id, expires_at
  ) VALUES (
    p_user_id, NULL, v_subtotal, p_shipping_fee, v_subtotal + p_shipping_fee, 'thb', p_shipping_address,
    'pending', 'unpaid', p_client_request_id,
    NOW() + make_interval(mins => GREATEST(LEAST(p_ttl_minutes, 1440), 5))
  )
  RETURNING * INTO v_order;

  INSERT INTO public.order_items (order_id, product_id, product_name, product_image, unit_price, quantity)
  SELECT v_order.id, p.id, p.name, p.images[1], p.price, r.qty
  FROM unnest(v_ids, v_qtys) AS r(product_id, qty) JOIN public.products p ON p.id = r.product_id;

  UPDATE public.products p
  SET stock = p.stock - r.qty
  FROM unnest(v_ids, v_qtys) AS r(product_id, qty)
  WHERE p.id = r.product_id;

  RETURN v_order;
END;
$$;

-- Cancels an order. Unpaid orders always release stock.
-- Paid orders can only be cancelled after a refund (p_refunded = TRUE).
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id UUID,
  p_reason   TEXT,
  p_restock  BOOLEAN DEFAULT TRUE,
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
  IF v_order.status IN ('shipped', 'delivered') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING DETAIL = v_order.status;
  END IF;
  IF v_order.payment_status = 'paid' AND NOT p_refunded THEN
    RAISE EXCEPTION 'REFUND_REQUIRED';
  END IF;

  -- Never-paid orders always give their reserved stock back
  IF v_order.payment_status IN ('unpaid', 'failed') THEN
    p_restock := TRUE;
  END IF;

  IF p_restock AND NOT v_order.stock_released THEN
    PERFORM 1 FROM public.products
    WHERE id IN (SELECT product_id FROM public.order_items WHERE order_id = p_order_id)
    ORDER BY id
    FOR UPDATE;

    UPDATE public.products p
    SET stock = p.stock + oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id AND p.id = oi.product_id;
  END IF;

  UPDATE public.orders
  SET status         = 'cancelled',
      stock_released = stock_released OR p_restock,
      cancelled_at   = COALESCE(cancelled_at, NOW()),
      cancel_reason  = COALESCE(p_reason, cancel_reason),
      payment_status = CASE WHEN p_refunded AND payment_status = 'paid' THEN 'refunded' ELSE payment_status END,
      needs_attention = CASE WHEN p_refunded THEN FALSE ELSE needs_attention END,
      expires_at     = NULL
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

-- Called ONLY from the verified Stripe webhook (or the reconciliation job,
-- which reads the PaymentIntent from Stripe). Verifies amount + currency.
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
      status = 'confirmed',
      paid_at = NOW(),
      stripe_payment_intent_id = p_payment_intent_id,
      expires_at = NULL
  WHERE id = p_order_id;

  RETURN 'paid';
END;
$$;

-- Atomic inventory adjustment for admins (never overwrites concurrent reservations)
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
  IF v_product.stock + p_delta < 0 THEN
    RAISE EXCEPTION 'STOCK_BELOW_ZERO';
  END IF;
  UPDATE public.products
  SET stock = stock + p_delta
  WHERE id = p_product_id
  RETURNING * INTO v_product;
  RETURN v_product;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_product_views(p_product_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  UPDATE public.products SET views = COALESCE(views, 0) + 1 WHERE id = p_product_id AND is_active;
$$;

-- Supabase grants EXECUTE on new functions to anon/authenticated by default — revoke it.
REVOKE ALL ON FUNCTION public.create_order(UUID, JSONB, JSONB, UUID, NUMERIC, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_order(UUID, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_order_paid(UUID, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_product_views(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adjust_product_stock(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_order_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_user_email_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(UUID, JSONB, JSONB, UUID, NUMERIC, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(UUID, TEXT, BIGINT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_product_views(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;

-- ---------------------------------------------------------------------------
-- 8. Storage: product images (public read via URL, admin-only writes)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Admins read product images" ON storage.objects;
CREATE POLICY "Admins read product images" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'product-images' AND public.is_admin());
DROP POLICY IF EXISTS "Admins upload product images" ON storage.objects;
CREATE POLICY "Admins upload product images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND public.is_admin());
DROP POLICY IF EXISTS "Admins update product images" ON storage.objects;
CREATE POLICY "Admins update product images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND public.is_admin());
DROP POLICY IF EXISTS "Admins delete product images" ON storage.objects;
CREATE POLICY "Admins delete product images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND public.is_admin());

COMMIT;

-- ---------------------------------------------------------------------------
-- After running: promote your first admin (replace the email):
--   UPDATE public.profiles SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
-- ---------------------------------------------------------------------------
