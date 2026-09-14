(() => {
  const CART_KEY = 'cleverToysCart';
  const BADGE_CLASS = 'cart-count-badge';
  const STORE_NAME = 'Clever Toys';
  const FALLBACK_LOGO = '';

  const readCart = () => {
    try {
      const items = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(items) ? items.filter(item => item && Number(item.quantity) > 0) : [];
    } catch {
      return [];
    }
  };

  const cartCount = () => readCart().reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);

  const updateCartBadges = () => {
    const count = cartCount();
    document.querySelectorAll('a[href="/cart"], a[href="/cart/"]').forEach(link => {
      link.classList.add('cart-link');
      let badge = link.querySelector(`.${BADGE_CLASS}`);
      if (!badge) {
        badge = document.createElement('span');
        badge.className = BADGE_CLASS;
        badge.setAttribute('aria-hidden', 'true');
        link.appendChild(badge);
      }
      badge.textContent = String(count);
      badge.hidden = count === 0;
      link.setAttribute('aria-label', count ? `Shopping cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Shopping cart');
    });
  };

  const ensureCartLink = () => {
    if (location.pathname.startsWith('/admin')) return;
    document.querySelectorAll('.main-nav').forEach(nav => {
      if (!nav.querySelector('a[href="/cart"], a[href="/cart/"]')) {
        const cart = document.createElement('a');
        cart.href = '/cart';
        cart.textContent = 'Cart';
        cart.setAttribute('aria-label', 'Shopping cart');
        nav.appendChild(cart);
      }
    });
  };

  const setColorTheme = primary => {
    if (!primary || primary.length !== 3) return;
    const [r, g, b] = primary;
    const lighten = amount => primary.map(v => Math.round(v + (255 - v) * amount));
    const darken = amount => primary.map(v => Math.round(v * (1 - amount)));
    const toHex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    const text = (0.299 * r + 0.587 * g + 0.114 * b) > 165 ? '#111827' : '#ffffff';
    document.documentElement.style.setProperty('--brand-primary', toHex(primary));
    document.documentElement.style.setProperty('--brand-primary-hover', toHex(darken(.12)));
    document.documentElement.style.setProperty('--brand-soft', toHex(lighten(.88)));
    document.documentElement.style.setProperty('--brand-text-on-primary', text);
  };

  const extractLogoTheme = async url => {
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, 48, 48);
      const data = ctx.getImageData(0, 0, 48, 48).data;
      const buckets = new Map();
      for (let i = 0; i < data.length; i += 16) {
        if (data[i + 3] < 150) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 242 || brightness < 18) continue;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max === 0 || (max - min) / max < 0.12) continue;
        const key = [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v / 24) * 24))).join(',');
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }
      let best = null;
      for (const [key, score] of buckets.entries()) if (!best || score > best.score) best = { key, score };
      if (best) setColorTheme(best.key.split(',').map(Number));
    } catch {}
  };

  const patchLogoElements = logoUrl => {
    document.querySelectorAll('.logo').forEach(logo => {
      // Remove legacy/raw text nodes so "Clever Toys" is never duplicated.
      [...logo.childNodes].forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) node.remove();
      });

      let image = logo.querySelector(':scope > .site-logo-image');
      let text = logo.querySelector(':scope > .logo-text');

      if (!image) {
        image = document.createElement('img');
        image.className = 'site-logo-image';
        image.alt = STORE_NAME;
        image.hidden = true;
        logo.prepend(image);
      }

      if (!text) {
        text = document.createElement('span');
        text.className = 'logo-text';
        logo.appendChild(text);
      }

      text.textContent = STORE_NAME;
      text.hidden = false;

      if (logoUrl) {
        image.src = `${logoUrl}${logoUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
        image.hidden = false;
      } else {
        image.hidden = true;
      }
    });
  };

  const ensureStoreHeader = () => {
    if (location.pathname.startsWith('/admin')) return;
    if (document.querySelector('.site-header')) return;
    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `<div class="container header-inner"><a href="/" class="logo"><img class="site-logo-image" alt="${STORE_NAME}" hidden><span class="logo-text">${STORE_NAME}</span></a><nav class="main-nav" aria-label="Main navigation"><a href="/">Home</a><a href="/products">Shop</a><a href="/categories">Categories</a><a href="/cart" aria-label="Shopping cart">Cart</a></nav></div>`;
    document.body.prepend(header);
  };

  const loadBranding = async () => {
    let logoUrl = FALLBACK_LOGO;
    try {
      const response = await fetch('/api/branding', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        logoUrl = data.logo_url || '';
      }
    } catch {}

    ensureStoreHeader();
    patchLogoElements(logoUrl);
    ensureCartLink();
    updateCartBadges();
    if (logoUrl) await extractLogoTheme(logoUrl);
  };

  const patchStorage = () => {
    try {
      const originalSet = localStorage.setItem.bind(localStorage);
      const originalRemove = localStorage.removeItem.bind(localStorage);
      localStorage.setItem = (key, value) => {
        originalSet(key, value);
        if (key === CART_KEY) window.dispatchEvent(new CustomEvent('clever-cart-updated'));
      };
      localStorage.removeItem = key => {
        originalRemove(key);
        if (key === CART_KEY) window.dispatchEvent(new CustomEvent('clever-cart-updated'));
      };
    } catch {}
  };

  const init = () => {
    patchStorage();
    ensureStoreHeader();
    ensureCartLink();
    updateCartBadges();
    loadBranding();
  };

  window.addEventListener('storage', event => { if (event.key === CART_KEY) updateCartBadges(); });
  window.addEventListener('clever-cart-updated', updateCartBadges);
  window.addEventListener('cart-updated', updateCartBadges);
  document.addEventListener('DOMContentLoaded', () => {
    ensureStoreHeader();
    ensureCartLink();
    updateCartBadges();
    loadBranding();
  });

  init();
})();
