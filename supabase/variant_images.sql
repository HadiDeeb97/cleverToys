-- ============================================================================
-- A photo for each option (variant), e.g. the blue picture for "Blue".
--
-- Chosen in Admin → Products → a product → Variants (one of the product's own photos). On the
-- product page, choosing the option shows that photo; the cart and the Google & Meta feed use it too.
-- Options without a photo keep using the product's photos, as before.
--
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file and press Run.
-- ============================================================================
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS image_url text;

NOTIFY pgrst, 'reload schema';
