import type { MiddlewareHandler } from 'astro';
import { env } from 'cloudflare:workers';

const safeHex = (value: string | null) => {
  const match = value?.match(/^#[0-9a-fA-F]{6}$/);
  return match ? match[0].toLowerCase() : null;
};

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
  const storeScript = '<script src="/store-ui.js?v=20260915" defer></script>';
  const adminBrandingLink = path.startsWith('/admin') && !path.startsWith('/admin/branding') ? '<a href="/admin/branding">Branding</a>' : '';
  let output = html;

  if (logoUrl && !path.startsWith('/admin')) {
    const logoMarkup = `<img class="site-logo-image" src="${escapeAttr(logoUrl)}" alt="Clever Toys" decoding="async"><span class="logo-text">Clever Toys</span>`;
    output = output.replace(/<a([^>]*class=[\"']logo[\"'][^>]*)>[\s\S]*?<\/a>/gi, `<a$1>${logoMarkup}</a>`);
  }

  if (!output.includes('/store-ui.js')) output = output.replace('</head>', `${earlyTheme}${storeConfig}${storeScript}</head>`);

  if (!path.startsWith('/admin')) {
    const whatsappHref = 'https://wa.me/96171220251?text=Hello%2C%20I%27m%20interested%20with%20your%20product';
    const floatingStyles = `<style id="clever-floating-styles">.clever-floating-controls{position:fixed;inset:0;pointer-events:none;z-index:10000}.clever-floating-cart,.clever-floating-whatsapp{position:fixed;bottom:20px;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;text-decoration:none;pointer-events:auto;box-shadow:0 10px 26px rgba(15,23,42,.22);transition:transform .2s,box-shadow .2s}.clever-floating-cart{right:20px;background:var(--brand-primary,#111827);color:var(--brand-text-on-primary,#fff)}.clever-floating-whatsapp{left:20px;background:#25D366;color:#fff}.clever-floating-cart:hover,.clever-floating-whatsapp:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(15,23,42,.27)}.clever-floating-cart .floating-cart-icon{font-size:25px;line-height:1}.clever-floating-cart .floating-cart-count{position:absolute;right:-2px;top:-2px;min-width:21px;height:21px;padding:0 5px;border-radius:999px;display:grid;place-items:center;background:#fff;color:var(--brand-primary,#111827);font-size:11px;font-weight:800;line-height:1}.clever-floating-whatsapp svg{width:30px;height:30px;display:block}.clever-floating-controls .floating-cart-count[hidden]{display:none}@media(max-width:640px){.clever-floating-cart,.clever-floating-whatsapp{bottom:calc(14px + env(safe-area-inset-bottom));width:54px;height:54px}.clever-floating-cart{right:14px}.clever-floating-whatsapp{left:14px}.clever-floating-cart .floating-cart-icon{font-size:23px}.clever-floating-whatsapp svg{width:28px;height:28px}}</style>`;
    const controls = `<div class="clever-floating-controls" aria-hidden="false"><a id="clever-floating-cart" class="clever-floating-cart" href="/cart" title="View your cart" aria-label="Shopping cart"><span class="floating-cart-icon" aria-hidden="true">🛒</span><span class="floating-cart-count" aria-hidden="true" hidden>0</span></a><a id="clever-floating-whatsapp" class="clever-floating-whatsapp" href="${whatsappHref}" target="_blank" rel="noopener noreferrer" aria-label="Chat with Clever Toys on WhatsApp" title="Chat with us on WhatsApp"><svg viewBox="0 0 32 32" focusable="false" aria-hidden="true"><path d="M16 3.2C9.1 3.2 3.5 8.8 3.5 15.7c0 2.2.6 4.4 1.8 6.3L3.2 28.8l6.9-2.1c1.8 1 3.8 1.5 5.9 1.5 6.9 0 12.5-5.6 12.5-12.5S22.9 3.2 16 3.2Zm0 22.8c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-4.1 1.2 1.2-4-.3-.4c-1-1.6-1.5-3.5-1.5-5.4C5.5 9.9 10.2 5.2 16 5.2s10.5 4.7 10.5 10.5S21.8 26 16 26Zm5.8-7.8c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.7-1.7-2-.2-.3 0-.5.1-.7.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z" fill="currentColor"/></svg></a></div>`;
    if (!output.includes('clever-floating-controls')) output = output.replace('</body>', `${floatingStyles}${controls}</body>`);
  }

  if (adminBrandingLink && output.includes('</nav>') && !output.includes('/admin/branding')) output = output.replace('</nav>', `${adminBrandingLink}</nav>`);

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');
  return new Response(output, { status: response.status, statusText: response.statusText, headers });
};
