import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { env } from 'cloudflare:workers';

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

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body?.customer_name || !body?.customer_phone || !Array.isArray(body.items) || body.items.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required order information.' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    }

    const url = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || '';
    const key = env.SUPABASE_PUBLISHABLE_KEY || env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
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
      // Prefer server-calculated amounts; older create_order versions do not return subtotal.
      subtotal: result?.subtotal ?? (result?.total != null && result?.delivery_fee != null ? Number(result.total) - Number(result.delivery_fee) : body.subtotal),
      delivery_fee: result?.delivery_fee ?? body.delivery_fee,
      total: result?.total ?? body.total
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
