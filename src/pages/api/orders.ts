import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { env } from 'cloudflare:workers';
import { supabaseConfig } from '../../lib/config';

const buildTelegramMessage = (body: any, orderNumber: string) => {
  const items = Array.isArray(body.items) ? body.items : [];
  const itemLines = items.map((item: any) => {
    const variant = item.variantName ? ` (${item.variantName})` : '';
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    return `• ${item.name || 'Product'}${variant} × ${quantity} — $${(price * quantity).toFixed(2)}`;
  });

  const lines = [
    '🛒 NEW CLEVER TOYS ORDER',
    '',
    `📦 Order: #${orderNumber}`,
    `👤 Customer: ${body.customer_name || ''}`,
    `📞 Phone: ${body.customer_phone || ''}`,
    `✉️ Email: ${body.customer_email || 'Not provided'}`,
    '',
    `📍 Governorate: ${body.governorate || ''}`,
    `🏙️ City: ${body.city || ''}`,
    `📌 Area: ${body.area || 'Not provided'}`,
    `🏠 Address: ${body.address || ''}`,
    '',
    '🧸 ITEMS',
    ...itemLines,
    '',
    `💰 Subtotal: $${Number(body.subtotal || 0).toFixed(2)}`,
    `🚚 COD delivery: $${Number(body.delivery_fee || 0).toFixed(2)}`,
    `💵 TOTAL: $${Number(body.total || 0).toFixed(2)}`,
    '💳 Payment: Cash on delivery',
    '',
    `📝 Notes: ${body.notes || 'None'}`,
  ];

  return lines.join('\n').slice(0, 4096);
};

const sendTelegramOrderNotification = async (body: any, orderNumber: string) => {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('Telegram order notification is not configured. Expected TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildTelegramMessage(body, orderNumber),
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      console.error('Telegram order notification failed:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Telegram order notification error:', error);
    return false;
  }
};

const MAX_BODY_BYTES = 32 * 1024;
const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

// Only forward the fields create_order uses, with length limits, so oversized or unexpected
// input never reaches the database or the Telegram message.
const sanitizeOrder = (raw: any) => ({
  customer_name: text(raw?.customer_name, 120),
  customer_phone: text(raw?.customer_phone, 40),
  customer_email: text(raw?.customer_email, 254),
  governorate: text(raw?.governorate, 80),
  city: text(raw?.city, 80),
  area: text(raw?.area, 120),
  address: text(raw?.address, 500),
  notes: text(raw?.notes, 1000),
  payment_method: 'cash_on_delivery',
  items: (Array.isArray(raw?.items) ? raw.items : []).slice(0, 50).map((item: any) => ({
    productId: text(item?.productId, 64),
    variantId: item?.variantId ? text(item.variantId, 64) : null,
    quantity: Math.floor(Number(item?.quantity) || 0),
    // Display-only fields for the notification; prices are recalculated by create_order.
    name: text(item?.name, 200),
    variantName: item?.variantName ? text(item.variantName, 120) : null,
    price: Math.max(0, Number(item?.price) || 0)
  }))
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const declaredLength = Number(request.headers.get('content-length') || 0);
    const rawBody = await request.text();
    if (declaredLength > MAX_BODY_BYTES || rawBody.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: 'Order is too large.' }), {
        status: 413,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    }
    const body = sanitizeOrder(JSON.parse(rawBody));
    if (!body.customer_name || !body.customer_phone || body.items.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required order information.' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    }

    const { url, key } = supabaseConfig();
    if (!url || !key) throw new Error('Supabase server configuration is missing.');

    const authHeader = request.headers.get('authorization');
    const supabase = createClient(
      url,
      key,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined
    );

    const { data, error } = await supabase.rpc('create_order', {
      order_payload: body
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    }

    const result = Array.isArray(data) ? data[0] : data;
    const orderNumber = result?.order_number || result?.orderNumber || 'New Order';
    const notificationBody = {
      ...body,
      // Always use server-calculated amounts; older create_order versions do not return subtotal.
      subtotal: result?.subtotal ?? Number(result?.total || 0) - Number(result?.delivery_fee || 0),
      delivery_fee: result?.delivery_fee ?? 0,
      total: result?.total ?? 0
    };
    const telegramNotificationSent = await sendTelegramOrderNotification(notificationBody, orderNumber);

    return new Response(JSON.stringify({
      ...(result && typeof result === 'object' ? result : { order_number: orderNumber }),
      telegram_notification_sent: telegramNotificationSent
    }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Invalid request.'
    }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }
};
