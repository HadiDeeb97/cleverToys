import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

const fallback = {
  whatsappUrl: 'https://wa.me/96171220251?text=Hello%2C%20I%27m%20interested%20with%20your%20product',
  instagramUrl: '',
  showWhatsapp: true,
  showInstagram: false,
  ribbonText: '',
  showRibbon: false,
  codDeliveryPrice: 0,
  freeDeliveryThreshold: 0
};

export const GET: APIRoute = async () => {
  try {
    const base = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || '';
    const key = env.SUPABASE_PUBLISHABLE_KEY || env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
    if (!base || !key) {
      return new Response(JSON.stringify(fallback), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }

    const response = await fetch(`${base.replace(/\/$/, '')}/rest/v1/store_settings?select=whatsapp_url,instagram_url,show_whatsapp,show_instagram,ribbon_text,show_ribbon,cod_delivery_price,free_delivery_threshold&id=eq.default&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cf: { cacheTtl: 0, cacheEverything: false }
    });

    if (!response.ok) {
      return new Response(JSON.stringify(fallback), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }

    const row = (await response.json())?.[0] || {};
    const output = {
      whatsappUrl: typeof row.whatsapp_url === 'string' && row.whatsapp_url ? row.whatsapp_url : fallback.whatsappUrl,
      instagramUrl: typeof row.instagram_url === 'string' ? row.instagram_url : '',
      showWhatsapp: Boolean(row.show_whatsapp),
      showInstagram: Boolean(row.show_instagram),
      ribbonText: typeof row.ribbon_text === 'string' ? row.ribbon_text.slice(0, 180) : '',
      showRibbon: Boolean(row.show_ribbon),
      codDeliveryPrice: Math.max(0, Number(row.cod_delivery_price || 0)),
      freeDeliveryThreshold: Math.max(0, Number(row.free_delivery_threshold || 0))
    };

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  } catch {
    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
};
