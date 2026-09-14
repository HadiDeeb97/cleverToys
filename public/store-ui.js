(() => {
  const CART_KEY = 'cleverToysCart';
  const BADGE_CLASS = 'cart-count-badge';
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

  const setColorTheme = (primary) => {
    if (!primary) return;
    const [r, g, b] = primary;
    const mix = (target, amount) => target.map((v, i) => Math.round(v + (target[i] - v) * amount));
    const lighten = (amount) => primary.map(v => Math.round(v + (255 - v) * amount));
    const darken = (amount) => primary.map(v => Math.round(v * (1 - amount)));
    const toHex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
    const text = (0.299 * r + 0.587 * g + 0.114 * b) > 165 ? '#111827' : '#ffffff';
    document.documentElement.style.setProperty('--brand-primary', toHex(primary));
    document.documentElement.style.setProperty('--brand-primary-hover', toHex(darken(.12)));
    document.documentElement.style.setProperty('--brand-soft', toHex(lighten(.88)));
    document.documentElement.style.setProperty('--brand-text-on-primary', text);
  };

  const extractLogoTheme = async (url) => {
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
      const canvas = document.createElement('canvas');
      const size = 48;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      const buckets = new Map();
      for (let i = 0; i < data.length; i += 16) {
        const a = data[i + 3];
        if (a < 150) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 242 || brightness < 18) continue;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        if (saturation < 0.12) continue;
        const key = [Math.round(r / 24) * 24, Math.round(g / 24) * 24, Math.round(b / 24) * 24].map(v => Math.max(0, Math.min(255, v))).join(',');
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }
      let best = null;
      for (const [key, score] of buckets.entries()) {
        if (!best || score > best.score) best = { key, score };
      }
      if (best) setColorTheme(best.key.split(',').map(Number));
    } catch {}
  };

  const loadBranding = async () => {
    try {
      const response = await fetch('/api/branding', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const logoUrl = data.logo_url || FALLBACK_LOGO;
      if (!logoUrl) return;
      document.querySelectorAll('.site-logo-image').forEach(img => {
        img.src = `${logoUrl}${logoUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
        img.hidden = false;
      });
      document.querySelectorAll('.logo-text').forEach(el => el.hidden = true);
      await extractLogoTheme(logoUrl);
    } catch {}
  };

  const patchLogoElements = () => {
    document.querySelectorAll('.logo').forEach(logo => {
      if (logo.querySelector('.site-logo-image')) return;
      const image = document.createElement('img');
      image.className = 'site-logo-image';
      image.alt = 'Clever Toys';
      image.hidden = true;
      const text = document.createElement('span');
      text.className = 'logo-text';
      text.textContent = logo.textContent?.trim() || 'Clever Toys';
      logo.textContent = '';
      logo.append(image, text);
    });
  };

  const patchStorage = () => {
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
  };

  const init = () => {
    patchLogoElements();
    patchStorage();
    updateCartBadges();
    loadBranding();
  };

  window.addEventListener('storage', event => { if (event.key === CART_KEY) updateCartBadges(); });
  window.addEventListener('clever-cart-updated', updateCartBadges);
  window.addEventListener('cart-updated', updateCartBadges);
  document.addEventListener('DOMContentLoaded', updateCartBadges);
  init();
})();
