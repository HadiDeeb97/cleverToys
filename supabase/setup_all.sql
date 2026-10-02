-- ============================================================================
-- Clever Toys: complete database structure (made 2026-10-02 21:43 UTC).
-- Rebuilds the store's database in a new, empty Supabase project. Data is not included:
-- after running this, restore a backup in Admin → Backup.
-- In the Supabase SQL Editor, paste the WHOLE file and press Run. Safe to run more than once.
--
-- Made from the live database with public.schema_snapshot() (supabase/schema_snapshot.sql). Every
-- Admin → Backup .zip also contains a fresh copy as schema.sql, which is newer than this file.
--
-- Rebuilding the store in a new Supabase project:
--   1. Run this file (or schema.sql from your latest backup) in the new project's SQL Editor.
--   2. Point the website at the new project (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) and deploy.
--   3. Create your account on the store, then make it the owner here in the SQL Editor:
--        insert into public.admin_users (user_id, role) select id, 'owner' from auth.users where email = 'YOUR EMAIL';
--   4. Admin → Backup → Restore from a backup, and choose the backup .zip.
-- ============================================================================
SET check_function_bodies = off;

-- 1. Extensions
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- 2. Tables
CREATE TABLE IF NOT EXISTS public.admin_activity (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid,
  user_email text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  label text,
  changes jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  role text DEFAULT 'owner'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.banners (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  subtitle text,
  image_url text,
  link_url text,
  button_text text,
  text_tone text DEFAULT 'light'::text NOT NULL,
  background text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  seo_title text,
  seo_description text,
  image_url text,
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  description text,
  discount_type text NOT NULL,
  value numeric(10,2) DEFAULT 0 NOT NULL,
  min_subtotal numeric(10,2) DEFAULT 0 NOT NULL,
  max_uses integer,
  used_count integer DEFAULT 0 NOT NULL,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id uuid NOT NULL,
  full_name text,
  phone text,
  governorate text,
  city text,
  area text,
  address text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.delivery_zones (
  governorate text NOT NULL,
  fee numeric(10,2) DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  eta text,
  sort_order integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  spent_on date DEFAULT CURRENT_DATE NOT NULL,
  category text DEFAULT 'Other'::text NOT NULL,
  description text DEFAULT ''::text NOT NULL,
  amount numeric(12,2) NOT NULL,
  payment_method text DEFAULT 'Cash'::text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  variant_id uuid,
  product_name text NOT NULL,
  variant_name text,
  sku text,
  quantity integer NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_number text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  governorate text,
  city text,
  area text,
  address text,
  subtotal numeric(10,2) DEFAULT 0 NOT NULL,
  delivery_fee numeric(10,2) DEFAULT 0 NOT NULL,
  discount numeric(10,2) DEFAULT 0 NOT NULL,
  total numeric(10,2) DEFAULT 0 NOT NULL,
  payment_method text DEFAULT 'cash_on_delivery'::text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  customer_id uuid,
  coupon_code text
);

CREATE TABLE IF NOT EXISTS public.pages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  intro text,
  body text DEFAULT ''::text NOT NULL,
  is_published boolean DEFAULT true NOT NULL,
  show_in_footer boolean DEFAULT false NOT NULL,
  is_system boolean DEFAULT false NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id uuid NOT NULL,
  category_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  product_id uuid NOT NULL,
  image_url text NOT NULL,
  alt_text text,
  sort_order integer DEFAULT 0 NOT NULL,
  is_primary boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.product_slug_history (
  old_slug text NOT NULL,
  product_id uuid NOT NULL,
  changed_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  product_id uuid NOT NULL,
  name text NOT NULL,
  sku text,
  price numeric(10,2),
  sale_price numeric(10,2),
  stock_quantity integer DEFAULT 0 NOT NULL,
  attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  cost_price numeric(10,2)
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  category_id uuid,
  name text NOT NULL,
  slug text NOT NULL,
  sku text,
  short_description text,
  description text,
  price numeric(10,2) DEFAULT 0 NOT NULL,
  sale_price numeric(10,2),
  stock_quantity integer DEFAULT 0 NOT NULL,
  age_min integer,
  age_max integer,
  brand text,
  primary_image_url text,
  seo_title text,
  seo_description text,
  is_active boolean DEFAULT true NOT NULL,
  is_featured boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  cost_price numeric(10,2)
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  product_id uuid NOT NULL,
  customer_id uuid,
  author_name text NOT NULL,
  rating integer NOT NULL,
  title text,
  body text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  verified boolean DEFAULT false NOT NULL,
  admin_reply text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.seo_pages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  path_key text NOT NULL,
  title text DEFAULT ''::text NOT NULL,
  description text DEFAULT ''::text NOT NULL,
  cover_image_url text,
  keywords text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  noindex boolean DEFAULT false NOT NULL,
  in_sitemap boolean DEFAULT true NOT NULL,
  priority numeric(2,1),
  changefreq text
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  product_id uuid NOT NULL,
  variant_id uuid,
  change integer NOT NULL,
  stock_after integer NOT NULL,
  reason text NOT NULL,
  order_id uuid,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.store_settings (
  id text DEFAULT 'default'::text NOT NULL,
  whatsapp_url text DEFAULT 'https://wa.me/96171220251?text=Hello%2C%20I%27m%20interested%20with%20your%20product'::text NOT NULL,
  instagram_url text DEFAULT ''::text NOT NULL,
  show_whatsapp boolean DEFAULT true NOT NULL,
  show_instagram boolean DEFAULT false NOT NULL,
  ribbon_text text DEFAULT ''::text NOT NULL,
  show_ribbon boolean DEFAULT false NOT NULL,
  cod_delivery_price numeric(10,2) DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  free_delivery_threshold numeric(10,2) DEFAULT 0 NOT NULL,
  theme jsonb,
  seo jsonb DEFAULT '{}'::jsonb NOT NULL,
  logo_url text,
  favicon_url text,
  design jsonb DEFAULT '{}'::jsonb NOT NULL,
  low_stock_threshold integer DEFAULT 5 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.visitor_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id text NOT NULL,
  visitor_id text NOT NULL,
  event_type text DEFAULT 'pageview'::text NOT NULL,
  path text NOT NULL,
  referrer text,
  country text,
  device text,
  browser text,
  os text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.visitor_sessions (
  session_id text NOT NULL,
  visitor_id text NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  landing_path text DEFAULT '/'::text NOT NULL,
  current_path text DEFAULT '/'::text NOT NULL,
  entry_referrer text,
  country text,
  device text DEFAULT 'unknown'::text NOT NULL,
  browser text DEFAULT 'unknown'::text NOT NULL,
  os text DEFAULT 'unknown'::text NOT NULL,
  page_count integer DEFAULT 1 NOT NULL
);

-- 3. Keys, checks and links
DO $c$ BEGIN ALTER TABLE public.admin_activity ADD CONSTRAINT admin_activity_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_pkey PRIMARY KEY (user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.banners ADD CONSTRAINT banners_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.categories ADD CONSTRAINT categories_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.coupons ADD CONSTRAINT coupons_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.customer_profiles ADD CONSTRAINT customer_profiles_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.delivery_zones ADD CONSTRAINT delivery_zones_pkey PRIMARY KEY (governorate); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.expenses ADD CONSTRAINT expenses_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.pages ADD CONSTRAINT pages_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_categories ADD CONSTRAINT product_categories_pkey PRIMARY KEY (product_id, category_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_images ADD CONSTRAINT product_images_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_slug_history ADD CONSTRAINT product_slug_history_pkey PRIMARY KEY (old_slug); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.seo_pages ADD CONSTRAINT seo_pages_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.store_settings ADD CONSTRAINT store_settings_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.visitor_events ADD CONSTRAINT visitor_events_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.visitor_sessions ADD CONSTRAINT visitor_sessions_pkey PRIMARY KEY (session_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.categories ADD CONSTRAINT categories_slug_key UNIQUE (slug); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.coupons ADD CONSTRAINT coupons_code_key UNIQUE (code); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.pages ADD CONSTRAINT pages_slug_key UNIQUE (slug); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_sku_key UNIQUE (sku); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.products ADD CONSTRAINT products_sku_key UNIQUE (sku); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.products ADD CONSTRAINT products_slug_key UNIQUE (slug); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.seo_pages ADD CONSTRAINT seo_pages_path_key_key UNIQUE (path_key); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'orders'::text, 'content'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.banners ADD CONSTRAINT banners_text_tone_check CHECK ((text_tone = ANY (ARRAY['light'::text, 'dark'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.banners ADD CONSTRAINT banners_title_check CHECK (((length(title) >= 1) AND (length(title) <= 120))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.coupons ADD CONSTRAINT coupons_check CHECK (((discount_type <> 'percent'::text) OR (value <= (100)::numeric))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.coupons ADD CONSTRAINT coupons_code_check CHECK ((code ~ '^[A-Z0-9_-]{3,30}$'::text)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.coupons ADD CONSTRAINT coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percent'::text, 'fixed'::text, 'free_delivery'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.coupons ADD CONSTRAINT coupons_max_uses_check CHECK (((max_uses IS NULL) OR (max_uses > 0))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.coupons ADD CONSTRAINT coupons_min_subtotal_check CHECK ((min_subtotal >= (0)::numeric)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.coupons ADD CONSTRAINT coupons_value_check CHECK ((value >= (0)::numeric)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.delivery_zones ADD CONSTRAINT delivery_zones_fee_check CHECK ((fee >= (0)::numeric)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_check CHECK ((amount >= (0)::numeric)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.order_items ADD CONSTRAINT order_items_quantity_positive CHECK ((quantity > 0)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.order_items ADD CONSTRAINT order_items_total_price_non_negative CHECK ((total_price >= (0)::numeric)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.order_items ADD CONSTRAINT order_items_unit_price_non_negative CHECK ((unit_price >= (0)::numeric)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_fee_non_negative CHECK ((delivery_fee >= (0)::numeric)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.orders ADD CONSTRAINT orders_discount_non_negative CHECK ((discount >= (0)::numeric)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.orders ADD CONSTRAINT orders_subtotal_non_negative CHECK ((subtotal >= (0)::numeric)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.orders ADD CONSTRAINT orders_total_non_negative CHECK ((total >= (0)::numeric)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.pages ADD CONSTRAINT pages_slug_check CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (length(slug) <= 80))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.pages ADD CONSTRAINT pages_title_check CHECK (((length(title) >= 1) AND (length(title) <= 160))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_cost_price_check CHECK (((cost_price IS NULL) OR (cost_price >= (0)::numeric))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_price_non_negative CHECK (((price IS NULL) OR (price >= (0)::numeric))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_sale_price_non_negative CHECK (((sale_price IS NULL) OR (sale_price >= (0)::numeric))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_sale_price_valid CHECK (((sale_price IS NULL) OR (price IS NULL) OR (sale_price <= price))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_stock_non_negative CHECK ((stock_quantity >= 0)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.products ADD CONSTRAINT products_age_max_valid CHECK (((age_max IS NULL) OR (age_max >= 0))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.products ADD CONSTRAINT products_age_min_valid CHECK (((age_min IS NULL) OR (age_min >= 0))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.products ADD CONSTRAINT products_age_range_valid CHECK (((age_min IS NULL) OR (age_max IS NULL) OR (age_max >= age_min))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.products ADD CONSTRAINT products_cost_price_check CHECK (((cost_price IS NULL) OR (cost_price >= (0)::numeric))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.products ADD CONSTRAINT products_price_non_negative CHECK ((price >= (0)::numeric)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.products ADD CONSTRAINT products_sale_price_non_negative CHECK (((sale_price IS NULL) OR (sale_price >= (0)::numeric))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.products ADD CONSTRAINT products_sale_price_valid CHECK (((sale_price IS NULL) OR (sale_price <= price))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.products ADD CONSTRAINT products_stock_non_negative CHECK ((stock_quantity >= 0)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.reviews ADD CONSTRAINT reviews_author_name_check CHECK (((length(author_name) >= 1) AND (length(author_name) <= 60))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.reviews ADD CONSTRAINT reviews_body_check CHECK (((length(body) >= 1) AND (length(body) <= 2000))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.reviews ADD CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.reviews ADD CONSTRAINT reviews_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'hidden'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.reviews ADD CONSTRAINT reviews_title_check CHECK (((title IS NULL) OR (length(title) <= 120))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.seo_pages ADD CONSTRAINT seo_pages_changefreq_check CHECK (((changefreq IS NULL) OR (changefreq = ANY (ARRAY['always'::text, 'hourly'::text, 'daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text, 'never'::text])))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.seo_pages ADD CONSTRAINT seo_pages_priority_check CHECK (((priority IS NULL) OR ((priority >= (0)::numeric) AND (priority <= (1)::numeric)))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.store_settings ADD CONSTRAINT store_settings_cod_delivery_price_check CHECK ((cod_delivery_price >= (0)::numeric)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.store_settings ADD CONSTRAINT store_settings_free_delivery_threshold_check CHECK ((free_delivery_threshold >= (0)::numeric)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.visitor_sessions ADD CONSTRAINT visitor_sessions_page_count_check CHECK ((page_count >= 0)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.customer_profiles ADD CONSTRAINT customer_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.order_items ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.orders ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_categories ADD CONSTRAINT product_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_categories ADD CONSTRAINT product_categories_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_images ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_slug_history ADD CONSTRAINT product_slug_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.reviews ADD CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.visitor_events ADD CONSTRAINT visitor_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.visitor_sessions(session_id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS admin_activity_created_idx ON public.admin_activity USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS expenses_spent_on_idx ON public.expenses USING btree (spent_on DESC);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON public.order_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS order_items_variant_id_idx ON public.order_items USING btree (variant_id);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON public.orders USING btree (customer_id);
CREATE INDEX IF NOT EXISTS product_categories_category_id_idx ON public.product_categories USING btree (category_id);
CREATE INDEX IF NOT EXISTS product_categories_product_id_idx ON public.product_categories USING btree (product_id);
CREATE INDEX IF NOT EXISTS product_images_product_id_idx ON public.product_images USING btree (product_id);
CREATE INDEX IF NOT EXISTS product_slug_history_product_id_idx ON public.product_slug_history USING btree (product_id);
CREATE INDEX IF NOT EXISTS product_variants_product_id_idx ON public.product_variants USING btree (product_id);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products USING btree (category_id);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON public.reviews USING btree (product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS seo_pages_path_key_idx ON public.seo_pages USING btree (path_key);
CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON public.stock_movements USING btree (created_at);
CREATE INDEX IF NOT EXISTS stock_movements_order_id_idx ON public.stock_movements USING btree (order_id);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON public.stock_movements USING btree (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_variant_id_idx ON public.stock_movements USING btree (variant_id);
CREATE INDEX IF NOT EXISTS visitor_events_created_at_idx ON public.visitor_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS visitor_events_created_idx ON public.visitor_events USING btree (created_at);
CREATE INDEX IF NOT EXISTS visitor_events_path_idx ON public.visitor_events USING btree (path);
CREATE INDEX IF NOT EXISTS visitor_events_session_id_idx ON public.visitor_events USING btree (session_id);
CREATE INDEX IF NOT EXISTS visitor_sessions_last_seen_idx ON public.visitor_sessions USING btree (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS visitor_sessions_visitor_id_idx ON public.visitor_sessions USING btree (visitor_id);

-- 5. Functions
CREATE OR REPLACE FUNCTION public.admin_add_admin(p_email text, p_role text DEFAULT 'manager'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.admin_has(p_perm text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND public.admin_role_allows(a.role, p_perm));
$function$
;
CREATE OR REPLACE FUNCTION public.admin_list_admins()
 RETURNS TABLE(user_id uuid, email text, role text, added_at timestamp with time zone, last_sign_in_at timestamp with time zone, is_you boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
#variable_conflict use_column
BEGIN
  IF NOT public.admin_has('team') THEN RAISE EXCEPTION 'Only the store owner can view the admin team.'; END IF;
  RETURN QUERY
    SELECT a.user_id, u.email::text, a.role, a.created_at, u.last_sign_in_at, a.user_id = auth.uid()
    FROM public.admin_users a JOIN auth.users u ON u.id = a.user_id
    ORDER BY a.created_at;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_list_customers(p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(customer_key text, customer_id uuid, name text, email text, phone text, governorate text, orders_count bigint, total_spent numeric, last_order_at timestamp with time zone, registered_at timestamp with time zone, total_rows bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.admin_me()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
  SELECT CASE WHEN a.user_id IS NULL THEN NULL ELSE jsonb_build_object(
    'role', a.role,
    'email', (SELECT email FROM auth.users WHERE id = a.user_id),
    'perms', (SELECT jsonb_agg(p) FROM unnest(ARRAY['products','orders','customers','accounting','analytics','content','marketing','seo','settings','reviews','team','logs','backup']) p WHERE public.admin_role_allows(a.role, p))
  ) END
  FROM (SELECT 1) one LEFT JOIN public.admin_users a ON a.user_id = auth.uid();
$function$
;
CREATE OR REPLACE FUNCTION public.admin_remove_admin(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.admin_role_allows(p_role text, p_perm text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE p_role
    WHEN 'owner' THEN true
    WHEN 'manager' THEN p_perm NOT IN ('team', 'backup')
    WHEN 'orders' THEN p_perm IN ('orders', 'customers')
    WHEN 'content' THEN p_perm IN ('products', 'content', 'marketing', 'seo', 'reviews')
    ELSE false
  END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id uuid, p_role text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.check_coupon(p_code text, p_subtotal numeric, p_governorate text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.coupon_discount(p_code, p_subtotal, public.delivery_fee_for(p_governorate, p_subtotal));
$function$
;
CREATE OR REPLACE FUNCTION public.coupon_discount(p_code text, p_subtotal numeric, p_delivery numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.create_order(order_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.delivery_fee_for(p_governorate text, p_subtotal numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.customer_profiles (id, full_name)
  VALUES (NEW.id, nullif(trim(coalesce(NEW.raw_user_meta_data->>'full_name', '')), ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$function$
;
CREATE OR REPLACE FUNCTION public.log_activity(p_action text, p_entity text, p_entity_id text, p_label text, p_changes jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN RETURN; END IF;
  INSERT INTO public.admin_activity (user_id, user_email, action, entity, entity_id, label, changes)
  VALUES (auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()), p_action, p_entity, p_entity_id, left(p_label, 200), p_changes);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.log_admin_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.phone_key(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^00', ''), '^961', ''), '^0', '');
$function$
;
CREATE OR REPLACE FUNCTION public.product_stock_from_variants()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE total integer := public.variant_stock_total(NEW.id);
BEGIN
  IF total IS NOT NULL THEN NEW.stock_quantity := total; END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.purge_old_records(keep_days integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.record_stock_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  delta integer := NEW.stock_quantity - CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.stock_quantity END;
  reason text := nullif(current_setting('clevertoys.stock_reason', true), '');
  order_ref uuid := nullif(current_setting('clevertoys.stock_order', true), '')::uuid;
BEGIN
  IF delta = 0 THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME = 'products' AND current_setting('clevertoys.stock_sync', true) = '1' THEN RETURN NULL; END IF;
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
$function$
;
CREATE OR REPLACE FUNCTION public.remember_product_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug AND OLD.slug IS NOT NULL THEN
    INSERT INTO public.product_slug_history (old_slug, product_id) VALUES (OLD.slug, NEW.id)
    ON CONFLICT (old_slug) DO UPDATE SET product_id = EXCLUDED.product_id, changed_at = now();
    -- The new address is live again, so it is no longer an "old" one.
    DELETE FROM public.product_slug_history WHERE old_slug = NEW.slug;
  END IF;
  RETURN NULL;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.restock_on_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.schema_snapshot()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  out text;
  part text;
  nl constant text := E'\n';
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') AND NOT coalesce(public.admin_has('backup'), false) THEN
    RAISE EXCEPTION 'Only the store owner can read the database structure.';
  END IF;

  out := '-- ============================================================================' || nl
      || '-- Clever Toys: complete database structure (made ' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC).' || nl
      || '-- Rebuilds the store''s database in a new, empty Supabase project. Data is not included:' || nl
      || '-- after running this, restore a backup in Admin → Backup.' || nl
      || '-- In the Supabase SQL Editor, paste the WHOLE file and press Run. Safe to run more than once.' || nl
      || '-- ============================================================================' || nl
      || 'SET check_function_bodies = off;' || nl || nl;

  -- 1. Extensions (search, ids, the nightly job…)
  SELECT string_agg(format('CREATE EXTENSION IF NOT EXISTS %I WITH SCHEMA %I;', e.extname, n.nspname), nl ORDER BY e.extname)
    INTO part
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname NOT IN ('plpgsql', 'supabase_vault', 'pg_graphql', 'pgsodium');
  out := out || '-- 1. Extensions' || nl || 'CREATE SCHEMA IF NOT EXISTS extensions;' || nl || coalesce(part, '') || nl || nl;

  -- 2. Tables and their columns
  SELECT string_agg(format(E'CREATE TABLE IF NOT EXISTS public.%I (\n%s\n);', c.relname, cols.def), nl || nl ORDER BY c.relname)
    INTO part
  FROM pg_class c
  CROSS JOIN LATERAL (
    SELECT string_agg(
      '  ' || quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod)
      || CASE a.attidentity WHEN 'a' THEN ' GENERATED ALWAYS AS IDENTITY' WHEN 'd' THEN ' GENERATED BY DEFAULT AS IDENTITY' ELSE '' END
      || CASE WHEN a.attgenerated = 's' THEN ' GENERATED ALWAYS AS (' || pg_get_expr(d.adbin, d.adrelid) || ') STORED'
              WHEN d.adbin IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid) ELSE '' END
      || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END,
      E',\n' ORDER BY a.attnum) AS def
    FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  ) cols
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r';
  out := out || '-- 2. Tables' || nl || coalesce(part, '') || nl || nl;

  -- 3. Keys, checks and links between tables (primary keys first, links last)
  SELECT string_agg(
      format('DO $c$ BEGIN ALTER TABLE public.%I ADD CONSTRAINT %I %s; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;',
             cl.relname, co.conname, pg_get_constraintdef(co.oid)),
      nl ORDER BY CASE co.contype WHEN 'p' THEN 1 WHEN 'u' THEN 2 WHEN 'c' THEN 3 WHEN 'x' THEN 4 ELSE 5 END, cl.relname, co.conname)
    INTO part
  FROM pg_constraint co JOIN pg_class cl ON cl.oid = co.conrelid
  WHERE cl.relnamespace = 'public'::regnamespace AND cl.relkind = 'r' AND co.contype IN ('p', 'u', 'c', 'f', 'x');
  out := out || '-- 3. Keys, checks and links' || nl || coalesce(part, '') || nl || nl;

  -- 4. Indexes (the ones not already made by a key above)
  SELECT string_agg(
      regexp_replace(pg_get_indexdef(i.indexrelid), '^CREATE (UNIQUE )?INDEX ', 'CREATE \1INDEX IF NOT EXISTS ') || ';',
      nl ORDER BY ic.relname)
    INTO part
  FROM pg_index i
  JOIN pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_class t ON t.oid = i.indrelid
  WHERE t.relnamespace = 'public'::regnamespace
    AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.indexrelid);
  out := out || '-- 4. Indexes' || nl || coalesce(part, '') || nl || nl;

  -- 5. Functions (search, orders, stock, admin roles, clean-up…), without the ones extensions bring
  SELECT string_agg(pg_get_functiondef(p.oid) || ';', nl ORDER BY p.proname, p.oid::regprocedure::text)
    INTO part
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind IN ('f', 'p')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e');
  out := out || '-- 5. Functions' || nl || coalesce(part, '') || nl;

  -- 6. Who may call each function
  SELECT string_agg(
      format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated;', p.oid::regprocedure)
      || coalesce((
        SELECT string_agg(format(' GRANT EXECUTE ON FUNCTION %s TO %s;', p.oid::regprocedure, CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(r.rolname) END), '' ORDER BY r.rolname)
        FROM aclexplode(p.proacl) a LEFT JOIN pg_roles r ON r.oid = a.grantee
        WHERE a.privilege_type = 'EXECUTE' AND (a.grantee = 0 OR r.rolname IN ('anon', 'authenticated', 'service_role'))
      ), ''),
      nl ORDER BY p.oid::regprocedure::text)
    INTO part
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind IN ('f', 'p') AND p.proacl IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e');
  out := out || '-- 6. Function permissions' || nl || coalesce(part, '') || nl || nl;

  -- 7. Row-level security and table permissions
  SELECT string_agg(format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', relname), nl ORDER BY relname)
    INTO part
  FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity;
  out := out || '-- 7. Row-level security and table permissions' || nl || coalesce(part, '') || nl;
  SELECT string_agg(
      format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated;', c.relname)
      || coalesce((
        SELECT string_agg(format(' GRANT %s ON TABLE public.%I TO %I;', g.privs, c.relname, g.rolname), '' ORDER BY g.rolname)
        FROM (SELECT r.rolname, string_agg(a.privilege_type, ', ' ORDER BY a.privilege_type) AS privs
              FROM aclexplode(c.relacl) a JOIN pg_roles r ON r.oid = a.grantee
              WHERE r.rolname IN ('anon', 'authenticated') GROUP BY r.rolname) g
      ), ''),
      nl ORDER BY c.relname)
    INTO part
  FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relacl IS NOT NULL;
  out := out || coalesce(part, '') || nl || nl;

  -- 8. Security rules (who can read and change what), for the store tables and the picture storage
  SELECT string_agg(
      format('DO $p$ BEGIN CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s; EXCEPTION WHEN duplicate_object THEN NULL; END $p$;',
             policyname, schemaname, tablename, permissive, cmd,
             (SELECT string_agg(CASE WHEN r = 'public' THEN 'PUBLIC' ELSE quote_ident(r) END, ', ') FROM unnest(roles) AS r),
             CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END,
             CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END),
      nl ORDER BY schemaname, tablename, policyname)
    INTO part
  FROM pg_policies WHERE schemaname = 'public' OR (schemaname = 'storage' AND tablename = 'objects');
  out := out || '-- 8. Security rules' || nl || coalesce(part, '') || nl || nl;

  -- 9. Triggers (stock sync, history, activity log, customer profile on sign-up…)
  SELECT string_agg(regexp_replace(pg_get_triggerdef(t.oid), '^CREATE TRIGGER ', 'CREATE OR REPLACE TRIGGER ') || ';', nl ORDER BY t.tgrelid::regclass::text, t.tgname)
    INTO part
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE NOT t.tgisinternal AND (c.relnamespace = 'public'::regnamespace OR t.tgrelid = 'auth.users'::regclass);
  out := out || '-- 9. Triggers' || nl || coalesce(part, '') || nl || nl;

  -- 9b. Event triggers that run store functions (e.g. turning on row-level security for new tables)
  SELECT string_agg(
      format('DO $e$ BEGIN CREATE EVENT TRIGGER %I ON %s%s EXECUTE FUNCTION %s(); EXCEPTION WHEN duplicate_object OR insufficient_privilege THEN NULL; END $e$;',
             et.evtname, et.evtevent,
             CASE WHEN et.evttags IS NOT NULL THEN ' WHEN TAG IN (' || (SELECT string_agg(quote_literal(tag), ', ') FROM unnest(et.evttags) AS tag) || ')' ELSE '' END,
             et.evtfoid::regproc),
      nl ORDER BY et.evtname)
    INTO part
  FROM pg_event_trigger et JOIN pg_proc p ON p.oid = et.evtfoid
  WHERE p.pronamespace = 'public'::regnamespace;
  out := out || '-- 9b. Event triggers' || nl || coalesce(part, '') || nl || nl;

  -- 10. Picture storage
  SELECT string_agg(format('INSERT INTO storage.buckets (id, name, public) VALUES (%L, %L, %s) ON CONFLICT (id) DO NOTHING;', id, name, CASE WHEN public THEN 'true' ELSE 'false' END), nl ORDER BY id)
    INTO part FROM storage.buckets;
  out := out || '-- 10. Picture storage' || nl || coalesce(part, '') || nl || nl;

  -- 11. Scheduled jobs (nightly clean-up)
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE $q$SELECT string_agg(format('SELECT cron.schedule(%L, %L, %L);', jobname, schedule, command), E'\n' ORDER BY jobname) FROM cron.job$q$ INTO part;
    out := out || '-- 11. Scheduled jobs' || nl || coalesce(part, '') || nl || nl;
  END IF;

  -- 12. The settings row every page reads, then refresh the API
  out := out || '-- 12. Store settings row and API refresh' || nl
      || 'INSERT INTO public.store_settings (id) VALUES (''default'') ON CONFLICT (id) DO NOTHING;' || nl
      || 'NOTIFY pgrst, ''reload schema'';' || nl;
  RETURN out;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.search_product_rows(q text, max_results integer DEFAULT 6)
 RETURNS SETOF public.products
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
 SET jit TO 'off'
AS $function$
  SELECT p.*
  FROM public.search_products(q, max_results) AS s
  JOIN public.products AS p ON p.id = s.id
  ORDER BY s.score DESC;
$function$
;
CREATE OR REPLACE FUNCTION public.search_products(q text, max_results integer DEFAULT 300)
 RETURNS TABLE(id uuid, score real)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
 SET jit TO 'off'
AS $function$
  WITH query AS (
    SELECT lower(extensions.unaccent(regexp_replace(coalesce(q, ''), '[^[:alnum:]]+', ' ', 'g'))) AS text
  ),
  words AS (
    SELECT DISTINCT w
    FROM query, regexp_split_to_table(trim(query.text), '\s+') AS w
    WHERE length(w) > 0
  ),
  docs AS (
    SELECT
      p.id,
      p.created_at,
      lower(extensions.unaccent(coalesce(p.name, ''))) AS name,
      regexp_replace(lower(extensions.unaccent(concat_ws(' ',
        p.name, p.brand, p.sku, p.short_description, p.description, c.name,
        (SELECT string_agg(c2.name, ' ') FROM public.product_categories pc JOIN public.categories c2 ON c2.id = pc.category_id WHERE pc.product_id = p.id),
        (SELECT string_agg(v.name, ' ') FROM public.product_variants v WHERE v.product_id = p.id AND v.is_active)
      ))), '[^[:alnum:]]+', ' ', 'g') AS doc
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.is_active
  ),
  matched AS (
    SELECT d.*
    FROM docs d
    WHERE EXISTS (SELECT 1 FROM words)
      AND NOT EXISTS (
        SELECT 1 FROM words
        WHERE NOT (
          d.doc LIKE '%' || w || '%'
          OR (length(w) > 3 AND w LIKE '%s' AND d.doc LIKE '%' || left(w, length(w) - 1) || '%')
          OR (length(w) > 4 AND w LIKE '%es' AND d.doc LIKE '%' || left(w, length(w) - 2) || '%')
          OR (length(w) >= 4 AND EXISTS (
            SELECT 1 FROM regexp_split_to_table(d.doc, '\s+') AS dw
            WHERE abs(length(dw) - length(w)) <= 2
              AND extensions.levenshtein_less_equal(w, dw, CASE WHEN length(w) >= 5 THEN 2 ELSE 1 END)
                  <= CASE WHEN length(w) >= 5 THEN 2 ELSE 1 END
          ))
          OR (length(w) >= 4 AND extensions.word_similarity(w, d.doc) >= 0.6)
        )
      )
  )
  SELECT
    m.id,
    (
      CASE WHEN m.name = (SELECT trim(text) FROM query) THEN 20 ELSE 0 END
      + CASE WHEN m.name LIKE (SELECT trim(text) FROM query) || '%' THEN 8 ELSE 0 END
      + (SELECT count(*) FROM words WHERE m.name LIKE '%' || w || '%') * 4
      + (SELECT count(*) FROM words WHERE m.doc LIKE '%' || w || '%') * 1.5
      + extensions.similarity(m.name, (SELECT trim(text) FROM query)) * 6
      + extensions.word_similarity((SELECT trim(text) FROM query), m.doc) * 2
    )::real AS score
  FROM matched m
  ORDER BY score DESC, m.created_at DESC
  LIMIT greatest(1, least(coalesce(max_results, 300), 1000));
$function$
;
CREATE OR REPLACE FUNCTION public.submit_review(p_product_id uuid, p_name text, p_rating integer, p_title text, p_body text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.sync_product_stock_from_variants()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE pid uuid; total integer;
BEGIN
  FOR pid IN
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.product_id END,
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.product_id END
    ]) AS x WHERE x IS NOT NULL
  LOOP
    total := public.variant_stock_total(pid);
    IF total IS NOT NULL THEN
      PERFORM set_config('clevertoys.stock_sync', '1', true);
      UPDATE public.products SET stock_quantity = total WHERE id = pid AND stock_quantity IS DISTINCT FROM total;
      PERFORM set_config('clevertoys.stock_sync', '', true);
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $function$
;
CREATE OR REPLACE FUNCTION public.track_order(p_order_number text, p_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  o public.orders%ROWTYPE;
  input_digits text;
  stored_digits text;
  compare_len integer;
BEGIN
  IF p_order_number IS NULL OR p_phone IS NULL OR length(p_order_number) > 40 OR length(p_phone) > 40 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO o FROM public.orders WHERE order_number = upper(trim(p_order_number)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Compare the last digits so "+961 71 123 456" and "71123456" both match.
  input_digits := regexp_replace(p_phone, '\D', '', 'g');
  stored_digits := regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g');
  compare_len := least(8, length(input_digits), length(stored_digits));
  IF compare_len < 6 OR right(input_digits, compare_len) <> right(stored_digits, compare_len) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'created_at', o.created_at,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'items', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('name', i.product_name, 'variant', i.variant_name, 'quantity', i.quantity, 'total', i.total_price) ORDER BY i.product_name), '[]'::jsonb)
      FROM public.order_items i
      WHERE i.order_id = o.id
    )
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.track_visitor(p_visitor_id text, p_session_id text, p_path text, p_referrer text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_device text DEFAULT 'unknown'::text, p_browser text DEFAULT 'unknown'::text, p_os text DEFAULT 'unknown'::text, p_event_type text DEFAULT 'pageview'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.variant_stock_total(p_product_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE WHEN count(*) > 0 THEN coalesce(sum(greatest(stock_quantity, 0)), 0)::integer END
  FROM public.product_variants
  WHERE product_id = p_product_id AND is_active;
$function$
;
-- 6. Function permissions
REVOKE ALL ON FUNCTION public.admin_add_admin(text,text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.admin_add_admin(text,text) TO authenticated; GRANT EXECUTE ON FUNCTION public.admin_add_admin(text,text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_has(text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.admin_has(text) TO anon; GRANT EXECUTE ON FUNCTION public.admin_has(text) TO authenticated; GRANT EXECUTE ON FUNCTION public.admin_has(text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_list_admins() FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated; GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO service_role;
REVOKE ALL ON FUNCTION public.admin_list_customers(text,integer,integer) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.admin_list_customers(text,integer,integer) TO authenticated; GRANT EXECUTE ON FUNCTION public.admin_list_customers(text,integer,integer) TO service_role;
REVOKE ALL ON FUNCTION public.admin_me() FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.admin_me() TO authenticated; GRANT EXECUTE ON FUNCTION public.admin_me() TO service_role;
REVOKE ALL ON FUNCTION public.admin_remove_admin(uuid) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.admin_remove_admin(uuid) TO authenticated; GRANT EXECUTE ON FUNCTION public.admin_remove_admin(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.admin_role_allows(text,text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.admin_role_allows(text,text) TO anon; GRANT EXECUTE ON FUNCTION public.admin_role_allows(text,text) TO authenticated; GRANT EXECUTE ON FUNCTION public.admin_role_allows(text,text) TO service_role; GRANT EXECUTE ON FUNCTION public.admin_role_allows(text,text) TO PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid,text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid,text) TO authenticated; GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.check_coupon(text,numeric,text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.check_coupon(text,numeric,text) TO anon; GRANT EXECUTE ON FUNCTION public.check_coupon(text,numeric,text) TO authenticated; GRANT EXECUTE ON FUNCTION public.check_coupon(text,numeric,text) TO service_role; GRANT EXECUTE ON FUNCTION public.check_coupon(text,numeric,text) TO PUBLIC;
REVOKE ALL ON FUNCTION public.coupon_discount(text,numeric,numeric) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.coupon_discount(text,numeric,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.create_order(jsonb) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO anon; GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO authenticated; GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.delivery_fee_for(text,numeric) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.delivery_fee_for(text,numeric) TO anon; GRANT EXECUTE ON FUNCTION public.delivery_fee_for(text,numeric) TO authenticated; GRANT EXECUTE ON FUNCTION public.delivery_fee_for(text,numeric) TO service_role; GRANT EXECUTE ON FUNCTION public.delivery_fee_for(text,numeric) TO PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon; GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated; GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role; GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.is_admin() TO anon; GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated; GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role; GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC;
REVOKE ALL ON FUNCTION public.log_activity(text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.log_activity(text,text,text,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.log_admin_change() FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.log_admin_change() TO service_role;
REVOKE ALL ON FUNCTION public.phone_key(text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.phone_key(text) TO anon; GRANT EXECUTE ON FUNCTION public.phone_key(text) TO authenticated; GRANT EXECUTE ON FUNCTION public.phone_key(text) TO service_role; GRANT EXECUTE ON FUNCTION public.phone_key(text) TO PUBLIC;
REVOKE ALL ON FUNCTION public.product_stock_from_variants() FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.product_stock_from_variants() TO anon; GRANT EXECUTE ON FUNCTION public.product_stock_from_variants() TO authenticated; GRANT EXECUTE ON FUNCTION public.product_stock_from_variants() TO service_role; GRANT EXECUTE ON FUNCTION public.product_stock_from_variants() TO PUBLIC;
REVOKE ALL ON FUNCTION public.purge_old_records(integer) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.purge_old_records(integer) TO service_role;
REVOKE ALL ON FUNCTION public.record_stock_change() FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.record_stock_change() TO service_role;
REVOKE ALL ON FUNCTION public.remember_product_slug() FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.remember_product_slug() TO anon; GRANT EXECUTE ON FUNCTION public.remember_product_slug() TO authenticated; GRANT EXECUTE ON FUNCTION public.remember_product_slug() TO service_role; GRANT EXECUTE ON FUNCTION public.remember_product_slug() TO PUBLIC;
REVOKE ALL ON FUNCTION public.restock_on_cancel() FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.restock_on_cancel() TO service_role;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO anon; GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO authenticated; GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role; GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC;
REVOKE ALL ON FUNCTION public.schema_snapshot() FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.schema_snapshot() TO authenticated; GRANT EXECUTE ON FUNCTION public.schema_snapshot() TO service_role;
REVOKE ALL ON FUNCTION public.search_product_rows(text,integer) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.search_product_rows(text,integer) TO anon; GRANT EXECUTE ON FUNCTION public.search_product_rows(text,integer) TO authenticated; GRANT EXECUTE ON FUNCTION public.search_product_rows(text,integer) TO service_role; GRANT EXECUTE ON FUNCTION public.search_product_rows(text,integer) TO PUBLIC;
REVOKE ALL ON FUNCTION public.search_products(text,integer) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.search_products(text,integer) TO anon; GRANT EXECUTE ON FUNCTION public.search_products(text,integer) TO authenticated; GRANT EXECUTE ON FUNCTION public.search_products(text,integer) TO service_role; GRANT EXECUTE ON FUNCTION public.search_products(text,integer) TO PUBLIC;
REVOKE ALL ON FUNCTION public.submit_review(uuid,text,integer,text,text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.submit_review(uuid,text,integer,text,text) TO anon; GRANT EXECUTE ON FUNCTION public.submit_review(uuid,text,integer,text,text) TO authenticated; GRANT EXECUTE ON FUNCTION public.submit_review(uuid,text,integer,text,text) TO service_role; GRANT EXECUTE ON FUNCTION public.submit_review(uuid,text,integer,text,text) TO PUBLIC;
REVOKE ALL ON FUNCTION public.sync_product_stock_from_variants() FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.sync_product_stock_from_variants() TO anon; GRANT EXECUTE ON FUNCTION public.sync_product_stock_from_variants() TO authenticated; GRANT EXECUTE ON FUNCTION public.sync_product_stock_from_variants() TO service_role; GRANT EXECUTE ON FUNCTION public.sync_product_stock_from_variants() TO PUBLIC;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.track_order(text,text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.track_order(text,text) TO anon; GRANT EXECUTE ON FUNCTION public.track_order(text,text) TO authenticated; GRANT EXECUTE ON FUNCTION public.track_order(text,text) TO service_role;
REVOKE ALL ON FUNCTION public.track_visitor(text,text,text,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.track_visitor(text,text,text,text,text,text,text,text,text) TO anon; GRANT EXECUTE ON FUNCTION public.track_visitor(text,text,text,text,text,text,text,text,text) TO authenticated; GRANT EXECUTE ON FUNCTION public.track_visitor(text,text,text,text,text,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.variant_stock_total(uuid) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.variant_stock_total(uuid) TO authenticated; GRANT EXECUTE ON FUNCTION public.variant_stock_total(uuid) TO service_role;

-- 7. Row-level security and table permissions
ALTER TABLE public.admin_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_slug_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_activity FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.admin_activity TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.admin_activity TO authenticated;
REVOKE ALL ON TABLE public.admin_users FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.admin_users TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.admin_users TO authenticated;
REVOKE ALL ON TABLE public.banners FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.banners TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.banners TO authenticated;
REVOKE ALL ON TABLE public.categories FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.categories TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.categories TO authenticated;
REVOKE ALL ON TABLE public.coupons FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.coupons TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.coupons TO authenticated;
REVOKE ALL ON TABLE public.customer_profiles FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.customer_profiles TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.customer_profiles TO authenticated;
REVOKE ALL ON TABLE public.delivery_zones FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.delivery_zones TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.delivery_zones TO authenticated;
REVOKE ALL ON TABLE public.expenses FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.expenses TO authenticated;
REVOKE ALL ON TABLE public.order_items FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.order_items TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.order_items TO authenticated;
REVOKE ALL ON TABLE public.orders FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.orders TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.orders TO authenticated;
REVOKE ALL ON TABLE public.pages FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.pages TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.pages TO authenticated;
REVOKE ALL ON TABLE public.product_categories FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.product_categories TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.product_categories TO authenticated;
REVOKE ALL ON TABLE public.product_images FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.product_images TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.product_images TO authenticated;
REVOKE ALL ON TABLE public.product_slug_history FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.product_slug_history TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.product_slug_history TO authenticated;
REVOKE ALL ON TABLE public.product_variants FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.product_variants TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.product_variants TO authenticated;
REVOKE ALL ON TABLE public.products FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.products TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.products TO authenticated;
REVOKE ALL ON TABLE public.reviews FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.reviews TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.reviews TO authenticated;
REVOKE ALL ON TABLE public.seo_pages FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.seo_pages TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.seo_pages TO authenticated;
REVOKE ALL ON TABLE public.stock_movements FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stock_movements TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.stock_movements TO authenticated;
REVOKE ALL ON TABLE public.store_settings FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.store_settings TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.store_settings TO authenticated;
REVOKE ALL ON TABLE public.visitor_events FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.visitor_events TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.visitor_events TO authenticated;
REVOKE ALL ON TABLE public.visitor_sessions FROM anon, authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.visitor_sessions TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.visitor_sessions TO authenticated;

-- 8. Security rules
DO $p$ BEGIN CREATE POLICY "Admins can read the activity log" ON public.admin_activity AS PERMISSIVE FOR SELECT TO authenticated USING (public.admin_has('logs'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Content admins manage banners" ON public.banners AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('content'::text)) WITH CHECK (public.admin_has('content'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Public can view live banners" ON public.banners AS PERMISSIVE FOR SELECT TO anon, authenticated USING (((is_active AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at > now()))) OR public.admin_has('content'::text))); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can manage categories" ON public.categories AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('products'::text)) WITH CHECK (public.admin_has('products'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Public can view active categories" ON public.categories AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((is_active = true)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Marketing admins manage coupons" ON public.coupons AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('marketing'::text)) WITH CHECK (public.admin_has('marketing'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can view customer profiles" ON public.customer_profiles AS PERMISSIVE FOR SELECT TO authenticated USING (public.admin_has('customers'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Customers can insert their own profile" ON public.customer_profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Customers can update their own profile" ON public.customer_profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Customers can view their own profile" ON public.customer_profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = id)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Public can view delivery zones" ON public.delivery_zones AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Settings admins manage delivery zones" ON public.delivery_zones AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('settings'::text)) WITH CHECK (public.admin_has('settings'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can manage expenses" ON public.expenses AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('accounting'::text)) WITH CHECK (public.admin_has('accounting'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Accounting can view order items" ON public.order_items AS PERMISSIVE FOR SELECT TO authenticated USING (public.admin_has('accounting'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can manage order items" ON public.order_items AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('orders'::text)) WITH CHECK (public.admin_has('orders'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Customers can view their own order items" ON public.order_items AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND (o.customer_id IS NOT NULL) AND (o.customer_id = auth.uid()))))); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Accounting can view orders" ON public.orders AS PERMISSIVE FOR SELECT TO authenticated USING (public.admin_has('accounting'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can manage orders" ON public.orders AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('orders'::text)) WITH CHECK (public.admin_has('orders'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Customers can view their own orders" ON public.orders AS PERMISSIVE FOR SELECT TO authenticated USING (((customer_id IS NOT NULL) AND (customer_id = auth.uid()))); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Content admins manage pages" ON public.pages AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('content'::text)) WITH CHECK (public.admin_has('content'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Public can view published pages" ON public.pages AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((is_published OR public.admin_has('content'::text))); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can manage product categories" ON public.product_categories AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('products'::text)) WITH CHECK (public.admin_has('products'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Public can view product categories" ON public.product_categories AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can manage product images" ON public.product_images AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('products'::text)) WITH CHECK (public.admin_has('products'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Public can view product images" ON public.product_images AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
   FROM public.products
  WHERE ((products.id = product_images.product_id) AND (products.is_active = true))))); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Public can read old product addresses" ON public.product_slug_history AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can manage product variants" ON public.product_variants AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('products'::text)) WITH CHECK (public.admin_has('products'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Order staff can view product variants" ON public.product_variants AS PERMISSIVE FOR SELECT TO authenticated USING (public.admin_has('orders'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Public can view active product variants" ON public.product_variants AS PERMISSIVE FOR SELECT TO anon, authenticated USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM public.products
  WHERE ((products.id = product_variants.product_id) AND (products.is_active = true)))))); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can manage products" ON public.products AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('products'::text)) WITH CHECK (public.admin_has('products'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Order staff can view products" ON public.products AS PERMISSIVE FOR SELECT TO authenticated USING (public.admin_has('orders'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Public can view active products" ON public.products AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((is_active = true)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Public can view approved reviews" ON public.reviews AS PERMISSIVE FOR SELECT TO anon, authenticated USING (((status = 'approved'::text) OR public.admin_has('reviews'::text))); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Review admins manage reviews" ON public.reviews AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('reviews'::text)) WITH CHECK (public.admin_has('reviews'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can manage SEO pages" ON public.seo_pages AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('seo'::text)) WITH CHECK (public.admin_has('seo'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Public can view SEO pages" ON public.seo_pages AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can read stock history" ON public.stock_movements AS PERMISSIVE FOR SELECT TO authenticated USING ((public.admin_has('products'::text) OR public.admin_has('orders'::text))); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can manage store settings" ON public.store_settings AS PERMISSIVE FOR ALL TO authenticated USING ((public.admin_has('settings'::text) OR public.admin_has('content'::text) OR public.admin_has('seo'::text))) WITH CHECK ((public.admin_has('settings'::text) OR public.admin_has('content'::text) OR public.admin_has('seo'::text))); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Public can view store settings" ON public.store_settings AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can manage visitor events" ON public.visitor_events AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('analytics'::text)) WITH CHECK (public.admin_has('analytics'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can view visitor events" ON public.visitor_events AS PERMISSIVE FOR SELECT TO authenticated USING (public.admin_has('analytics'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can manage visitor sessions" ON public.visitor_sessions AS PERMISSIVE FOR ALL TO authenticated USING (public.admin_has('analytics'::text)) WITH CHECK (public.admin_has('analytics'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can view visitor sessions" ON public.visitor_sessions AS PERMISSIVE FOR SELECT TO authenticated USING (public.admin_has('analytics'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can delete product images" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'product-images'::text) AND public.is_admin())); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can update product images" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'product-images'::text) AND public.is_admin())) WITH CHECK (((bucket_id = 'product-images'::text) AND public.is_admin())); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Admins can upload product images" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'product-images'::text) AND public.is_admin())); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN CREATE POLICY "Public can view product images" ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((bucket_id = 'product-images'::text)); EXCEPTION WHEN duplicate_object THEN NULL; END $p$;

-- 9. Triggers
CREATE OR REPLACE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE OR REPLACE TRIGGER banners_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();
CREATE OR REPLACE TRIGGER banners_touch BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE OR REPLACE TRIGGER categories_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();
CREATE OR REPLACE TRIGGER coupons_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();
CREATE OR REPLACE TRIGGER coupons_touch BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE OR REPLACE TRIGGER delivery_zones_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.delivery_zones FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();
CREATE OR REPLACE TRIGGER delivery_zones_touch BEFORE UPDATE ON public.delivery_zones FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE OR REPLACE TRIGGER expenses_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();
CREATE OR REPLACE TRIGGER orders_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();
CREATE OR REPLACE TRIGGER orders_restock_on_cancel AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.restock_on_cancel();
CREATE OR REPLACE TRIGGER pages_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();
CREATE OR REPLACE TRIGGER pages_touch BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE OR REPLACE TRIGGER product_variants_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();
CREATE OR REPLACE TRIGGER variants_stock_history AFTER INSERT OR UPDATE OF stock_quantity ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.record_stock_change();
CREATE OR REPLACE TRIGGER variants_sync_product_stock AFTER INSERT OR DELETE OR UPDATE OF stock_quantity, is_active, product_id ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.sync_product_stock_from_variants();
CREATE OR REPLACE TRIGGER products_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();
CREATE OR REPLACE TRIGGER products_remember_slug AFTER UPDATE OF slug ON public.products FOR EACH ROW EXECUTE FUNCTION public.remember_product_slug();
CREATE OR REPLACE TRIGGER products_stock_from_variants BEFORE UPDATE OF stock_quantity ON public.products FOR EACH ROW EXECUTE FUNCTION public.product_stock_from_variants();
CREATE OR REPLACE TRIGGER products_stock_history AFTER INSERT OR UPDATE OF stock_quantity ON public.products FOR EACH ROW EXECUTE FUNCTION public.record_stock_change();
CREATE OR REPLACE TRIGGER reviews_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();
CREATE OR REPLACE TRIGGER reviews_touch BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE OR REPLACE TRIGGER seo_pages_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.seo_pages FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();
CREATE OR REPLACE TRIGGER store_settings_activity_log AFTER INSERT OR DELETE OR UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();

-- 9b. Event triggers
DO $e$ BEGIN CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') EXECUTE FUNCTION public.rls_auto_enable(); EXCEPTION WHEN duplicate_object OR insufficient_privilege THEN NULL; END $e$;

-- 10. Picture storage
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;

-- 11. Scheduled jobs
SELECT cron.schedule('purge-old-records', '15 3 * * *', 'SELECT public.purge_old_records(15)');

-- 12. Store settings row and API refresh
INSERT INTO public.store_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
NOTIFY pgrst, 'reload schema';
