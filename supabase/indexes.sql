-- ============================================================================
-- Speed: indexes on the links between tables (orders ↔ items, products ↔ images,
-- options and categories, stock history ↔ orders). Recommended by Supabase's
-- performance advisor. Safe to run more than once; missing tables are skipped.
-- ============================================================================
DO $idx$
DECLARE
  item text[];
BEGIN
  FOREACH item SLICE 1 IN ARRAY ARRAY[
    ['order_items', 'order_id'], ['order_items', 'product_id'], ['order_items', 'variant_id'],
    ['orders', 'customer_id'], ['product_images', 'product_id'], ['product_variants', 'product_id'],
    ['products', 'category_id'], ['stock_movements', 'order_id'], ['stock_movements', 'variant_id']
  ] LOOP
    IF to_regclass('public.' || item[1]) IS NOT NULL AND EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = item[1] AND column_name = item[2]
    ) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)', item[1] || '_' || item[2] || '_idx', item[1], item[2]);
    END IF;
  END LOOP;
END $idx$;
