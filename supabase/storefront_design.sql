-- Clever Toys: storefront design settings for Admin → Storefront
-- (fonts, corners, homepage sections and texts, product page notes, footer).
-- Run once in Supabase SQL Editor. Safe to re-run.
-- The storefront uses built-in defaults until something is saved here.
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS design jsonb NOT NULL DEFAULT '{}'::jsonb;
