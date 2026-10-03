/**
 * GET /products-feed.xml: the product feed for Google Merchant Center (Shopping ads) and the
 * Meta Commerce Manager catalog (Facebook & Instagram shops and ads). Add the address once as a
 * scheduled feed in each; they fetch it again by themselves, so prices, stock and photos stay current.
 *
 *  - Google's product data format (RSS 2.0 with g: fields), which Meta also reads.
 *    /products-feed.xml?for=meta writes availability the way Meta spells it ("in stock").
 *  - Every active toy. A toy sold by option (colour, size…) gives one item per active option,
 *    grouped by item_group_id, with a link that opens the product page with that option chosen.
 *  - Item IDs are the same as in the Meta Pixel / Google tag events (public/store-ui.js), so ads can
 *    show people the toys they looked at.
 *  - Prices are exactly what the product page shows: the regular price, plus sale_price on sale.
 *  - Brand: the toy's brand, or the store name when it has none. Toys have no barcodes here, so
 *    identifier_exists is "no".
 *  - Shipping (Lebanon): the standard delivery fee and the free-delivery amount from Admin → Branding.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../lib/supabase';
import { parseSeoSettings } from '../lib/seo';

const xml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string)
  // Characters XML does not allow.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
/** Text without HTML tags, with single spaces. */
const plain = (value: unknown, max: number) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
/** Descriptions: also without Markdown marks (**bold**, # headings, - lists). */
const plainDescription = (value: unknown, max: number) => plain(String(value ?? '').replace(/^\s*(#{1,6}|[-*•])\s+/gm, '').replace(/[*_`]{1,3}([^*_`]+)[*_`]{1,3}/g, '$1'), max);
const money = (value: number) => `${value.toFixed(2)} USD`;
const num = (value: unknown) => (value === null || value === undefined || value === '' ? null : Number(value));

type Variant = { id: string; name: string; sku: string | null; price: number | null; sale_price: number | null; stock_quantity: number; attributes: Record<string, unknown> | null; is_active: boolean };
type Row = {
  id: string; name: string; slug: string; sku: string | null; short_description: string | null; description: string | null;
  price: number; sale_price: number | null; stock_quantity: number; brand: string | null; primary_image_url: string | null;
  categories: { name: string } | null;
  product_images: Array<{ image_url: string; sort_order: number }> | null;
  product_variants: Variant[] | null;
};

export const GET: APIRoute = async ({ site, url }) => {
  // The address Google/Meta fetch the feed from, so product links match the site they verified.
  const origin = url.origin || site?.origin || '';
  const forMeta = url.searchParams.get('for') === 'meta';
  const [productsResult, settingsResult] = await Promise.all([
    supabase.from('products')
      .select('id,name,slug,sku,short_description,description,price,sale_price,stock_quantity,brand,primary_image_url,categories:category_id(name),product_images(image_url,sort_order),product_variants(id,name,sku,price,sale_price,stock_quantity,attributes,is_active)')
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase.from('store_settings').select('*').eq('id', 'default').maybeSingle()
  ]);
  if (productsResult.error) return new Response('The product feed is not available right now.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '600' } });

  const settings = settingsResult.data ?? {};
  const storeName = parseSeoSettings(settings.seo).site_name || 'Clever Toys';
  const deliveryFee = Math.max(0, Number(settings.cod_delivery_price || 0));
  const freeOver = Math.max(0, Number(settings.free_delivery_threshold || 0));
  const shipping = `<g:shipping><g:country>LB</g:country><g:service>Cash on delivery</g:service><g:price>${money(deliveryFee)}</g:price></g:shipping>`
    + (freeOver > 0 ? `<g:free_shipping_threshold><g:country>LB</g:country><g:price_threshold>${money(freeOver)}</g:price_threshold></g:free_shipping_threshold>` : '');
  const inStock = forMeta ? 'in stock' : 'in_stock';
  const outOfStock = forMeta ? 'out of stock' : 'out_of_stock';

  const items: string[] = [];
  for (const p of (productsResult.data ?? []) as unknown as Row[]) {
    const link = `${origin}/product/${encodeURIComponent(p.slug)}`;
    // Photos in the product page's order: the main one, then the gallery, without repeats.
    const images = [p.primary_image_url, ...[...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.image_url)]
      .filter((u, i, all): u is string => Boolean(u) && /^https?:\/\//.test(u as string) && all.indexOf(u) === i);
    if (!images.length) continue;   // Google and Meta reject items without a photo.
    const title = plain(p.name, 150);
    const description = plainDescription(p.description || p.short_description || p.name, 5000);
    const brand = plain(p.brand, 70) || storeName;
    const category = p.categories?.name ? plain(p.categories.name, 200) : '';
    const common = [
      `<g:description>${xml(description)}</g:description>`,
      `<g:image_link>${xml(images[0])}</g:image_link>`,
      ...images.slice(1, 11).map((u) => `<g:additional_image_link>${xml(u)}</g:additional_image_link>`),
      `<g:brand>${xml(brand)}</g:brand>`,
      '<g:condition>new</g:condition>',
      '<g:identifier_exists>no</g:identifier_exists>',
      '<g:google_product_category>1239</g:google_product_category>',   // Toys & Games
      category ? `<g:product_type>${xml(category)}</g:product_type>` : '',
      shipping
    ].filter(Boolean).join('');

    const variants = (p.product_variants ?? []).filter((v) => v.is_active);
    if (!variants.length) {
      const price = Number(p.price || 0);
      const sale = num(p.sale_price);
      items.push(`<item><g:id>${xml(p.id)}</g:id><g:title>${xml(title)}</g:title><g:link>${xml(link)}</g:link>`
        + `<g:price>${money(price)}</g:price>${sale !== null && sale < price ? `<g:sale_price>${money(sale)}</g:sale_price>` : ''}`
        + `<g:availability>${Number(p.stock_quantity) > 0 ? inStock : outOfStock}</g:availability>`
        + (p.sku ? `<g:custom_label_0>${xml(plain(p.sku, 100))}</g:custom_label_0>` : '')
        + `${common}</item>`);
      continue;
    }
    for (const v of variants) {
      // Same prices as the product page shows for this option.
      let price: number, sale: number | null;
      if (num(v.sale_price) !== null) { price = Number(num(v.price) ?? p.price); sale = Number(v.sale_price); }
      else if (num(v.price) !== null) { price = Number(v.price); sale = null; }
      else { price = Number(p.price); sale = num(p.sale_price); }
      const attrs = v.attributes && typeof v.attributes === 'object' ? v.attributes : {};
      const attr = (key: string) => { const found = Object.entries(attrs).find(([k]) => k.toLowerCase() === key); return found ? plain(found[1], 100) : ''; };
      const color = attr('color') || attr('colour');
      const size = attr('size');
      items.push(`<item><g:id>${xml(v.id)}</g:id><g:item_group_id>${xml(p.id)}</g:item_group_id>`
        + `<g:title>${xml(plain(`${p.name} - ${v.name}`, 150))}</g:title><g:link>${xml(`${link}?option=${encodeURIComponent(v.id)}`)}</g:link>`
        + `<g:price>${money(price)}</g:price>${sale !== null && sale < price ? `<g:sale_price>${money(sale)}</g:sale_price>` : ''}`
        + `<g:availability>${Number(v.stock_quantity) > 0 ? inStock : outOfStock}</g:availability>`
        + (color ? `<g:color>${xml(color)}</g:color>` : '') + (size ? `<g:size>${xml(size)}</g:size>` : '')
        + (v.sku || p.sku ? `<g:custom_label_0>${xml(plain(v.sku || p.sku, 100))}</g:custom_label_0>` : '')
        + `${common}</item>`);
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${xml(storeName)}</title>
<link>${xml(origin)}</link>
<description>${xml(`${storeName} products`)}</description>
${items.join('\n')}
</channel>
</rss>
`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=900' } });
};
