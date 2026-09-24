/**
 * POST /api/analytics/track: records a page view or heartbeat from public/visitor-analytics.js
 * for Admin → Visitors. Visitors are identified only by a random id; the country comes from Cloudflare
 * and no names, emails or IP addresses are stored.
 */
import type { APIRoute } from 'astro';
import { supabaseConfig } from '../../../lib/config';

const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const payload = {
      p_visitor_id: clean(body?.visitorId, 120),
      p_session_id: clean(body?.sessionId, 120),
      p_path: clean(body?.path || '/', 500) || '/',
      p_referrer: clean(body?.referrer, 1000) || null,
      p_country: clean((request as any).cf?.country || request.headers.get('CF-IPCountry'), 10) || null,
      p_device: clean(body?.device || 'unknown', 30),
      p_browser: clean(body?.browser || 'unknown', 40),
      p_os: clean(body?.os || 'unknown', 40),
      p_event_type: body?.eventType === 'heartbeat' ? 'heartbeat' : 'pageview'
    };

    if (!payload.p_visitor_id || !payload.p_session_id) {
      return new Response(JSON.stringify({ ok: false }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    const { url: base, key } = supabaseConfig();
    if (!base || !key) return new Response(JSON.stringify({ ok: false }), { status: 503, headers: { 'content-type': 'application/json' } });

    const response = await fetch(`${base.replace(/\/$/, '')}/rest/v1/rpc/track_visitor`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Analytics RPC failed: ${response.status}`);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  }
};
