-- ============================================================================
-- Return policy setting (Admin → Branding & settings → Cash on delivery).
--
-- store_settings.return_days: how many days after delivery customers can ask for a return or
-- exchange. 0 = no returns. Empty = not set yet (the admin shows 3, the store's current policy).
--
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file and press Run.
-- ============================================================================
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS return_days integer
  CHECK (return_days IS NULL OR (return_days >= 0 AND return_days <= 365));

-- The store's policy page says exchanges within 3 days; start the setting from that.
UPDATE public.store_settings SET return_days = 3 WHERE id = 'default' AND return_days IS NULL;
