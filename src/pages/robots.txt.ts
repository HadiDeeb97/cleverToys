import type { APIRoute } from 'astro';
import { supabase } from '../lib/supabase';
import { DEFAULT_DISALLOW, cleanRobotsLines, parseSeoSettings } from '../lib/seo';

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin || 'https://clevertoys.hadidib97.workers.dev';
  let extra: string[] = [];
  try {
    const { data } = await supabase.from('store_settings').select('*').eq('id', 'default').maybeSingle();
    extra = cleanRobotsLines(parseSeoSettings(data?.seo).robots_extra);
  } catch {}
  const body = ['User-agent: *', 'Allow: /', ...DEFAULT_DISALLOW.map((p) => `Disallow: ${p}`), ...(extra.length ? ['', '# Custom rules from Admin → SEO', ...extra] : []), '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=900' } });
};
