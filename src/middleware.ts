import type { MiddlewareHandler } from 'astro';
import { supabaseConfig } from './lib/config';
import { PRIVATE_PATH, fillTemplate, parseSeoSettings } from './lib/seo';

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

const fallbackWhatsappUrl = 'https://wa.me/96171220251?text=Hello%20Clever%20Toys%21%20I%20have%20a%20question%20about%20your%20toys.';
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

export const onRequest: MiddlewareHandler = async (context, next) => {
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
  const path = context.url.pathname;
  const { url: base, key: publishableKey } = supabaseConfig();
  const logoUrl = base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/product-images/branding/logo.webp` : '';
  const themeUrl = base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/product-images/branding/theme.json` : '';
  type PublishedTheme = { mode: string; theme: null | { primary: string; primary2?: string; soft: string; accent: string; id?: string; name?: string } };
  // Accepts the published theme payload ({ mode, theme: { primary, soft, accent } }) from either source.
  const parseTheme = (d: any): PublishedTheme | null => {
    if (d?.mode === 'theme' && safeHex(d?.theme?.primary) && safeHex(d?.theme?.soft) && safeHex(d?.theme?.accent)) {
      return {
        mode: 'theme',
        theme: {
          primary: safeHex(d.theme.primary)!,
          // Optional gradient end color; themes without it render solid.
          primary2: safeHex(d.theme.primary2) || undefined,
          soft: safeHex(d.theme.soft)!,
          accent: safeHex(d.theme.accent)!,
          id: typeof d.theme.id === 'string' ? d.theme.id : undefined,
          name: typeof d.theme.name === 'string' ? d.theme.name : undefined
        }
      };
    }
    return d?.mode === 'logo' ? { mode: 'logo', theme: null } : null;
  };
  let published: PublishedTheme = { mode: 'logo', theme: null };
  let fileTheme: PublishedTheme | null = null;
  let settingsTheme: PublishedTheme | null = null;
  let storeSettings: Record<string, any> = { ...defaultStoreSettings };

  // Older setups published the theme as a JSON file in storage; it is only used when store_settings has no theme.
  const loadTheme = async () => {
    if (!themeUrl) return;
    try {
      const r = await fetch(`${themeUrl}?theme=${Date.now()}`, { cf: { cacheTtl: 0, cacheEverything: false } });
      if (r.ok) fileTheme = parseTheme(JSON.parse(await r.text()));
    } catch {}
  };

  const loadStoreSettings = async () => {
    if (path.startsWith('/api') || !base || !publishableKey) return;
    try {
      // select=* so a missing optional column (e.g. before a migration) does not break the whole query.
      const settingsResponse = await fetch(`${base.replace(/\/$/, '')}/rest/v1/store_settings?select=*&id=eq.default&limit=1`, {
        headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      if (settingsResponse.ok) {
        const row = (await settingsResponse.json())?.[0];
        if (row) {
          storeSettings = { ...defaultStoreSettings, ...row };
          settingsTheme = parseTheme(row.theme);
        }
      }
    } catch {}
  };

  const loadSeo = async (): Promise<any> => {
    if (path.startsWith('/admin') || path.startsWith('/api') || !base || !publishableKey) return null;
    try {
      // One request for the exact page and, on product/category pages, the fallback template; the exact page wins.
      const wildcard = path.startsWith('/product/') ? '/product/*' : path.startsWith('/category/') ? '/category/*' : '';
      const keys = [path, ...(wildcard ? [wildcard] : [])].map((key) => `"${key.replace(/["\\]/g, '')}"`).join(',');
      const r = await fetch(`${base.replace(/\/$/, '')}/rest/v1/seo_pages?select=*&path_key=in.(${encodeURIComponent(keys)})`, {
        headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      if (!r.ok) return null;
      const rows: any[] = await r.json();
      return rows.find((row) => row.path_key === path) || rows.find((row) => row.path_key === wildcard) || null;
    } catch {
      return null;
    }
  };

  const [, , seo] = await Promise.all([loadTheme(), loadStoreSettings(), loadSeo()]);
  published = settingsTheme || fileTheme || published;

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
  const fontLinks = '<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800;900&display=swap" media="print" onload="this.media=\'all\'" /><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800;900&display=swap" /></noscript>';
  const storeScript = '<script src="/store-ui.js?v=20260925-1" defer></script><script src="/branding-ui.js?v=20260925-4" defer></script>';
  let output = html;

  // Several page templates have no <head> or <body>. Give every page a real <head> so the theme,
  // fonts, scripts and meta tags below are always injected.
  if (!/<head[\s>]/i.test(output)) {
    output = /<!doctype html>/i.test(output) ? output.replace(/<!doctype html>/i, (match) => `${match}<head></head>`) : `<head></head>${output}`;
  }
  if (!/<meta\s+charset/i.test(output)) output = output.replace(/<head[^>]*>/i, (match) => `${match}<meta charset="utf-8" />`);
  if (!/<title>/i.test(output)) output = output.replace('</head>', '<title>Clever Toys Lebanon</title></head>');
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  const htmlArea = isAdmin ? ' data-area="admin"' : '';
  // Pages without an <html> element get no lang attribute, which screen readers rely on.
  if (!/<html[\s>]/i.test(output)) output = /<!doctype html>/i.test(output) ? output.replace(/<!doctype html>/i, (match) => `${match}<html lang="en"${htmlArea}>`) : `<html lang="en"${htmlArea}>${output}`;

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
    const viewportTags = `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /><meta name="theme-color" content="${published.theme?.primary || '#2563eb'}" /><meta name="format-detection" content="telephone=no" />`;
    output = output.replace(/<head[^>]*>/i, (match) => `${match}${viewportTags}`);
  }
  output = output.replace(/<meta\s+name=["']theme-color["'][^>]*>/i, `<meta name="theme-color" content="${published.theme?.primary || '#2563eb'}" />`);

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

  if (!output.includes('/store-ui.js')) output = output.replace('</head>', `${fontLinks}${earlyTheme}${storeConfig}${storeScript}</head>`);

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
      ['/admin/branding', 'Branding & settings', '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>']
    ];
    const adminNav = adminLinks.map(([href, label, icon]) => `<a href="${href}"${path === href || (href !== '/admin' && path.startsWith(href + '/')) ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg><span>${label}</span></a>`).join('');
    const adminSidebar = `<aside class="admin-sidebar" aria-label="Admin"><a href="/admin/dashboard" class="admin-brand"><span class="admin-brand-mark" aria-hidden="true">🧸</span><span>Clever Toys<small>Admin</small></span></a><nav class="admin-nav" aria-label="Admin navigation">${adminNav}</nav><div class="admin-sidebar-footer"><a href="/" target="_blank" rel="noopener">View store ↗</a><button type="button" id="admin-signout">Sign out</button></div></aside>`;
    const adminHeaderPattern = /<header([^>]*class=["'][^"']*site-header[^"']*["'][^>]*)>[\s\S]*?<\/header>/i;
    if (adminHeaderPattern.test(output)) output = output.replace(adminHeaderPattern, () => adminSidebar);
    else output = output.replace('</head>', () => `</head>${adminSidebar}`);
    output = output.replace('</head>', '<script src="/admin-ui.js?v=20260924-1" defer></script></head>');
  }

  if (!path.startsWith('/admin')) {
    const headerSocials = (showWhatsapp || showInstagram)
      ? `<span class="clever-header-socials" aria-label="Social links">${showWhatsapp ? `<a class="clever-header-social clever-header-whatsapp" href="${escapeAttr(whatsappUrl)}" target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="Chat with Clever Toys on WhatsApp"><svg class="clever-header-social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg></a>` : ''}${showInstagram ? `<a class="clever-header-social clever-header-instagram" href="${escapeAttr(instagramUrl)}" target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Clever Toys on Instagram"><svg class="clever-header-social-icon" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="clever-instagram-gradient-server" x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse"><stop stop-color="#FFDC80"/><stop offset=".35" stop-color="#F77737"/><stop offset=".67" stop-color="#E1306C"/><stop offset="1" stop-color="#833AB4"/></linearGradient></defs><rect x="5.25" y="5.25" width="21.5" height="21.5" rx="6" fill="none" stroke="url(#clever-instagram-gradient-server)" stroke-width="2.4"/><circle cx="16" cy="16" r="5" fill="none" stroke="url(#clever-instagram-gradient-server)" stroke-width="2.4"/><circle cx="22.4" cy="9.7" r="1.55" fill="#E1306C"/></svg></a>` : ''}</span>`
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
    // Skip link so keyboard users can jump past the header, targeting the page's <main> element.
    output = output.replace(/<main(?![^>]*\bid=)([^>]*)>/i, '<main id="main-content"$1>');
    const skipLink = /id=["']main-content["']/i.test(output) ? '<a class="skip-link" href="#main-content">Skip to content</a>' : '';
    const standardHeader = `${skipLink}<header class="site-header" data-clever-standard-header><div class="container header-inner"><a href="/" class="logo" aria-label="Clever Toys home">${standardLogoMarkup}</a><nav class="main-nav" aria-label="Main navigation">${navLink('/', 'Home')}${navLink('/products', 'Shop')}${navLink('/categories', 'Categories')}${navLink('/about', 'About')}${navLink('/contact', 'Contact')}</nav><form class="header-search" action="/products" method="get" role="search">${searchIcon}<label class="sr-only" for="header-search-input">Search toys</label><input id="header-search-input" name="q" type="search" value="${searchValue}" placeholder="Search toys…" autocomplete="off" /></form><div class="header-actions">${headerSocials}<a href="/products#product-search" class="header-icon-link header-search-link" aria-label="Search toys">${searchIcon}</a><a href="/account" class="header-icon-link header-account-link" aria-label="My account"${currentAttr('/account')}>${accountIcon}</a><a href="/cart" class="cart-link" aria-label="Shopping cart"><span class="cart-icon" aria-hidden="true">🛒</span><span class="cart-label">Cart</span><span class="cart-count-badge" aria-hidden="true" hidden>0</span></a></div></div></header>${ribbon}`;
    const headerPattern = /<header([^>]*class=["'][^"']*site-header[^"']*["'][^>]*)>[\s\S]*?<\/header>/i;
    if (headerPattern.test(output)) output = output.replace(headerPattern, () => standardHeader);
    else if (/<body[^>]*>/i.test(output)) output = output.replace(/<body[^>]*>/i, (match) => `${match}${standardHeader}`);
    else output = output.replace('</head>', () => `</head>${standardHeader}`);

    const year = new Date().getFullYear();
    const standardFooter = `<footer class="site-footer"><div class="container"><div class="footer-grid"><div class="footer-brand"><strong>Clever Toys</strong><p>Fun, educational and exciting toys for every stage of childhood, with cash on delivery across Lebanon.</p></div><div class="footer-col"><h2>Shop</h2><ul><li><a href="/products">All toys</a></li><li><a href="/categories">Categories</a></li><li><a href="/cart">Your cart</a></li></ul></div><div class="footer-col"><h2>Help</h2><ul><li><a href="/track-order">Track your order</a></li><li><a href="/contact">Contact us</a></li><li><a href="/shipping-returns">Shipping &amp; returns</a></li><li><a href="/account">My account</a></li></ul></div><div class="footer-col"><h2>Company</h2><ul><li><a href="/about">About us</a></li><li><a href="/privacy">Privacy policy</a></li><li><a href="/terms">Terms</a></li></ul></div></div><div class="footer-bottom"><p>© ${year} Clever Toys. All rights reserved.</p><p>Made for curious minds 🧸</p></div></div></footer>`;
    const footerPattern = /<footer([^>]*class=["'][^"']*site-footer[^"']*["'][^>]*)>[\s\S]*?<\/footer>/i;
    const lastMain = output.lastIndexOf('</main>');
    if (footerPattern.test(output)) output = output.replace(footerPattern, () => standardFooter);
    else if (lastMain >= 0) output = `${output.slice(0, lastMain + 7)}${standardFooter}${output.slice(lastMain + 7)}`;

    const controls = `<div class="clever-floating-controls" aria-hidden="false"><a id="clever-floating-cart" class="clever-floating-cart" href="/cart" title="View your cart" aria-label="Shopping cart"><span class="floating-cart-icon" aria-hidden="true">🛒</span><span class="floating-cart-count" aria-hidden="true" hidden>0</span></a><a id="clever-floating-whatsapp" class="clever-floating-whatsapp" href="${escapeAttr(whatsappUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Chat with Clever Toys on WhatsApp" title="Chat with us on WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg></a></div>`;
    // Match the element, not the class name, which also appears in inlined CSS.
    if (!output.includes('class="clever-floating-controls"')) appendToBody(controls);
  }


  const headers = withSecurityHeaders(new Headers(response.headers));
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.delete('content-length');
  return new Response(output, { status: response.status, statusText: response.statusText, headers });
};
