// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://clevertoyslb.com',
  output: 'server',
  adapter: cloudflare(),
  // The store keeps no server-side sessions (sign-in is Supabase, in the browser). Without this the
  // Cloudflare adapter adds a "SESSION" KV storage binding to the Worker, and a deploy fails if that
  // storage is ever deleted in the Cloudflare dashboard.
  session: false
});
