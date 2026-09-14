import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async () => {
  const base = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || '';
  const logo_url = base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/product-images/branding/logo.webp` : '';
  return new Response(JSON.stringify({ logo_url }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
};
