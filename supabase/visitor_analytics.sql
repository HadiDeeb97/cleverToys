-- Clever Toys visitor analytics
-- Run once in Supabase SQL Editor.
-- Privacy-friendly: no raw IP address or full user-agent is stored.

CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  session_id text PRIMARY KEY,
  visitor_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  landing_path text NOT NULL DEFAULT '/',
  current_path text NOT NULL DEFAULT '/',
  entry_referrer text,
  country text,
  device text NOT NULL DEFAULT 'unknown',
  browser text NOT NULL DEFAULT 'unknown',
  os text NOT NULL DEFAULT 'unknown',
  page_count integer NOT NULL DEFAULT 1 CHECK (page_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.visitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL REFERENCES public.visitor_sessions(session_id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  event_type text NOT NULL DEFAULT 'pageview',
  path text NOT NULL,
  referrer text,
  country text,
  device text,
  browser text,
  os text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS visitor_sessions_last_seen_idx ON public.visitor_sessions(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS visitor_sessions_visitor_id_idx ON public.visitor_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS visitor_events_created_at_idx ON public.visitor_events(created_at DESC);
CREATE INDEX IF NOT EXISTS visitor_events_session_id_idx ON public.visitor_events(session_id);
CREATE INDEX IF NOT EXISTS visitor_events_path_idx ON public.visitor_events(path);

ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view visitor sessions" ON public.visitor_sessions;
CREATE POLICY "Admins can view visitor sessions" ON public.visitor_sessions
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage visitor sessions" ON public.visitor_sessions;
CREATE POLICY "Admins can manage visitor sessions" ON public.visitor_sessions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view visitor events" ON public.visitor_events;
CREATE POLICY "Admins can view visitor events" ON public.visitor_events
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage visitor events" ON public.visitor_events;
CREATE POLICY "Admins can manage visitor events" ON public.visitor_events
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.track_visitor(
  p_visitor_id text,
  p_session_id text,
  p_path text,
  p_referrer text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_device text DEFAULT 'unknown',
  p_browser text DEFAULT 'unknown',
  p_os text DEFAULT 'unknown',
  p_event_type text DEFAULT 'pageview'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  clean_visitor_id text := left(trim(coalesce(p_visitor_id,'')), 120);
  clean_session_id text := left(trim(coalesce(p_session_id,'')), 120);
  clean_path text := left(trim(coalesce(p_path,'/')), 500);
  clean_referrer text := nullif(left(trim(coalesce(p_referrer,'')), 1000), '');
  clean_country text := nullif(left(trim(coalesce(p_country,'')), 10), '');
  clean_device text := left(trim(coalesce(p_device,'unknown')), 30);
  clean_browser text := left(trim(coalesce(p_browser,'unknown')), 40);
  clean_os text := left(trim(coalesce(p_os,'unknown')), 40);
  clean_event text := CASE WHEN p_event_type IN ('pageview','heartbeat') THEN p_event_type ELSE 'pageview' END;
BEGIN
  IF clean_visitor_id = '' OR clean_session_id = '' OR clean_path = '' THEN
    RAISE EXCEPTION 'Invalid analytics payload.';
  END IF;

  INSERT INTO public.visitor_sessions (
    session_id, visitor_id, started_at, last_seen_at, landing_path, current_path,
    entry_referrer, country, device, browser, os, page_count
  ) VALUES (
    clean_session_id, clean_visitor_id, now(), now(), clean_path, clean_path,
    clean_referrer, clean_country, clean_device, clean_browser, clean_os,
    CASE WHEN clean_event = 'pageview' THEN 1 ELSE 0 END
  )
  ON CONFLICT (session_id) DO UPDATE SET
    visitor_id = EXCLUDED.visitor_id,
    last_seen_at = now(),
    current_path = EXCLUDED.current_path,
    country = COALESCE(EXCLUDED.country, public.visitor_sessions.country),
    device = COALESCE(NULLIF(EXCLUDED.device,'unknown'), public.visitor_sessions.device),
    browser = COALESCE(NULLIF(EXCLUDED.browser,'unknown'), public.visitor_sessions.browser),
    os = COALESCE(NULLIF(EXCLUDED.os,'unknown'), public.visitor_sessions.os),
    page_count = public.visitor_sessions.page_count + CASE WHEN clean_event = 'pageview' THEN 1 ELSE 0 END;

  IF clean_event = 'pageview' THEN
    INSERT INTO public.visitor_events (
      session_id, visitor_id, event_type, path, referrer, country, device, browser, os
    ) VALUES (
      clean_session_id, clean_visitor_id, clean_event, clean_path, clean_referrer,
      clean_country, clean_device, clean_browser, clean_os
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.track_visitor(text,text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_visitor(text,text,text,text,text,text,text,text,text) TO anon, authenticated;
