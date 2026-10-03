/**
 * "Continue with Google" on /login and /register.
 *
 * The button only appears once Google sign-in is switched on in Supabase (Authentication → Providers →
 * Google), so the pages never show a button that does not work. Google sends the shopper back to
 * /login?oauth=1, which finishes signing in (see src/pages/login.astro).
 * A first Google sign-in creates the account (and its customer profile, with the name from Google);
 * an existing account with the same email is the same account.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Shows the Google button when the provider is enabled and starts the sign-in when it is pressed. */
export async function setupGoogleSignIn(supabase: SupabaseClient<any, any, any>, url: string, key: string, next = '') {
  const box = document.getElementById('google-box');
  const button = document.getElementById('google-signin') as HTMLButtonElement | null;
  const msg = document.getElementById('message');
  if (!box || !button) return;
  try {
    const settings = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: key } }).then((r) => r.json());
    if (!settings?.external?.google) return;
  } catch { return; }
  box.hidden = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    if (msg) msg.textContent = 'Opening Google…';
    const back = new URL('/login', location.origin);
    back.searchParams.set('oauth', '1');
    if (next) back.searchParams.set('next', next);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: back.href, queryParams: { prompt: 'select_account' } } });
    if (error) {
      button.disabled = false;
      if (msg) msg.textContent = 'Could not open Google sign-in. Please try again.';
    }
  });
}

/** The button and the "or" line, placed at the top of the sign-in and register forms. */
export const GOOGLE_ICON = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';
