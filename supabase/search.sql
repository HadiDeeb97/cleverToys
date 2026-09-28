-- ============================================================================
-- Smart product search (the store's search boxes, instant suggestions and the shop page).
--
-- search_products('dinosor cars') returns active toys ranked by how well they match:
--   * every word must match, in any order, anywhere in the toy: name, brand, code (SKU),
--     short and full description, its categories and its options (sizes, colours…)
--   * small typos still match ("dinosor" → dinosaur, "trian" → train)
--   * plurals match the singular ("cars" → car, "puzzles" → puzzle)
--   * accents are ignored
--   * matches in the name rank first, then the rest; an exact or starting-with name ranks highest
--
-- Runs with the visitor's own rights (row-level security still applies: only visible toys).
-- The website falls back to a simpler search when this file has not been run yet.
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file and press Run.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA extensions;
-- (Supabase already allows this; kept so the file also works on a fresh database.)
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_products(q text, max_results integer DEFAULT 300)
RETURNS TABLE (id uuid, score real)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
-- (Just-in-time compilation adds about a second to this short query; off keeps it instant.)
SET jit = off
AS $search$
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
          -- plural → singular: cars → car, puzzles → puzzle, boxes → box
          OR (length(w) > 3 AND w LIKE '%s' AND d.doc LIKE '%' || left(w, length(w) - 1) || '%')
          OR (length(w) > 4 AND w LIKE '%es' AND d.doc LIKE '%' || left(w, length(w) - 2) || '%')
          -- small typos in words of 4+ letters: 1 letter off, or 2 for longer words
          -- ("trian" → train, "dinosor" → dinosaur)
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
$search$;

GRANT EXECUTE ON FUNCTION public.search_products(text, integer) TO anon, authenticated;

-- The same ranking, returning the toys themselves (best first), so the instant suggestions under the
-- search boxes need a single request: /api/search selects just the columns it shows.
CREATE OR REPLACE FUNCTION public.search_product_rows(q text, max_results integer DEFAULT 6)
RETURNS SETOF public.products
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
-- (Just-in-time compilation adds about a second to this short query; off keeps it instant.)
SET jit = off
AS $rows$
  SELECT p.*
  FROM public.search_products(q, max_results) AS s
  JOIN public.products AS p ON p.id = s.id
  ORDER BY s.score DESC;
$rows$;

GRANT EXECUTE ON FUNCTION public.search_product_rows(text, integer) TO anon, authenticated;
