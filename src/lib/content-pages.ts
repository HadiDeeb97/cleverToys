/**
 * Content pages from Admin → Pages (table "pages", supabase/cms.sql).
 * About, Privacy, Terms and Shipping & returns keep their addresses (/about …); pages you create
 * live at /pages/<address>. Before cms.sql is run, getContentPage returns null and the built-in
 * pages show their original text.
 */
import { supabase } from './supabase';

export type ContentPage = { id: string; slug: string; title: string; intro: string | null; body: string; is_published: boolean; show_in_footer: boolean; is_system: boolean; updated_at: string };

/** Built-in pages and the address they are shown at. */
export const SYSTEM_PAGE_PATHS: Record<string, string> = { about: '/about', privacy: '/privacy', terms: '/terms', 'shipping-returns': '/shipping-returns' };
export const pagePath = (slug: string) => SYSTEM_PAGE_PATHS[slug] || `/pages/${slug}`;

export async function getContentPage(slug: string): Promise<ContentPage | null> {
  try {
    const { data, error } = await supabase.from('pages').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
    return error ? null : ((data as ContentPage | null) ?? null);
  } catch {
    return null;
  }
}
