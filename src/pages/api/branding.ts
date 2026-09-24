import type { APIRoute } from 'astro';
import { supabaseConfig } from '../../lib/config';

export const GET: APIRoute = async () => {
  const { url: base } = supabaseConfig();
  const logo_url = base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/product-images/branding/logo.webp` : '';
  return new Response(JSON.stringify({ logo_url }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
};
