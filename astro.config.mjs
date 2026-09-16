// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

const cleverToysScale = {
  name: 'clever-toys-scale',
  hooks: {
    'astro:config:setup': ({ injectScript }) => {
      injectScript('page', `(() => {
        const path = location.pathname.replace(/\\/+$/, '') || '/';
        const excluded = path === '/' || path === '/admin' || path.startsWith('/admin/') || path === '/products' || path.startsWith('/category');
        if (!excluded && !document.head.querySelector('link[data-clever-toys-scale]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = '/site-scale.css?v=20260916-4';
          link.dataset.cleverToysScale = 'true';
          document.head.appendChild(link);
        }
        if (!document.head.querySelector('link[data-clever-floating-cart-fix]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = '/floating-cart-fix.css?v=20260916-1';
          link.dataset.cleverFloatingCartFix = 'true';
          document.head.appendChild(link);
        }
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