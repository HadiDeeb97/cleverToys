-- Clever Toys: store the published theme in store_settings so Admin → Branding can publish it.
-- Run once in Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS theme jsonb;

-- Make the new column visible to the API right away.
NOTIFY pgrst, 'reload schema';
