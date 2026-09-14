(() => {
  const CART_KEY = 'cleverToysCart';
  const BADGE_CLASS = 'cart-count-badge';
  const STORE_NAME = 'Clever Toys';
  const CART_ICON = '<span class="cart-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l1.8 10.2a2 2 0 0 0 2 1.8h7.8a2 2 0 0 0 2-1.7L20 8H6"/><circle cx="9" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/></svg></span>';
  const branding = window.__CLEVER_BRANDING__ || {};
  const FALLBACK_LOGO = branding.logoUrl || '';
  const THEME_KEY = 'cleverToysTheme';

  const readCart = () => {
    try {
      const items = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(items) ? items.filter(item => item && Number(item.quantity) > 0) : [];
    } catch { return []; }
  };

  const cartCount = () => readCart().reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);

  const normalizeCartLink = link => {
    link.classList.add('cart-link');
    const href = link.getAttribute('href') || '/cart';
    link.innerHTML = `${CART_ICON}<span class="cart-label">Cart</span><span class="${BADGE_CLASS}" aria-hidden="true"></span>`;
    link.setAttribute('href', href);
  };

  const updateCartLinks = () => {
    const count = cartCount();
    document.querySelectorAll('a[href="/cart"], a[href="/cart/"]').forEach(link => {
      normalizeCartLink(link);
      const badge = link.querySelector(`.${BADGE_CLASS}`);
      badge.textContent = String(count);
      badge.hidden = count === 0;
      link.setAttribute('aria-label', count ? `Shopping cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Shopping cart');
    });
  };

  const ensureCartLink = () => {
    if (location.pathname.startsWith('/admin')) return;
    document.querySelectorAll('.main-nav').forEach(nav => {
      const links = [...nav.querySelectorAll('a[href="/cart"], a[href="/cart/"]')];
      if (links.length === 0) {
        const cart = document.createElement('a');
        cart.href = '/cart';
        nav.appendChild(cart);
        normalizeCartLink(cart);
      } else {
        links.slice(1).forEach(link => link.remove());
      }
    });
    updateCartLinks();
  };

  const applyTheme = primary => {
    if (!Array.isArray(primary) || primary.length !== 3) return;
    const [r, g, b] = primary.map(Number);
    const clamp = value => Math.max(0, Math.min(255, Math.round(value)));
    const lighten = amount => primary.map(v => clamp(v + (255 - v) * amount));
    const darken = amount => primary.map(v => clamp(v * (1 - amount)));
    const toHex = rgb => '#' + rgb.map(clamp).map(v => v.toString(16).padStart(2, '0')).join('');
    const hex = toHex(primary);
    const hover = toHex(darken(.12));
    const soft = toHex(lighten(.88));
    const text = (0.299 * r + 0.587 * g + 0.114 * b) > 165 ? '#111827' : '#ffffff';
    document.documentElement.style.setProperty('--brand-primary', hex);
    document.documentElement.style.setProperty('--brand-primary-hover', hover);
    document.documentElement.style.setProperty('--brand-soft', soft);
    document.documentElement.style.setProperty('--brand-text-on-primary', text);
    try {
      localStorage.setItem(THEME_KEY, hex);
      document.cookie = `cleverTheme=${encodeURIComponent(hex)}; Max-Age=31536000; Path=/; SameSite=Lax`;
    } catch {}
  };

  const applyCachedThemeImmediately = () => {
    const hex = branding.theme || (() => { try { return localStorage.getItem(THEME_KEY) || ''; } catch { return ''; } })();
    if (/^#[0-9a-f]{6}$/i.test(hex)) document.documentElement.style.setProperty('--brand-primary', hex);
  };

  const extractLogoTheme = async url => {
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = url;
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
      const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 48;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) return;
      ctx.drawImage(image, 0, 0, 48, 48);
      const data = ctx.getImageData(0, 0, 48, 48).data; const buckets = new Map();
      for (let i = 0; i < data.length; i += 16) {
        if (data[i + 3] < 150) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const brightness = (r + g + b) / 3; if (brightness > 242 || brightness < 18) continue;
        const max = Math.max(r, g, b), min = Math.min(r, g, b); if (max === 0 || (max - min) / max < 0.12) continue;
        const key = [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v / 24) * 24))).join(',');
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }
      let best = null; for (const [key, score] of buckets.entries()) if (!best || score > best.score) best = { key, score };
      if (best) applyTheme(best.key.split(',').map(Number));
    } catch {}
  };

  const patchLogoElements = logoUrl => {
    document.querySelectorAll('.logo').forEach(logo => {
      let image = logo.querySelector('.site-logo-image'); let text = logo.querySelector('.logo-text');
      if (!image) { image = document.createElement('img'); image.className = 'site-logo-image'; image.alt = STORE_NAME; image.decoding = 'async'; logo.prepend(image); }
      if (!text) { text = document.createElement('span'); text.className = 'logo-text'; logo.appendChild(text); }
      text.textContent = STORE_NAME; text.hidden = false;
      if (logoUrl) { image.src = logoUrl; image.hidden = false; }
    });
  };

  const ensureStoreHeader = () => {
    if (location.pathname.startsWith('/admin') || document.querySelector('.site-header')) return;
    const header = document.createElement('header'); header.className = 'site-header';
    header.innerHTML = `<div class="container header-inner"><a href="/" class="logo"><img class="site-logo-image" src="${FALLBACK_LOGO}" alt="${STORE_NAME}" decoding="async"><span class="logo-text">${STORE_NAME}</span></a><nav class="main-nav" aria-label="Main navigation"><a href="/">Home</a><a href="/products">Shop</a><a href="/categories">Categories</a><a href="/cart"></a></nav></div>`;
    document.body.prepend(header);
  };

  const patchStorage = () => {
    try {
      if (localStorage.__cleverPatched) return;
      const originalSet = localStorage.setItem.bind(localStorage); const originalRemove = localStorage.removeItem.bind(localStorage);
      localStorage.__cleverPatched = true;
      localStorage.setItem = (key, value) => { originalSet(key, value); if (key === CART_KEY) window.dispatchEvent(new CustomEvent('clever-cart-updated')); };
      localStorage.removeItem = key => { originalRemove(key); if (key === CART_KEY) window.dispatchEvent(new CustomEvent('clever-cart-updated')); };
    } catch {}
  };

  const init = () => {
    applyCachedThemeImmediately();
    ensureStoreHeader();
    patchLogoElements(FALLBACK_LOGO);
    ensureCartLink();
    if (FALLBACK_LOGO) extractLogoTheme(FALLBACK_LOGO);
  };

  window.addEventListener('storage', event => { if (event.key === CART_KEY) updateCartLinks(); });
  window.addEventListener('clever-cart-updated', updateCartLinks);
  window.addEventListener('cart-updated', updateCartLinks);
  document.addEventListener('DOMContentLoaded', () => { ensureStoreHeader(); patchLogoElements(FALLBACK_LOGO); ensureCartLink(); });
  patchStorage();
  init();
})();
