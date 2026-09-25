/**
 * GET /api/quick-view?slug=<product-slug>: the details shown in the product cards' Quick view popup
 * (src/components/QuickView.astro): photos, description, ages, brand, category and the options
 * (variants) with their own prices and stock. One database request; the browser keeps the answer
 * for a minute so reopening the same toy is instant.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache } });

type Row = {
  id: string; name: string; slug: string; sku: string | null; short_description: string | null; description: string | null;
  price: number; sale_price: number | null; stock_quantity: number; age_min: number | null; age_max: number | null; brand: string | null;
  primary_image_url: string | null;
  categories?: { name: string; slug: string } | null;
  product_images?: Array<{ image_url: string; alt_text: string | null; sort_order: number | null }> | null;
  product_variants?: Array<{ id: string; name: string; sku: string | null; price: number | null; sale_price: number | null; stock_quantity: number; is_active: boolean }> | null;
};

export const GET: APIRoute = async ({ url }) => {
  const slug = String(url.searchParams.get('slug') || '').trim().slice(0, 200);
  if (!slug) return json({ error: 'Missing product.' }, 400);

  const { data, error } = await supabase
    .from('products')
    .select('id,name,slug,sku,short_description,description,price,sale_price,stock_quantity,age_min,age_max,brand,primary_image_url,categories(name,slug),product_images(image_url,alt_text,sort_order),product_variants(id,name,sku,price,sale_price,stock_quantity,is_active)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) return json({ error: 'Could not load this toy right now.' }, 503);
  if (!data) return json({ error: 'This toy is no longer available.' }, 404);

  const p = data as unknown as Row;
  // Main photo first, then the other photos in their admin order (no duplicates).
  const extra = [...(p.product_images ?? [])].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)).map((i) => i.image_url);
  const images = [...new Set([p.primary_image_url, ...extra].filter((u): u is string => Boolean(u)))].slice(0, 8);
  // Options without their own price use the toy's price (same rule as the product page).
  const variants = (p.product_variants ?? []).filter((v) => v.is_active).map((v) => ({
    id: v.id,
    name: v.name,
    sku: v.sku ?? null,
    price: Number(v.sale_price ?? v.price ?? p.sale_price ?? p.price ?? 0),
    original: v.sale_price != null ? Number(v.price ?? p.price ?? 0) : v.price == null && p.sale_price != null ? Number(p.price) : null,
    stock: Math.max(0, Number(v.stock_quantity ?? 0))
  }));

  return json({
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    shortDescription: p.short_description || '',
    description: p.description || '',
    price: Number(p.sale_price ?? p.price),
    original: p.sale_price != null ? Number(p.price) : null,
    stock: Math.max(0, Number(p.stock_quantity ?? 0)),
    ageMin: p.age_min,
    ageMax: p.age_max,
    brand: p.brand,
    category: p.categories ? { name: p.categories.name, slug: p.categories.slug } : null,
    images,
    variants
  }, 200, 'public, max-age=60');
};
