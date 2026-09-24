-- Clever Toys: let signed-in customers see their own orders on /account.
-- Run once in Supabase SQL Editor. Safe to re-run.

DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
CREATE POLICY "Customers can view their own orders" ON public.orders FOR SELECT TO authenticated USING (customer_id IS NOT NULL AND customer_id = auth.uid());
DROP POLICY IF EXISTS "Customers can view their own order items" ON public.order_items;
CREATE POLICY "Customers can view their own order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.customer_id IS NOT NULL AND o.customer_id = auth.uid()));
