// Shared Supabase client for storefront pages that only need it in the background
// (for example to prefill checkout for signed-in customers).
//
// The library (~50 KB) is loaded on first use instead of up front, so buttons on the page
// work immediately even on slow phones. The URL and public key come from a hidden
// <div id="auth-config" data-url=… data-key=…> that the page renders on the server.
import type { SupabaseClient } from '@supabase/supabase-js';

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  clientPromise ??= (async () => {
    const config = document.querySelector<HTMLElement>('#auth-config');
    const url = config?.dataset.url;
    const key = config?.dataset.key;
    if (!url || !key) return null;
    try {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    } catch (error) {
      console.warn('Supabase client could not be loaded', error);
      return null;
    }
  })();
  return clientPromise;
}

/** The signed-in customer's session, or null for guests. */
export async function getSession() {
  const supabase = await getSupabase();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
}
