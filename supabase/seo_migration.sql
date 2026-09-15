-- Clever Toys per-page SEO settings
-- Run once in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.seo_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_key text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  cover_image_url text,
  keywords text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_pages_path_key_idx ON public.seo_pages(path_key);
ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view SEO pages" ON public.seo_pages;
CREATE POLICY "Public can view SEO pages"
  ON public.seo_pages FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage SEO pages" ON public.seo_pages;
CREATE POLICY "Admins can manage SEO pages"
  ON public.seo_pages FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.seo_pages (path_key,title,description,cover_image_url,keywords) VALUES
('/', 'Clever Toys Lebanon | Educational & Fun Toys for Kids', 'Shop fun, educational and exciting toys in Lebanon. Discover quality toys for babies, kids and growing learners at Clever Toys.', NULL, 'toys Lebanon, kids toys Lebanon, educational toys, baby toys, children toys, toy store Lebanon'),
('/products', 'Shop Toys in Lebanon | Clever Toys', 'Shop toys for children of all ages at Clever Toys Lebanon. Find fun, educational and exciting toys with local delivery.', NULL, 'shop toys Lebanon, buy toys Lebanon, toy store Beirut, children toys Lebanon'),
('/categories', 'Toy Categories | Clever Toys Lebanon', 'Browse Clever Toys by category and discover the right toys for babies, kids and growing learners.', NULL, 'toy categories Lebanon, kids toys categories, educational toys Lebanon'),
('/about', 'About Clever Toys | Toy Store in Lebanon', 'Learn more about Clever Toys, a Lebanon-based toy store focused on fun, educational and family-friendly toys.', NULL, 'Clever Toys Lebanon, toy store Lebanon, about Clever Toys'),
('/contact', 'Contact Clever Toys Lebanon', 'Contact Clever Toys for product questions, orders and support. We are here to help families across Lebanon.', NULL, 'contact Clever Toys, toy store Lebanon contact, toys Lebanon WhatsApp'),
('/cart', 'Shopping Cart | Clever Toys Lebanon', 'Review your selected toys before checkout at Clever Toys Lebanon.', NULL, 'Clever Toys cart, toys shopping cart Lebanon'),
('/checkout', 'Checkout | Clever Toys Lebanon', 'Complete your Clever Toys order with simple checkout and local delivery in Lebanon.', NULL, 'Clever Toys checkout, order toys Lebanon, cash on delivery Lebanon'),
('/order-success', 'Order Confirmed | Clever Toys Lebanon', 'Your Clever Toys order has been received successfully.', NULL, 'Clever Toys order confirmation'),
('/privacy', 'Privacy Policy | Clever Toys Lebanon', 'Read the Clever Toys privacy policy and learn how customer information is handled.', NULL, 'Clever Toys privacy policy, Lebanon privacy'),
('/login', 'Sign In | Clever Toys', 'Sign in to your Clever Toys account.', NULL, 'Clever Toys login'),
('/account', 'My Account | Clever Toys', 'Manage your Clever Toys customer account and orders.', NULL, 'Clever Toys account'),
('/forgot-password', 'Reset Password | Clever Toys', 'Reset your Clever Toys account password.', NULL, 'Clever Toys password reset'),
('/404', 'Page Not Found | Clever Toys', 'The page you requested could not be found on Clever Toys.', NULL, 'Clever Toys 404'),
('/product/*', 'Shop Toys in Lebanon | Clever Toys', 'Discover fun and educational toys at Clever Toys Lebanon. Explore product details, prices and local delivery.', NULL, 'toys Lebanon, kids toys, educational toys, children toys, buy toys Lebanon'),
('/category/*', 'Toy Category | Clever Toys Lebanon', 'Explore this Clever Toys category and find fun, educational and exciting toys for children.', NULL, 'toy category Lebanon, kids toys Lebanon, educational toys')
ON CONFLICT (path_key) DO NOTHING;
