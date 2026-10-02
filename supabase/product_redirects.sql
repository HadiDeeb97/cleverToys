-- ============================================================================
-- Old product addresses keep working.
--
-- When a product's web address (slug) changes, e.g. after fixing a spelling in its name,
-- the old address is remembered here and /product/<old address> forwards to the new one
-- (src/pages/product/[slug].astro). Saved automatically from now on.
--
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file and press Run.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_slug_history (
  old_slug text PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_slug_history_product_id_idx ON public.product_slug_history (product_id);
ALTER TABLE public.product_slug_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read old product addresses" ON public.product_slug_history;
CREATE POLICY "Public can read old product addresses" ON public.product_slug_history FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.product_slug_history TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.remember_product_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug AND OLD.slug IS NOT NULL THEN
    INSERT INTO public.product_slug_history (old_slug, product_id) VALUES (OLD.slug, NEW.id)
    ON CONFLICT (old_slug) DO UPDATE SET product_id = EXCLUDED.product_id, changed_at = now();
    -- The new address is live again, so it is no longer an "old" one.
    DELETE FROM public.product_slug_history WHERE old_slug = NEW.slug;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS products_remember_slug ON public.products;
CREATE TRIGGER products_remember_slug AFTER UPDATE OF slug ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.remember_product_slug();

-- Addresses that already changed (spelling fixes, October 2026).
INSERT INTO public.product_slug_history (old_slug, product_id)
SELECT v.old_slug, p.id
FROM (VALUES ('sudoko', 'sudoku'), ('master-of-architechture-blocks-toy', 'master-of-architecture-blocks-toy')) AS v(old_slug, new_slug)
JOIN public.products p ON p.slug = v.new_slug
ON CONFLICT (old_slug) DO NOTHING;

SELECT h.old_slug AS old_address, p.slug AS forwards_to FROM public.product_slug_history h JOIN public.products p ON p.id = h.product_id;
