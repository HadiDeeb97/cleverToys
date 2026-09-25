/**
 * Runs on every request (see onRequest at the bottom of this file).
 *
 * HTML pages are finished here, so individual page files stay small:
 *  - the shared store header, footer, announcement ribbon and floating cart/WhatsApp buttons
 *  - theme colours, logo, website icon and settings from Admin → Branding (window.__CLEVER_BRANDING__)
 *  - SEO tags from Admin → SEO (per page, or the /product/* and /category/* templates)
 *  - the admin sidebar on /admin pages
 *  - security headers on every response
 */
import type { MiddlewareHandler } from 'astro';
import { supabaseConfig } from './lib/config';
import { PRIVATE_PATH, fillTemplate, parseSeoSettings } from './lib/seo';
import { DEFAULT_WHATSAPP_URL, loadPageData } from './lib/page-data';
import { FONT_PRESETS } from './lib/design';
import { renderFloatingControls, renderFooter, renderHeader, renderMenuDrawer, type ChromeOptions } from './lib/storefront-chrome';

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

const themeVariables = (theme: { primary: string; primary2?: string; soft: string; accent: string }) =>
  `--brand-primary:${theme.primary};--brand-primary-2:${theme.primary2 || theme.primary};--brand-primary-hover:color-mix(in srgb,${theme.primary} 86%,#000);--brand-soft:${theme.soft};--theme-accent:${theme.accent};--brand-text-on-primary:${readableText(theme.primary)};--theme-text-on-accent:${readableText(theme.accent)}`;

const fallbackWhatsappUrl = DEFAULT_WHATSAPP_URL;

const securityHeaders: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'content-security-policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'strict-transport-security': 'max-age=31536000; includeSubDomains'
};

const withSecurityHeaders = (headers: Headers) => {
  for (const [name, value] of Object.entries(securityHeaders)) if (!headers.has(name)) headers.set(name, value);
  return headers;
};

// ---------- Website icon ----------
/**
 * <link> tags for the website icon. Admin → Branding uploads PNG sizes to
 * product-images/branding/icons/<version>/icon-{32,180,192,512}.png and saves the 32px URL
 * in store_settings.favicon_url. Without an upload the default teddy-bear icon in public/ is used.
 */
