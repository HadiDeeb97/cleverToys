import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { env } from 'cloudflare:workers';

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const money = (value: unknown) => `$${Number(value || 0).toFixed(2)}`;

const buildOrderEmail = (body: any, orderNumber: string) => {
  const items = Array.isArray(body.items) ? body.items : [];
  const itemRows = items.map((item: any) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb">${escapeHtml(item.name)}${item.variantName ? `<div style="font-size:12px;color:#64748b;margin-top:3px">Option: ${escapeHtml(item.variantName)}</div>` : ''}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center">${escapeHtml(item.quantity)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right">${money(item.price)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right">${money(Number(item.price || 0) * Number(item.quantity || 0))}</td>
    </tr>`).join('');

  const timestamp = new Date().toLocaleString('en-LB', { timeZone: 'Asia/Beirut' });
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <div style="max-width:720px;margin:0 auto;padding:24px">
    <div style="background:#111827;color:#fff;padding:24px;border-radius:16px 16px 0 0">
      <div style="font-size:13px;opacity:.75;letter-spacing:.08em;text-transform:uppercase">Clever Toys</div>
      <h1 style="margin:8px 0 4px;font-size:26px">New order received</h1>
      <div style="font-size:15px">Order <strong>#${escapeHtml(orderNumber)}</strong></div>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px">
      <h2 style="margin:0 0 14px;font-size:18px">Customer information</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#64748b;width:150px">Name</td><td style="padding:6px 0"><strong>${escapeHtml(body.customer_name)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Phone</td><td style="padding:6px 0">${escapeHtml(body.customer_phone)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Email</td><td style="padding:6px 0">${escapeHtml(body.customer_email || 'Not provided')}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Governorate</td><td style="padding:6px 0">${escapeHtml(body.governorate)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">City</td><td style="padding:6px 0">${escapeHtml(body.city)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Area</td><td style="padding:6px 0">${escapeHtml(body.area || 'Not provided')}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;vertical-align:top">Address</td><td style="padding:6px 0">${escapeHtml(body.address)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;vertical-align:top">Notes</td><td style="padding:6px 0">${escapeHtml(body.notes || 'None')}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Payment</td><td style="padding:6px 0">Cash on delivery</td></tr>
      </table>

      <h2 style="margin:28px 0 14px;font-size:18px">Items</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="background:#f8fafc"><th style="padding:10px;text-align:left">Product</th><th style="padding:10px;text-align:center">Qty</th><th style="padding:10px;text-align:right">Unit price</th><th style="padding:10px;text-align:right">Line total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div style="margin-top:18px;padding-top:18px;border-top:2px solid #111827">
        <div style="display:flex;justify-content:space-between;margin:6px 0"><span>Subtotal</span><strong>${money(body.subtotal)}</strong></div>
        <div style="display:flex;justify-content:space-between;margin:6px 0;font-size:18px"><span><strong>Total</strong></span><strong>${money(body.total)}</strong></div>
      </div>

      <div style="margin-top:24px;padding:14px;background:#f8fafc;border-radius:12px;color:#475569;font-size:13px">
        Order received at ${escapeHtml(timestamp)} (Lebanon time).
      </div>
    </div>
  </div></body></html>`;
};

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

    const result = Array.isArray(data) ? data[0] : data;
    const orderNumber = result?.order_number || result?.orderNumber || 'New Order';

    const resendApiKey = env.RESEND_API_KEY;
    const adminEmail = env.ADMIN_ORDER_EMAIL;
    const fromEmail = env.RESEND_FROM_EMAIL;
    let emailNotificationSent = false;

    if (resendApiKey && adminEmail && fromEmail) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [adminEmail],
            ...(body.customer_email ? { reply_to: body.customer_email } : {}),
            subject: `New Clever Toys order #${orderNumber} — ${body.customer_name}`,
            html: buildOrderEmail(body, orderNumber)
          })
        });

        if (!emailResponse.ok) {
          console.error('Order email notification failed:', await emailResponse.text());
        } else {
          emailNotificationSent = true;
        }
      } catch (emailError) {
        console.error('Order email notification error:', emailError);
      }
    } else {
      console.warn('Order email notification is not configured. Expected RESEND_API_KEY, ADMIN_ORDER_EMAIL and RESEND_FROM_EMAIL.');
    }

    return new Response(JSON.stringify({
      ...(result && typeof result === 'object' ? result : { order_number: orderNumber }),
      email_notification_sent: emailNotificationSent
    }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid request.' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
};
