-- ============================================================================
-- Silver Thief Bug — Migration 003: product categories
-- Run AFTER 002_spec_alignment.sql. Safe to re-run.
--
-- Category becomes a fixed set: beetle | food | log | gear (see CONTEXT.md).
-- The old beetle-family categories (Rhinoceros / Stag / Flower) move into
-- attributes.family; any other old category (e.g. "Supplies") becomes "gear" —
-- review those products in the admin panel after running this.
-- ============================================================================

UPDATE public.products
SET attributes = attributes || jsonb_build_object('family', initcap(category)),
    category   = 'beetle'
WHERE lower(category) IN ('rhinoceros', 'stag', 'flower');

UPDATE public.products
SET category = 'gear'
WHERE category IS NULL OR category NOT IN ('beetle', 'food', 'log', 'gear');

ALTER TABLE public.products ALTER COLUMN category SET DEFAULT 'beetle';
ALTER TABLE public.products ALTER COLUMN category SET NOT NULL;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_category_check CHECK (category IN ('beetle', 'food', 'log', 'gear'));
