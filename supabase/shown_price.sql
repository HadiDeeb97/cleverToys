-- ============================================================================
-- Sort the shop by the price customers see.
--
-- products.shown_price is the sale price when the toy has one, otherwise its price (what the
-- product cards show). The shop's "Price: low to high / high to low" sorts by it
-- (src/lib/shop.ts). A trigger keeps it right on every insert and update, so nothing else has to
-- set it; whatever value is sent for it is replaced.
--
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file and press Run.
-- ============================================================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shown_price numeric(10,2);

CREATE OR REPLACE FUNCTION public.products_set_shown_price()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.shown_price := coalesce(NEW.sale_price, NEW.price);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER products_shown_price BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_set_shown_price();

UPDATE public.products SET shown_price = coalesce(sale_price, price)
WHERE shown_price IS DISTINCT FROM coalesce(sale_price, price);

CREATE INDEX IF NOT EXISTS products_active_shown_price_idx ON public.products (shown_price, id) WHERE is_active;
