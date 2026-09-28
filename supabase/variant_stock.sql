-- ============================================================================
-- Toys with options (sizes, colours…): the toy's stock is always the total of its visible options.
--
--   * Changing an option's stock, adding, removing, hiding or showing an option updates the toy's stock.
--   * Orders, cancellations and admin edits of options all go through the options, so the total
--     is always right; the toy's own stock can't be set by hand while it has visible options.
--   * Toys without options keep their own stock as before.
--   * Stock history lists the option changes only (the toy total is not recorded twice).
--
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file and press Run.
-- ============================================================================

-- Total stock of a toy's visible options, or NULL when it has none.
CREATE OR REPLACE FUNCTION public.variant_stock_total(p_product_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN count(*) > 0 THEN coalesce(sum(greatest(stock_quantity, 0)), 0)::integer END
  FROM public.product_variants
  WHERE product_id = p_product_id AND is_active;
$$;
REVOKE EXECUTE ON FUNCTION public.variant_stock_total(uuid) FROM PUBLIC, anon;

-- A toy with visible options: its stock is their total, whatever else tries to set it.
CREATE OR REPLACE FUNCTION public.product_stock_from_variants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE total integer := public.variant_stock_total(NEW.id);
BEGIN
  IF total IS NOT NULL THEN NEW.stock_quantity := total; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS products_stock_from_variants ON public.products;
CREATE TRIGGER products_stock_from_variants BEFORE UPDATE OF stock_quantity ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.product_stock_from_variants();

-- An option changed: recount its toy (and the toy it came from, if it was moved).
CREATE OR REPLACE FUNCTION public.sync_product_stock_from_variants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
$$;
DROP TRIGGER IF EXISTS variants_sync_product_stock ON public.product_variants;
CREATE TRIGGER variants_sync_product_stock AFTER INSERT OR DELETE OR UPDATE OF stock_quantity, is_active, product_id
  ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.sync_product_stock_from_variants();

-- Stock history: same as before, but a toy total recounted from its options is not recorded
-- (the option change itself already is).
CREATE OR REPLACE FUNCTION public.record_stock_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
$$;

-- Bring every existing toy with options in line now (not recorded in stock history).
SELECT set_config('clevertoys.stock_sync', '1', false);
UPDATE public.products p SET stock_quantity = public.variant_stock_total(p.id)
WHERE public.variant_stock_total(p.id) IS NOT NULL AND p.stock_quantity IS DISTINCT FROM public.variant_stock_total(p.id);
SELECT set_config('clevertoys.stock_sync', '', false);
