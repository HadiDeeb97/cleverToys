-- ============================================================================
-- Editing orders and adding orders made outside the website (Admin → Orders).
--
--  - orders.source: where the order came from: website (checkout), whatsapp, instagram, facebook,
--    phone, in_store or other.
--  - admin_update_order(order, items, discount, delivery fee): saves an edited order in one step:
--    items removed, added, quantities and prices changed, the discount and the delivery fee. Stock
--    follows the change (an item removed goes back into stock, an item added is taken from it), except
--    for cancelled orders, whose stock was already put back.
--  - admin_create_order(details): adds an order from WhatsApp, Instagram, a phone call, the shop…
--    Its items are taken from stock like a website order. Empty prices use the toy's current price; an
--    empty delivery fee uses the delivery fees from Admin → Discounts & delivery.
--  Only admins with access to orders can use them; changes appear in the Activity log and the stock
--  history ("order_edit" for edits, "order" for added orders).
--
-- Safe to run more than once. In the Supabase SQL Editor, paste the WHOLE file and press Run.
-- ============================================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'website';
DO $c$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_source_check CHECK (source IN ('website', 'whatsapp', 'instagram', 'facebook', 'phone', 'in_store', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $c$;

-- Changes one toy's (or option's) stock by p_change; taking more than is in stock stops with a message.
-- Only used by the two functions below.
CREATE OR REPLACE FUNCTION public.admin_order_stock_change(p_product uuid, p_variant uuid, p_change integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE label text;
BEGIN
  IF coalesce(p_change, 0) = 0 THEN RETURN; END IF;
  IF p_variant IS NOT NULL THEN
    UPDATE public.product_variants SET stock_quantity = stock_quantity + p_change, updated_at = now()
     WHERE id = p_variant AND stock_quantity + p_change >= 0;
    IF NOT FOUND THEN
      SELECT p.name || ' · ' || v.name || ' (' || v.stock_quantity || ' in stock)' INTO label FROM public.product_variants v JOIN public.products p ON p.id = v.product_id WHERE v.id = p_variant;
      RAISE EXCEPTION 'Not enough stock for %.', coalesce(label, 'an item');
    END IF;
  ELSE
    UPDATE public.products SET stock_quantity = stock_quantity + p_change, updated_at = now()
     WHERE id = p_product AND stock_quantity + p_change >= 0;
    IF NOT FOUND THEN
      SELECT name || ' (' || stock_quantity || ' in stock)' INTO label FROM public.products WHERE id = p_product;
      RAISE EXCEPTION 'Not enough stock for %.', coalesce(label, 'an item');
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_order_stock_change(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;

-- One order item checked and completed from the toy: names, SKU and (when empty) the current price.
CREATE OR REPLACE FUNCTION public.admin_order_item(p_item jsonb)
RETURNS TABLE(product_id uuid, variant_id uuid, product_name text, variant_name text, sku text, quantity integer, unit_price numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p public.products%ROWTYPE;
  v public.product_variants%ROWTYPE;
  pid uuid; vid uuid; qty integer; price numeric;
BEGIN
  BEGIN
    pid := (p_item->>'product_id')::uuid;
    vid := nullif(p_item->>'variant_id', '')::uuid;
    qty := (p_item->>'quantity')::integer;
    price := nullif(p_item->>'unit_price', '')::numeric;
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'One of the items is not valid.'; END;
  SELECT * INTO p FROM public.products WHERE id = pid;
  IF NOT FOUND THEN RAISE EXCEPTION 'One of the toys no longer exists.'; END IF;
  IF qty IS NULL OR qty < 1 OR qty > 1000 THEN RAISE EXCEPTION 'Enter a quantity from 1 to 1000 for %.', p.name; END IF;
  IF price IS NOT NULL AND (price < 0 OR price > 1000000) THEN RAISE EXCEPTION 'Enter a valid price for %.', p.name; END IF;
  IF vid IS NOT NULL THEN
    SELECT * INTO v FROM public.product_variants WHERE id = vid AND product_variants.product_id = pid;
    IF NOT FOUND THEN RAISE EXCEPTION 'The chosen option of % no longer exists.', p.name; END IF;
  -- An item already in the order without an option stays valid if the toy got options later.
  ELSIF coalesce(p_item->>'_kept', '') <> 'true' AND EXISTS (SELECT 1 FROM public.product_variants x WHERE x.product_id = pid AND x.is_active) THEN
    RAISE EXCEPTION 'Choose an option for %.', p.name;
  END IF;
  product_id := pid;
  variant_id := vid;
  product_name := p.name;
  variant_name := CASE WHEN vid IS NOT NULL THEN v.name END;
  sku := CASE WHEN vid IS NOT NULL THEN coalesce(v.sku, p.sku) ELSE p.sku END;
  quantity := qty;
  unit_price := round(coalesce(price, CASE WHEN vid IS NOT NULL THEN coalesce(v.sale_price, v.price, p.sale_price, p.price) ELSE coalesce(p.sale_price, p.price) END, 0), 2);
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_order_item(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_order(p_order_id uuid, p_items jsonb, p_discount numeric DEFAULT NULL, p_delivery_fee numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.orders%ROWTYPE;
  e jsonb;
  it record;
  k record;
  keep uuid[] := '{}';
  items jsonb := '[]';
  item_id uuid;
  new_subtotal numeric(10,2);
  new_discount numeric(10,2);
  new_delivery numeric(10,2);
  none constant uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF NOT public.admin_has('orders') THEN RAISE EXCEPTION 'You do not have access to orders.'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'An order needs at least one item. To remove the whole order, delete it instead.';
  END IF;
  IF jsonb_array_length(p_items) > 100 THEN RAISE EXCEPTION 'An order can have up to 100 items.'; END IF;
  IF p_discount IS NOT NULL AND (p_discount < 0 OR p_discount > 1000000) THEN RAISE EXCEPTION 'Enter a valid discount.'; END IF;
  IF p_delivery_fee IS NOT NULL AND (p_delivery_fee < 0 OR p_delivery_fee > 100000) THEN RAISE EXCEPTION 'Enter a valid delivery fee.'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This order no longer exists.'; END IF;

  -- Check every item first (names, options, quantities, prices). Items already in the order keep
  -- their toy and option as they are.
  FOR e IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(e) <> 'object' THEN RAISE EXCEPTION 'One of the items is not valid.'; END IF;
    e := e - '_kept';
    item_id := NULL;
    BEGIN item_id := nullif(e->>'id', '')::uuid; EXCEPTION WHEN others THEN item_id := NULL; END;
    IF item_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.id = item_id AND oi.order_id = o.id
                                         AND oi.product_id::text = e->>'product_id' AND oi.variant_id IS NULL AND nullif(e->>'variant_id', '') IS NULL) THEN
      e := e || '{"_kept": true}';
    END IF;
    PERFORM public.admin_order_item(e);
    items := items || jsonb_build_array(e);
  END LOOP;
  p_items := items;

  -- Stock follows the difference between the old and the new items (not for cancelled orders).
  IF o.status <> 'cancelled' THEN
    PERFORM set_config('clevertoys.stock_reason', 'order_edit', true);
    PERFORM set_config('clevertoys.stock_order', o.id::text, true);
    FOR k IN
      WITH n AS (
        SELECT (x->>'product_id')::uuid AS pid, coalesce(nullif(x->>'variant_id', '')::uuid, none) AS vid, sum((x->>'quantity')::integer) AS qty
        FROM jsonb_array_elements(p_items) AS x GROUP BY 1, 2
      ), c AS (
        SELECT oi.product_id AS pid, coalesce(oi.variant_id, none) AS vid, sum(oi.quantity) AS qty
        FROM public.order_items oi WHERE oi.order_id = o.id GROUP BY 1, 2
      )
      SELECT coalesce(n.pid, c.pid) AS pid, nullif(coalesce(n.vid, c.vid), none) AS vid, coalesce(n.qty, 0) - coalesce(c.qty, 0) AS added
      FROM n FULL JOIN c ON n.pid = c.pid AND n.vid = c.vid
    LOOP
      PERFORM public.admin_order_stock_change(k.pid, k.vid, -k.added::integer);
    END LOOP;
    PERFORM set_config('clevertoys.stock_reason', '', true);
    PERFORM set_config('clevertoys.stock_order', '', true);
  END IF;

  -- Items: update the ones kept, add the new ones, then remove the rest.
  FOR e IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO it FROM public.admin_order_item(e);
    item_id := NULL;
    BEGIN item_id := nullif(e->>'id', '')::uuid; EXCEPTION WHEN others THEN item_id := NULL; END;
    IF item_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.order_items WHERE id = item_id AND order_id = o.id) AND NOT item_id = ANY(keep) THEN
      UPDATE public.order_items
         SET product_id = it.product_id, variant_id = it.variant_id, product_name = it.product_name, variant_name = it.variant_name,
             sku = it.sku, quantity = it.quantity, unit_price = it.unit_price, total_price = it.unit_price * it.quantity
       WHERE id = item_id;
    ELSE
      INSERT INTO public.order_items (order_id, product_id, variant_id, product_name, variant_name, sku, quantity, unit_price, total_price)
      VALUES (o.id, it.product_id, it.variant_id, it.product_name, it.variant_name, it.sku, it.quantity, it.unit_price, it.unit_price * it.quantity)
      RETURNING id INTO item_id;
    END IF;
    keep := keep || item_id;
  END LOOP;
  DELETE FROM public.order_items WHERE order_id = o.id AND NOT (id = ANY(keep));

  SELECT coalesce(sum(total_price), 0) INTO new_subtotal FROM public.order_items WHERE order_id = o.id;
  new_discount := least(round(coalesce(p_discount, o.discount, 0), 2), new_subtotal);
  new_delivery := round(coalesce(p_delivery_fee, o.delivery_fee, 0), 2);
  UPDATE public.orders
     SET subtotal = new_subtotal, discount = new_discount, delivery_fee = new_delivery,
         total = greatest(0, new_subtotal - new_discount) + new_delivery, updated_at = now()
   WHERE id = o.id
  RETURNING * INTO o;
  RETURN jsonb_build_object('subtotal', o.subtotal, 'discount', o.discount, 'delivery_fee', o.delivery_fee, 'total', o.total);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_order(uuid, jsonb, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order(uuid, jsonb, numeric, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_order(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.orders%ROWTYPE;
  e jsonb;
  it record;
  name_value text := trim(coalesce(p->>'customer_name', ''));
  phone_value text := trim(coalesce(p->>'customer_phone', ''));
  status_value text := coalesce(nullif(p->>'status', ''), 'confirmed');
  source_value text := coalesce(nullif(p->>'source', ''), 'other');
  when_value timestamptz;
  governorate_value text := nullif(trim(coalesce(p->>'governorate', '')), '');
  subtotal_value numeric(10,2) := 0;
  delivery_value numeric(10,2);
  discount_value numeric(10,2);
  number_value text;
BEGIN
  IF NOT public.admin_has('orders') THEN RAISE EXCEPTION 'You do not have access to orders.'; END IF;
  IF name_value = '' OR length(name_value) > 120 THEN RAISE EXCEPTION 'Enter the customer''s name.'; END IF;
  IF length(phone_value) > 40 THEN RAISE EXCEPTION 'Check the phone number.'; END IF;
  IF status_value NOT IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') THEN RAISE EXCEPTION 'Unknown status.'; END IF;
  IF source_value NOT IN ('whatsapp', 'instagram', 'facebook', 'phone', 'in_store', 'other') THEN RAISE EXCEPTION 'Unknown order source.'; END IF;
  BEGIN
    when_value := coalesce(nullif(p->>'created_at', '')::timestamptz, now());
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'Check the order date.'; END;
  IF when_value > now() + interval '1 day' THEN RAISE EXCEPTION 'The order date cannot be in the future.'; END IF;
  IF jsonb_typeof(p->'items') <> 'array' OR jsonb_array_length(p->'items') = 0 THEN RAISE EXCEPTION 'Add at least one item.'; END IF;
  IF jsonb_array_length(p->'items') > 100 THEN RAISE EXCEPTION 'An order can have up to 100 items.'; END IF;

  FOR e IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
    SELECT * INTO it FROM public.admin_order_item(e);
    subtotal_value := subtotal_value + it.unit_price * it.quantity;
  END LOOP;
  BEGIN
    delivery_value := round(coalesce(nullif(p->>'delivery_fee', '')::numeric, public.delivery_fee_for(governorate_value, subtotal_value), 0), 2);
    discount_value := round(coalesce(nullif(p->>'discount', '')::numeric, 0), 2);
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'Check the delivery fee and the discount.'; END;
  IF delivery_value < 0 OR delivery_value > 100000 THEN RAISE EXCEPTION 'Enter a valid delivery fee.'; END IF;
  IF discount_value < 0 THEN RAISE EXCEPTION 'Enter a valid discount.'; END IF;
  discount_value := least(discount_value, subtotal_value);

  LOOP
    number_value := 'CT-' || to_char(when_value, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    BEGIN
      INSERT INTO public.orders (order_number, customer_name, customer_phone, customer_email, governorate, city, area, address, notes,
                                 subtotal, delivery_fee, discount, total, payment_method, status, source, created_at, updated_at)
      VALUES (number_value, name_value, phone_value, nullif(trim(coalesce(p->>'customer_email', '')), ''), governorate_value,
              nullif(trim(coalesce(p->>'city', '')), ''), nullif(trim(coalesce(p->>'area', '')), ''), nullif(trim(coalesce(p->>'address', '')), ''),
              nullif(trim(coalesce(p->>'notes', '')), ''), subtotal_value, delivery_value, discount_value,
              greatest(0, subtotal_value - discount_value) + delivery_value, 'cash_on_delivery', status_value, source_value, when_value, now())
      RETURNING * INTO o;
      EXIT;
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END LOOP;

  IF status_value <> 'cancelled' THEN
    PERFORM set_config('clevertoys.stock_reason', 'order', true);
    PERFORM set_config('clevertoys.stock_order', o.id::text, true);
  END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
    SELECT * INTO it FROM public.admin_order_item(e);
    INSERT INTO public.order_items (order_id, product_id, variant_id, product_name, variant_name, sku, quantity, unit_price, total_price)
    VALUES (o.id, it.product_id, it.variant_id, it.product_name, it.variant_name, it.sku, it.quantity, it.unit_price, it.unit_price * it.quantity);
    IF status_value <> 'cancelled' THEN PERFORM public.admin_order_stock_change(it.product_id, it.variant_id, -it.quantity); END IF;
  END LOOP;
  PERFORM set_config('clevertoys.stock_reason', '', true);
  PERFORM set_config('clevertoys.stock_order', '', true);
  RETURN to_jsonb(o);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_order(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_order(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
