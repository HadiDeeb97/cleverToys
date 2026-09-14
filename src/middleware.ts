import type { MiddlewareHandler } from 'astro';
import { env } from 'cloudflare:workers';

const safeHex = (value: string | null) => {
  const match = value?.match(/^#[0-9a-fA-F]{6}$/);
  return match ? match[0].toLowerCase() : null;
};

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const onRequest: MiddlewareHandler = async (context, next) => {
  const response = await next();
  const contentType = response.headers.get('content-type');
  if (!contentType?.toLowerCase().includes('text/html')) return response;

  const html = await response.text();
  const path = context.url.pathname;
  const base = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || '';
  const logoUrl = base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/product-images/branding/logo.webp` : '';
  const cookieTheme = safeHex(context.request.headers.get('cookie')?.match(/(?:^|;\s*)cleverTheme=([^;]+)/)?.[1] ? decodeURIComponent(context.request.headers.get('cookie')!.match(/(?:^|;\s*)cleverTheme=([^;]+)/)![1]) : null);

  const storeConfig = `<script>window.__CLEVER_BRANDING__=${JSON.stringify({ logoUrl, storeName: 'Clever Toys', theme: cookieTheme })};</script>`;
  const earlyTheme = cookieTheme
    ? `<style id="clever-theme">:root{--brand-primary:${cookieTheme};}</style>`
    : '';
  const storeScript = '<script src="/store-ui.js" defer></script>';
  const adminBrandingLink = path.startsWith('/admin') && !path.startsWith('/admin/branding')
    ? '<a href="/admin/branding">Branding</a>'
    : '';

  let output = html;

  if (logoUrl && !path.startsWith('/admin')) {
    const logoMarkup = `<img class="site-logo-image" src="${escapeAttr(logoUrl)}" alt="Clever Toys" decoding="async"><span class="logo-text">Clever Toys</span>`;
    output = output.replace(/<a([^>]*class=["']logo["'][^>]*)>[\s\S]*?<\/a>/gi, `<a$1>${logoMarkup}</a>`);
  }

  if (!output.includes('/store-ui.js')) {
    output = output.replace('</head>', `${earlyTheme}${storeConfig}${storeScript}</head>`);
  }

  if (adminBrandingLink && output.includes('</nav>') && !output.includes('/admin/branding')) {
    output = output.replace('</nav>', `${adminBrandingLink}</nav>`);
  }

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');
  return new Response(output, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};
