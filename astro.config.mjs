// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

const cleverToysScale = {
  name: 'clever-toys-scale',
  hooks: {
    'astro:config:setup': ({ injectScript }) => {
      injectScript('page', `(() => {
        if (location.pathname.startsWith('/admin')) return;
        if (document.head.querySelector('link[data-clever-toys-scale]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/site-scale.css?v=20260916-1';
        link.dataset.cleverToysScale = 'true';
        document.head.appendChild(link);
      })();`);
    }
  }
};

export default defineConfig({
  site: 'https://clevertoys.hadidib97.workers.dev',
  output: 'server',
  adapter: cloudflare(),
  integrations: [cleverToysScale]
});