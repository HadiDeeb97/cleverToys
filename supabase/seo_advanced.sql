-- Clever Toys: advanced SEO settings for Admin → SEO (indexing, sitemap, verification, templates).
-- Run once in Supabase SQL Editor after seo_migration.sql and branding_settings.sql. Safe to re-run.

-- Per-page indexing and sitemap options.
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS noindex boolean NOT NULL DEFAULT false;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS in_sitemap boolean NOT NULL DEFAULT true;
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS priority numeric(2,1);
ALTER TABLE public.seo_pages ADD COLUMN IF NOT EXISTS changefreq text;

ALTER TABLE public.seo_pages DROP CONSTRAINT IF EXISTS seo_pages_priority_check;
ALTER TABLE public.seo_pages ADD CONSTRAINT seo_pages_priority_check CHECK (priority IS NULL OR (priority >= 0 AND priority <= 1));
ALTER TABLE public.seo_pages DROP CONSTRAINT IF EXISTS seo_pages_changefreq_check;
ALTER TABLE public.seo_pages ADD CONSTRAINT seo_pages_changefreq_check CHECK (changefreq IS NULL OR changefreq IN ('always','hourly','daily','weekly','monthly','yearly','never'));

-- Site-wide SEO settings (verification codes, default share image, business details, sitemap and robots options).
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS seo jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Product and category fallbacks are templates: {name} becomes the product or category name.
-- Before this, one fallback title replaced every product's own title, so all product pages shared the same title.
UPDATE public.seo_pages
SET title = '{name} | Clever Toys Lebanon',
    description = 'Buy {name} at Clever Toys Lebanon. Fun, educational toys with fast delivery across Lebanon and cash on delivery.',
    updated_at = now()
WHERE path_key = '/product/*' AND title = 'Shop Toys in Lebanon | Clever Toys';

UPDATE public.seo_pages
SET title = '{name} Toys | Clever Toys Lebanon',
    description = 'Shop {name} toys at Clever Toys Lebanon. Fun, educational picks for every age, delivered across Lebanon.',
    updated_at = now()
WHERE path_key = '/category/*' AND title = 'Toy Category | Clever Toys Lebanon';

-- Private pages should never appear in search results.
UPDATE public.seo_pages SET noindex = true, in_sitemap = false
WHERE path_key IN ('/cart', '/checkout', '/order-success', '/login', '/account', '/forgot-password', '/404');
