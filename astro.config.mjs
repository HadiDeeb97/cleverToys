// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://clevertoys.hadidib97.workers.dev',
  output: 'server',
  adapter: cloudflare()
});