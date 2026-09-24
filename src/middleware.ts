import type { MiddlewareHandler } from 'astro';
import { env } from 'cloudflare:workers';

const safeHex = (value: unknown) => {
  const match = String(value ?? '').match(/^#[0-9a-fA-F]{6}$/);
  return match ? match[0].toLowerCase() : null;
};

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
const safeExternalUrl = (value: unknown, fallback: string) => /^https?:\/\//i.test(String(value ?? '').trim()) ? String(value).trim() : fallback;

// Pick whichever text color (white or dark ink) reads better on a theme color.
const readableText = (hex: string) => {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (value: string) => {
    const n = parseInt(value.slice(1), 16);
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  };
  const color = luminance(hex);
  const onWhite = 1.05 / (color + 0.05);
  const onInk = (color + 0.05) / (luminance('#1b1530') + 0.05);
  return onWhite >= 4.5 || onWhite >= onInk ? '#ffffff' : '#1b1530';
};

const themeVariables = (theme: { primary: string; soft: string; accent: string }) =>
  `--brand-primary:${theme.primary};--brand-primary-hover:color-mix(in srgb,${theme.primary} 86%,#000);--brand-soft:${theme.soft};--theme-accent:${theme.accent};--brand-text-on-primary:${readableText(theme.primary)};--theme-text-on-accent:${readableText(theme.accent)}`;

const fallbackWhatsappUrl = 'https://wa.me/96171220251?text=Hello%2C%20I%27m%20interested%20with%20your%20product';
const defaultStoreSettings = {
  whatsapp_url: fallbackWhatsappUrl,
  instagram_url: '',
  show_whatsapp: true,
  show_instagram: false,
  ribbon_text: '',
  show_ribbon: false,
  cod_delivery_price: 0,
  free_delivery_threshold: 0
};

export const onRequest: MiddlewareHandler = async (context, next) => {
  const response = await next();
  const contentType = response.headers.get('content-type');
  if (!contentType?.toLowerCase().includes('text/html')) return response;

  const html = await response.text();
  const path = context.url.pathname;
  const base = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || '';
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  const logoUrl = base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/product-images/branding/logo.webp` : '';
  const themeUrl = base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/product-images/branding/theme.json` : '';
  let published = { mode: 'logo', theme: null as null | { primary: string; soft: string; accent: string; id?: string; name?: string } };
  let storeSettings = { ...defaultStoreSettings };

  const loadTheme = async () => {
    if (!themeUrl) return;
    try {
      const cacheBust = `?theme=${Date.now()}`;
      const r = await fetch(`${themeUrl}${cacheBust}`, { cf: { cacheTtl: 0, cacheEverything: false } });
      if (r.ok) {
        const raw = await r.text();
        const d = JSON.parse(raw) as any;
        if (d?.mode === 'theme' && safeHex(d?.theme?.primary) && safeHex(d?.theme?.soft) && safeHex(d?.theme?.accent)) {
          published = {
            mode: 'theme',
            theme: {
              primary: safeHex(d.theme.primary)!,
              soft: safeHex(d.theme.soft)!,
              accent: safeHex(d.theme.accent)!,
              id: typeof d.theme.id === 'string' ? d.theme.id : undefined,
              name: typeof d.theme.name === 'string' ? d.theme.name : undefined
            }
          };
        } else if (d?.mode === 'logo') {
          published = { mode: 'logo', theme: null };
        }
      }
    } catch {}
  };

  const loadStoreSettings = async () => {
    if (path.startsWith('/admin') || path.startsWith('/api') || !base || !publishableKey) return;
    try {
      const settingsResponse = await fetch(`${base.replace(/\/$/, '')}/rest/v1/store_settings?select=whatsapp_url,instagram_url,show_whatsapp,show_instagram,ribbon_text,show_ribbon,cod_delivery_price,free_delivery_threshold&id=eq.default&limit=1`, {
        headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      if (settingsResponse.ok) {
        const row = (await settingsResponse.json())?.[0];
        if (row) storeSettings = { ...defaultStoreSettings, ...row };
      }
    } catch {}
  };

  const loadSeo = async (): Promise<any> => {
    if (path.startsWith('/admin') || path.startsWith('/api') || !base || !publishableKey) return null;
    try {
      const encodedPath = encodeURIComponent(path);
      const encodedProduct = encodeURIComponent('/product/*');
      const encodedCategory = encodeURIComponent('/category/*');
      const query = `select=path_key,title,description,cover_image_url,keywords&path_key=eq.${encodedPath}&limit=1`;
      const exactResponse = await fetch(`${base.replace(/\/$/, '')}/rest/v1/seo_pages?${query}`, {
        headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      let seo: any = exactResponse.ok ? (await exactResponse.json())?.[0] || null : null;
      if (!seo && path.startsWith('/product/')) {
        const r = await fetch(`${base.replace(/\/$/, '')}/rest/v1/seo_pages?select=path_key,title,description,cover_image_url,keywords&path_key=eq.${encodedProduct}&limit=1`, {
          headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
          cf: { cacheTtl: 0, cacheEverything: false }
        });
        if (r.ok) seo = (await r.json())?.[0] || null;
      }
      if (!seo && path.startsWith('/category/')) {
        const r = await fetch(`${base.replace(/\/$/, '')}/rest/v1/seo_pages?select=path_key,title,description,cover_image_url,keywords&path_key=eq.${encodedCategory}&limit=1`, {
          headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
          cf: { cacheTtl: 0, cacheEverything: false }
        });
        if (r.ok) seo = (await r.json())?.[0] || null;
      }
      return seo;
    } catch {
      return null;
    }
  };

  const [, , seo] = await Promise.all([loadTheme(), loadStoreSettings(), loadSeo()]);

  const whatsappUrl = safeExternalUrl(storeSettings.whatsapp_url, fallbackWhatsappUrl);
  const instagramUrl = safeExternalUrl(storeSettings.instagram_url, 'https://instagram.com/');
  const showWhatsapp = Boolean(storeSettings.show_whatsapp) && Boolean(String(storeSettings.whatsapp_url || '').trim());
  const showInstagram = Boolean(storeSettings.show_instagram) && Boolean(String(storeSettings.instagram_url || '').trim());
  const ribbonText = String(storeSettings.ribbon_text || '').trim().slice(0, 180);
  const showRibbon = Boolean(storeSettings.show_ribbon) && Boolean(ribbonText);
  const codDeliveryPrice = Math.max(0, Number(storeSettings.cod_delivery_price || 0));

  const branding = {
    logoUrl,
    storeName: 'Clever Toys',
    theme: published.theme?.primary || null,
    useLogoColors: published.mode !== 'theme',
    publishedTheme: published.theme,
    whatsappUrl,
    instagramUrl,
    showWhatsapp,
    showInstagram,
    ribbonText,
    showRibbon,
    codDeliveryPrice,
    freeDeliveryThreshold: Math.max(0, Number(storeSettings.free_delivery_threshold || 0))
  };
  const storeConfig = `<script>window.__CLEVER_BRANDING__=${JSON.stringify(branding).replace(/</g, '\\u003c')};</script>`;
  const earlyTheme = published.mode === 'theme' && published.theme ? `<style id="clever-theme">:root{${themeVariables(published.theme)}}</style>` : '';
  const fontLinks = '<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800;900&display=swap" />';
  const storeScript = '<script src="/store-ui.js?v=20260924-1" defer></script><script src="/branding-ui.js?v=20260924-1" defer></script>';
  const adminBrandingLink = path.startsWith('/admin') && !path.startsWith('/admin/branding') ? '<a href="/admin/branding">Branding</a>' : '';
  const adminSeoLink = path.startsWith('/admin') && !path.startsWith('/admin/seo') ? '<a href="/admin/seo">SEO</a>' : '';
  let output = html;

  // Several page templates have no <head> or <body>. Give every page a real <head> so the theme,
  // fonts, scripts and meta tags below are always injected.
  if (!/<head[\s>]/i.test(output)) {
    output = /<!doctype html>/i.test(output) ? output.replace(/<!doctype html>/i, (match) => `${match}<head></head>`) : `<head></head>${output}`;
  }
  if (!/<meta\s+charset/i.test(output)) output = output.replace(/<head[^>]*>/i, (match) => `${match}<meta charset="utf-8" />`);
  if (!/<title>/i.test(output)) output = output.replace('</head>', '<title>Clever Toys Lebanon</title></head>');
  const appendToBody = (markup: string) => {
    output = output.includes('</body>') ? output.replace('</body>', `${markup}</body>`) : `${output}${markup}`;
  };

  if (!/<meta\s+name=[\"']viewport[\"'][^>]*>/i.test(output)) {
    const viewportTags = `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /><meta name="theme-color" content="${published.theme?.primary || '#2563eb'}" /><meta name="format-detection" content="telephone=no" />`;
    output = output.replace(/<head[^>]*>/i, (match) => `${match}${viewportTags}`);
  }
  output = output.replace(/<meta\s+name=["']theme-color["'][^>]*>/i, `<meta name="theme-color" content="${published.theme?.primary || '#2563eb'}" />`);

  if (seo) {
    const title = String(seo.title || '').trim();
    const description = String(seo.description || '').trim();
    const keywords = String(seo.keywords || '').trim();
    const cover = String(seo.cover_image_url || '').trim();
    output = output.replace(/<title>[\s\S]*?<\/title>/i, '');
    output = output.replace(/<meta\s+name=[\"']description[\"'][^>]*>\s*/gi, '');
    output = output.replace(/<meta\s+name=[\"']keywords[\"'][^>]*>\s*/gi, '');
    output = output.replace(/<meta\s+name=[\"']twitter:title[\"'][^>]*>\s*/gi, '');
    output = output.replace(/<meta\s+name=[\"']twitter:description[\"'][^>]*>\s*/gi, '');
    output = output.replace(/<meta\s+name=[\"']twitter:image[\"'][^>]*>\s*/gi, '');
    output = output.replace(/<meta\s+property=[\"']og:title[\"'][^>]*>\s*/gi, '');
    output = output.replace(/<meta\s+property=[\"']og:description[\"'][^>]*>\s*/gi, '');
    output = output.replace(/<meta\s+property=[\"']og:image[\"'][^>]*>\s*/gi, '');
    const seoTags = `${title ? `<title>${escapeHtml(title)}</title><meta name="title" content="${escapeAttr(title)}" />` : ''}${description ? `<meta name="description" content="${escapeAttr(description)}" />` : ''}${keywords ? `<meta name="keywords" content="${escapeAttr(keywords)}" />` : ''}${title ? `<meta property="og:title" content="${escapeAttr(title)}" /><meta name="twitter:title" content="${escapeAttr(title)}" />` : ''}${description ? `<meta property="og:description" content="${escapeAttr(description)}" /><meta name="twitter:description" content="${escapeAttr(description)}" />` : ''}${cover ? `<meta property="og:image" content="${escapeAttr(cover)}" /><meta name="twitter:image" content="${escapeAttr(cover)}" /><meta name="twitter:card" content="summary_large_image" />` : ''}`;
    output = output.replace('</head>', `${seoTags}</head>`);
  }

  if (!output.includes('/store-ui.js')) output = output.replace('</head>', `${fontLinks}${earlyTheme}${storeConfig}${storeScript}</head>`);

  if (!path.startsWith('/admin')) {
    const headerSocials = (showWhatsapp || showInstagram)
      ? `<span class="clever-header-socials" aria-label="Social links">${showWhatsapp ? `<a class="clever-header-social clever-header-whatsapp" href="${escapeAttr(whatsappUrl)}" target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="Chat with Clever Toys on WhatsApp"><svg class="clever-header-social-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13.25" fill="#25D366"/><path d="M11.5 9.8c-.35 0-.72.08-1.02.45-.4.45-1.3 1.27-1.3 3.1 0 1.82 1.33 3.57 1.52 3.81.19.25 2.55 3.99 6.21 5.42 3.07 1.2 3.69.96 4.35.9.66-.06 2.12-.87 2.42-1.71.3-.84.3-1.56.21-1.71-.09-.15-.35-.25-.74-.45-.39-.2-2.3-1.14-2.66-1.27-.36-.14-.63-.2-.89.2-.26.4-1.02 1.27-1.25 1.53-.23.26-.46.3-.85.1-.39-.2-1.65-.61-3.15-1.95-1.16-1.03-1.94-2.3-2.17-2.69-.23-.4-.02-.61.18-.81.18-.18.39-.46.58-.69.2-.23.26-.4.39-.65.13-.26.06-.49-.03-.69-.1-.2-.89-2.12-1.22-2.9-.32-.75-.66-.65-.89-.65h-.76Z" fill="#fff"/></svg></a>` : ''}${showInstagram ? `<a class="clever-header-social clever-header-instagram" href="${escapeAttr(instagramUrl)}" target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Clever Toys on Instagram"><svg class="clever-header-social-icon" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="clever-instagram-gradient-server" x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse"><stop stop-color="#FFDC80"/><stop offset=".35" stop-color="#F77737"/><stop offset=".67" stop-color="#E1306C"/><stop offset="1" stop-color="#833AB4"/></linearGradient></defs><rect x="5.25" y="5.25" width="21.5" height="21.5" rx="6" fill="none" stroke="url(#clever-instagram-gradient-server)" stroke-width="2.4"/><circle cx="16" cy="16" r="5" fill="none" stroke="url(#clever-instagram-gradient-server)" stroke-width="2.4"/><circle cx="22.4" cy="9.7" r="1.55" fill="#E1306C"/></svg></a>` : ''}</span>`
      : '';

    const ribbon = showRibbon
      ? `<div class="clever-ribbon" role="status"><div class="container">${escapeHtml(ribbonText)}</div></div>`
      : '';

    // Normalize the public storefront header and footer on every page so individual page
    // templates cannot produce different layouts, missing links, or overlapping mobile navigation.
    const active = (href: string) => path === href || (href !== '/' && path.startsWith(href + '/'));
    const currentAttr = (href: string) => active(href) ? ' aria-current="page"' : '';
    const navLink = (href: string, label: string) => `<a href="${href}"${currentAttr(href)}>${label}</a>`;
    const searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
    const accountIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
    const searchValue = path === '/products' ? escapeAttr(context.url.searchParams.get('q') || '') : '';
    const standardLogoMarkup = logoUrl
      ? `<img class="site-logo-image" src="${escapeAttr(logoUrl)}" alt="Clever Toys" decoding="async" onerror="this.hidden=true"><span class="logo-text">Clever Toys</span>`
      : '<span class="logo-text">Clever Toys</span>';
    const standardHeader = `<header class="site-header" data-clever-standard-header><div class="container header-inner"><a href="/" class="logo" aria-label="Clever Toys home">${standardLogoMarkup}</a><nav class="main-nav" aria-label="Main navigation">${navLink('/', 'Home')}${navLink('/products', 'Shop')}${navLink('/categories', 'Categories')}${navLink('/about', 'About')}${navLink('/contact', 'Contact')}</nav><form class="header-search" action="/products" method="get" role="search">${searchIcon}<label class="sr-only" for="header-search-input">Search toys</label><input id="header-search-input" name="q" type="search" value="${searchValue}" placeholder="Search toys…" autocomplete="off" /></form><div class="header-actions">${headerSocials}<a href="/products#product-search" class="header-icon-link header-search-link" aria-label="Search toys">${searchIcon}</a><a href="/account" class="header-icon-link header-account-link" aria-label="My account"${currentAttr('/account')}>${accountIcon}</a><a href="/cart" class="cart-link" aria-label="Shopping cart"><span class="cart-icon" aria-hidden="true">🛒</span><span class="cart-label">Cart</span><span class="cart-count-badge" aria-hidden="true" hidden>0</span></a></div></div></header>${ribbon}`;
    const headerPattern = /<header([^>]*class=["'][^"']*site-header[^"']*["'][^>]*)>[\s\S]*?<\/header>/i;
    if (headerPattern.test(output)) output = output.replace(headerPattern, () => standardHeader);
    else if (/<body[^>]*>/i.test(output)) output = output.replace(/<body[^>]*>/i, (match) => `${match}${standardHeader}`);
    else output = output.replace('</head>', () => `</head>${standardHeader}`);

    const year = new Date().getFullYear();
    const standardFooter = `<footer class="site-footer"><div class="container"><div class="footer-grid"><div class="footer-brand"><strong>Clever Toys</strong><p>Fun, educational and exciting toys for every stage of childhood, with cash on delivery across Lebanon.</p></div><div class="footer-col"><h2>Shop</h2><ul><li><a href="/products">All toys</a></li><li><a href="/categories">Categories</a></li><li><a href="/cart">Your cart</a></li></ul></div><div class="footer-col"><h2>Help</h2><ul><li><a href="/contact">Contact us</a></li><li><a href="/shipping-returns">Shipping &amp; returns</a></li><li><a href="/account">My account</a></li></ul></div><div class="footer-col"><h2>Company</h2><ul><li><a href="/about">About us</a></li><li><a href="/privacy">Privacy policy</a></li><li><a href="/terms">Terms</a></li></ul></div></div><div class="footer-bottom"><p>© ${year} Clever Toys. All rights reserved.</p><p>Made for curious minds 🧸</p></div></div></footer>`;
    const footerPattern = /<footer([^>]*class=["'][^"']*site-footer[^"']*["'][^>]*)>[\s\S]*?<\/footer>/i;
    const lastMain = output.lastIndexOf('</main>');
    if (footerPattern.test(output)) output = output.replace(footerPattern, () => standardFooter);
    else if (lastMain >= 0) output = `${output.slice(0, lastMain + 7)}${standardFooter}${output.slice(lastMain + 7)}`;

    const controls = `<div class="clever-floating-controls" aria-hidden="false"><a id="clever-floating-cart" class="clever-floating-cart" href="/cart" title="View your cart" aria-label="Shopping cart"><span class="floating-cart-icon" aria-hidden="true">🛒</span><span class="floating-cart-count" aria-hidden="true" hidden>0</span></a><a id="clever-floating-whatsapp" class="clever-floating-whatsapp" href="${escapeAttr(whatsappUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Chat with Clever Toys on WhatsApp" title="Chat with us on WhatsApp"><svg viewBox="0 0 32 32" focusable="false" aria-hidden="true"><path d="M16 3.2C9.1 3.2 3.5 8.8 3.5 15.7c0 2.2.6 4.4 1.8 6.3L3.2 28.8l6.9-2.1c1.8 1 3.8 1.5 5.9 1.5 6.9 0 12.5-5.6 12.5-12.5S22.9 3.2 16 3.2Zm0 22.8c-1.9 0-3.8-.5-5.4-1.5l1.2-4-.3-.4c-1-1.6-1.5-3.5-1.5-5.4-1.5-2.1 5.1-3.7 8.8-3.7 5.7 0 10.4 4.7 10.4 10.4S21.7 26.5 16 26.5Zm5.8-7.8c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.7-1.7-2-.2-.3 0-.5.1-.7.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z" fill="currentColor"/></svg></a></div>`;
    if (!output.includes('clever-floating-controls')) appendToBody(controls);
  }

  if (adminBrandingLink && output.includes('</nav>') && !output.includes('/admin/branding')) output = output.replace('</nav>', `${adminBrandingLink}</nav>`);
  if (adminSeoLink && output.includes('</nav>') && !output.includes('/admin/seo')) output = output.replace('</nav>', `${adminSeoLink}</nav>`);

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.delete('content-length');
  return new Response(output, { status: response.status, statusText: response.statusText, headers });
};
