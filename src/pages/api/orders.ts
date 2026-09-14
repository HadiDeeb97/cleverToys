import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body?.customer_name || !body?.customer_phone || !Array.isArray(body.items) || body.items.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required order information.' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
    }

    const url = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || '';
    const key = env.SUPABASE_PUBLISHABLE_KEY || env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
    if (!url || !key) throw new Error('Supabase server configuration is missing.');

    const authHeader = request.headers.get('authorization');
    const supabase = createClient(url, key, authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined);
    const { data, error } = await supabase.rpc('create_order', { order_payload: body });

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
    return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid request.' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
};