const siteIconTags = (faviconUrl: unknown, base: string | undefined) => {
  const url = String(faviconUrl ?? '').trim();
  const prefix = base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/product-images/branding/icons/` : '';
  const manifest = '<link rel="manifest" href="/manifest.webmanifest" />';
  if (prefix && url.startsWith(prefix) && /\/icon-32\.png$/.test(url) && !/["<>\s]/.test(url)) {
    const size = (n: number) => escapeAttr(url.replace(/icon-32\.png$/, `icon-${n}.png`));
    return `<link rel="icon" type="image/png" sizes="32x32" href="${escapeAttr(url)}" /><link rel="icon" type="image/png" sizes="192x192" href="${size(192)}" /><link rel="apple-touch-icon" sizes="180x180" href="${size(180)}" />${manifest}`;
  }
  // Default Clever Toys icon (public/favicon.svg, favicon.ico and apple-touch-icon.png).
  return `<link rel="icon" href="/favicon.ico" sizes="48x48" /><link rel="icon" href="/favicon.svg" type="image/svg+xml" /><link rel="apple-touch-icon" href="/apple-touch-icon.png" />${manifest}`;
};

// ---------- The middleware ----------
// Runs for every request. Non-HTML responses (API, files) only get security headers.
// HTML pages are rewritten: shared header/footer, theme colours, branding settings, SEO tags,
// floating cart/WhatsApp buttons and the admin sidebar.
export const onRequest: MiddlewareHandler = async (context, next) => {
  const path = context.url.pathname;
  // Start loading page data now, while Astro renders the page, instead of after it (saves a full round trip).
  const looksLikePage = context.request.method === 'GET' && !path.startsWith('/api') && !/\.[a-z0-9]{2,11}$/i.test(path);
  const pageDataPromise = looksLikePage ? loadPageData(path) : null;
  // Pages can await the same data (see getPageData in src/lib/page-data.ts) instead of loading it again.
  if (pageDataPromise) context.locals.pageData = pageDataPromise;

  const response = await next();
  const contentType = response.headers.get('content-type');
  if (!contentType?.toLowerCase().includes('text/html')) {
    try {
      withSecurityHeaders(response.headers);
      return response;
    } catch {
      // Some responses have immutable headers; copy them into a new response instead.
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: withSecurityHeaders(new Headers(response.headers)) });
    }
  }

  const html = await response.text();
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  const { url: base } = supabaseConfig();
  const { storeSettings, published, seo, design, categories } = await (pageDataPromise ?? loadPageData(path));
  // Logo from Admin → Branding: the versioned upload (store_settings.logo_url) or the older fixed file.
  const brandingFolder = base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/product-images/branding/` : '';
  const savedLogo = String(storeSettings.logo_url ?? '').trim();
  const logoUrl = brandingFolder && savedLogo.startsWith(`${brandingFolder}logo/`) && !/["<>\s]/.test(savedLogo) ? savedLogo : brandingFolder ? `${brandingFolder}logo.webp` : '';

  // The WhatsApp link from Admin → Branding is used exactly as saved (number and greeting).
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
  // Fonts: the pair chosen in Admin → Storefront (the admin panel always uses the clean "modern" pair).
  const fontHref = FONT_PRESETS[isAdmin ? 'modern' : design.font].href;
  const fontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="${fontHref}" media="print" onload="this.media='all'" /><noscript><link rel="stylesheet" href="${fontHref}" /></noscript>`;
  // Bump the ?v= number whenever these files change, so browsers fetch the new version.
  const storeScript = '<script src="/store-ui.js?v=20260927-2" defer></script><script src="/branding-ui.js?v=20260927-1" defer></script>';
  // Warm up the connection to Supabase (photos, logo, sign-in) before the browser discovers it needs it.
  const supabaseOrigin = base ? new URL(base).origin : '';
  const preconnect = supabaseOrigin ? `<link rel="preconnect" href="${escapeAttr(supabaseOrigin)}" /><link rel="dns-prefetch" href="${escapeAttr(supabaseOrigin)}" />` : '';
  // Website icon (browser tab, bookmarks, phone home screen) from Admin → Branding, or the default icon.
  const iconTags = siteIconTags(storeSettings.favicon_url, base);
  let output = html;

  // Several page templates have no <head> or <body>. Give every page a real <head> so the theme,
  // fonts, scripts and meta tags below are always injected.
  if (!/<head[\s>]/i.test(output)) {
    output = /<!doctype html>/i.test(output) ? output.replace(/<!doctype html>/i, (match) => `${match}<head></head>`) : `<head></head>${output}`;
  }
  if (!/<meta\s+charset/i.test(output)) output = output.replace(/<head[^>]*>/i, (match) => `${match}<meta charset="utf-8" />`);
  if (!/<title>/i.test(output)) output = output.replace('</head>', '<title>Clever Toys Lebanon</title></head>');
  // Colour of the phone browser's top bar: matches the page background.
  const browserBarColor = isAdmin ? '#f6f6f9' : design.background === 'white' ? '#ffffff' : design.background === 'tint' ? (published.theme?.soft || '#e8f0ff') : '#fbf7f1';
  // Style choices from Admin → Storefront become attributes on <html>; global.css reads them.
  const htmlArea = isAdmin
    ? ' data-area="admin" data-font="modern"'
    : ` data-font="${design.font}" data-corners="${design.corners}" data-bg="${design.background}" data-buttons="${design.buttons}" data-floating-cart="${design.floating_cart ? 'on' : 'off'}" data-floating-whatsapp="${design.floating_whatsapp ? 'on' : 'off'}"`;
  // Pages without an <html> element get no lang attribute, which screen readers rely on.
  // Only the real document start counts (inlined CSS or scripts may mention "<html" in comments).
  const htmlTag = /^\s*(<!doctype html>\s*)?<html\b/i;
  if (!htmlTag.test(output)) output = /^\s*<!doctype html>/i.test(output) ? output.replace(/<!doctype html>/i, (match) => `${match}<html lang="en"${htmlArea}>`) : `<html lang="en"${htmlArea}>${output}`;
  else output = output.replace(htmlTag, (match) => `${match}${htmlArea}`);

  // SEO defaults for pages that do not set their own tags.
  const isPrivatePage = PRIVATE_PATH.test(path);
  const headTags: string[] = [];
  if (isPrivatePage && !/<meta\s+name=["']robots["']/i.test(output)) headTags.push('<meta name="robots" content="noindex, nofollow" />');
  if (!/<meta\s+name=["']description["']/i.test(output)) headTags.push('<meta name="description" content="Clever Toys Lebanon: fun, educational and exciting toys for every stage of childhood, with cash on delivery." />');
  if (!isPrivatePage && !/<link\s+rel=["']canonical["']/i.test(output)) headTags.push(`<link rel="canonical" href="${escapeAttr(new URL(path, context.site ?? context.url.origin).href)}" />`);
  if (!/property=["']og:site_name["']/i.test(output)) headTags.push('<meta property="og:site_name" content="Clever Toys" />');
  if (!/property=["']og:type["']/i.test(output)) headTags.push('<meta property="og:type" content="website" />');
  if (headTags.length) output = output.replace('</head>', `${headTags.join('')}</head>`);
  const appendToBody = (markup: string) => {
    output = output.includes('</body>') ? output.replace('</body>', `${markup}</body>`) : `${output}${markup}`;
  };

  if (!/<meta\s+name=[\"']viewport[\"'][^>]*>/i.test(output)) {
    const viewportTags = `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /><meta name="theme-color" content="${browserBarColor}" /><meta name="format-detection" content="telephone=no" />`;
    output = output.replace(/<head[^>]*>/i, (match) => `${match}${viewportTags}`);
  }
  output = output.replace(/<meta\s+name=["']theme-color["'][^>]*>/i, `<meta name="theme-color" content="${browserBarColor}" />`);

  // Product and category pages describe themselves with hint tags: the name for {name} templates, and which fields they set on purpose.
  const hint = (name: string) => output.match(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"[^>]*>`, 'i'))?.[1] ?? '';
  const decodeAttr = (value: string) => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const seoName = decodeAttr(hint('clever-seo-name'));
  const seoCustom = new Set(hint('clever-seo-custom').split(',').map((v) => v.trim()).filter(Boolean));
  output = output.replace(/<meta\s+name=["']clever-seo-(name|custom)["'][^>]*>/gi, '');

  if (seo) {
    const isTemplate = String(seo.path_key || '').endsWith('/*');
    // A template only applies when the page did not set its own value and the template uses {name}.
    const pick = (field: 'title' | 'description', value: unknown) => isTemplate ? (seoCustom.has(field) ? '' : fillTemplate(value, seoName)) : String(value || '').trim();
    const title = pick('title', seo.title);
    const description = pick('description', seo.description);
    const keywords = String(seo.keywords || '').trim().replace(/\{name\}/g, seoName);
    const hasPageImage = /<meta\s+property=["']og:image["']/i.test(output);
    const cover = isTemplate && hasPageImage ? '' : String(seo.cover_image_url || '').trim();
    const drop = (pattern: RegExp) => { output = output.replace(pattern, ''); };
    if (title) {
      drop(/<title>[\s\S]*?<\/title>/i);
      drop(/<meta\s+(name=["'](title|twitter:title)["']|property=["']og:title["'])[^>]*>\s*/gi);
    }
    if (description) drop(/<meta\s+(name=["'](description|twitter:description)["']|property=["']og:description["'])[^>]*>\s*/gi);
    if (keywords) drop(/<meta\s+name=["']keywords["'][^>]*>\s*/gi);
    if (cover) drop(/<meta\s+(name=["']twitter:image["']|property=["']og:image["'])[^>]*>\s*/gi);
    const seoTags = `${title ? `<title>${escapeHtml(title)}</title><meta property="og:title" content="${escapeAttr(title)}" /><meta name="twitter:title" content="${escapeAttr(title)}" />` : ''}${description ? `<meta name="description" content="${escapeAttr(description)}" /><meta property="og:description" content="${escapeAttr(description)}" /><meta name="twitter:description" content="${escapeAttr(description)}" />` : ''}${keywords ? `<meta name="keywords" content="${escapeAttr(keywords)}" />` : ''}${cover ? `<meta property="og:image" content="${escapeAttr(cover)}" /><meta name="twitter:image" content="${escapeAttr(cover)}" />` : ''}`;
    output = output.replace('</head>', `${seoTags}</head>`);
    if (seo.noindex === true && !isTemplate) {
      drop(/<meta\s+name=["']robots["'][^>]*>\s*/gi);
      output = output.replace('</head>', '<meta name="robots" content="noindex, follow" /></head>');
    }
  }

  // Site-wide SEO from Admin → SEO → Settings.
  if (!isAdmin) {
    const seoSettings = parseSeoSettings(storeSettings.seo);
    const extra: string[] = [];
    if (seoSettings.google_verification) extra.push(`<meta name="google-site-verification" content="${escapeAttr(seoSettings.google_verification)}" />`);
    if (seoSettings.bing_verification) extra.push(`<meta name="msvalidate.01" content="${escapeAttr(seoSettings.bing_verification)}" />`);
    if (seoSettings.default_image && !/<meta\s+property=["']og:image["']/i.test(output)) extra.push(`<meta property="og:image" content="${escapeAttr(seoSettings.default_image)}" /><meta name="twitter:image" content="${escapeAttr(seoSettings.default_image)}" />`);
    if (!/<meta\s+name=["']twitter:card["']/i.test(output)) extra.push('<meta name="twitter:card" content="summary_large_image" />');
    const canonical = output.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
    if (canonical && !/<meta\s+property=["']og:url["']/i.test(output)) extra.push(`<meta property="og:url" content="${canonical}" />`);
    if (path === '/') {
      const origin = new URL('/', context.site ?? context.url.origin).href;
      const sameAs = [instagramUrl, seoSettings.facebook_url, seoSettings.tiktok_url].filter((u) => u && !/instagram\.com\/?$/.test(u));
      const org = {
        '@context': 'https://schema.org', '@type': 'Store', '@id': `${origin}#store`, name: seoSettings.site_name, url: origin,
        logo: logoUrl || undefined, image: seoSettings.default_image || logoUrl || undefined,
        telephone: seoSettings.org_phone || undefined, email: seoSettings.org_email || undefined,
        address: { '@type': 'PostalAddress', addressLocality: seoSettings.org_city || undefined, addressCountry: 'LB' },
        currenciesAccepted: 'USD', paymentAccepted: 'Cash on delivery', sameAs: sameAs.length ? sameAs : undefined
      };
      extra.push(`<script type="application/ld+json">${JSON.stringify(org).replace(/</g, '\\u003c')}</script>`);
    }
    if (extra.length) output = output.replace('</head>', `${extra.join('')}</head>`);
  }

  output = output.replace(/<link\s+rel=["'](?:shortcut )?icon["'][^>]*>|<link\s+rel=["']apple-touch-icon["'][^>]*>/gi, '');
  // Look for the real <script> tag, not just the text: page scripts may mention store-ui.js in a comment.
  if (!/<script[^>]+src="\/store-ui\.js/.test(output)) output = output.replace('</head>', `${preconnect}${iconTags}${fontLinks}${earlyTheme}${storeConfig}${storeScript}</head>`);

  if (isAdmin) {
    // One admin layout for every admin page: sidebar navigation on desktop, compact top bar on phones.
    const adminLinks: Array<[string, string, string]> = [
      ['/admin/dashboard', 'Dashboard', '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z"/>'],
      ['/admin/orders', 'Orders', '<path d="M6 3h12l2 5v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8zM4 8h16M9 12h6"/>'],
      ['/admin/accounting', 'Accounting', '<path d="M4 4h16v16H4zM4 9h16M9 9v11M13 13h4M13 17h4"/>'],
      ['/admin', 'Products', '<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>'],
      ['/admin/analytics', 'Visitors', '<path d="M3 20V10M9 20V4M15 20v-7M21 20v-11"/>'],
      ['/admin/team', 'Team', '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>'],
      ['/admin/seo', 'SEO', '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'],
      ['/admin/storefront', 'Storefront', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 13h8M8 16h5"/>'],
      ['/admin/branding', 'Branding & settings', '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>']
    ];
    const adminNav = adminLinks.map(([href, label, icon]) => `<a href="${href}"${path === href || (href !== '/admin' && path.startsWith(href + '/')) ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg><span>${label}</span></a>`).join('');
    const adminSidebar = `<aside class="admin-sidebar" aria-label="Admin"><a href="/admin/dashboard" class="admin-brand"><span class="admin-brand-mark" aria-hidden="true">🧸</span><span>Clever Toys<small>Admin</small></span></a><nav class="admin-nav" aria-label="Admin navigation">${adminNav}</nav><div class="admin-sidebar-footer"><a href="/" target="_blank" rel="noopener">View store ↗</a><button type="button" id="admin-signout">Sign out</button></div></aside>`;
    const adminHeaderPattern = /<header([^>]*class=["'][^"']*site-header[^"']*["'][^>]*)>[\s\S]*?<\/header>/i;
    if (adminHeaderPattern.test(output)) output = output.replace(adminHeaderPattern, () => adminSidebar);
    else output = output.replace('</head>', () => `</head>${adminSidebar}`);
    output = output.replace('</head>', '<script src="/admin-ui.js?v=20260924-1" defer></script></head>');
  }

  if (!isAdmin) {
    // One shared header, menu, footer and floating buttons on every storefront page (src/lib/storefront-chrome.ts),
    // so individual pages cannot drift apart. Page templates only need <header class="site-header"></header>
    // and <footer class="site-footer"></footer> placeholders.
    const seoSettings = parseSeoSettings(storeSettings.seo);
    const chrome: ChromeOptions = {
      path,
      searchValue: path === '/products' ? context.url.searchParams.get('q') || '' : '',
      logoUrl,
      design,
      categories,
      whatsappUrl,
      instagramUrl,
      showWhatsapp,
      showInstagram,
      ribbonText: showRibbon ? ribbonText : '',
      contact: { phone: seoSettings.org_phone, email: seoSettings.org_email, city: seoSettings.org_city }
    };
    // Skip link so keyboard users can jump past the header, targeting the page's <main> element.
    output = output.replace(/<main(?![^>]*\bid=)([^>]*)>/i, '<main id="main-content"$1>');
    const skipLink = /id=["']main-content["']/i.test(output) ? '<a class="skip-link" href="#main-content">Skip to content</a>' : '';
    const header = `${skipLink}${renderHeader(chrome)}${renderMenuDrawer(chrome)}`;
    const headerPattern = /<header([^>]*class=["'][^"']*site-header[^"']*["'][^>]*)>[\s\S]*?<\/header>/i;
    if (headerPattern.test(output)) output = output.replace(headerPattern, () => header);
    else if (/<body[^>]*>/i.test(output)) output = output.replace(/<body[^>]*>/i, (match) => `${match}${header}`);
    else output = output.replace('</head>', () => `</head>${header}`);

    const footer = renderFooter(chrome);
    const footerPattern = /<footer([^>]*class=["'][^"']*site-footer[^"']*["'][^>]*)>[\s\S]*?<\/footer>/i;
    const lastMain = output.lastIndexOf('</main>');
    if (footerPattern.test(output)) output = output.replace(footerPattern, () => footer);
    else if (lastMain >= 0) output = `${output.slice(0, lastMain + 7)}${footer}${output.slice(lastMain + 7)}`;

    // Match the element, not the class name, which also appears in inlined CSS.
    if (!output.includes('class="clever-floating-controls"')) appendToBody(renderFloatingControls(chrome));
  }

  const headers = withSecurityHeaders(new Headers(response.headers));
  headers.set('content-type', 'text/html; charset=utf-8');
  // Admin pages are never stored. Store pages may be kept for the Back button (instant back navigation)
  // but are always re-checked with the server, so prices and stock are never stale.
  headers.set('cache-control', isAdmin ? 'no-store' : 'private, no-cache');
  headers.delete('content-length');
  return new Response(output, { status: response.status, statusText: response.statusText, headers });
};
