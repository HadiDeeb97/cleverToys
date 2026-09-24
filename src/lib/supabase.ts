/**
 * Server-side Supabase client used by pages while they render (public, read-only access).
 */
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './config';

const { url: supabaseUrl, key: supabaseKey } = supabaseConfig();

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Supabase configuration is missing. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or the PUBLIC_ versions) in the Cloudflare Worker environment.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
