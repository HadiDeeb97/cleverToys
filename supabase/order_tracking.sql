-- Clever Toys: let customers track an order with its order number and phone number (/track-order).
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Only returns an order when both values match, so visitors cannot browse other orders.

CREATE OR REPLACE FUNCTION public.track_order(p_order_number text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.orders%ROWTYPE;
  input_digits text;
  stored_digits text;
  compare_len integer;
BEGIN
  IF p_order_number IS NULL OR p_phone IS NULL OR length(p_order_number) > 40 OR length(p_phone) > 40 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO o FROM public.orders WHERE order_number = upper(trim(p_order_number)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Compare the last digits so "+961 71 123 456" and "71123456" both match.
  input_digits := regexp_replace(p_phone, '\D', '', 'g');
  stored_digits := regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g');
  compare_len := least(8, length(input_digits), length(stored_digits));
  IF compare_len < 6 OR right(input_digits, compare_len) <> right(stored_digits, compare_len) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'created_at', o.created_at,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'items', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('name', i.product_name, 'variant', i.variant_name, 'quantity', i.quantity, 'total', i.total_price) ORDER BY i.product_name), '[]'::jsonb)
      FROM public.order_items i
      WHERE i.order_id = o.id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.track_order(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_order(text, text) TO anon, authenticated;
