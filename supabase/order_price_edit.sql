-- ============================================================================
-- Edit the selling prices and the discount of an order (Admin → Orders → open an order → Edit prices).
--
-- admin_set_order_prices(order, {item id: new price, …}, discount) changes each item's price, its
-- line total, the order's discount, subtotal and total in one step. The delivery fee stays as it was.
-- Leave the discount out (NULL) to keep the current one. The discount is never more than the
-- subtotal, so the total is never below the delivery fee.
-- Only admins with access to orders can use it; the change appears in the Activity log.
--
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file and press Run.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_order_prices(p_order_id uuid, p_prices jsonb, p_discount numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.orders%ROWTYPE;
  entry record;
  new_price numeric(10,2);
  new_subtotal numeric(10,2);
  new_discount numeric(10,2);
BEGIN
  IF NOT public.admin_has('orders') THEN RAISE EXCEPTION 'You do not have access to orders.'; END IF;
  IF jsonb_typeof(coalesce(p_prices, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'No prices to save.'; END IF;
  IF p_discount IS NOT NULL AND (p_discount < 0 OR p_discount > 1000000) THEN RAISE EXCEPTION 'Enter a valid discount.'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This order no longer exists.'; END IF;

  FOR entry IN SELECT key, value FROM jsonb_each_text(coalesce(p_prices, '{}'::jsonb)) LOOP
    BEGIN
      new_price := round(entry.value::numeric, 2);
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'Enter a valid price.'; END;
    IF new_price IS NULL OR new_price < 0 OR new_price > 1000000 THEN RAISE EXCEPTION 'Enter a valid price.'; END IF;
    UPDATE public.order_items
       SET unit_price = new_price, total_price = new_price * quantity
     WHERE id = entry.key::uuid AND order_id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'One of the items is no longer in this order.'; END IF;
  END LOOP;

  SELECT coalesce(sum(total_price), 0) INTO new_subtotal FROM public.order_items WHERE order_id = p_order_id;
  new_discount := least(round(coalesce(p_discount, o.discount, 0), 2), new_subtotal);
  UPDATE public.orders
     SET subtotal = new_subtotal,
         discount = new_discount,
         total = greatest(0, new_subtotal - new_discount) + coalesce(delivery_fee, 0),
         updated_at = now()
   WHERE id = p_order_id
  RETURNING * INTO o;

  RETURN jsonb_build_object('subtotal', o.subtotal, 'discount', o.discount, 'delivery_fee', o.delivery_fee, 'total', o.total);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_order_prices(uuid, jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_order_prices(uuid, jsonb, numeric) TO authenticated;
