-- Clever Toys: logo and website icon files for Admin → Branding.
-- Run once in Supabase SQL Editor. Safe to re-run.
--
-- Uploads go into a new folder each time (product-images/branding/logo/<version>.webp and
-- product-images/branding/icons/<version>/icon-{32,180,192,512}.png), so browsers can cache them
-- for a year and still show a new logo or icon immediately after it is changed.

-- URL of the current logo (a small, header-sized WebP). Empty = the older branding/logo.webp file.
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS logo_url text;

-- URL of the 32px website icon; the other sizes sit next to it. Empty = the default Clever Toys icon.
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS favicon_url text;
