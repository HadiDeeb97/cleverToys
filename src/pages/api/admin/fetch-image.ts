/**
 * POST /api/admin/fetch-image  { url }: downloads a photo from another website for the admin panel.
 *
 * Browsers are usually not allowed to read pictures from other sites, so the Excel import and the
 * "Copy photos to my storage" tool (src/pages/admin/index.astro) ask the server to fetch them. The
 * browser then resizes the photo, converts it to WebP and uploads it to the store's own storage, so
 * the site never depends on someone else's website for its photos.
 *
 * Only signed-in staff who can edit products may use it, only http(s) addresses on the public
 * internet are fetched, and only real pictures (checked by their first bytes) up to 20 MB come back.
 */
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../../../lib/config';

const MAX_BYTES = 20 * 1024 * 1024;
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/** localhost, private networks and bare IP addresses are never fetched. */
function blockedHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h.includes(':')) return true; // IPv6 literal
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** The picture type from the file's first bytes (servers often send the wrong content type). */
function pictureType(b: Uint8Array) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && /^(avif|avis)$/.test(ascii(8, 12))) return 'image/avif';
  return '';
}

/** Reads the body, stopping once it is bigger than MAX_BYTES. */
async function readLimited(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error('The photo is bigger than 20 MB.'); }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/.test(auth)) return json({ error: 'Please sign in again.' }, 401);
  const { url, key } = supabaseConfig();
  if (!url || !key) return json({ error: 'Supabase server configuration is missing.' }, 500);

  // Same permission as editing products (older databases without roles: any admin).
  const supabase = createClient(url, key, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  let allowed = await supabase.rpc('admin_has', { p_perm: 'products' });
  if (allowed.error) allowed = await supabase.rpc('is_admin');
  if (allowed.error || allowed.data !== true) return json({ error: 'Only staff who can edit products can copy photos.' }, 403);

  let target: URL;
  try {
    const body = await request.json() as { url?: unknown };
    target = new URL(String(body.url ?? '').trim());
  } catch {
    return json({ error: 'That is not a valid web address.' }, 400);
  }
  if (!/^https?:$/.test(target.protocol) || target.username || target.password || blockedHost(target.hostname)) return json({ error: 'That web address cannot be used.' }, 400);

  try {
    const response = await fetch(target.toString(), {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; CleverToysPhotoImport/1.0)', accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) return json({ error: `The other website answered ${response.status}${response.status === 404 ? ' (photo not found)' : ''}.` }, 502);
    const bytes = await readLimited(response);
    const type = pictureType(bytes);
    if (!type) return json({ error: 'That address is not a JPG, PNG, GIF, WebP or AVIF picture.' }, 415);
    return new Response(bytes, { status: 200, headers: { 'content-type': type, 'cache-control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return json({ error: /timeout|abort/i.test(message) ? 'The other website took too long to answer.' : message || 'The photo could not be downloaded.' }, 502);
  }
};
