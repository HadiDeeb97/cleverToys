/**
 * Reads the Supabase URL and public (publishable) key from the Cloudflare environment.
 * Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the Worker settings (or .dev.vars locally).
 */
import { env } from 'cloudflare:workers';

type WorkerVars = Record<string, string | undefined>;

/** Supabase project URL (no trailing slash) and publishable key from the Worker environment. */
export const supabaseConfig = () => {
  const vars = env as unknown as WorkerVars;
  const url = (vars.SUPABASE_URL || vars.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = vars.SUPABASE_PUBLISHABLE_KEY || vars.SUPABASE_KEY || vars.PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  return { url, key };
};
