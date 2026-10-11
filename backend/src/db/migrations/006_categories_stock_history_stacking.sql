-- ============================================================================
-- Silver Thief Bug — Migration 006: Categories, Stock History, Stackable Promotions, more Notifications
-- Run AFTER 005_order_flow.sql. Safe to re-run.
--
--   1. Stock History (CONTEXT.md: Stock History, Stock Change): every change to a product's On Hand or
--      Available is written by a trigger, in the same transaction. The order functions tag their changes
--      with the Order (stock_context), the Admin's "set On Hand" with who and why.
--   2. Admins set On Hand to a counted number (set_product_on_hand), never below the units Reserved.
--   3. Categories and beetle Families become Admin-managed tables (ADR 0005).
--   4. Promotions are Stackable or Exclusive (ADR 0004); order lines remember every Promotion they used.
--   5. Notifications: a promotion column with a foreign key; Confirmed orders notify the customer or the
--      Admins; Promotions are announced when created and again when they start.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Stock History
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stock_changes (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  on_hand_delta   INTEGER NOT NULL DEFAULT 0,
  available_delta INTEGER NOT NULL DEFAULT 0,
  on_hand_after   INTEGER NOT NULL,
  available_after INTEGER NOT NULL,
  order_id        UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  actor_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.stock_changes DROP CONSTRAINT IF EXISTS stock_changes_kind_check;
ALTER TABLE public.stock_changes
  ADD CONSTRAINT stock_changes_kind_check
  CHECK (kind IN ('opening', 'created', 'set_on_hand', 'order_created', 'order_cancelled', 'order_confirmed', 'other'));
CREATE INDEX IF NOT EXISTS stock_changes_product_idx ON public.stock_changes (product_id, id DESC);

-- Backend-only: the admin API serves it
ALTER TABLE public.stock_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stock_changes FROM anon, authenticated;

-- One opening entry per product that has no history yet: On Hand and Available as they stand today
INSERT INTO public.stock_changes (product_id, kind, on_hand_after, available_after)
SELECT p.id, 'opening', p.on_hand, p.available
FROM public.products p
WHERE NOT EXISTS (SELECT 1 FROM public.stock_changes s WHERE s.product_id = p.id);

-- What the next stock changes in this transaction are about (read by the trigger below)
CREATE OR REPLACE FUNCTION public.stock_context(p_kind TEXT, p_order UUID DEFAULT NULL, p_actor UUID DEFAULT NULL, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('stb.stock_kind', COALESCE(p_kind, ''), TRUE);
  PERFORM set_config('stb.stock_order', COALESCE(p_order::TEXT, ''), TRUE);
  PERFORM set_config('stb.stock_actor', COALESCE(p_actor::TEXT, ''), TRUE);
  PERFORM set_config('stb.stock_note', COALESCE(p_note, ''), TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_stock_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_kind  TEXT := NULLIF(current_setting('stb.stock_kind', TRUE), '');
  v_order UUID := NULLIF(current_setting('stb.stock_order', TRUE), '')::UUID;
  v_actor UUID := NULLIF(current_setting('stb.stock_actor', TRUE), '')::UUID;
  v_note  TEXT := NULLIF(current_setting('stb.stock_note', TRUE), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.stock_changes (product_id, kind, on_hand_delta, available_delta, on_hand_after, available_after, actor_id, note)
    VALUES (NEW.id, 'created', NEW.on_hand, NEW.available, NEW.on_hand, NEW.available, v_actor, v_note);
    RETURN NEW;
  END IF;
  IF NEW.on_hand = OLD.on_hand AND NEW.available = OLD.available THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.stock_changes (product_id, kind, on_hand_delta, available_delta, on_hand_after, available_after, order_id, actor_id, note)
  VALUES (NEW.id, COALESCE(v_kind, 'other'), NEW.on_hand - OLD.on_hand, NEW.available - OLD.available,
          NEW.on_hand, NEW.available, v_order, v_actor, v_note);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_stock_history ON public.products;
CREATE TRIGGER products_stock_history
  AFTER INSERT OR UPDATE OF on_hand, available ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_stock_change();

-- ---------------------------------------------------------------------------
-- 2. Admin sets On Hand to a counted number
-- ---------------------------------------------------------------------------

-- Available moves by the same difference, so the units Reserved by open orders are untouched;
-- a count below them is refused (DETAIL = the lowest allowed).
CREATE OR REPLACE FUNCTION public.set_product_on_hand(p_product_id UUID, p_on_hand INTEGER, p_actor UUID DEFAULT NULL, p_note TEXT DEFAULT NULL)
RETURNS public.products
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_product  public.products;
  v_reserved INTEGER;
BEGIN
  IF p_on_hand IS NULL OR p_on_hand < 0 OR p_on_hand > 100000 THEN
    RAISE EXCEPTION 'INVALID_ON_HAND';
  END IF;
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
  END IF;
  v_reserved := v_product.on_hand - v_product.available;
  IF p_on_hand < v_reserved THEN
    RAISE EXCEPTION 'BELOW_RESERVED' USING DETAIL = v_reserved::TEXT;
  END IF;
  PERFORM public.stock_context('set_on_hand', NULL, p_actor, NULLIF(btrim(COALESCE(p_note, '')), ''));
  UPDATE public.products
  SET on_hand = p_on_hand, available = p_on_hand - v_reserved
  WHERE id = p_product_id
  RETURNING * INTO v_product;
  RETURN v_product;
END;
$$;

REVOKE ALL ON FUNCTION public.set_product_on_hand(UUID, INTEGER, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_product_on_hand(UUID, INTEGER, UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.stock_context(TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_stock_change() FROM PUBLIC, anon, authenticated;

-- The old delta function is replaced by set_product_on_hand
DROP FUNCTION IF EXISTS public.adjust_product_stock(UUID, INTEGER);

-- ---------------------------------------------------------------------------
-- 3. Categories and beetle Families (ADR 0005)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.categories (
  slug       TEXT PRIMARY KEY,
  name_th    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT categories_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 40)
);

INSERT INTO public.categories (slug, name_th, name_en, sort_order, is_system) VALUES
  ('beetle', 'ด้วง', 'Beetles', 1, TRUE),
  ('food', 'อาหาร', 'Food', 2, FALSE),
  ('log', 'ขอนไม้และวัสดุเพาะ', 'Logs & substrate', 3, FALSE),
  ('gear', 'อุปกรณ์', 'Gear', 4, FALSE)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_fkey;
ALTER TABLE public.products
  ADD CONSTRAINT products_category_fkey FOREIGN KEY (category) REFERENCES public.categories(slug) ON DELETE RESTRICT;

-- `beetle` carries the live-beetle rules: it can be renamed, never deleted
CREATE OR REPLACE FUNCTION public.protect_system_category()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.is_system THEN
    RAISE EXCEPTION 'SYSTEM_CATEGORY';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS categories_protect_system ON public.categories;
CREATE TRIGGER categories_protect_system BEFORE DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.protect_system_category();

CREATE TABLE IF NOT EXISTS public.beetle_families (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT beetle_families_name CHECK (length(btrim(name)) BETWEEN 1 AND 60)
);

-- Seed from the Families already typed on beetles
INSERT INTO public.beetle_families (name, sort_order)
SELECT f, ROW_NUMBER() OVER (ORDER BY f)
FROM (SELECT DISTINCT btrim(attributes ->> 'family') AS f FROM public.products
      WHERE category = 'beetle' AND COALESCE(btrim(attributes ->> 'family'), '') <> '') s
ON CONFLICT (name) DO NOTHING;

-- Renaming a Family renames it on every beetle that has it, in one transaction
CREATE OR REPLACE FUNCTION public.rename_beetle_family(p_id UUID, p_name TEXT)
RETURNS public.beetle_families
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_family public.beetle_families;
  v_old    TEXT;
BEGIN
  SELECT * INTO v_family FROM public.beetle_families WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAMILY_NOT_FOUND';
  END IF;
  v_old := v_family.name;
  UPDATE public.beetle_families SET name = btrim(p_name) WHERE id = p_id RETURNING * INTO v_family;
  UPDATE public.products
  SET attributes = attributes || jsonb_build_object('family', v_family.name)
  WHERE attributes ->> 'family' = v_old;
  RETURN v_family;
END;
$$;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beetle_families ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.categories, public.beetle_families FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.rename_beetle_family(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rename_beetle_family(UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.protect_system_category() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Stackable / Exclusive Promotions (ADR 0004)
-- ---------------------------------------------------------------------------

ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS stacking TEXT NOT NULL DEFAULT 'exclusive';
ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS promotions_stacking_check;
ALTER TABLE public.promotions ADD CONSTRAINT promotions_stacking_check CHECK (stacking IN ('stackable', 'exclusive'));

-- When Customers were told a Promotion is coming (announced_at: told it has started)
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS previewed_at TIMESTAMPTZ;
UPDATE public.promotions SET previewed_at = announced_at WHERE previewed_at IS NULL AND announced_at IS NOT NULL;

-- Every Promotion an order line used; promotion_id stays the first of them
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS promotion_ids UUID[] NOT NULL DEFAULT '{}';
UPDATE public.order_items SET promotion_ids = ARRAY[promotion_id] WHERE promotion_id IS NOT NULL AND promotion_ids = '{}';

-- The Promotions an order line names: its promotion_ids list, else its single promotion_id
CREATE OR REPLACE FUNCTION public.line_promotion_ids(p_ids JSONB, p_id UUID)
RETURNS UUID[]
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN jsonb_typeof(p_ids) = 'array'
              THEN ARRAY(SELECT x::UUID FROM jsonb_array_elements_text(p_ids) x)
              ELSE ARRAY_REMOVE(ARRAY[p_id], NULL) END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Notifications
-- ---------------------------------------------------------------------------

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES public.promotions(id) ON DELETE CASCADE;
UPDATE public.notifications n
SET promotion_id = (n.data ->> 'promotion_id')::UUID
WHERE n.promotion_id IS NULL
  AND n.data ->> 'promotion_id' ~ '^[0-9a-fA-F-]{36}$'
  AND EXISTS (SELECT 1 FROM public.promotions p WHERE p.id = (n.data ->> 'promotion_id')::UUID);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'awaiting_payment', 'shipping', 'confirm_request', 'cancelled',
    'confirmed_by_admin', 'confirmed_auto',                       -- to the customer
    'admin_confirmed_by_customer', 'admin_confirmed_auto',        -- to every Admin
    'promotion_new', 'promotion'                                  -- to every Customer: coming, started
  ));

-- Several Admins are notified about the same order, so a notification is unique per recipient
DROP INDEX IF EXISTS public.notifications_order_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_order_type_user_key ON public.notifications (order_id, type, user_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_promotion_type_user_key ON public.notifications (promotion_id, type, user_id) WHERE promotion_id IS NOT NULL;

-- Order events → the customer's bell, and for Confirmed orders the Admins' bells too:
-- customer confirms → every Admin; Admin confirms → the customer; automatic → both.
CREATE OR REPLACE FUNCTION public.notify_order_event()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_type    TEXT;
  v_admin   TEXT;
  v_data    JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'awaiting_payment' THEN v_type := 'awaiting_payment'; END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'shipping' THEN
      v_type := 'shipping';
    ELSIF NEW.status = 'cancelled' THEN
      v_type := 'cancelled';
    ELSIF NEW.status = 'confirmed' THEN
      IF NEW.confirmed_by = 'admin' THEN
        v_type := 'confirmed_by_admin';
      ELSIF NEW.confirmed_by = 'auto' THEN
        v_type := 'confirmed_auto';
        v_admin := 'admin_confirmed_auto';
      ELSIF NEW.confirmed_by = 'customer' THEN
        v_admin := 'admin_confirmed_by_customer';
      END IF;
    END IF;
  END IF;

  v_data := jsonb_strip_nulls(jsonb_build_object(
    'order_number', NEW.order_number,
    'carrier', CASE WHEN v_type = 'shipping' THEN NEW.carrier END,
    'tracking_number', CASE WHEN v_type = 'shipping' THEN NEW.tracking_number END,
    'cancel_reason', CASE WHEN v_type = 'cancelled' THEN NEW.cancel_reason END,
    'refunded', CASE WHEN v_type = 'cancelled' AND NEW.refunded_at IS NOT NULL THEN TRUE END
  ));

  IF v_type IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, order_id, data)
    VALUES (NEW.user_id, v_type, NEW.id, v_data)
    ON CONFLICT (order_id, type, user_id) WHERE order_id IS NOT NULL DO NOTHING;
  END IF;

  IF v_admin IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, order_id, data)
    SELECT p.id, v_admin, NEW.id,
           v_data || jsonb_strip_nulls(jsonb_build_object('customer', NEW.shipping_address ->> 'recipient_name', 'total', NEW.total))
    FROM public.profiles p
    WHERE p.role = 'admin' AND p.deactivated_at IS NULL
    ON CONFLICT (order_id, type, user_id) WHERE order_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

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
  ON CONFLICT (order_id, type, user_id) WHERE order_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Background job (also run right after a Promotion is created or switched on). For each live Promotion:
-- before its start, every active Customer is told it is coming, with its dates (once); from its start,
-- that it has started (once). A Promotion first seen on or after its start only gets the second.
DROP FUNCTION IF EXISTS public.announce_started_promotions();
CREATE OR REPLACE FUNCTION public.announce_promotions()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_promo public.promotions;
  v_type  TEXT;
  v_count INTEGER := 0;
BEGIN
  FOR v_promo IN
    SELECT * FROM public.promotions
    WHERE is_active AND ends_at >= NOW()
      AND (previewed_at IS NULL OR (announced_at IS NULL AND starts_at <= NOW()))
    ORDER BY starts_at
    FOR UPDATE SKIP LOCKED
  LOOP
    v_type := CASE WHEN v_promo.starts_at <= NOW() THEN 'promotion' ELSE 'promotion_new' END;
    INSERT INTO public.notifications (user_id, type, promotion_id, data)
    SELECT p.id, v_type, v_promo.id, jsonb_strip_nulls(jsonb_build_object(
      'promotion_id', v_promo.id, 'name_th', v_promo.name_th, 'name_en', v_promo.name_en,
      'starts_at', v_promo.starts_at, 'ends_at', v_promo.ends_at))
    FROM public.profiles p
    WHERE p.role = 'user' AND p.deactivated_at IS NULL
    ON CONFLICT (promotion_id, type, user_id) WHERE promotion_id IS NOT NULL DO NOTHING;
    IF v_type = 'promotion' THEN
      UPDATE public.promotions SET previewed_at = COALESCE(previewed_at, NOW()), announced_at = NOW() WHERE id = v_promo.id;
    ELSE
      UPDATE public.promotions SET previewed_at = NOW() WHERE id = v_promo.id;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_order_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_confirm_requests(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_confirm_requests(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.announce_promotions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.announce_promotions() TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Order functions, from 005: their stock changes are tagged with the Order for Stock History,
--    and create_order accepts lines that used several Stackable Promotions.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_order(
  p_user_id           UUID,
  p_items             JSONB,      -- [{ product_id, quantity, discount_per_unit?, promotion_id?, promotion_ids?, is_gift? }, ...]
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

  DROP TABLE IF EXISTS _order_lines;
  CREATE TEMP TABLE _order_lines (
    product_id UUID, qty INTEGER, discount NUMERIC(10, 2), promotion_id UUID, is_gift BOOLEAN, promotion_ids UUID[]
  ) ON COMMIT DROP;
  -- promotion_ids: every Promotion a line used (several when Stackable Promotions combine, ADR 0004);
  -- promotion_id stays the first of them, so older callers that send one Promotion still work.
  INSERT INTO _order_lines
  SELECT (e ->> 'product_id')::UUID,
         SUM((e ->> 'quantity')::INTEGER)::INTEGER,
         MAX(COALESCE((e ->> 'discount_per_unit')::NUMERIC, 0)),
         (array_agg(NULLIF(e ->> 'promotion_id', '')::UUID))[1],
         COALESCE((e ->> 'is_gift')::BOOLEAN, FALSE),
         public.line_promotion_ids((array_agg(e -> 'promotion_ids'))[1], (array_agg(NULLIF(e ->> 'promotion_id', '')::UUID))[1])
  FROM jsonb_array_elements(p_items) e
  -- A product bought is one line; a Gift is one line per Promotion that gives it
  GROUP BY 1, 5, CASE WHEN COALESCE((e ->> 'is_gift')::BOOLEAN, FALSE) THEN NULLIF(e ->> 'promotion_id', '') END;

  IF EXISTS (SELECT 1 FROM _order_lines WHERE product_id IS NULL OR qty IS NULL OR qty < 1 OR qty > 99) THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;
  -- A discount or Gift must name a Promotion being redeemed in this order
  IF EXISTS (SELECT 1 FROM _order_lines
             WHERE discount < 0
                OR ((discount > 0 OR is_gift) AND (promotion_id IS NULL OR NOT promotion_id = ANY (p_redeem)))
                OR NOT (COALESCE(promotion_ids, '{}') <@ p_redeem)) THEN
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
    order_id, product_id, product_name, product_image, unit_price, quantity, list_price, discount_per_unit, promotion_id, is_gift, promotion_ids
  )
  SELECT v_order.id, p.id, p.name, p.images[1],
         CASE WHEN l.is_gift THEN 0 ELSE p.price - l.discount END,
         l.qty, p.price,
         CASE WHEN l.is_gift THEN p.price ELSE l.discount END,
         COALESCE(l.promotion_id, l.promotion_ids[1]), l.is_gift, COALESCE(l.promotion_ids, '{}')
  FROM _order_lines l JOIN public.products p ON p.id = l.product_id;

  PERFORM public.stock_context('order_created', v_order.id);
  UPDATE public.products p
  SET available = p.available - l.qty
  FROM (SELECT product_id, SUM(qty) AS qty FROM _order_lines GROUP BY 1) l
  WHERE p.id = l.product_id;

  RETURN v_order;
END;
$$;

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

    PERFORM public.stock_context('order_cancelled', p_order_id);
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
  PERFORM public.stock_context('order_confirmed', p_order_id);
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

REVOKE ALL ON FUNCTION public.create_order(UUID, JSONB, JSONB, UUID, NUMERIC, INTEGER, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_order(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_order(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(UUID, JSONB, JSONB, UUID, NUMERIC, INTEGER, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_order(UUID, TEXT) TO service_role;


-- ---------------------------------------------------------------------------
-- Realtime: a Member's bell hears new and changed Notifications at once instead of waiting for its
-- next poll. Supabase Realtime sends a row only to a subscriber its RLS lets SELECT it
-- (notifications_select_own, 005), so each Member hears only their own. Where the publication does
-- not exist (a plain Postgres) this does nothing.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;
