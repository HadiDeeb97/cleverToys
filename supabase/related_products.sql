-- ============================================================================
-- "You may also like" on product pages: hand-picked toys first, then the best automatic matches.
--
--  - product_relations: toys chosen in Admin → Products → (a product) → Related toys, in order.
--  - related_products(product, limit): the toys to show, best first. Hand-picked ones (visible in the
--    store) always come first. The rest are in-stock toys scored against the product:
--      bought together in the same orders (not cancelled) ... 6 per order, up to 5 orders
--      each shared category, by how specific it is ........ up to 6 (a category holding most toys,
--        like "Girls Toys", counts almost nothing; a small one like "Building & Construction" a lot)
--      age ranges overlap ................................... +3 (ranges that do not overlap: −3)
--      similar names (typos and plurals included) ........... up to 5
--      each shared word of 4+ letters in the names .......... 1.5
--      similar price (the cheaper is at least half the other) up to 2
--    Ties: featured toys first, then the newest, so a toy with no matches still gets suggestions.
--    Used by src/pages/product/[slug].astro (which falls back to same-category toys before this runs).
--
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file and press Run.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_relations (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  related_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, related_id),
  CONSTRAINT product_relations_not_itself CHECK (product_id <> related_id)
);
CREATE INDEX IF NOT EXISTS product_relations_related_id_idx ON public.product_relations (related_id);
ALTER TABLE public.product_relations ENABLE ROW LEVEL SECURITY;
DO $p$ BEGIN
  CREATE POLICY "Public can view related toys" ON public.product_relations FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN
  CREATE POLICY "Admins manage related toys" ON public.product_relations FOR ALL TO authenticated USING (public.admin_has('products')) WITH CHECK (public.admin_has('products'));
EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
GRANT SELECT ON public.product_relations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_relations TO authenticated;

CREATE OR REPLACE FUNCTION public.related_products(p_product_id uuid, p_limit integer DEFAULT 8)
RETURNS TABLE(id uuid, score real, picked boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER   -- reads order items (to find toys bought together); returns only ids of visible toys
SET search_path = public, extensions, pg_temp
AS $$
  WITH me AS (
    SELECT p.id, lower(p.name) AS name, p.age_min, p.age_max, coalesce(p.sale_price, p.price) AS price,
      array(SELECT DISTINCT c FROM unnest(array_append(array(SELECT pc.category_id FROM public.product_categories pc WHERE pc.product_id = p.id), p.category_id)) AS c WHERE c IS NOT NULL) AS cats,
      array(SELECT DISTINCT w FROM regexp_split_to_table(lower(unaccent(p.name)), '[^[:alnum:]]+') AS w WHERE length(w) >= 4) AS words
    FROM public.products p
    WHERE p.id = p_product_id
  ),
  cand AS (
    SELECT p.id, lower(p.name) AS name, p.age_min, p.age_max, p.is_featured, p.created_at, coalesce(p.sale_price, p.price) AS price,
      (p.stock_quantity > 0 OR EXISTS (SELECT 1 FROM public.product_variants v WHERE v.product_id = p.id AND v.is_active AND v.stock_quantity > 0)) AS in_stock,
      array(SELECT DISTINCT c FROM unnest(array_append(array(SELECT pc.category_id FROM public.product_categories pc WHERE pc.product_id = p.id), p.category_id)) AS c WHERE c IS NOT NULL) AS cats,
      array(SELECT DISTINCT w FROM regexp_split_to_table(lower(unaccent(p.name)), '[^[:alnum:]]+') AS w WHERE length(w) >= 4) AS words
    FROM public.products p
    WHERE p.is_active AND p.id <> p_product_id
  ),
  -- How specific each category is: 6 × the share of visible toys NOT in it.
  catw AS (
    SELECT pc.category_id AS id, 6 * (1 - count(DISTINCT pc.product_id)::real / greatest((SELECT count(*) FROM public.products WHERE is_active), 1)) AS weight
    FROM public.product_categories pc JOIN public.products p ON p.id = pc.product_id AND p.is_active
    GROUP BY pc.category_id
  ),
  picks AS (
    SELECT r.related_id, r.sort_order FROM public.product_relations r WHERE r.product_id = p_product_id
  ),
  together AS (
    SELECT b.product_id, count(DISTINCT b.order_id) AS orders
    FROM public.order_items a
    JOIN public.orders o ON o.id = a.order_id AND o.status <> 'cancelled'
    JOIN public.order_items b ON b.order_id = a.order_id AND b.product_id <> a.product_id
    WHERE a.product_id = p_product_id
    GROUP BY b.product_id
  ),
  scored AS (
    SELECT c.id, c.is_featured, c.created_at, c.in_stock, pk.related_id IS NOT NULL AS picked, pk.sort_order,
      ( least(coalesce(t.orders, 0), 5) * 6
      + (SELECT coalesce(sum(coalesce(w.weight, 4)), 0) FROM unnest(c.cats) AS x(id) LEFT JOIN catw w ON w.id = x.id WHERE x.id = ANY(me.cats))
      + CASE
          WHEN (c.age_min IS NULL AND c.age_max IS NULL) OR (me.age_min IS NULL AND me.age_max IS NULL) THEN 0
          WHEN coalesce(c.age_min, 0) <= coalesce(me.age_max, 99) AND coalesce(me.age_min, 0) <= coalesce(c.age_max, 99) THEN 3
          ELSE -3
        END
      + similarity(c.name, me.name) * 5
      + cardinality(array(SELECT unnest(c.words) INTERSECT SELECT unnest(me.words))) * 1.5
      + CASE
          WHEN me.price > 0 AND c.price > 0 AND least(c.price, me.price) / greatest(c.price, me.price) >= 0.5
          THEN least(c.price, me.price) / greatest(c.price, me.price) * 2
          ELSE 0
        END
      )::real AS score
    FROM cand c
    CROSS JOIN me
    LEFT JOIN together t ON t.product_id = c.id
    LEFT JOIN picks pk ON pk.related_id = c.id
  )
  SELECT s.id, (CASE WHEN s.picked THEN 1000 - coalesce(s.sort_order, 0) ELSE s.score END)::real, s.picked
  FROM scored s
  WHERE s.picked OR s.in_stock
  ORDER BY s.picked DESC, s.sort_order NULLS LAST, s.score DESC, s.is_featured DESC, s.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 8), 1), 24);
$$;
REVOKE ALL ON FUNCTION public.related_products(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.related_products(uuid, integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
