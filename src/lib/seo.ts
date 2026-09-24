// Shared SEO helpers for the middleware, sitemap and robots.txt. Settings live in store_settings.seo (see supabase/seo_advanced.sql).

export type SeoSettings = {
  site_name: string;
  default_image: string;
  google_verification: string;
  bing_verification: string;
  org_phone: string;
  org_email: string;
  org_city: string;
  facebook_url: string;
  tiktok_url: string;
  sitemap_products: boolean;
  sitemap_categories: boolean;
  sitemap_images: boolean;
  robots_extra: string;
};

export const defaultSeoSettings: SeoSettings = {
  site_name: 'Clever Toys',
  default_image: '',
  google_verification: '',
  bing_verification: '',
  org_phone: '',
  org_email: '',
  org_city: '',
  facebook_url: '',
  tiktok_url: '',
  sitemap_products: true,
  sitemap_categories: true,
  sitemap_images: true,
  robots_extra: ''
};

const text = (value: unknown, max = 300) => String(value ?? '').trim().slice(0, max);
const httpUrl = (value: unknown) => (/^https?:\/\/\S+$/i.test(text(value, 1000)) ? text(value, 1000) : '');
const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
// Accepts either the bare code or the whole <meta ... content="..."> tag that Google/Bing show.
export const verificationCode = (value: unknown) => {
  const raw = text(value, 400);
  const fromTag = raw.match(/content=["']([^"']+)["']/i)?.[1] ?? raw;
  return /^[A-Za-z0-9_\-=.]{4,120}$/.test(fromTag) ? fromTag : '';
};

export function parseSeoSettings(value: unknown): SeoSettings {
  const s = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    site_name: text(s.site_name, 80) || defaultSeoSettings.site_name,
    default_image: httpUrl(s.default_image),
    google_verification: verificationCode(s.google_verification),
    bing_verification: verificationCode(s.bing_verification),
    org_phone: text(s.org_phone, 40),
    org_email: text(s.org_email, 120),
    org_city: text(s.org_city, 80),
    facebook_url: httpUrl(s.facebook_url),
    tiktok_url: httpUrl(s.tiktok_url),
    sitemap_products: flag(s.sitemap_products, true),
    sitemap_categories: flag(s.sitemap_categories, true),
    sitemap_images: flag(s.sitemap_images, true),
    robots_extra: text(s.robots_extra, 4000)
  };
}

/** Fills a product/category template such as "{name} | Clever Toys". Returns '' when the template has no {name}, so one fixed title is never copied onto every page. */
export const fillTemplate = (template: unknown, name: string) => {
  const t = text(template, 400);
  return name && t.includes('{name}') ? t.replace(/\{name\}/g, name) : '';
};

// Pages that are never indexed or listed in the sitemap.
export const PRIVATE_PATH = /^\/(admin|account|cart|checkout|login|register|forgot-password|reset-password|order-success|api)(\/|$)/;

export const STATIC_PAGES: Array<{ path: string; priority: number; changefreq: string }> = [
  { path: '/', priority: 1.0, changefreq: 'daily' },
  { path: '/products', priority: 0.9, changefreq: 'daily' },
  { path: '/categories', priority: 0.8, changefreq: 'weekly' },
  { path: '/about', priority: 0.5, changefreq: 'monthly' },
  { path: '/contact', priority: 0.5, changefreq: 'monthly' },
  { path: '/track-order', priority: 0.4, changefreq: 'monthly' },
  { path: '/shipping-returns', priority: 0.4, changefreq: 'monthly' },
  { path: '/privacy', priority: 0.2, changefreq: 'yearly' },
  { path: '/terms', priority: 0.2, changefreq: 'yearly' }
];

export const DEFAULT_DISALLOW = ['/admin', '/api/', '/account', '/login', '/register', '/forgot-password', '/reset-password', '/cart', '/checkout', '/order-success'];

// Only lines robots.txt understands, so a typo cannot break the file.
export const cleanRobotsLines = (value: string) =>
  value.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^(user-agent|allow|disallow|crawl-delay|sitemap)\s*:\s*\S*/i.test(line) || line.startsWith('#'));
