-- Clever Toys production hardening
-- Run this file once in Supabase SQL Editor after the existing tables/functions have been created.

ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS free_delivery_threshold numeric(10,2) NOT NULL DEFAULT 0 CHECK (free_delivery_threshold >= 0);

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can manage product images" ON public.product_images;
CREATE POLICY "Admins can manage product images" ON public.product_images FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can manage product variants" ON public.product_variants;
CREATE POLICY "Admins can manage product variants" ON public.product_variants FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
CREATE POLICY "Admins can manage orders" ON public.orders FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can manage order items" ON public.order_items;
CREATE POLICY "Admins can manage order items" ON public.order_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.create_order(order_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  new_order_id uuid; new_order_number text; item jsonb;
  product_row public.products%ROWTYPE; variant_row public.product_variants%ROWTYPE;
  requested_qty integer; server_unit_price numeric(10,2); server_subtotal numeric(10,2) := 0; server_total numeric(10,2);
  customer_name_value text; customer_phone_value text; customer_email_value text; governorate_value text; city_value text; area_value text; address_value text; notes_value text;
  cod_delivery_price numeric(10,2) := 0;
  free_delivery_threshold numeric(10,2) := 0;
  item_product_id uuid; item_variant_id uuid; variant_name_value text; item_sku text;
BEGIN
  customer_name_value := trim(coalesce(order_payload->>'customer_name',''));
  customer_phone_value := trim(coalesce(order_payload->>'customer_phone',''));
  customer_email_value := nullif(trim(coalesce(order_payload->>'customer_email','')),'');
  governorate_value := nullif(trim(coalesce(order_payload->>'governorate','')),'');
  city_value := nullif(trim(coalesce(order_payload->>'city','')),'');
  area_value := nullif(trim(coalesce(order_payload->>'area','')),'');
  address_value := nullif(trim(coalesce(order_payload->>'address','')),'');
  notes_value := nullif(trim(coalesce(order_payload->>'notes','')),'');
  SELECT greatest(0, coalesce(s.cod_delivery_price, 0)),
         greatest(0, coalesce(s.free_delivery_threshold, 0))
  INTO cod_delivery_price, free_delivery_threshold
  FROM public.store_settings AS s
  WHERE s.id = 'default';
  cod_delivery_price := coalesce(cod_delivery_price, 0);
  free_delivery_threshold := coalesce(free_delivery_threshold, 0);

  IF customer_name_value = '' OR length(customer_name_value) > 120 THEN RAISE EXCEPTION 'Please enter a valid customer name.'; END IF;
  IF customer_phone_value = '' OR length(customer_phone_value) > 40 THEN RAISE EXCEPTION 'Please enter a valid phone number.'; END IF;
  IF address_value IS NULL OR length(address_value) > 500 THEN RAISE EXCEPTION 'Please enter a valid delivery address.'; END IF;
  IF jsonb_typeof(order_payload->'items') <> 'array' OR jsonb_array_length(order_payload->'items') = 0 OR jsonb_array_length(order_payload->'items') > 50 THEN RAISE EXCEPTION 'Your cart is empty or contains too many items.'; END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(order_payload->'items') LOOP
    BEGIN
      item_product_id := (item->>'productId')::uuid;
      requested_qty := (item->>'quantity')::integer;
      item_variant_id := nullif(item->>'variantId','')::uuid;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'Invalid product in cart.'; END;
    IF requested_qty IS NULL OR requested_qty < 1 OR requested_qty > 100 THEN RAISE EXCEPTION 'Invalid quantity.'; END IF;
    SELECT * INTO product_row FROM public.products WHERE id=item_product_id AND is_active=true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'One of the products is no longer available.'; END IF;

    IF item_variant_id IS NOT NULL THEN
      SELECT * INTO variant_row FROM public.product_variants WHERE id=item_variant_id AND product_id=item_product_id AND is_active=true FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'One of the selected options is no longer available.'; END IF;
      IF variant_row.stock_quantity < requested_qty THEN RAISE EXCEPTION 'Not enough stock for %.', variant_row.name; END IF;
      server_unit_price := coalesce(variant_row.sale_price, variant_row.price, product_row.sale_price, product_row.price);
    ELSE
      IF product_row.stock_quantity < requested_qty THEN RAISE EXCEPTION 'Not enough stock for %.', product_row.name; END IF;
      server_unit_price := coalesce(product_row.sale_price, product_row.price);
    END IF;
    server_subtotal := server_subtotal + server_unit_price * requested_qty;
  END LOOP;

  server_total := server_subtotal + cod_delivery_price;
  LOOP
    new_order_number := 'CT-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,6));
    BEGIN
      INSERT INTO public.orders (order_number,customer_id,customer_name,customer_phone,customer_email,governorate,city,area,address,subtotal,delivery_fee,discount,total,payment_method,status,notes)
      VALUES (new_order_number,auth.uid(),customer_name_value,customer_phone_value,customer_email_value,governorate_value,city_value,area_value,address_value,server_subtotal,cod_delivery_price,0,server_total,'cash_on_delivery','pending',notes_value)
      RETURNING id INTO new_order_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(order_payload->'items') LOOP
    item_product_id := (item->>'productId')::uuid;
    requested_qty := (item->>'quantity')::integer;
    item_variant_id := nullif(item->>'variantId','')::uuid;
    SELECT * INTO product_row FROM public.products WHERE id=item_product_id AND is_active=true FOR UPDATE;
    IF item_variant_id IS NOT NULL THEN
      SELECT * INTO variant_row FROM public.product_variants WHERE id=item_variant_id AND product_id=item_product_id AND is_active=true FOR UPDATE;
      server_unit_price := coalesce(variant_row.sale_price, variant_row.price, product_row.sale_price, product_row.price);
      variant_name_value := variant_row.name;
      item_sku := coalesce(variant_row.sku, product_row.sku);
      UPDATE public.product_variants SET stock_quantity=stock_quantity-requested_qty, updated_at=now() WHERE id=item_variant_id AND stock_quantity>=requested_qty;
      IF NOT FOUND THEN RAISE EXCEPTION 'Stock changed while placing the order. Please try again.'; END IF;
    ELSE
      server_unit_price := coalesce(product_row.sale_price,product_row.price);
      variant_name_value := NULL; item_sku := product_row.sku;
      UPDATE public.products SET stock_quantity=stock_quantity-requested_qty, updated_at=now() WHERE id=item_product_id AND stock_quantity>=requested_qty;
      IF NOT FOUND THEN RAISE EXCEPTION 'Stock changed while placing the order. Please try again.'; END IF;
    END IF;
    INSERT INTO public.order_items (order_id,product_id,variant_id,product_name,variant_name,sku,quantity,unit_price,total_price)
    VALUES (new_order_id,product_row.id,item_variant_id,product_row.name,variant_name_value,item_sku,requested_qty,server_unit_price,server_unit_price*requested_qty);
  END LOOP;

  RETURN jsonb_build_object('order_id',new_order_id,'order_number',new_order_number,'delivery_fee',cod_delivery_price,'total',server_total);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO anon, authenticated;

DROP POLICY IF EXISTS "Customers can view their own profile" ON public.customer_profiles;
CREATE POLICY "Customers can view their own profile" ON public.customer_profiles FOR SELECT TO authenticated USING (auth.uid()=id);
DROP POLICY IF EXISTS "Customers can insert their own profile" ON public.customer_profiles;
CREATE POLICY "Customers can insert their own profile" ON public.customer_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()=id);
DROP POLICY IF EXISTS "Customers can update their own profile" ON public.customer_profiles;
CREATE POLICY "Customers can update their own profile" ON public.customer_profiles FOR UPDATE TO authenticated USING (auth.uid()=id) WITH CHECK (auth.uid()=id);

-- Multiple categories per product
CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS product_categories_category_id_idx ON public.product_categories(category_id);
CREATE INDEX IF NOT EXISTS product_categories_product_id_idx ON public.product_categories(product_id);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view product categories" ON public.product_categories;
CREATE POLICY "Public can view product categories" ON public.product_categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage product categories" ON public.product_categories;
CREATE POLICY "Admins can manage product categories" ON public.product_categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Keep current single-category data as the initial primary category mapping.
INSERT INTO public.product_categories (product_id, category_id)
SELECT id, category_id FROM public.products WHERE category_id IS NOT NULL
ON CONFLICT (product_id, category_id) DO NOTHING;
