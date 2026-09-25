-- =====================================================================================
-- Clever Toys CMS: everything the admin panel needs to run the store without code.
-- Run once in Supabase → SQL Editor. Safe to re-run (every step checks what exists).
-- Nothing is deleted: existing products, orders, customers and settings stay as they are.
--
--  1. Staff roles and permissions (owner / manager / orders / content), enforced by the database
--  2. Activity log: who changed what, and when
--  3. Content pages (About, Privacy, Terms, Shipping + your own pages)
--  4. Home page banners with start/end dates
--  5. Discount codes (coupons)
--  6. Delivery fees per governorate
--  7. Stock history + low-stock threshold; stock returns when an order is cancelled
--  8. Product reviews with moderation
--  9. Customer list for the admin
-- 10. create_order: delivery fee per governorate, discount codes, stock history
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1. Staff roles
-- -------------------------------------------------------------------------------------
-- Every existing admin becomes an "owner" (full access, same as today).
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'owner';
DO $$ BEGIN
  ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_role_check CHECK (role IN ('owner', 'manager', 'orders', 'content'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- What each role may do. Permissions: products, orders, customers, accounting, analytics, content,
-- marketing, seo, settings, reviews, team, logs, backup.
--   owner   → everything
--   manager → everything except the admin team and full backups
--   orders  → orders and customers
--   content → products, content pages/banners/menus, discount codes, SEO and reviews
CREATE OR REPLACE FUNCTION public.admin_role_allows(p_role text, p_perm text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_role
    WHEN 'owner' THEN true
    WHEN 'manager' THEN p_perm NOT IN ('team', 'backup')
    WHEN 'orders' THEN p_perm IN ('orders', 'customers')
    WHEN 'content' THEN p_perm IN ('products', 'content', 'marketing', 'seo', 'reviews')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.admin_has(p_perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND public.admin_role_allows(a.role, p_perm));
$$;

-- The signed-in admin's role and permissions (used by the admin panel to show the right pages).
CREATE OR REPLACE FUNCTION public.admin_me()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
  SELECT CASE WHEN a.user_id IS NULL THEN NULL ELSE jsonb_build_object(
    'role', a.role,
    'email', (SELECT email FROM auth.users WHERE id = a.user_id),
    'perms', (SELECT jsonb_agg(p) FROM unnest(ARRAY['products','orders','customers','accounting','analytics','content','marketing','seo','settings','reviews','team','logs','backup']) p WHERE public.admin_role_allows(a.role, p))
  ) END
  FROM (SELECT 1) one LEFT JOIN public.admin_users a ON a.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.admin_has(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_has(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_me() TO authenticated;

-- Team functions now include roles. Only owners manage the team; the last owner cannot be removed.
DROP FUNCTION IF EXISTS public.admin_list_admins();
CREATE FUNCTION public.admin_list_admins()
RETURNS TABLE (user_id uuid, email text, role text, added_at timestamptz, last_sign_in_at timestamptz, is_you boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.admin_has('team') THEN RAISE EXCEPTION 'Only the store owner can view the admin team.'; END IF;
  RETURN QUERY
    SELECT a.user_id, u.email::text, a.role, a.created_at, u.last_sign_in_at, a.user_id = auth.uid()
    FROM public.admin_users a JOIN auth.users u ON u.id = a.user_id
    ORDER BY a.created_at;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_add_admin(text);
DROP FUNCTION IF EXISTS public.admin_add_admin(text, text);
CREATE FUNCTION public.admin_add_admin(p_email text, p_role text DEFAULT 'manager')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE target uuid;
BEGIN
  IF NOT public.admin_has('team') THEN RAISE EXCEPTION 'Only the store owner can add team members.'; END IF;
  IF p_role NOT IN ('owner', 'manager', 'orders', 'content') THEN RAISE EXCEPTION 'Unknown role.'; END IF;
  SELECT id INTO target FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF target IS NULL THEN
    RAISE EXCEPTION 'No account uses %. Ask them to create an account on the store first, then add them again.', trim(p_email);
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = target) THEN RETURN 'already_admin'; END IF;
  INSERT INTO public.admin_users (user_id, role) VALUES (target, p_role);
  PERFORM public.log_activity('create', 'admin_users', target::text, trim(p_email), jsonb_build_object('role', p_role));
  RETURN 'added';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id uuid, p_role text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE old_role text;
BEGIN
  IF NOT public.admin_has('team') THEN RAISE EXCEPTION 'Only the store owner can change roles.'; END IF;
  IF p_role NOT IN ('owner', 'manager', 'orders', 'content') THEN RAISE EXCEPTION 'Unknown role.'; END IF;
  SELECT role INTO old_role FROM public.admin_users WHERE user_id = p_user_id;
  IF old_role IS NULL THEN RAISE EXCEPTION 'That person is not on the admin team.'; END IF;
  IF old_role = 'owner' AND p_role <> 'owner' AND (SELECT count(*) FROM public.admin_users WHERE role = 'owner') <= 1 THEN
    RAISE EXCEPTION 'The store needs at least one owner. Make someone else an owner first.';
  END IF;
  UPDATE public.admin_users SET role = p_role WHERE user_id = p_user_id;
  PERFORM public.log_activity('update', 'admin_users', p_user_id::text, (SELECT email FROM auth.users WHERE id = p_user_id), jsonb_build_object('role', jsonb_build_array(old_role, p_role)));
  RETURN 'updated';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_admin(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
BEGIN
  IF NOT public.admin_has('team') THEN RAISE EXCEPTION 'Only the store owner can remove team members.'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot remove yourself. Ask another owner to do it.'; END IF;
  IF (SELECT role FROM public.admin_users WHERE user_id = p_user_id) = 'owner' AND (SELECT count(*) FROM public.admin_users WHERE role = 'owner') <= 1 THEN
    RAISE EXCEPTION 'The store needs at least one owner.';
  END IF;
  PERFORM public.log_activity('delete', 'admin_users', p_user_id::text, (SELECT email FROM auth.users WHERE id = p_user_id), NULL);
  DELETE FROM public.admin_users WHERE user_id = p_user_id;
  RETURN 'removed';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_admins() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_add_admin(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_remove_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_admin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_admin(uuid) TO authenticated;

-- -------------------------------------------------------------------------------------
-- 2. Activity log
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  user_email text,
  action text NOT NULL,          -- create / update / delete
  entity text NOT NULL,          -- table name, e.g. products
  entity_id text,
  label text,                    -- readable name: product name, order number, code…
  changes jsonb,                 -- {"price": [old, new], …} (long values are shortened)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_activity_created_idx ON public.admin_activity (created_at DESC);
ALTER TABLE public.admin_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read the activity log" ON public.admin_activity;
CREATE POLICY "Admins can read the activity log" ON public.admin_activity FOR SELECT TO authenticated USING (public.admin_has('logs'));

-- Writes one log line for the signed-in admin (customers placing orders are not logged).
CREATE OR REPLACE FUNCTION public.log_activity(p_action text, p_entity text, p_entity_id text, p_label text, p_changes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN RETURN; END IF;
  INSERT INTO public.admin_activity (user_id, user_email, action, entity, entity_id, label, changes)
  VALUES (auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()), p_action, p_entity, p_entity_id, left(p_label, 200), p_changes);
END;
$$;
REVOKE ALL ON FUNCTION public.log_activity(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Trigger used on every managed table: records which fields changed.
CREATE OR REPLACE FUNCTION public.log_admin_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  old_row jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  new_row jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
  row_data jsonb := coalesce(new_row, old_row);
  diff jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(key, jsonb_build_array(
             CASE WHEN length(old_row->>key) > 120 THEN to_jsonb(left(old_row->>key, 120) || '…') ELSE old_row->key END,
             CASE WHEN length(new_row->>key) > 120 THEN to_jsonb(left(new_row->>key, 120) || '…') ELSE new_row->key END))
      INTO diff
      FROM jsonb_object_keys(new_row) AS key
      WHERE key NOT IN ('updated_at', 'created_at') AND (old_row->key) IS DISTINCT FROM (new_row->key);
    IF diff IS NULL THEN RETURN NULL; END IF;   -- nothing really changed
  END IF;
  PERFORM public.log_activity(
    CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'DELETE' THEN 'delete' ELSE 'update' END, TG_TABLE_NAME,
    coalesce(row_data->>'id', row_data->>'governorate', row_data->>'product_id'),
    coalesce(CASE WHEN TG_TABLE_NAME = 'store_settings' THEN 'settings' END, row_data->>'name', row_data->>'title', row_data->>'order_number', row_data->>'code', row_data->>'governorate', row_data->>'author_name', row_data->>'description', row_data->>'id'),
    diff);
  RETURN NULL;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 3. Content pages
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  intro text,                    -- short line under the title
  body text NOT NULL DEFAULT '', -- simple formatting: ## headings, **bold**, lists, [links](/url)
  -- Search titles/descriptions: Admin → SEO (by page address), like every other page.
  is_published boolean NOT NULL DEFAULT true,
  show_in_footer boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false, -- About, Privacy, Terms, Shipping: cannot be deleted
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view published pages" ON public.pages;
DROP POLICY IF EXISTS "Content admins manage pages" ON public.pages;
CREATE POLICY "Public can view published pages" ON public.pages FOR SELECT TO anon, authenticated USING (is_published OR public.admin_has('content'));
CREATE POLICY "Content admins manage pages" ON public.pages FOR ALL TO authenticated USING (public.admin_has('content')) WITH CHECK (public.admin_has('content'));

-- The four existing pages, with the text the store shows today (only added if missing).
INSERT INTO public.pages (slug, title, intro, body, is_system, sort_order) VALUES
('about', 'Play. Learn. Discover.', 'We believe the right toy can turn an ordinary moment into a chance to imagine, learn and create.', $md$## Our store
Clever Toys brings together fun, educational and creative toys for children of different ages. We focus on practical products, clear information and a simple shopping experience.

## Our promise
We aim to offer quality toys, straightforward prices and responsive customer service from browsing to delivery.

[Explore our toys](/products)$md$, true, 1),
('privacy', 'Privacy Policy', 'How Clever Toys handles information provided through the store.', $md$## Information we collect
When you place an order, we may collect your name, phone number, delivery address and optional email address so we can process and deliver your order.

## How we use it
We use order information to process purchases, contact customers about orders and provide customer support. We do not need payment-card information for cash-on-delivery orders.

## Accounts
If you create an account, authentication is handled by our secure authentication provider. Your account lets you access your own order history.

## Data requests
For questions about your information or to request correction, contact Clever Toys through the customer-support channel provided on the website.$md$, true, 2),
('terms', 'Terms & Conditions', 'Terms for using the Clever Toys store.', $md$## Product information
We make reasonable efforts to keep product names, descriptions, prices and stock information accurate. Availability can change before an order is confirmed.

## Orders
Submitting an order is a request to purchase. Clever Toys may contact you to confirm availability and delivery details before fulfillment.

## Prices
Prices shown on the website are in US dollars unless stated otherwise. The final order total is calculated by the store when the order is placed.

## Delivery
Orders are normally handled using cash on delivery. Delivery details and any applicable fee are confirmed with the customer.$md$, true, 3),
('shipping-returns', 'Shipping & Returns', 'Important information before placing your order.', $md$## Delivery
Orders are placed with cash on delivery. After an order is received, Clever Toys will contact you to confirm the order and delivery details.

## Delivery fee
Any delivery fee is confirmed with you before the order is finalized.

## Returns and exchanges
If an item arrives defective, contact us as soon as possible with your order number and details. Exchange requests should be made within 3 days of receiving the order.

## Important
Products should be returned in the condition in which they were received. Final approval of a return or exchange is subject to inspection.$md$, true, 4)
ON CONFLICT (slug) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 4. Home page banners (a slideshow; each banner can have start and end dates)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  subtitle text,
  image_url text,
  link_url text,
  button_text text,
  text_tone text NOT NULL DEFAULT 'light' CHECK (text_tone IN ('light', 'dark')), -- light text for dark pictures
  background text,               -- colour used when there is no picture, e.g. #1b1822
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view live banners" ON public.banners;
DROP POLICY IF EXISTS "Content admins manage banners" ON public.banners;
CREATE POLICY "Public can view live banners" ON public.banners FOR SELECT TO anon, authenticated
  USING ((is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())) OR public.admin_has('content'));
CREATE POLICY "Content admins manage banners" ON public.banners FOR ALL TO authenticated USING (public.admin_has('content')) WITH CHECK (public.admin_has('content'));

-- -------------------------------------------------------------------------------------
-- 5. Discount codes
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{3,30}$'),
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed', 'free_delivery')),
  value numeric(10,2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  min_subtotal numeric(10,2) NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_type <> 'percent' OR value <= 100)
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;  -- codes are private: customers check one code at a time
DROP POLICY IF EXISTS "Marketing admins manage coupons" ON public.coupons;
CREATE POLICY "Marketing admins manage coupons" ON public.coupons FOR ALL TO authenticated USING (public.admin_has('marketing')) WITH CHECK (public.admin_has('marketing'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code text;

-- Works out a code's discount for a cart subtotal and delivery fee. Used by checkout and create_order.
CREATE OR REPLACE FUNCTION public.coupon_discount(p_code text, p_subtotal numeric, p_delivery numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c public.coupons%ROWTYPE; discount numeric(10,2) := 0; free_delivery boolean := false;
BEGIN
  SELECT * INTO c FROM public.coupons WHERE code = upper(trim(coalesce(p_code, '')));
  IF NOT FOUND OR NOT c.is_active THEN RETURN jsonb_build_object('ok', false, 'message', 'This code is not valid.'); END IF;
  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN RETURN jsonb_build_object('ok', false, 'message', 'This code is not active yet.'); END IF;
  IF c.ends_at IS NOT NULL AND c.ends_at <= now() THEN RETURN jsonb_build_object('ok', false, 'message', 'This code has expired.'); END IF;
  IF c.max_uses IS NOT NULL AND c.used_count >= c.max_uses THEN RETURN jsonb_build_object('ok', false, 'message', 'This code has been fully used.'); END IF;
  IF coalesce(p_subtotal, 0) < c.min_subtotal THEN
    RETURN jsonb_build_object('ok', false, 'message', format('This code needs an order of at least $%s.', to_char(c.min_subtotal, 'FM999990.00')));
  END IF;
  IF c.discount_type = 'percent' THEN discount := round(p_subtotal * c.value / 100, 2);
  ELSIF c.discount_type = 'fixed' THEN discount := least(c.value, p_subtotal);
  ELSE free_delivery := true; discount := coalesce(p_delivery, 0);
  END IF;
  RETURN jsonb_build_object('ok', true, 'code', c.code, 'type', c.discount_type, 'value', c.value,
    'discount', least(discount, p_subtotal + coalesce(p_delivery, 0)), 'free_delivery', free_delivery,
    'message', coalesce(nullif(c.description, ''), 'Discount applied.'));
END;
$$;

-- -------------------------------------------------------------------------------------
-- 6. Delivery fees per governorate (no row = the standard fee from Branding & settings)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  governorate text PRIMARY KEY,
  fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  is_active boolean NOT NULL DEFAULT true,   -- false: "we don't deliver there yet"
  eta text,                                  -- e.g. "1–2 working days"
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view delivery zones" ON public.delivery_zones;
DROP POLICY IF EXISTS "Settings admins manage delivery zones" ON public.delivery_zones;
CREATE POLICY "Public can view delivery zones" ON public.delivery_zones FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Settings admins manage delivery zones" ON public.delivery_zones FOR ALL TO authenticated USING (public.admin_has('settings')) WITH CHECK (public.admin_has('settings'));

-- Delivery fee for a governorate and subtotal (free above the free-delivery amount). NULL = no delivery there.
CREATE OR REPLACE FUNCTION public.delivery_fee_for(p_governorate text, p_subtotal numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE z public.delivery_zones%ROWTYPE; fee numeric(10,2); threshold numeric(10,2);
BEGIN
  SELECT greatest(0, coalesce(s.cod_delivery_price, 0)), greatest(0, coalesce(s.free_delivery_threshold, 0))
    INTO fee, threshold FROM public.store_settings s WHERE s.id = 'default';
  fee := coalesce(fee, 0); threshold := coalesce(threshold, 0);
  SELECT * INTO z FROM public.delivery_zones WHERE lower(governorate) = lower(trim(coalesce(p_governorate, '')));
  IF FOUND THEN
    IF NOT z.is_active THEN RETURN NULL; END IF;
    fee := z.fee;
  END IF;
  IF threshold > 0 AND coalesce(p_subtotal, 0) >= threshold THEN fee := 0; END IF;
  RETURN fee;
END;
$$;
-- Checkout preview: customers check a code without seeing the coupon list.
CREATE OR REPLACE FUNCTION public.check_coupon(p_code text, p_subtotal numeric, p_governorate text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.coupon_discount(p_code, p_subtotal, public.delivery_fee_for(p_governorate, p_subtotal));
$$;
REVOKE ALL ON FUNCTION public.coupon_discount(text, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_coupon(text, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_fee_for(text, numeric) TO anon, authenticated;

-- -------------------------------------------------------------------------------------
-- 7. Stock history and low-stock alerts
-- -------------------------------------------------------------------------------------
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  change integer NOT NULL,        -- +5 added, −2 sold…
  stock_after integer NOT NULL,
  reason text NOT NULL,           -- order, order_cancelled, order_restored, manual, created
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON public.stock_movements (product_id, created_at DESC);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read stock history" ON public.stock_movements;
CREATE POLICY "Admins can read stock history" ON public.stock_movements FOR SELECT TO authenticated USING (public.admin_has('products') OR public.admin_has('orders'));

-- Records every stock change. The reason comes from the order functions (set_config), or "manual"
-- when an admin edits stock.
CREATE OR REPLACE FUNCTION public.record_stock_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  delta integer := NEW.stock_quantity - CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.stock_quantity END;
  reason text := nullif(current_setting('clevertoys.stock_reason', true), '');
  order_ref uuid := nullif(current_setting('clevertoys.stock_order', true), '')::uuid;
BEGIN
  IF delta = 0 THEN RETURN NULL; END IF;
  IF reason IS NULL THEN reason := CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'manual' END; END IF;
  IF TG_TABLE_NAME = 'product_variants' THEN
    INSERT INTO public.stock_movements (product_id, variant_id, change, stock_after, reason, order_id, user_id)
    VALUES (NEW.product_id, NEW.id, delta, NEW.stock_quantity, reason, order_ref, auth.uid());
  ELSE
    INSERT INTO public.stock_movements (product_id, variant_id, change, stock_after, reason, order_id, user_id)
    VALUES (NEW.id, NULL, delta, NEW.stock_quantity, reason, order_ref, auth.uid());
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS products_stock_history ON public.products;
CREATE TRIGGER products_stock_history AFTER INSERT OR UPDATE OF stock_quantity ON public.products FOR EACH ROW EXECUTE FUNCTION public.record_stock_change();
DROP TRIGGER IF EXISTS variants_stock_history ON public.product_variants;
CREATE TRIGGER variants_stock_history AFTER INSERT OR UPDATE OF stock_quantity ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.record_stock_change();

-- Cancelling an order puts its toys back in stock; un-cancelling takes them out again.
CREATE OR REPLACE FUNCTION public.restock_on_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE item record; direction integer;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NULL; END IF;
  IF NEW.status = 'cancelled' THEN direction := 1;
  ELSIF OLD.status = 'cancelled' THEN direction := -1;
  ELSE RETURN NULL; END IF;
  PERFORM set_config('clevertoys.stock_reason', CASE WHEN direction = 1 THEN 'order_cancelled' ELSE 'order_restored' END, true);
  PERFORM set_config('clevertoys.stock_order', NEW.id::text, true);
  FOR item IN SELECT product_id, variant_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
    IF item.variant_id IS NOT NULL THEN
      UPDATE public.product_variants SET stock_quantity = greatest(0, stock_quantity + direction * item.quantity), updated_at = now() WHERE id = item.variant_id;
    ELSIF item.product_id IS NOT NULL THEN
      UPDATE public.products SET stock_quantity = greatest(0, stock_quantity + direction * item.quantity), updated_at = now() WHERE id = item.product_id;
    END IF;
  END LOOP;
  PERFORM set_config('clevertoys.stock_reason', '', true);
  PERFORM set_config('clevertoys.stock_order', '', true);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS orders_restock_on_cancel ON public.orders;
CREATE TRIGGER orders_restock_on_cancel AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.restock_on_cancel();

-- -------------------------------------------------------------------------------------
-- 8. Product reviews (shown after an admin approves them)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id uuid,
  author_name text NOT NULL CHECK (length(author_name) BETWEEN 1 AND 60),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text CHECK (title IS NULL OR length(title) <= 120),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden')),
  verified boolean NOT NULL DEFAULT false,  -- the reviewer bought this toy (delivered order)
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON public.reviews (product_id, status, created_at DESC);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Review admins manage reviews" ON public.reviews;
CREATE POLICY "Public can view approved reviews" ON public.reviews FOR SELECT TO anon, authenticated USING (status = 'approved' OR public.admin_has('reviews'));
CREATE POLICY "Review admins manage reviews" ON public.reviews FOR ALL TO authenticated USING (public.admin_has('reviews')) WITH CHECK (public.admin_has('reviews'));

-- Customers submit reviews through this function (they cannot write to the table directly).
CREATE OR REPLACE FUNCTION public.submit_review(p_product_id uuid, p_name text, p_rating integer, p_title text, p_body text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE bought boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND is_active) THEN RAISE EXCEPTION 'This toy is not available.'; END IF;
  IF length(trim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Please enter your name (up to 60 characters).'; END IF;
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Please choose a rating from 1 to 5 stars.'; END IF;
  IF length(trim(coalesce(p_body, ''))) NOT BETWEEN 3 AND 2000 THEN RAISE EXCEPTION 'Please write a short review (up to 2000 characters).'; END IF;
  IF auth.uid() IS NOT NULL THEN
    IF (SELECT count(*) FROM public.reviews WHERE customer_id = auth.uid() AND product_id = p_product_id) >= 2 THEN
      RAISE EXCEPTION 'You have already reviewed this toy. Thank you!';
    END IF;
    bought := EXISTS (SELECT 1 FROM public.orders o JOIN public.order_items i ON i.order_id = o.id
                      WHERE o.customer_id = auth.uid() AND o.status = 'delivered' AND i.product_id = p_product_id);
  END IF;
  -- Simple protection against floods of anonymous reviews.
  IF (SELECT count(*) FROM public.reviews WHERE product_id = p_product_id AND status = 'pending' AND created_at > now() - interval '1 hour') >= 20 THEN
    RAISE EXCEPTION 'Too many reviews right now. Please try again later.';
  END IF;
  INSERT INTO public.reviews (product_id, customer_id, author_name, rating, title, body, verified)
  VALUES (p_product_id, auth.uid(), trim(p_name), p_rating, nullif(trim(coalesce(p_title, '')), ''), trim(p_body), bought);
  RETURN 'pending';
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, text, integer, text, text) TO anon, authenticated;

-- -------------------------------------------------------------------------------------
-- 9. Customers (registered accounts + guests grouped by phone number)
-- -------------------------------------------------------------------------------------
-- Same phone written differently ("+961 71 000 001", "71000001", "00961…", "03 …") → same digits.
CREATE OR REPLACE FUNCTION public.phone_key(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^00', ''), '^961', ''), '^0', '');
$$;

CREATE OR REPLACE FUNCTION public.admin_list_customers(p_search text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE (customer_key text, customer_id uuid, name text, email text, phone text, governorate text,
               orders_count bigint, total_spent numeric, last_order_at timestamptz, registered_at timestamptz, total_rows bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.admin_has('customers') THEN RAISE EXCEPTION 'You do not have access to customers.'; END IF;
  RETURN QUERY
  WITH o AS (
    SELECT coalesce(x.customer_id::text, 'phone:' || public.phone_key(x.customer_phone)) AS k,
           x.customer_id, x.customer_name, x.customer_email, x.customer_phone, x.governorate, x.total, x.status, x.created_at
    FROM public.orders x
  ), agg AS (
    SELECT k,
      (array_agg(o.customer_id ORDER BY o.created_at DESC))[1] AS cid,
      (array_agg(o.customer_name ORDER BY o.created_at DESC))[1] AS cname,
      (array_agg(o.customer_email ORDER BY o.created_at DESC) FILTER (WHERE o.customer_email IS NOT NULL))[1] AS cemail,
      (array_agg(o.customer_phone ORDER BY o.created_at DESC))[1] AS cphone,
      (array_agg(o.governorate ORDER BY o.created_at DESC) FILTER (WHERE o.governorate IS NOT NULL))[1] AS cgov,
      count(*) FILTER (WHERE o.status <> 'cancelled') AS n,
      coalesce(sum(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS spent,
      max(o.created_at) AS last_at
    FROM o GROUP BY k
  ), people AS (
    SELECT coalesce(u.id::text, agg.k) AS k,
           coalesce(u.id, agg.cid) AS cid,
           coalesce(nullif(p.full_name, ''), agg.cname) AS cname,
           coalesce(u.email::text, agg.cemail) AS cemail,
           coalesce(nullif(p.phone, ''), agg.cphone) AS cphone,
           coalesce(nullif(p.governorate, ''), agg.cgov) AS cgov,
           coalesce(agg.n, 0) AS n, coalesce(agg.spent, 0) AS spent, agg.last_at, u.created_at AS reg_at
    FROM auth.users u
    LEFT JOIN public.customer_profiles p ON p.id = u.id
    FULL JOIN agg ON agg.k = u.id::text
    WHERE u.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id) OR agg.k IS NOT NULL
  ), filtered AS (
    SELECT * FROM people
    WHERE p_search IS NULL OR trim(p_search) = ''
       OR cname ILIKE '%' || trim(p_search) || '%' OR cemail ILIKE '%' || trim(p_search) || '%'
       OR public.phone_key(cphone) LIKE '%' || nullif(public.phone_key(p_search), '') || '%'
  )
  SELECT f.k, f.cid, f.cname, f.cemail, f.cphone, f.cgov, f.n, f.spent, f.last_at, f.reg_at, count(*) OVER ()
  FROM filtered f
  ORDER BY f.last_at DESC NULLS LAST, f.reg_at DESC NULLS LAST
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 500) OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_customers(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_customers(text, integer, integer) TO authenticated;

-- -------------------------------------------------------------------------------------
-- 10. create_order: delivery fee per governorate, discount codes and stock history
--     (same checks as before: prices, stock and totals are always worked out here, never trusted
--     from the browser)
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order(order_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  new_order_id uuid; new_order_number text; item jsonb;
  product_row public.products%ROWTYPE; variant_row public.product_variants%ROWTYPE;
  requested_qty integer; server_unit_price numeric(10,2); server_subtotal numeric(10,2) := 0; server_total numeric(10,2);
  customer_name_value text; customer_phone_value text; customer_email_value text; governorate_value text; city_value text; area_value text; address_value text; notes_value text;
  cod_delivery_price numeric(10,2) := 0;
  discount_value numeric(10,2) := 0;
  coupon_value text; coupon_result jsonb; coupon_row public.coupons%ROWTYPE;
  item_product_id uuid; item_variant_id uuid; variant_name_value text; item_sku text;
BEGIN
  customer_name_value := trim(coalesce(order_payload->>'customer_name',''));
  customer_phone_value := trim(coalesce(order_payload->>'customer_phone',''));
  customer_email_value := nullif(trim(coalesce(order_payload->>'customer_email','')),'');
  governorate_value := nullif(trim(coalesce(order_payload->>'governorate','')),'');
  city_value := nullif(trim(coalesce(order_payload->>'city','')),'');
  area_value := nullif(trim(coalesce(order_payload->>'area','')),'');
  address_value := nullif(trim(coalesce(order_payload->>'address','')),'');
  notes_value := nullif(trim(coalesce(order_payload->>'notes','')),'');
  coupon_value := nullif(upper(trim(coalesce(order_payload->>'coupon_code',''))),'');

  IF customer_name_value = '' OR length(customer_name_value) > 120 THEN RAISE EXCEPTION 'Please enter a valid customer name.'; END IF;
  IF customer_phone_value = '' OR length(customer_phone_value) > 40 THEN RAISE EXCEPTION 'Please enter a valid phone number.'; END IF;
  IF address_value IS NULL OR length(address_value) > 500 THEN RAISE EXCEPTION 'Please enter a valid delivery address.'; END IF;
  IF jsonb_typeof(order_payload->'items') <> 'array' OR jsonb_array_length(order_payload->'items') = 0 OR jsonb_array_length(order_payload->'items') > 50 THEN RAISE EXCEPTION 'Your cart is empty or contains too many items.'; END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(order_payload->'items') LOOP
    BEGIN
      item_product_id := (item->>'productId')::uuid;
      requested_qty := (item->>'quantity')::integer;
      item_variant_id := nullif(item->>'variantId','')::uuid;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'Invalid product in cart.'; END;
    IF requested_qty IS NULL OR requested_qty < 1 OR requested_qty > 100 THEN RAISE EXCEPTION 'Invalid quantity.'; END IF;
    SELECT * INTO product_row FROM public.products WHERE id=item_product_id AND is_active=true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'One of the products is no longer available.'; END IF;
    IF item_variant_id IS NOT NULL THEN
      SELECT * INTO variant_row FROM public.product_variants WHERE id=item_variant_id AND product_id=item_product_id AND is_active=true FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'One of the selected options is no longer available.'; END IF;
      IF variant_row.stock_quantity < requested_qty THEN RAISE EXCEPTION 'Not enough stock for %.', variant_row.name; END IF;
      server_unit_price := coalesce(variant_row.sale_price, variant_row.price, product_row.sale_price, product_row.price);
    ELSE
      IF product_row.stock_quantity < requested_qty THEN RAISE EXCEPTION 'Not enough stock for %.', product_row.name; END IF;
      server_unit_price := coalesce(product_row.sale_price, product_row.price);
    END IF;
    server_subtotal := server_subtotal + server_unit_price * requested_qty;
  END LOOP;

  -- Delivery fee for the chosen governorate (or the standard fee), free above the free-delivery amount.
  cod_delivery_price := public.delivery_fee_for(governorate_value, server_subtotal);
  IF cod_delivery_price IS NULL THEN RAISE EXCEPTION 'Sorry, we do not deliver to % yet.', governorate_value; END IF;

  -- Discount code (locked while the order is saved so its use count stays exact).
  IF coupon_value IS NOT NULL THEN
    SELECT * INTO coupon_row FROM public.coupons WHERE code = coupon_value FOR UPDATE;
    coupon_result := public.coupon_discount(coupon_value, server_subtotal, cod_delivery_price);
    IF NOT (coupon_result->>'ok')::boolean THEN RAISE EXCEPTION '%', coupon_result->>'message'; END IF;
    IF (coupon_result->>'free_delivery')::boolean THEN cod_delivery_price := 0;
    ELSE discount_value := (coupon_result->>'discount')::numeric; END IF;
  END IF;

  server_total := greatest(0, server_subtotal - discount_value) + cod_delivery_price;
  LOOP
    new_order_number := 'CT-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,6));
    BEGIN
      INSERT INTO public.orders (order_number,customer_id,customer_name,customer_phone,customer_email,governorate,city,area,address,subtotal,delivery_fee,discount,total,payment_method,status,notes,coupon_code)
      VALUES (new_order_number,auth.uid(),customer_name_value,customer_phone_value,customer_email_value,governorate_value,city_value,area_value,address_value,server_subtotal,cod_delivery_price,discount_value,server_total,'cash_on_delivery','pending',notes_value,coupon_value)
      RETURNING id INTO new_order_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END LOOP;
  IF coupon_value IS NOT NULL THEN UPDATE public.coupons SET used_count = used_count + 1 WHERE code = coupon_value; END IF;

  -- Stock history: these changes are recorded as "order" for this order.
  PERFORM set_config('clevertoys.stock_reason', 'order', true);
  PERFORM set_config('clevertoys.stock_order', new_order_id::text, true);
  FOR item IN SELECT * FROM jsonb_array_elements(order_payload->'items') LOOP
    item_product_id := (item->>'productId')::uuid;
    requested_qty := (item->>'quantity')::integer;
    item_variant_id := nullif(item->>'variantId','')::uuid;
    SELECT * INTO product_row FROM public.products WHERE id=item_product_id AND is_active=true FOR UPDATE;
    IF item_variant_id IS NOT NULL THEN
      SELECT * INTO variant_row FROM public.product_variants WHERE id=item_variant_id AND product_id=item_product_id AND is_active=true FOR UPDATE;
      server_unit_price := coalesce(variant_row.sale_price, variant_row.price, product_row.sale_price, product_row.price);
      variant_name_value := variant_row.name;
      item_sku := coalesce(variant_row.sku, product_row.sku);
      UPDATE public.product_variants SET stock_quantity=stock_quantity-requested_qty, updated_at=now() WHERE id=item_variant_id AND stock_quantity>=requested_qty;
      IF NOT FOUND THEN RAISE EXCEPTION 'Stock changed while placing the order. Please try again.'; END IF;
    ELSE
      server_unit_price := coalesce(product_row.sale_price,product_row.price);
      variant_name_value := NULL; item_sku := product_row.sku;
      UPDATE public.products SET stock_quantity=stock_quantity-requested_qty, updated_at=now() WHERE id=item_product_id AND stock_quantity>=requested_qty;
      IF NOT FOUND THEN RAISE EXCEPTION 'Stock changed while placing the order. Please try again.'; END IF;
    END IF;
    INSERT INTO public.order_items (order_id,product_id,variant_id,product_name,variant_name,sku,quantity,unit_price,total_price)
    VALUES (new_order_id,product_row.id,item_variant_id,product_row.name,variant_name_value,item_sku,requested_qty,server_unit_price,server_unit_price*requested_qty);
  END LOOP;
  PERFORM set_config('clevertoys.stock_reason', '', true);
  PERFORM set_config('clevertoys.stock_order', '', true);

  RETURN jsonb_build_object('order_id',new_order_id,'order_number',new_order_number,'subtotal',server_subtotal,'delivery_fee',cod_delivery_price,
                            'discount',discount_value,'coupon_code',coupon_value,'total',server_total);
END;
$$;
REVOKE ALL ON FUNCTION public.create_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO anon, authenticated;

-- -------------------------------------------------------------------------------------
-- Permissions per area (replaces the old "any admin can do everything" rules)
-- -------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL TO authenticated USING (public.admin_has('products')) WITH CHECK (public.admin_has('products'));
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products FOR ALL TO authenticated USING (public.admin_has('products')) WITH CHECK (public.admin_has('products'));
DROP POLICY IF EXISTS "Order staff can view products" ON public.products;
CREATE POLICY "Order staff can view products" ON public.products FOR SELECT TO authenticated USING (public.admin_has('orders'));
DROP POLICY IF EXISTS "Admins can manage product images" ON public.product_images;
CREATE POLICY "Admins can manage product images" ON public.product_images FOR ALL TO authenticated USING (public.admin_has('products')) WITH CHECK (public.admin_has('products'));
DROP POLICY IF EXISTS "Admins can manage product variants" ON public.product_variants;
CREATE POLICY "Admins can manage product variants" ON public.product_variants FOR ALL TO authenticated USING (public.admin_has('products')) WITH CHECK (public.admin_has('products'));
DROP POLICY IF EXISTS "Order staff can view product variants" ON public.product_variants;
CREATE POLICY "Order staff can view product variants" ON public.product_variants FOR SELECT TO authenticated USING (public.admin_has('orders'));
DROP POLICY IF EXISTS "Admins can manage product categories" ON public.product_categories;
CREATE POLICY "Admins can manage product categories" ON public.product_categories FOR ALL TO authenticated USING (public.admin_has('products')) WITH CHECK (public.admin_has('products'));
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
CREATE POLICY "Admins can manage orders" ON public.orders FOR ALL TO authenticated USING (public.admin_has('orders')) WITH CHECK (public.admin_has('orders'));
DROP POLICY IF EXISTS "Accounting can view orders" ON public.orders;
CREATE POLICY "Accounting can view orders" ON public.orders FOR SELECT TO authenticated USING (public.admin_has('accounting'));
DROP POLICY IF EXISTS "Admins can manage order items" ON public.order_items;
CREATE POLICY "Admins can manage order items" ON public.order_items FOR ALL TO authenticated USING (public.admin_has('orders')) WITH CHECK (public.admin_has('orders'));
DROP POLICY IF EXISTS "Accounting can view order items" ON public.order_items;
CREATE POLICY "Accounting can view order items" ON public.order_items FOR SELECT TO authenticated USING (public.admin_has('accounting'));
DROP POLICY IF EXISTS "Admins can manage expenses" ON public.expenses;
CREATE POLICY "Admins can manage expenses" ON public.expenses FOR ALL TO authenticated USING (public.admin_has('accounting')) WITH CHECK (public.admin_has('accounting'));
DROP POLICY IF EXISTS "Admins can manage SEO pages" ON public.seo_pages;
CREATE POLICY "Admins can manage SEO pages" ON public.seo_pages FOR ALL TO authenticated USING (public.admin_has('seo')) WITH CHECK (public.admin_has('seo'));
DROP POLICY IF EXISTS "Admins can manage store settings" ON public.store_settings;
CREATE POLICY "Admins can manage store settings" ON public.store_settings FOR ALL TO authenticated
  USING (public.admin_has('settings') OR public.admin_has('content') OR public.admin_has('seo'))
  WITH CHECK (public.admin_has('settings') OR public.admin_has('content') OR public.admin_has('seo'));
DROP POLICY IF EXISTS "Admins can manage visitor events" ON public.visitor_events;
DROP POLICY IF EXISTS "Admins can view visitor events" ON public.visitor_events;
CREATE POLICY "Admins can view visitor events" ON public.visitor_events FOR SELECT TO authenticated USING (public.admin_has('analytics'));
CREATE POLICY "Admins can manage visitor events" ON public.visitor_events FOR ALL TO authenticated USING (public.admin_has('analytics')) WITH CHECK (public.admin_has('analytics'));
DROP POLICY IF EXISTS "Admins can manage visitor sessions" ON public.visitor_sessions;
DROP POLICY IF EXISTS "Admins can view visitor sessions" ON public.visitor_sessions;
CREATE POLICY "Admins can view visitor sessions" ON public.visitor_sessions FOR SELECT TO authenticated USING (public.admin_has('analytics'));
CREATE POLICY "Admins can manage visitor sessions" ON public.visitor_sessions FOR ALL TO authenticated USING (public.admin_has('analytics')) WITH CHECK (public.admin_has('analytics'));
-- Customer profiles: staff with customer access can read them (customers still see only their own).
DROP POLICY IF EXISTS "Admins can view customer profiles" ON public.customer_profiles;
CREATE POLICY "Admins can view customer profiles" ON public.customer_profiles FOR SELECT TO authenticated USING (public.admin_has('customers'));

-- -------------------------------------------------------------------------------------
-- Activity log triggers on every table the admin panel changes
-- -------------------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','product_variants','categories','orders','expenses','seo_pages','store_settings','pages','banners','coupons','delivery_zones','reviews'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_activity_log', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_admin_change()', t || '_activity_log', t);
  END LOOP;
END $$;

-- Keep updated_at current on the new tables.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pages','banners','coupons','delivery_zones','reviews'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

-- Tell the API about the new tables and functions right away.
NOTIFY pgrst, 'reload schema';

-- Trigger-only functions are never called directly; small helpers get a fixed search path.
REVOKE EXECUTE ON FUNCTION public.log_admin_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_stock_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restock_on_cancel() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.admin_role_allows(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.phone_key(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.touch_updated_at() SET search_path = public, pg_temp;
