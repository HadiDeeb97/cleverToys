-- ============================================================================
-- Deleting orders: only the Owner and Manager roles (Admin → Orders → open an order → Delete order).
--
--  - admin_can_delete_orders(): true for owners and managers.
--  - A restrictive rule on orders and order items: whatever else a role may do with orders
--    (Orders staff can view and update them), deleting needs Owner or Manager.
--  - admin_delete_order(order): deletes the order and its items in one step. Items of an order that
--    had not left the store yet (pending, confirmed, processing) go back into stock, recorded in the
--    stock history as "order_deleted"; shipped, delivered and cancelled orders change no stock
--    (cancelling already put it back). A discount code used by the order gets that use back.
--
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file and press Run.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_can_delete_orders()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role IN ('owner', 'manager'));
$$;
REVOKE ALL ON FUNCTION public.admin_can_delete_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_can_delete_orders() TO authenticated;

DO $p$ BEGIN
  CREATE POLICY "Only owners and managers delete orders" ON public.orders AS RESTRICTIVE FOR DELETE TO authenticated USING (public.admin_can_delete_orders());
EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN
  CREATE POLICY "Only owners and managers delete order items" ON public.order_items AS RESTRICTIVE FOR DELETE TO authenticated USING (public.admin_can_delete_orders());
EXCEPTION WHEN duplicate_object THEN NULL; END $p$;

CREATE OR REPLACE FUNCTION public.admin_delete_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.orders%ROWTYPE;
  item record;
  restocked integer := 0;
BEGIN
  IF NOT public.admin_can_delete_orders() THEN RAISE EXCEPTION 'Only the owner or a manager can delete orders.'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This order no longer exists.'; END IF;

  IF o.status IN ('pending', 'confirmed', 'processing') THEN
    PERFORM set_config('clevertoys.stock_reason', 'order_deleted', true);
    FOR item IN SELECT product_id, variant_id, quantity FROM public.order_items WHERE order_id = o.id LOOP
      IF item.variant_id IS NOT NULL THEN
        UPDATE public.product_variants SET stock_quantity = stock_quantity + item.quantity, updated_at = now() WHERE id = item.variant_id;
      ELSE
        UPDATE public.products SET stock_quantity = stock_quantity + item.quantity, updated_at = now() WHERE id = item.product_id;
      END IF;
      restocked := restocked + item.quantity;
    END LOOP;
    PERFORM set_config('clevertoys.stock_reason', '', true);
  END IF;

  IF o.coupon_code IS NOT NULL THEN
    UPDATE public.coupons SET used_count = greatest(0, used_count - 1) WHERE code = o.coupon_code;
  END IF;

  DELETE FROM public.orders WHERE id = o.id;   -- its items go with it
  RETURN jsonb_build_object('order_number', o.order_number, 'restocked', restocked);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_order(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
