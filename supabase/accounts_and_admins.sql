-- Clever Toys: customer profiles on sign-up and admin team management (Admin → Team).
-- Run once in Supabase SQL Editor. Safe to re-run.

-- 1. Create a customer profile automatically when someone signs up, using the name from the sign-up form.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.customer_profiles (id, full_name)
  VALUES (NEW.id, nullif(trim(coalesce(NEW.raw_user_meta_data->>'full_name', '')), ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles for accounts created before this trigger existed.
INSERT INTO public.customer_profiles (id, full_name)
SELECT u.id, nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), '')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 2. Admin team management. Only existing admins can call these; admin_users itself stays locked.
CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE (user_id uuid, email text, added_at timestamptz, last_sign_in_at timestamptz, is_you boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only administrators can view the admin team.'; END IF;
  RETURN QUERY
    SELECT a.user_id, u.email::text, a.created_at, u.last_sign_in_at, a.user_id = auth.uid()
    FROM public.admin_users a JOIN auth.users u ON u.id = a.user_id
    ORDER BY a.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_admin(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  target uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only administrators can add admins.'; END IF;
  SELECT id INTO target FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF target IS NULL THEN
    RAISE EXCEPTION 'No account uses %. Ask them to create an account on the store first, then add them again.', trim(p_email);
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = target) THEN
    RETURN 'already_admin';
  END IF;
  INSERT INTO public.admin_users (user_id) VALUES (target);
  RETURN 'added';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_admin(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only administrators can remove admins.'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot remove yourself. Ask another admin to do it.'; END IF;
  IF (SELECT count(*) FROM public.admin_users) <= 1 THEN RAISE EXCEPTION 'The store needs at least one admin.'; END IF;
  DELETE FROM public.admin_users WHERE user_id = p_user_id;
  RETURN 'removed';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_admins() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_add_admin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_remove_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_admin(uuid) TO authenticated;
