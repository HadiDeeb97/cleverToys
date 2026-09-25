/**
 * The storefront "chrome" that src/middleware.ts puts on every public page:
 * announcement ribbon, header (with the "Shop" mega menu), the slide-in mobile menu, the footer
 * and the floating cart / WhatsApp buttons.
 *
 * It is plain HTML built on the server, so it appears instantly and works before any script loads.
 * public/store-ui.js adds the interactive parts (opening the menu, cart counts, cart drawer).
 * Styles live in src/styles/global.css, sections 4 and 14.
 */
import { AGE_RANGES, placeholderFor, type StoreDesign } from './design';
import type { MenuCategory } from './page-data';

const esc = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- Icons (inline SVG, so no extra downloads) ----------
const svg = (body: string, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${body}</svg>`;
export const ICONS = {
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  account: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  bag: svg('<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h10"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  chevron: svg('<path d="m6 9 6 6 6-6"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  instagram: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/>'),
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41Z"/></svg>'
};

/** Square category picture, or a soft coloured tile with a toy emoji when there is no photo. */
export const tileMedia = (name: string, image: string | null | undefined, className = 'tile-media') => {
  if (image && /^https?:\/\//.test(image)) return `<span class="${className}"><img src="${esc(image)}" alt="" loading="lazy" decoding="async" /></span>`;
  const ph = placeholderFor(name);
  return `<span class="${className}" style="--ph-h:${ph.hue}"><span aria-hidden="true">${ph.emoji}</span></span>`;
};

export type ChromeOptions = {
  path: string;
  searchValue: string;
  logoUrl: string;
  design: StoreDesign;
  categories: MenuCategory[];
  /** Pages from Admin → Pages marked "Show in the footer". */
  footerPages: Array<{ slug: string; title: string }>;
  /** Something is on sale: show "Sale" links (they open /products?sale=1). */
  hasSale: boolean;
  whatsappUrl: string;
  instagramUrl: string;
  showWhatsapp: boolean;
  showInstagram: boolean;
  ribbonText: string;
  contact: { phone: string; email: string; city: string };
};

const isActive = (path: string, href: string) => path === href || (href !== '/' && path.startsWith(href + '/'));
const current = (path: string, href: string) => isActive(path, href) ? ' aria-current="page"' : '';
/** Links typed in the admin: escaped, and https links open in a new tab. */
const linkAttrs = (href: string) => `href="${esc(href)}"${/^https:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}`;
const navLink = (path: string, href: string, label: string) => `<a ${linkAttrs(href)}${current(path, href)}>${esc(label)}</a>`;

const logoMarkup = (logoUrl: string) => logoUrl
  ? `<img class="site-logo-image" src="${esc(logoUrl)}" alt="Clever Toys" decoding="async" onerror="this.hidden=true"><span class="logo-text">Clever Toys</span>`
  : '<span class="logo-text">Clever Toys</span>';

export function renderHeader(o: ChromeOptions) {
  const socials = (o.showWhatsapp || o.showInstagram)
    ? `<span class="clever-header-socials" aria-label="Social links">${o.showWhatsapp ? `<a class="clever-header-social clever-header-whatsapp" href="${esc(o.whatsappUrl)}" target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="Chat with Clever Toys on WhatsApp"><svg class="clever-header-social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#25D366" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41Z"/></svg></a>` : ''}${o.showInstagram ? `<a class="clever-header-social clever-header-instagram" href="${esc(o.instagramUrl)}" target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Clever Toys on Instagram"><svg class="clever-header-social-icon" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="clever-ig" x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse"><stop stop-color="#FFDC80"/><stop offset=".35" stop-color="#F77737"/><stop offset=".67" stop-color="#E1306C"/><stop offset="1" stop-color="#833AB4"/></linearGradient></defs><rect x="5.25" y="5.25" width="21.5" height="21.5" rx="6" fill="none" stroke="url(#clever-ig)" stroke-width="2.4"/><circle cx="16" cy="16" r="5" fill="none" stroke="url(#clever-ig)" stroke-width="2.4"/><circle cx="22.4" cy="9.7" r="1.55" fill="#E1306C"/></svg></a>` : ''}</span>`
    : '';

  // Mega menu under "Shop": quick links, up to 8 categories with pictures, and age shortcuts.
  const megaCategories = o.categories.slice(0, 8).map((c) => `<a class="mega-category" href="/category/${encodeURIComponent(c.slug)}">${tileMedia(c.name, c.image_url)}<span>${esc(c.name)}</span></a>`).join('');
  const ages = AGE_RANGES.map((a) => `<a href="/products?age_min=${a.min}${a.max != null ? `&amp;age_max=${a.max}` : ''}"><span>Ages ${a.label}</span><small>${a.icon}</small></a>`).join('');
  const mega = `<div class="mega-menu" role="region" aria-label="Shop menu"><div class="container"><div class="mega-inner">
    <div><p class="mega-title">Shop</p><div class="mega-links"><a href="/products">All toys ${ICONS.arrow.replace('<svg', '<svg width="16" height="16"')}</a><a href="/products?sort=newest">New arrivals</a>${o.hasSale ? '<a href="/products?sale=1" class="sale-link">Sale</a>' : ''}<a href="/products?sort=price-asc">Best prices</a><a href="/categories">All categories</a></div></div>
    <div><p class="mega-title">Categories</p><div class="mega-categories">${megaCategories || '<p class="muted">Categories coming soon.</p>'}</div></div>
    <div><p class="mega-title">Shop by age</p><div class="mega-links">${ages}</div></div>
  </div></div></div>`;

  const ribbon = o.ribbonText ? `<div class="clever-ribbon" role="status"><div class="container">${esc(o.ribbonText)}</div></div>` : '';
  return `${ribbon}<header class="site-header" data-clever-standard-header>
  <div class="container header-inner">
    <button type="button" class="icon-button menu-toggle" data-drawer-open="site-drawer" aria-controls="site-drawer" aria-expanded="false" aria-label="Open menu">${ICONS.menu}</button>
    <a href="/" class="logo" aria-label="Clever Toys home">${logoMarkup(o.logoUrl)}</a>
    <nav class="main-nav" aria-label="Main navigation">
      <div class="nav-item"><a class="nav-link" href="/products"${current(o.path, '/products')}>Shop ${ICONS.chevron}</a>${mega}</div>${o.hasSale ? '<a class="nav-sale" href="/products?sale=1">Sale</a>' : ''}
      ${o.design.menus.header.map((l) => navLink(o.path, l.href, l.label)).join('')}
    </nav>
    <div class="header-actions">
      <form class="header-search" action="/products" method="get" role="search">${ICONS.search}<label class="sr-only" for="header-search-input">Search toys</label><input id="header-search-input" name="q" type="search" value="${esc(o.searchValue)}" placeholder="Search toys…" autocomplete="off" /></form>
      ${socials}
      <a href="/products#product-search" class="icon-button header-search-link" data-drawer-open="site-drawer" data-drawer-focus="search" aria-label="Search toys">${ICONS.search}</a>
      <a href="/account" class="header-icon-link header-account-link" aria-label="My account"${current(o.path, '/account')}>${ICONS.account}</a>
      <a href="/cart" class="cart-link" aria-label="Shopping cart"><span class="cart-icon" aria-hidden="true">${ICONS.bag}</span><span class="cart-label">Cart</span><span class="cart-count-badge" aria-hidden="true" hidden>0</span></a>
    </div>
  </div>
</header>`;
}

/** Slide-in menu for phones and tablets (opened by the ☰ button). */
export function renderMenuDrawer(o: ChromeOptions) {
  // Home, shop and sale first, then the header menu from Admin → Storefront & menus, then the account.
  const all: Array<[string, string]> = [['/', 'Home'], ['/products', 'Shop all toys'], ...(o.hasSale ? [['/products?sale=1', 'Sale'] as [string, string]] : []),
    ...o.design.menus.header.map((l): [string, string] => [l.href, l.label]), ['/account', 'My account']];
  const links = all.filter(([href], i) => all.findIndex(([h]) => h === href) === i);
  const categories = o.categories.map((c) => `<a href="/category/${encodeURIComponent(c.slug)}">${tileMedia(c.name, c.image_url)}<span>${esc(c.name)}</span></a>`).join('');
  return `<div class="drawer site-drawer" id="site-drawer" hidden>
  <div class="drawer-backdrop" data-drawer-close></div>
  <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="Menu">
    <div class="drawer-head"><strong>Menu</strong><button type="button" class="icon-button" data-drawer-close aria-label="Close menu">${ICONS.close}</button></div>
    <div class="drawer-body">
      <form class="drawer-search" action="/products" method="get" role="search">${ICONS.search}<label class="sr-only" for="drawer-search-input">Search toys</label><input id="drawer-search-input" name="q" type="search" value="${esc(o.searchValue)}" placeholder="Search toys…" autocomplete="off" enterkeyhint="search" /></form>
      <nav class="drawer-nav" aria-label="Menu">${links.map(([href, label]) => `<a ${linkAttrs(href)}${current(o.path, href)}>${esc(label)}<span aria-hidden="true">→</span></a>`).join('')}</nav>
      ${categories ? `<p class="drawer-section-title">Shop by category</p><div class="drawer-categories">${categories}</div>` : ''}
      <p class="drawer-section-title">Need help?</p>
      <div class="drawer-contact">
        ${o.showWhatsapp ? `<a class="button whatsapp-button" href="${esc(o.whatsappUrl)}" target="_blank" rel="noopener noreferrer">${ICONS.whatsapp} Chat on WhatsApp</a>` : ''}
        ${o.showInstagram ? `<a class="button secondary-button" href="${esc(o.instagramUrl)}" target="_blank" rel="noopener noreferrer">${ICONS.instagram} Follow on Instagram</a>` : ''}
      </div>
    </div>
  </aside>
</div>`;
}

export function renderFooter(o: ChromeOptions) {
  const f = o.design.footer;
  const contact = [
    o.contact.phone && `<li><span aria-hidden="true">📞</span><a href="tel:${esc(o.contact.phone.replace(/[^+\d]/g, ''))}">${esc(o.contact.phone)}</a></li>`,
    o.contact.email && `<li><span aria-hidden="true">✉️</span><a href="mailto:${esc(o.contact.email)}">${esc(o.contact.email)}</a></li>`,
    (f.address || o.contact.city) && `<li><span aria-hidden="true">📍</span><span>${esc(f.address || o.contact.city)}</span></li>`,
    f.hours && `<li><span aria-hidden="true">🕘</span><span>${esc(f.hours)}</span></li>`
  ].filter(Boolean).join('');
  const socials = [
    o.showWhatsapp && `<a href="${esc(o.whatsappUrl)}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">${ICONS.whatsapp}</a>`,
    o.showInstagram && `<a href="${esc(o.instagramUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${ICONS.instagram}</a>`
  ].filter(Boolean).join('');
  const shopLinks = [['/products', 'All toys'], ['/products?sort=newest', 'New arrivals'], ...(o.hasSale ? [['/products?sale=1', 'Sale']] : []), ...o.categories.slice(0, 5).map((c) => [`/category/${encodeURIComponent(c.slug)}`, c.name])];
  const col = (title: string, items: string[][]) => `<nav class="footer-col" aria-label="${esc(title)}"><h2>${esc(title)}</h2><ul>${items.map(([href, label]) => `<li><a ${linkAttrs(href)}>${esc(label)}</a></li>`).join('')}</ul></nav>`;
  return `<footer class="site-footer"><div class="container">
  <div class="footer-grid">
    <div class="footer-brand"><strong>Clever Toys</strong><p>${esc(f.about)}</p>${contact ? `<ul class="footer-contact">${contact}</ul>` : ''}${socials ? `<div class="footer-socials">${socials}</div>` : ''}</div>
    ${col('Shop', shopLinks)}
    ${o.design.menus.help.length ? col('Help', o.design.menus.help.map((l) => [l.href, l.label])) : ''}
    ${col('Company', [...o.design.menus.company.map((l) => [l.href, l.label]), ...o.footerPages.map((p) => [`/pages/${encodeURIComponent(p.slug)}`, p.title])])}
  </div>
  <div class="footer-badges"><span>💵 Cash on delivery</span><span>🚚 Delivery across Lebanon</span><span>🔒 Secure checkout</span></div>
  <div class="footer-bottom"><p>© ${new Date().getFullYear()} Clever Toys. All rights reserved.</p><p>${esc(f.note)}</p></div>
</div></footer>`;
}

/** Floating WhatsApp (and optional cart) buttons; which ones show is set in Admin → Storefront. */
export function renderFloatingControls(o: ChromeOptions) {
  return `<div class="clever-floating-controls" aria-hidden="false"><a id="clever-floating-cart" class="clever-floating-cart" href="/cart" title="View your cart" aria-label="Shopping cart"><span class="floating-cart-icon" aria-hidden="true">${ICONS.bag}</span><span class="floating-cart-count" aria-hidden="true" hidden>0</span></a><a id="clever-floating-whatsapp" class="clever-floating-whatsapp" href="${esc(o.whatsappUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Chat with Clever Toys on WhatsApp" title="Chat with us on WhatsApp">${ICONS.whatsapp}</a></div>`;
}
