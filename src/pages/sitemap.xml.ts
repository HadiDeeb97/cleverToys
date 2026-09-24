import type { APIRoute } from 'astro';
import { supabase } from '../lib/supabase';
import { PRIVATE_PATH, STATIC_PAGES, parseSeoSettings } from '../lib/seo';

const xmlEscape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string);
const CHANGEFREQ = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);

type Entry = { path: string; lastmod?: string | null; priority?: number | null; changefreq?: string | null; images?: Array<{ url: string; title?: string }> };

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin || 'https://clevertoys.hadidib97.workers.dev';
  const [settingsResult, pagesResult, productsResult, categoriesResult] = await Promise.all([
    supabase.from('store_settings').select('*').eq('id', 'default').maybeSingle(),
    supabase.from('seo_pages').select('*'),
    supabase.from('products').select('slug, name, updated_at, primary_image_url, product_images(image_url, alt_text)').eq('is_active', true),
    supabase.from('categories').select('slug, name, updated_at, image_url').eq('is_active', true)
  ]);
  const settings = parseSeoSettings(settingsResult.data?.seo);
  const pages = new Map((pagesResult.data ?? []).map((row: any) => [row.path_key, row]));
  // Per-page options from Admin → SEO; product/category templates set the defaults for all products/categories.
  const options = (key: string) => {
    const row: any = pages.get(key);
    return {
      skip: row ? row.noindex === true || row.in_sitemap === false : false,
      priority: row?.priority != null ? Number(row.priority) : null,
      changefreq: CHANGEFREQ.has(row?.changefreq) ? row.changefreq : null,
      lastmod: row?.updated_at ?? null
    };
  };

  const entries: Entry[] = [];
  const seen = new Set<string>();
  const add = (entry: Entry) => { if (!seen.has(entry.path)) { seen.add(entry.path); entries.push(entry); } };

  for (const page of STATIC_PAGES) {
    const o = options(page.path);
    if (!o.skip) add({ path: page.path, lastmod: o.lastmod, priority: o.priority ?? page.priority, changefreq: o.changefreq ?? page.changefreq });
  }
  // Extra public pages added in Admin → SEO.
  for (const [key] of pages) {
    if (key.includes('*') || !key.startsWith('/') || PRIVATE_PATH.test(key) || key === '/404') continue;
    const o = options(key);
    if (!o.skip) add({ path: key, lastmod: o.lastmod, priority: o.priority ?? 0.5, changefreq: o.changefreq ?? 'monthly' });
  }
  const categoryOptions = options('/category/*');
  if (settings.sitemap_categories && !categoryOptions.skip) {
    for (const item of categoriesResult.data ?? []) {
      const o = options(`/category/${item.slug}`);
      if (o.skip) continue;
      add({ path: `/category/${encodeURIComponent(item.slug)}`, lastmod: item.updated_at, priority: o.priority ?? categoryOptions.priority ?? 0.7, changefreq: o.changefreq ?? categoryOptions.changefreq ?? 'weekly', images: item.image_url ? [{ url: item.image_url, title: item.name }] : [] });
    }
  }
  const productOptions = options('/product/*');
  if (settings.sitemap_products && !productOptions.skip) {
    for (const item of (productsResult.data ?? []) as any[]) {
      const o = options(`/product/${item.slug}`);
      if (o.skip) continue;
      const images = [item.primary_image_url, ...(item.product_images ?? []).map((image: any) => image.image_url)]
        .filter((url, index, all): url is string => Boolean(url) && all.indexOf(url) === index).slice(0, 10)
        .map((url) => ({ url, title: item.name }));
      add({ path: `/product/${encodeURIComponent(item.slug)}`, lastmod: item.updated_at, priority: o.priority ?? productOptions.priority ?? 0.8, changefreq: o.changefreq ?? productOptions.changefreq ?? 'weekly', images });
    }
  }

  const withImages = settings.sitemap_images;
  const xml = entries.map((entry) => {
    const lastmod = entry.lastmod ? `<lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>` : '';
    const changefreq = entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : '';
    const priority = entry.priority != null && Number.isFinite(entry.priority) ? `<priority>${Math.min(1, Math.max(0, entry.priority)).toFixed(1)}</priority>` : '';
    const images = withImages ? (entry.images ?? []).map((image) => `<image:image><image:loc>${xmlEscape(image.url)}</image:loc>${image.title ? `<image:title>${xmlEscape(image.title)}</image:title>` : ''}</image:image>`).join('') : '';
    return `<url><loc>${xmlEscape(origin + entry.path)}</loc>${lastmod}${changefreq}${priority}${images}</url>`;
  }).join('');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${withImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ''}>${xml}</urlset>`, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=900' }
  });
};
