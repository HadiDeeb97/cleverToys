/**
 * Data that every storefront page needs, loaded once per request by src/middleware.ts:
 * store settings (Admin → Branding and Admin → Storefront), the published theme, the page's
 * SEO row and the category list for the menus.
 *
 * The middleware starts this before the page renders and shares the promise through
 * Astro.locals.pageData, so pages can use the same data without asking Supabase again:
 *   const { design, categories } = await getPageData(Astro);
 */
import { supabaseConfig } from './config';
import { parseDesign, type StoreDesign } from './design';

export const DEFAULT_WHATSAPP_URL = 'https://wa.me/96171220251?text=Hello%20Clever%20Toys%21%20I%20have%20a%20question%20about%20your%20toys.';

export const defaultStoreSettings: Record<string, any> = {
  whatsapp_url: DEFAULT_WHATSAPP_URL,
  instagram_url: '',
  show_whatsapp: true,
  show_instagram: false,
  ribbon_text: '',
  show_ribbon: false,
  cod_delivery_price: 0,
  free_delivery_threshold: 0
};

const safeHex = (value: unknown) => {
  const match = String(value ?? '').match(/^#[0-9a-fA-F]{6}$/);
  return match ? match[0].toLowerCase() : null;
};

export type PublishedTheme = { mode: string; theme: null | { primary: string; primary2?: string; soft: string; accent: string; id?: string; name?: string } };

/** Accepts the published theme payload ({ mode, theme: { primary, soft, accent } }). Anything invalid is ignored. */
export const parseTheme = (d: any): PublishedTheme | null => {
  if (d?.mode === 'theme' && safeHex(d?.theme?.primary) && safeHex(d?.theme?.soft) && safeHex(d?.theme?.accent)) {
    return {
      mode: 'theme',
      theme: {
        primary: safeHex(d.theme.primary)!,
        // Optional gradient end color; themes without it render solid.
        primary2: safeHex(d.theme.primary2) || undefined,
        soft: safeHex(d.theme.soft)!,
        accent: safeHex(d.theme.accent)!,
        id: typeof d.theme.id === 'string' ? d.theme.id : undefined,
        name: typeof d.theme.name === 'string' ? d.theme.name : undefined
      }
    };
  }
  return d?.mode === 'logo' ? { mode: 'logo', theme: null } : null;
};

export type MenuCategory = { name: string; slug: string; image_url: string | null };
export type PageData = { storeSettings: Record<string, any>; published: PublishedTheme; seo: any; design: StoreDesign; categories: MenuCategory[] };

/**
 * Loads the store settings (Admin → Branding), the published theme and the page's SEO row.
 * Never throws: if Supabase is unreachable the page still renders with defaults.
 * Always read fresh (no caching), so changes in the admin panel show up on the next page load.
 */
export async function loadPageData(path: string): Promise<PageData> {
  const { url: base, key } = supabaseConfig();
  const data: PageData = { storeSettings: { ...defaultStoreSettings }, published: { mode: 'logo', theme: null }, seo: null, design: parseDesign(null), categories: [] };
  if (!base || !key) return data;
  const rest = `${base.replace(/\/$/, '')}/rest/v1`;
  const init = { headers: { apikey: key, Authorization: `Bearer ${key}` }, cf: { cacheTtl: 0, cacheEverything: false } };

  const loadSettings = async () => {
    try {
      // select=* so a missing optional column (e.g. before a migration) does not break the whole query.
      const r = await fetch(`${rest}/store_settings?select=*&id=eq.default&limit=1`, init);
      const row = r.ok ? (await r.json())?.[0] : null;
      if (row) data.storeSettings = { ...defaultStoreSettings, ...row };
      data.design = parseDesign(row?.design);
      let theme = parseTheme(row?.theme);
      // Very old setups published the theme as a JSON file in storage; only look there if the database has none.
      if (!theme) {
        const file = await fetch(`${base.replace(/\/$/, '')}/storage/v1/object/public/product-images/branding/theme.json?theme=${Date.now()}`, { cf: { cacheTtl: 0, cacheEverything: false } }).catch(() => null);
        if (file?.ok) theme = parseTheme(JSON.parse(await file.text()));
      }
      if (theme) data.published = theme;
    } catch {}
  };

  const loadSeo = async () => {
    if (path.startsWith('/admin')) return;
    try {
      // One request for the exact page and, on product/category pages, the fallback template; the exact page wins.
      const wildcard = path.startsWith('/product/') ? '/product/*' : path.startsWith('/category/') ? '/category/*' : '';
      const keys = [path, ...(wildcard ? [wildcard] : [])].map((k) => `"${k.replace(/["\\]/g, '')}"`).join(',');
      const r = await fetch(`${rest}/seo_pages?select=*&path_key=in.(${encodeURIComponent(keys)})`, init);
      if (!r.ok) return;
      const rows: any[] = await r.json();
      data.seo = rows.find((row) => row.path_key === path) || rows.find((row) => row.path_key === wildcard) || null;
    } catch {}
  };

  // Active categories for the header menu, mobile menu and footer (storefront pages only).
  const loadCategories = async () => {
    if (path.startsWith('/admin')) return;
    try {
      const r = await fetch(`${rest}/categories?select=name,slug,image_url&is_active=eq.true&order=sort_order.asc`, init);
      if (r.ok) data.categories = ((await r.json()) as MenuCategory[]).filter((c) => c && c.slug && c.name);
    } catch {}
  };

  await Promise.all([loadSettings(), loadSeo(), loadCategories()]);
  return data;
}


/** The data the middleware already loaded for this request (or a fresh load if it is missing). */
export function getPageData(astro: { locals: App.Locals; url: URL }): Promise<PageData> {
  return astro.locals.pageData ?? loadPageData(astro.url.pathname);
}
