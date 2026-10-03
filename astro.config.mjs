// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://clevertoyslb.com',
  output: 'server',
  adapter: cloudflare()
});
