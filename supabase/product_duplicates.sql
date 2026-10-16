-- ============================================================================
-- Admin → Products → "Possible duplicates": pairs an admin marked as "Not a duplicate".
--
-- The admin panel finds products whose names look alike (src/scripts/import-match.ts,
-- findDuplicates). A pair saved here is two different toys, so it is not suggested again, for any
-- admin. product_a is always the smaller id of the two. Rows go away with either product.
--
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file and press Run.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_not_duplicates (
  product_a uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_b uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_a, product_b),
  CONSTRAINT product_not_duplicates_order CHECK (product_a < product_b)
);
CREATE INDEX IF NOT EXISTS product_not_duplicates_b_idx ON public.product_not_duplicates (product_b);
ALTER TABLE public.product_not_duplicates ENABLE ROW LEVEL SECURITY;
DO $p$ BEGIN
  CREATE POLICY "Admins manage not-duplicate pairs" ON public.product_not_duplicates FOR ALL TO authenticated USING (public.admin_has('products')) WITH CHECK (public.admin_has('products'));
EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
GRANT SELECT, INSERT, DELETE ON public.product_not_duplicates TO authenticated;
