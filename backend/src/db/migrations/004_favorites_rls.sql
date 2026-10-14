-- ============================================================================
-- Silver Thief Bug — Migration 004: favorites stored per user in the database
-- Run AFTER 003_product_categories.sql. Safe to re-run.
-- The storefront reads/writes favorites directly with the user's Supabase session;
-- RLS limits every row to its owner.
-- ============================================================================

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.favorites FROM anon;
REVOKE UPDATE ON public.favorites FROM authenticated;

DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
CREATE POLICY "Users can manage own favorites" ON public.favorites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
