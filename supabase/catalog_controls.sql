-- ============================================================================
-- Google & Meta catalog controls per product (Admin → Products → a product).
--
--  - in_feed:  "Show in Google & Meta". Off keeps the toy on the website but leaves it out of the
--              product feed (/products-feed.xml), so it is not in the catalogs or the ads.
--  - ad_label: "Ad group label", e.g. Bestseller, Clearance, New. Sent as custom_label_1, so Google
--              Ads and Meta product sets can group toys by it.
--
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file and press Run.
-- ============================================================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS in_feed boolean NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ad_label text;
DO $c$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_ad_label_length CHECK (ad_label IS NULL OR length(ad_label) <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $c$;

NOTIFY pgrst, 'reload schema';
