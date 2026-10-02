-- ============================================================================
-- Category clean-up (October 2026)
--
--   * New: Dolls & Dollhouses, Building & Construction
--   * Renamed (web addresses unchanged): Outdoor Toys → Sports & Active Play,
--     Baby Toys → Baby & Toddler, Vehicles & Cars → Cars & Remote Control
--   * Remote Control merged into Cars & Remote Control (old links redirect there,
--     see src/pages/category/[slug].astro)
--   * Each product gets 1–2 main categories and keeps its Girls Toys / Boys Toys tags
--   * Menu order, and Google titles without the doubled "Toys Toys"
--
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file and press Run.
-- ============================================================================
BEGIN;

-- 1. New categories and renames
INSERT INTO public.categories (name, slug, description, is_active, sort_order)
VALUES ('Dolls & Dollhouses', 'dolls-dollhouses', 'Dolls, dollhouses and villas with furniture and accessories.', true, 1),
       ('Building & Construction', 'building-construction', 'Building blocks, construction sets and tool kits for little builders.', true, 3)
ON CONFLICT (slug) DO NOTHING;
UPDATE public.categories SET name = 'Sports & Active Play', description = 'Basketball sets, boxing games and toys that get kids moving.' WHERE slug = 'outdoor-toys';
UPDATE public.categories SET name = 'Baby & Toddler', description = 'Safe, fun toys and play spaces for babies and toddlers.' WHERE slug = 'baby-toys';
UPDATE public.categories SET name = 'Cars & Remote Control', description = 'Toy cars, remote control cars and other vehicles.' WHERE slug = 'vehicles-cars';
UPDATE public.categories SET description = 'Learning toys that build skills through play.' WHERE slug = 'educational-toys';

-- 2. Each product's main categories (by product name). Girls/Boys tags are kept.
CREATE TEMP TABLE cat_plan (name text, slug text, ord int) ON COMMIT DROP;
INSERT INTO cat_plan VALUES
  ('Baby Park', 'baby-toys', 1),
  ('Basket Ball Set', 'outdoor-toys', 1),
  ('Basket Ball Slam Dunk', 'outdoor-toys', 1),
  ('Creative Beading', 'arts-crafts', 1),
  ('Creative Mosaic', 'arts-crafts', 1), ('Creative Mosaic', 'educational-toys', 2),
  ('Darkshot Gun', 'games-puzzles', 1),
  ('Diy Beads Makeup Box', 'arts-crafts', 1),
  ('Double Sided Drawing Board', 'arts-crafts', 1), ('Double Sided Drawing Board', 'educational-toys', 2),
  ('Electronic Keyboard Piano', 'educational-toys', 1),
  ('Fantasy Villa', 'dolls-dollhouses', 1),
  ('Giant Tub Of Craft', 'arts-crafts', 1),
  ('Lol Warm House', 'dolls-dollhouses', 1),
  ('Magic Food Diy', 'girls-toys', 1),
  ('Master Of Architechture Blocks Toy', 'building-construction', 1), ('Master Of Architechture Blocks Toy', 'educational-toys', 2),
  ('Model Car', 'vehicles-cars', 1),
  ('Rhythm Boxing Bluetooth', 'outdoor-toys', 1),
  ('Simulation Toolbox', 'building-construction', 1),
  ('Spraying Kitchen', 'girls-toys', 1),
  ('Sudoko', 'games-puzzles', 1), ('Sudoko', 'educational-toys', 2),
  ('Villa', 'dolls-dollhouses', 1);

CREATE TEMP TABLE cat_target ON COMMIT DROP AS
  SELECT DISTINCT p.id AS product_id, c.id AS category_id
  FROM public.products p JOIN cat_plan pl ON pl.name = p.name JOIN public.categories c ON c.slug = pl.slug
  UNION
  SELECT pc.product_id, pc.category_id
  FROM public.product_categories pc JOIN public.categories c ON c.id = pc.category_id
  WHERE c.slug IN ('girls-toys', 'boys-toys')
    AND pc.product_id IN (SELECT p.id FROM public.products p JOIN cat_plan pl ON pl.name = p.name);

DELETE FROM public.product_categories WHERE product_id IN (SELECT product_id FROM cat_target);
INSERT INTO public.product_categories (product_id, category_id)
  SELECT product_id, category_id FROM cat_target ON CONFLICT DO NOTHING;
UPDATE public.products p SET category_id = c.id
  FROM cat_plan pl JOIN public.categories c ON c.slug = pl.slug
  WHERE pl.name = p.name AND pl.ord = 1 AND p.category_id IS DISTINCT FROM c.id;

-- 3. Remote Control merged into Cars & Remote Control
UPDATE public.products SET category_id = (SELECT id FROM public.categories WHERE slug = 'vehicles-cars')
  WHERE category_id = (SELECT id FROM public.categories WHERE slug = 'remote-control');
INSERT INTO public.product_categories (product_id, category_id)
  SELECT pc.product_id, (SELECT id FROM public.categories WHERE slug = 'vehicles-cars')
  FROM public.product_categories pc WHERE pc.category_id = (SELECT id FROM public.categories WHERE slug = 'remote-control')
  ON CONFLICT DO NOTHING;
DELETE FROM public.product_categories WHERE category_id = (SELECT id FROM public.categories WHERE slug = 'remote-control');
DELETE FROM public.categories WHERE slug = 'remote-control';

-- 4. Menu order
UPDATE public.categories c SET sort_order = o.n FROM (VALUES
  ('dolls-dollhouses', 1), ('arts-crafts', 2), ('building-construction', 3), ('educational-toys', 4), ('games-puzzles', 5),
  ('outdoor-toys', 6), ('vehicles-cars', 7), ('baby-toys', 8), ('girls-toys', 9), ('boys-toys', 10)) AS o(slug, n)
WHERE c.slug = o.slug;

-- 5. Google texts
UPDATE public.categories SET
  seo_title = name || ' | Clever Toys Lebanon',
  seo_description = left('Shop ' || name || ' at Clever Toys Lebanon. ' || coalesce(description, '') || ' Delivery across Lebanon, cash on delivery.', 160),
  updated_at = now();

COMMIT;

-- Result: each category with its number of products.
SELECT c.sort_order, c.name, count(pc.product_id) AS products
FROM public.categories c LEFT JOIN public.product_categories pc ON pc.category_id = c.id
GROUP BY c.id ORDER BY c.sort_order;
