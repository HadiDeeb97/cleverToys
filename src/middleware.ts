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
  const cookieHeader = context.request.headers.get('cookie') || '';
  const themeMatch = cookieHeader.match(/(?:^|;\s*)cleverTheme=([^;]+)/);
  const cookieTheme = safeHex(themeMatch ? decodeURIComponent(themeMatch[1]) : null);

  const storeConfig = `<script>window.__CLEVER_BRANDING__=${JSON.stringify({ logoUrl, storeName: 'Clever Toys', theme: cookieTheme })};</script>`;
  const earlyTheme = cookieTheme ? `<style id="clever-theme">:root{--brand-primary:${cookieTheme};}</style>` : '';
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

  if (!path.startsWith('/admin')) {
    const whatsappHref = 'https://wa.me/96171220251?text=Hello%2C%20I%27m%20interested%20with%20your%20product';
    const whatsappBubble = `<a class="whatsapp-bubble" href="${whatsappHref}" target="_blank" rel="noopener noreferrer" aria-label="Chat with Clever Toys on WhatsApp" title="Chat with us on WhatsApp"><span class="whatsapp-icon" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path d="M16 3.2C9.1 3.2 3.5 8.8 3.5 15.7c0 2.2.6 4.4 1.8 6.3L3.2 28.8l6.9-2.1c1.8 1 3.8 1.5 5.9 1.5 6.9 0 12.5-5.6 12.5-12.5S22.9 3.2 16 3.2Zm0 22.8c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-4.1 1.2 1.2-4-.3-.4c-1-1.6-1.5-3.5-1.5-5.4C5.5 9.9 10.2 5.2 16 5.2s10.5 4.7 10.5 10.5S21.8 26 16 26Zm5.8-7.8c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.7-1.7-2-.2-.3 0-.5.1-.7.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.3 1.3.5 1.7.7.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z" fill="currentColor"/></svg></span></a>`;
    const whatsappStyles = `<style id="clever-whatsapp-styles">.whatsapp-bubble{position:fixed;left:20px;bottom:20px;z-index:1000;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:#25D366;color:#fff;box-shadow:0 10px 26px rgba(15,23,42,.22);text-decoration:none}.whatsapp-bubble:hover{transform:translateY(-3px)}.whatsapp-icon,.whatsapp-icon svg{width:30px;height:30px}@media(max-width:640px){.whatsapp-bubble{left:14px;bottom:14px;width:54px;height:54px}.whatsapp-icon,.whatsapp-icon svg{width:28px;height:28px}}</style>`;
    if (!output.includes('whatsapp-bubble')) output = output.replace('</body>', `${whatsappStyles}${whatsappBubble}</body>`);
  }

  if (adminBrandingLink && output.includes('</nav>') && !output.includes('/admin/branding')) {
    output = output.replace('</nav>', `${adminBrandingLink}</nav>`);
  }

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');
  return new Response(output, { status: response.status, statusText: response.statusText, headers });
};
