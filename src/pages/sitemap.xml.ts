import type { APIRoute } from 'astro';
import { supabase } from '../lib/supabase';

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin || 'https://clevertoys.hadidib97.workers.dev';
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products').select('slug, updated_at').eq('is_active', true),
    supabase.from('categories').select('slug, updated_at').eq('is_active', true)
  ]);

  const urls = [
    { path: '/', updated_at: null },
    { path: '/products', updated_at: null },
    { path: '/categories', updated_at: null },
    { path: '/about', updated_at: null },
    { path: '/contact', updated_at: null },
    { path: '/shipping-returns', updated_at: null },
    { path: '/privacy', updated_at: null },
    { path: '/terms', updated_at: null },
    ...(categories ?? []).map((item) => ({ path: `/category/${encodeURIComponent(item.slug)}`, updated_at: item.updated_at })),
    ...(products ?? []).map((item) => ({ path: `/product/${encodeURIComponent(item.slug)}`, updated_at: item.updated_at }))
  ];

  const xml = urls.map(({ path, updated_at }) => {
    const lastmod = updated_at ? `<lastmod>${new Date(updated_at).toISOString()}</lastmod>` : '';
    return `<url><loc>${origin}${path}</loc>${lastmod}</url>`;
  }).join('');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${xml}</urlset>`, {
    headers: { 'content-type': 'application/xml; charset=utf-8' }
  });
};
