(() => {
  const CART_KEY = 'cleverToysCart';
  const STORE_NAME = 'Clever Toys';
  const WHATSAPP_URL = 'https://wa.me/96171220251?text=Hello%2C%20I%27m%20interested%20with%20your%20product';
  const branding = window.__CLEVER_BRANDING__ || {};
  const FALLBACK_LOGO = branding.logoUrl || '';
  const THEME_KEY = 'cleverToysTheme';
  const DEFAULT_THEME = { primary: '#111827', soft: '#f3f4f6', accent: '#fbbf24' };
  const whatsappSvg = '<svg viewBox="0 0 32 32" focusable="false" aria-hidden="true"><path d="M16 3.2C9.1 3.2 3.5 8.8 3.5 15.7c0 2.2.6 4.4 1.8 6.3L3.2 28.8l6.9-2.1c1.8 1 3.8 1.5 5.9 1.5 6.9 0 12.5-5.6 12.5-12.5S22.9 3.2 16 3.2Zm0 22.8c-1.9 0-3.8-.5-5.4-1.5l.4-.2-4.1 1.2 1.2-4-.3-.4c-1-1.6-1.5-3.5-1.5-5.4C5.5 9.9 10.2 5.2 16 5.2s10.5 4.7 10.5 10.5S21.8 26 16 26Zm5.8-7.8c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.7-1.7-2-.2-.3 0-.5.1-.7.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z" fill="currentColor"/></svg>';

  const detectDevice = () => {
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const device = width <= 767 ? 'mobile' : width <= 1024 ? 'tablet' : 'desktop';
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches === true;
    const root = document.documentElement;
    if (root.dataset.device !== device) root.dataset.device = device;
    root.dataset.input = coarsePointer ? 'touch' : 'pointer';
    return device;
  };

  const readCart = () => {
    try {
      const items = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(items) ? items.filter(i => i && Number(i.quantity) > 0) : [];
    } catch {
      return [];
    }
  };

  const cartCount = () => readCart().reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);

  const normalizeCartLink = link => {
    if (!(link instanceof HTMLAnchorElement)) return;
    link.classList.add('cart-link');
    link.innerHTML = '<span class="cart-icon" aria-hidden="true">🛒</span><span class="cart-label">Cart</span><span class="cart-count-badge" aria-hidden="true"></span>';
  };

  const updateCartUI = () => {
    const count = cartCount();
    document.querySelectorAll('a[href="/cart"],a[href="/cart/"]').forEach(link => {
      normalizeCartLink(link);
      const badge = link.querySelector('.cart-count-badge');
      if (badge) {
        badge.textContent = String(count);
        badge.hidden = count === 0;
      }
      link.setAttribute('aria-label', count ? `Shopping cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Shopping cart');
    });

    const floating = document.getElementById('clever-floating-cart');
    if (floating) {
      const badge = floating.querySelector('.floating-cart-count');
      if (badge) {
        badge.textContent = String(count);
        badge.hidden = count === 0;
      }
      floating.setAttribute('aria-label', count ? `Shopping cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Shopping cart');
    }
  };

  const ensureControls = () => {
    if (location.pathname.startsWith('/admin')) return;
    let root = document.querySelector('.clever-floating-controls');
    if (!root) {
      root = document.createElement('div');
      root.className = 'clever-floating-controls';
      root.innerHTML = `<a id="clever-floating-cart" class="clever-floating-cart" href="/cart" title="View your cart" aria-label="Shopping cart"><span class="floating-cart-icon" aria-hidden="true">🛒</span><span class="floating-cart-count" aria-hidden="true" hidden>0</span></a><a id="clever-floating-whatsapp" class="clever-floating-whatsapp" href="${WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" aria-label="Chat with Clever Toys on WhatsApp" title="Chat with us on WhatsApp">${whatsappSvg}</a>`;
      document.body.appendChild(root);
    } else {
      const whatsapp = root.querySelector('#clever-floating-whatsapp');
      if (whatsapp) {
        whatsapp.href = WHATSAPP_URL;
        whatsapp.innerHTML = whatsappSvg;
      }
    }
    updateCartUI();
  };

  const ensureCartLinks = () => {
    if (location.pathname.startsWith('/admin')) return;
    document.querySelectorAll('.main-nav').forEach(nav => {
      const links = [...nav.querySelectorAll('a[href="/cart"],a[href="/cart/"]')];
      if (!links.length) {
        const cart = document.createElement('a');
        cart.href = '/cart';
        nav.appendChild(cart);
      }
      const all = [...nav.querySelectorAll('a[href="/cart"],a[href="/cart/"]')];
      all.slice(1).forEach(link => link.remove());
    });
    updateCartUI();
  };

  const patchLogos = () => document.querySelectorAll('.logo').forEach(logo => {
    let image = logo.querySelector('.site-logo-image');
    let text = logo.querySelector('.logo-text');
    if (!image) {
      image = document.createElement('img');
      image.className = 'site-logo-image';
      image.alt = STORE_NAME;
      image.decoding = 'async';
      logo.prepend(image);
    }
    if (!text) {
      text = document.createElement('span');
      text.className = 'logo-text';
      logo.appendChild(text);
    }
    text.textContent = STORE_NAME;
    if (FALLBACK_LOGO) {
      image.src = FALLBACK_LOGO;
      image.hidden = false;
    }
  });

  const validHex = value => /^#[0-9a-f]{6}$/i.test(String(value || ''));

  const applyTheme = theme => {
    if (!theme || !validHex(theme.primary) || !validHex(theme.soft) || !validHex(theme.accent)) return false;
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', theme.primary);
    root.style.setProperty('--brand-primary-hover', theme.primary);
    root.style.setProperty('--brand-soft', theme.soft);
    root.style.setProperty('--theme-accent', theme.accent);
    root.style.setProperty('--brand-text-on-primary', '#fff');
    try { localStorage.setItem(THEME_KEY, theme.primary); } catch {}
    return true;
  };

  const resetTheme = () => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', DEFAULT_THEME.primary);
    root.style.setProperty('--brand-primary-hover', DEFAULT_THEME.primary);
    root.style.setProperty('--brand-soft', DEFAULT_THEME.soft);
    root.style.setProperty('--theme-accent', DEFAULT_THEME.accent);
    root.style.setProperty('--brand-text-on-primary', '#fff');
    try { localStorage.removeItem(THEME_KEY); } catch {}
  };

  const applyCachedThemeImmediately = () => {
    if (branding.useLogoColors === true) return;
    if (branding.publishedTheme && applyTheme(branding.publishedTheme)) return;
    const primary = branding.theme || (() => {
      try { return localStorage.getItem(THEME_KEY) || ''; } catch { return ''; }
    })();
    if (validHex(primary)) document.documentElement.style.setProperty('--brand-primary', primary);
  };

  const loadGlobalTheme = async () => {
    if (!FALLBACK_LOGO) return;
    try {
      const base = FALLBACK_LOGO.split('/storage/v1/object/public/product-images/branding/')[0];
      const response = await fetch(`${base}/storage/v1/object/public/product-images/branding/theme.json?theme=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const raw = await response.text();
      const config = JSON.parse(raw);
      if (config?.mode === 'theme' && applyTheme(config.theme)) return;
      if (config?.mode === 'logo') resetTheme();
    } catch {}
  };

  const refresh = () => {
    detectDevice();
    if (location.pathname.startsWith('/admin')) return;
    patchLogos();
    ensureCartLinks();
    ensureControls();
    updateCartUI();
  };

  applyCachedThemeImmediately();
  refresh();
  loadGlobalTheme().then(refresh);

  window.addEventListener('resize', detectDevice, { passive: true });
  window.addEventListener('orientationchange', detectDevice, { passive: true });
  window.addEventListener('storage', e => { if (e.key === CART_KEY) refresh(); });
  window.addEventListener('clever-cart-updated', refresh);
  window.addEventListener('cart-updated', refresh);
  window.addEventListener('pageshow', refresh);
  document.addEventListener('DOMContentLoaded', refresh);
  setInterval(refresh, 500);
})();
