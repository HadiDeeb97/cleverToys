import type { APIRoute } from 'astro';
import { supabaseConfig } from '../../lib/config';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const orderNumber = String(body?.orderNumber ?? '').trim().slice(0, 40);
  const phone = String(body?.phone ?? '').trim().slice(0, 40);
  if (!orderNumber || !phone) return json({ error: 'Enter your order number and phone number.' }, 400);

  const { url, key } = supabaseConfig();
  if (!url || !key) return json({ error: 'Order tracking is temporarily unavailable.' }, 503);

  try {
    const response = await fetch(`${url}/rest/v1/rpc/track_order`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_order_number: orderNumber, p_phone: phone })
    });
    if (!response.ok) return json({ error: 'Order tracking is temporarily unavailable.' }, 503);
    const order = await response.json();
    // The same message for "no such order" and "wrong phone", so order numbers cannot be probed.
    if (!order) return json({ error: 'We could not find an order with that number and phone number.' }, 404);
    return json({ order });
  } catch {
    return json({ error: 'Order tracking is temporarily unavailable.' }, 503);
  }
};
