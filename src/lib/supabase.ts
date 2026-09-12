import { createClient } from '@supabase/supabase-js';
import { env } from 'cloudflare:workers';

const supabaseUrl =
  import.meta.env.PUBLIC_SUPABASE_URL ||
  (env as Record<string, string | undefined>).SUPABASE_URL ||
  (env as Record<string, string | undefined>).PUBLIC_SUPABASE_URL;

const supabaseKey =
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  (env as Record<string, string | undefined>).SUPABASE_PUBLISHABLE_KEY ||
  (env as Record<string, string | undefined>).SUPABASE_KEY ||
  (env as Record<string, string | undefined>).PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Supabase configuration is missing. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY, or SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the Cloudflare Worker environment.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
