-- Clever Toys production hardening
-- Run once in Supabase SQL Editor after the existing tables/functions have been created.

-- Admin CRUD policies
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products"
ON public.products FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage product images" ON public.product_images;
CREATE POLICY "Admins can manage product images"
ON public.product_images FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage product variants" ON public.product_variants;
CREATE POLICY "Admins can manage product variants"
ON public.product_variants FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
CREATE POLICY "Admins can manage orders"
ON public.orders FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage order items" ON public.order_items;
CREATE POLICY "Admins can manage order items"
ON public.order_items FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Secure server-side order creation.
-- The browser may send prices/totals, but this function never trusts them.
CREATE OR REPLACE FUNCTION public.create_order(order_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_order_id uuid;
  new_order_number text;
  item jsonb;
  product_row public.products%ROWTYPE;
  requested_qty integer;
  server_unit_price numeric(10,2);
  server_subtotal numeric(10,2) := 0;
  server_total numeric(10,2);
  customer_name_value text;
  customer_phone_value text;
  customer_email_value text;
  governorate_value text;
  city_value text;
  area_value text;
  address_value text;
  notes_value text;
  item_product_id uuid;
BEGIN
  customer_name_value := trim(coalesce(order_payload->>'customer_name', ''));
  customer_phone_value := trim(coalesce(order_payload->>'customer_phone', ''));
  customer_email_value := nullif(trim(coalesce(order_payload->>'customer_email', '')), '');
  governorate_value := nullif(trim(coalesce(order_payload->>'governorate', '')), '');
  city_value := nullif(trim(coalesce(order_payload->>'city', '')), '');
  area_value := nullif(trim(coalesce(order_payload->>'area', '')), '');
  address_value := nullif(trim(coalesce(order_payload->>'address', '')), '');
  notes_value := nullif(trim(coalesce(order_payload->>'notes', '')), '');

  IF customer_name_value = '' OR length(customer_name_value) > 120 THEN
    RAISE EXCEPTION 'Please enter a valid customer name.';
  END IF;

  IF customer_phone_value = '' OR length(customer_phone_value) > 40 THEN
    RAISE EXCEPTION 'Please enter a valid phone number.';
  END IF;

  IF address_value IS NULL OR length(address_value) > 500 THEN
    RAISE EXCEPTION 'Please enter a valid delivery address.';
  END IF;

  IF jsonb_typeof(order_payload->'items') <> 'array'
     OR jsonb_array_length(order_payload->'items') = 0
     OR jsonb_array_length(order_payload->'items') > 50 THEN
    RAISE EXCEPTION 'Your cart is empty or contains too many items.';
  END IF;

  -- Validate every line and calculate the real subtotal from the database.
  FOR item IN SELECT * FROM jsonb_array_elements(order_payload->'items') LOOP
    BEGIN
      item_product_id := (item->>'productId')::uuid;
      requested_qty := (item->>'quantity')::integer;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid product in cart.';
    END;

    IF requested_qty IS NULL OR requested_qty < 1 OR requested_qty > 100 THEN
      RAISE EXCEPTION 'Invalid quantity.';
    END IF;

    SELECT * INTO product_row
    FROM public.products
    WHERE id = item_product_id
      AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'One of the products is no longer available.';
    END IF;

    IF product_row.stock_quantity < requested_qty THEN
      RAISE EXCEPTION 'Not enough stock for %.', product_row.name;
    END IF;

    server_unit_price := coalesce(product_row.sale_price, product_row.price);
    server_subtotal := server_subtotal + (server_unit_price * requested_qty);
  END LOOP;

  server_total := server_subtotal;

  -- Generate a short human-friendly order number and retry on the very unlikely collision.
  LOOP
    new_order_number := 'CT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    BEGIN
      INSERT INTO public.orders (
        order_number, customer_id, customer_name, customer_phone, customer_email,
        governorate, city, area, address, subtotal, delivery_fee, discount, total,
        payment_method, status, notes
      ) VALUES (
        new_order_number, auth.uid(), customer_name_value, customer_phone_value, customer_email_value,
        governorate_value, city_value, area_value, address_value, server_subtotal, 0, 0, server_total,
        'cash_on_delivery', 'pending', notes_value
      ) RETURNING id INTO new_order_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- Try another order number.
    END;
  END LOOP;

  -- Decrement stock and store a price snapshot for every line.
  FOR item IN SELECT * FROM jsonb_array_elements(order_payload->'items') LOOP
    item_product_id := (item->>'productId')::uuid;
    requested_qty := (item->>'quantity')::integer;

    SELECT * INTO product_row
    FROM public.products
    WHERE id = item_product_id AND is_active = true
    FOR UPDATE;

    server_unit_price := coalesce(product_row.sale_price, product_row.price);

    UPDATE public.products
    SET stock_quantity = stock_quantity - requested_qty,
        updated_at = now()
    WHERE id = item_product_id
      AND stock_quantity >= requested_qty;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock changed while placing the order. Please try again.';
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, variant_name, sku,
      quantity, unit_price, total_price
    ) VALUES (
      new_order_id, product_row.id, product_row.name, NULL, product_row.sku,
      requested_qty, server_unit_price, server_unit_price * requested_qty
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', new_order_id,
    'order_number', new_order_number,
    'total', server_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO anon, authenticated;

-- Customers may create/update their own profile when signed in.
DROP POLICY IF EXISTS "Customers can view their own profile" ON public.customer_profiles;
CREATE POLICY "Customers can view their own profile"
ON public.customer_profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Customers can insert their own profile" ON public.customer_profiles;
CREATE POLICY "Customers can insert their own profile"
ON public.customer_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Customers can update their own profile" ON public.customer_profiles;
CREATE POLICY "Customers can update their own profile"
ON public.customer_profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
