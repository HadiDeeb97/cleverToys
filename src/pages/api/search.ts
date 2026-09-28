/**
 * GET /api/search?q=<words>: instant suggestions for the store's search boxes (public/store-ui.js).
 * Returns the best matching toys (search_products in supabase/search.sql: every word in any order,
 * small typos and plurals, all fields) and matching categories. Before search.sql is run, a simpler
 * name search is used. The browser may keep an answer for a minute.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { placeholderFor } from '../../lib/design';

const json = (body: unknown, cache = 'public, max-age=60') =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache } });

type Row = { id: string; name: string; slug: string; price: number; sale_price: number | null; primary_image_url: string | null };

const words = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Letters that differ between two words, stopping early once it is more than `max`. */
function within(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return false;
  // Two swapped neighbouring letters ("lnia" → lina) count as one mistake.
  let before: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], before[j - 2] + 1);
      best = Math.min(best, cur[j]);
    }
    if (best > max) return false;
    before = prev;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** Every searched word appears in the text (or is one small typo / plural away from one of its words). */
function matches(text: string, query: string[]) {
  const hay = words(text);
  const joined = hay.join(' ');
  return query.every((w) => joined.includes(w)
    || (w.length > 3 && w.endsWith('s') && joined.includes(w.slice(0, -1)))
    || (w.length >= 4 && hay.some((h) => within(w, h.slice(0, w.length + 1), w.length >= 5 ? 2 : 1) || within(w, h, w.length >= 5 ? 2 : 1))));
}

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const query = words(q);
  if (q.length < 2 || !query.length) return json({ products: [], categories: [] });

  const fields = 'id,name,slug,price,sale_price,primary_image_url';
  // One round trip: the ranked toys (search_product_rows) and the categories at the same time.
  const [ranked, categoriesResult] = await Promise.all([
    supabase.rpc('search_product_rows', { q, max_results: 6 }).select(fields),
    supabase.from('categories').select('name,slug').eq('is_active', true).order('sort_order', { ascending: true })
  ]);

  let rows: Row[] = ranked.error ? [] : ((ranked.data ?? []) as unknown as Row[]);
  if (ranked.error) {
    // search.sql not run yet: every word in the name.
    let r = supabase.from('products').select(fields).eq('is_active', true);
    for (const w of query.slice(0, 5)) r = r.ilike('name', `%${w}%`);
    rows = ((await r.limit(6)).data ?? []) as Row[];
  }

  const categories = ((categoriesResult.data ?? []) as Array<{ name: string; slug: string }>)
    .filter((c) => matches(c.name, query))
    .slice(0, 3);

  return json({
    products: rows.map((p) => ({
      name: p.name,
      url: `/product/${p.slug}`,
      price: Number(p.sale_price ?? p.price),
      original: p.sale_price != null ? Number(p.price) : null,
      image: p.primary_image_url || '',
      placeholder: p.primary_image_url ? null : placeholderFor(p.name)
    })),
    categories: categories.map((c) => ({ name: c.name, url: `/category/${c.slug}` }))
  });
};
