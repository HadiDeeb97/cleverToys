/**
 * GET /manifest.webmanifest: lets phones "Add to Home Screen" with the store name, colours
 * and the website icon uploaded in Admin → Branding.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../lib/supabase';
import { supabaseConfig } from '../lib/config';

export const GET: APIRoute = async () => {
  let faviconUrl = '';
  let themeColor = '#2563eb';
  try {
    const { data } = await supabase.from('store_settings').select('*').eq('id', 'default').maybeSingle();
    faviconUrl = String(data?.favicon_url || '');
    const primary = data?.theme?.theme?.primary;
    if (/^#[0-9a-f]{6}$/i.test(String(primary || ''))) themeColor = primary;
  } catch {}

  // Only trust icon URLs that point at our own storage folder (same rule as the middleware).
  const { url: base } = supabaseConfig();
  const prefix = base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/product-images/branding/icons/` : '';
  const hasUpload = Boolean(prefix && faviconUrl.startsWith(prefix) && /\/icon-32\.png$/.test(faviconUrl));
  const icons = hasUpload
    ? [192, 512].map((size) => ({ src: faviconUrl.replace(/icon-32\.png$/, `icon-${size}.png`), sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' }))
    : [192, 512].map((size) => ({ src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' }));

  const manifest = {
    name: 'Clever Toys Lebanon',
    short_name: 'Clever Toys',
    description: 'Fun, educational toys with cash on delivery across Lebanon.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: themeColor,
    icons
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=3600' }
  });
};
