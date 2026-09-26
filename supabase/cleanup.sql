-- ============================================================================
-- Automatic clean-up: keeps the database small (Supabase free plan: 500 MB).
--
-- Every night at 03:15 (UTC) records older than 15 days are deleted from the
-- tables that only grow and are only useful for a short time:
--   visitor_sessions  visits to the store (Admin → Visitors)
--   visitor_events    page views inside those visits
--   admin_activity    who changed what in the admin panel (Admin → Activity log)
--   stock_movements   stock history shown on each product
--
-- Orders, customers, products, reviews, expenses and settings are never touched.
-- Tables that do not exist yet are skipped, so this file can run at any time.
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file
-- (nothing highlighted) and press Run.
-- ============================================================================

-- pg_cron runs jobs on a schedule inside the database (Supabase → Database → Extensions).
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_old_records(keep_days integer DEFAULT 15)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $purge$
DECLARE
  cutoff timestamptz := now() - make_interval(days => GREATEST(keep_days, 1));
  result jsonb := '{}'::jsonb;
  removed bigint;
BEGIN
  -- A visit counts by its last page view, so a visit still going on is kept.
  -- Deleting a visit also deletes its page views (ON DELETE CASCADE).
  IF to_regclass('public.visitor_sessions') IS NOT NULL THEN
    DELETE FROM public.visitor_sessions WHERE COALESCE(last_seen_at, started_at) < cutoff;
    GET DIAGNOSTICS removed = ROW_COUNT;
    result := result || jsonb_build_object('visitor_sessions', removed);
  END IF;
  IF to_regclass('public.visitor_events') IS NOT NULL THEN
    DELETE FROM public.visitor_events WHERE created_at < cutoff;
    GET DIAGNOSTICS removed = ROW_COUNT;
    result := result || jsonb_build_object('visitor_events', removed);
  END IF;
  IF to_regclass('public.admin_activity') IS NOT NULL THEN
    DELETE FROM public.admin_activity WHERE created_at < cutoff;
    GET DIAGNOSTICS removed = ROW_COUNT;
    result := result || jsonb_build_object('admin_activity', removed);
  END IF;
  IF to_regclass('public.stock_movements') IS NOT NULL THEN
    DELETE FROM public.stock_movements WHERE created_at < cutoff;
    GET DIAGNOSTICS removed = ROW_COUNT;
    result := result || jsonb_build_object('stock_movements', removed);
  END IF;
  RETURN result;
END;
$purge$;

-- Only the nightly job (and the SQL Editor) may run it, never the website's visitors.
REVOKE EXECUTE ON FUNCTION public.purge_old_records(integer) FROM PUBLIC, anon, authenticated;

-- Indexes so the nightly delete stays quick as the tables grow.
DO $idx$
BEGIN
  IF to_regclass('public.visitor_events') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS visitor_events_created_idx ON public.visitor_events (created_at);
  END IF;
  IF to_regclass('public.visitor_sessions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS visitor_sessions_last_seen_idx ON public.visitor_sessions (last_seen_at);
  END IF;
  IF to_regclass('public.stock_movements') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON public.stock_movements (created_at);
  END IF;
END $idx$;

-- The nightly job (replaced if it already exists).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-old-records';
SELECT cron.schedule('purge-old-records', '15 3 * * *', 'SELECT public.purge_old_records(15)');

-- Clean up once now as well.
SELECT public.purge_old_records(15);
