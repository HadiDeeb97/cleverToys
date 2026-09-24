(() => {
  const CART_KEY = 'cleverToysCart';
  const STORE_NAME = 'Clever Toys';
  const DEFAULT_WHATSAPP_URL = 'https://wa.me/96171220251?text=Hello%20Clever%20Toys%21%20I%20have%20a%20question%20about%20your%20toys.';
  const getWhatsappUrl = () => String(window.__CLEVER_BRANDING__?.whatsappUrl || '').trim() || DEFAULT_WHATSAPP_URL;
  const branding = window.__CLEVER_BRANDING__ || {};
  const FALLBACK_LOGO = branding.logoUrl || '';
  const THEME_KEY = 'cleverToysTheme';
  const whatsappSvg = '<svg viewBox="0 0 32 32" focusable="false" aria-hidden="true"><path d="M16 3.2C9.1 3.2 3.5 8.8 3.5 15.7c0 2.2.6 4.4 1.8 6.3L3.2 28.8l6.9-2.1c1.8 1 3.8 1.5 5.9 1.5 6.9 0 12.5-5.6 12.5-12.5S22.9 3.2 16 3.2Zm0 22.8c-1.9 0-3.8-.5-5.4-1.5l.4-.2-4.1 1.2 1.2-4-.3-.4c-1-1.6-1.5-3.5-1.5-5.4C5.5 9.9 10.2 5.2 16 5.2s10.5 4.7 10.5 10.5S21.8 26 16 26Zm5.8-7.8c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.7-1.7-2-.2-.3 0-.5.1-.7.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z" fill="currentColor"/></svg>';
  const detectDevice = () => {
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const device = width <= 767 ? 'mobile' : width <= 1024 ? 'tablet' : 'desktop';
    const root = document.documentElement;
    if (root.dataset.device !== device) root.dataset.device = device;
    root.dataset.input = device === 'desktop' ? 'pointer' : 'touch';
    return device;
  };
  const readCart = () => { try { const items = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(items) ? items.filter(i => i && Number(i.quantity) > 0) : []; } catch { return []; } };
  const cartCount = () => readCart().reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
  const normalizeCartLink = link => { if (!(link instanceof HTMLAnchorElement)) return; link.classList.add('cart-link'); link.innerHTML = '<span class="cart-icon" aria-hidden="true">🛒</span><span class="cart-label">Cart</span><span class="cart-count-badge" aria-hidden="true"></span>'; };
  let lastCartCount = null;
  const bump = element => { if (!element || element.hidden) return; element.classList.remove('bump'); void element.offsetWidth; element.classList.add('bump'); element.addEventListener('animationend', () => element.classList.remove('bump'), { once: true }); };
  const updateCartUI = () => {
    const count = cartCount();
    const grew = lastCartCount !== null && count > lastCartCount;
    lastCartCount = count;
    document.querySelectorAll('.site-header a[href="/cart"],.site-header a[href="/cart/"]').forEach(link => { normalizeCartLink(link); const badge = link.querySelector('.cart-count-badge'); if (badge) { badge.textContent = String(count); badge.hidden = count === 0; } link.setAttribute('aria-label', count ? `Shopping cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Shopping cart'); });
    const floating = document.getElementById('clever-floating-cart');
    if (grew) requestAnimationFrame(() => document.querySelectorAll('.site-header .cart-count-badge, .floating-cart-count').forEach(bump));
    if (floating) { const badge = floating.querySelector('.floating-cart-count'); if (badge) { badge.textContent = String(count); badge.hidden = count === 0; } floating.setAttribute('aria-label', count ? `Shopping cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Shopping cart'); }
  };
  const ensureControls = () => {
    if (location.pathname.startsWith('/admin')) return;
    let root = document.querySelector('.clever-floating-controls');
    const whatsappUrl = getWhatsappUrl();
    if (!root) { root = document.createElement('div'); root.className = 'clever-floating-controls'; root.innerHTML = `<a id="clever-floating-cart" class="clever-floating-cart" href="/cart" title="View your cart" aria-label="Shopping cart"><span class="floating-cart-icon" aria-hidden="true">🛒</span><span class="floating-cart-count" aria-hidden="true" hidden>0</span></a><a id="clever-floating-whatsapp" class="clever-floating-whatsapp" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" aria-label="Chat with Clever Toys on WhatsApp" title="Chat with us on WhatsApp">${whatsappSvg}</a>`; document.body.appendChild(root); }
    // branding-ui.js may set a page-specific greeting, so only fill the link when it is missing.
    else { const whatsapp = root.querySelector('#clever-floating-whatsapp'); if (whatsapp && !whatsapp.getAttribute('href')) whatsapp.href = whatsappUrl; }
    updateCartUI();
  };
  const ensureCartLinks = () => {
    if (location.pathname.startsWith('/admin')) return;
    document.querySelectorAll('.site-header').forEach(header => { const selector = 'a[href="/cart"],a[href="/cart/"]'; if (!header.querySelector(selector)) { const target = header.querySelector('.header-actions') || header.querySelector('.main-nav'); if (target) { const cart = document.createElement('a'); cart.href = '/cart'; target.appendChild(cart); } } [...header.querySelectorAll(selector)].slice(1).forEach(link => link.remove()); });
    updateCartUI();
  };
  const patchLogos = () => document.querySelectorAll('.logo').forEach(logo => { let image = logo.querySelector('.site-logo-image'); let text = logo.querySelector('.logo-text'); if (!image) { image = document.createElement('img'); image.className = 'site-logo-image'; image.alt = STORE_NAME; image.decoding = 'async'; image.addEventListener('error', () => { image.hidden = true; }); logo.prepend(image); } if (!text) { text = document.createElement('span'); text.className = 'logo-text'; logo.appendChild(text); } text.textContent = STORE_NAME; if (FALLBACK_LOGO) { image.src = FALLBACK_LOGO; image.hidden = false; } else { image.removeAttribute('src'); image.hidden = true; } });
  const validHex = value => /^#[0-9a-f]{6}$/i.test(String(value || ''));
  // Pick white or dark ink text, whichever reads better on the given theme color.
  const readableText = hex => { const channel = v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; const lum = value => { const n = parseInt(value.slice(1), 16); return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); }; const color = lum(hex); const onWhite = 1.05 / (color + 0.05); const onInk = (color + 0.05) / (lum('#1b1530') + 0.05); return onWhite >= 4.5 || onWhite >= onInk ? '#ffffff' : '#1b1530'; };
  const applyTheme = theme => { if (!theme || !validHex(theme.primary) || !validHex(theme.soft) || !validHex(theme.accent)) return false; const root = document.documentElement; root.style.setProperty('--brand-primary', theme.primary); root.style.setProperty('--brand-primary-2', validHex(theme.primary2) ? theme.primary2 : theme.primary); root.style.setProperty('--brand-primary-hover', `color-mix(in srgb,${theme.primary} 86%,#000)`); root.style.setProperty('--brand-soft', theme.soft); root.style.setProperty('--theme-accent', theme.accent); root.style.setProperty('--brand-text-on-primary', readableText(theme.primary)); root.style.setProperty('--theme-text-on-accent', readableText(theme.accent)); try { localStorage.setItem(THEME_KEY, theme.primary); } catch {} return true; };
  const applyCachedThemeImmediately = () => { if (branding.useLogoColors === true) return; if (branding.publishedTheme && applyTheme(branding.publishedTheme)) return; };
  const imageViewerState = { images: [], index: 0, previousOverflow: '' };
  const ensureImageViewerStyles = () => { if (document.getElementById('clever-image-viewer-styles')) return; const style = document.createElement('style'); style.id = 'clever-image-viewer-styles'; style.textContent = `.clever-image-viewer{position:fixed;inset:0;z-index:20000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.94);padding:18px;touch-action:none}.clever-image-viewer.is-open{display:flex}.clever-image-viewer-image-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:100%;max-width:1400px}.clever-image-viewer-image{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;border-radius:8px;user-select:none;-webkit-user-drag:none;box-shadow:0 20px 60px rgba(0,0,0,.35)}.clever-image-viewer-button{position:absolute;border:0;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;cursor:pointer;backdrop-filter:blur(8px);transition:background .15s,transform .15s;z-index:2}.clever-image-viewer-button:hover{background:rgba(255,255,255,.24);transform:scale(1.04)}.clever-image-viewer-close{top:12px;right:12px;font-size:26px}.clever-image-viewer-prev{left:12px;top:50%;transform:translateY(-50%);font-size:30px}.clever-image-viewer-next{right:12px;top:50%;transform:translateY(-50%);font-size:30px}.clever-image-viewer-prev:hover,.clever-image-viewer-next:hover{transform:translateY(-50%) scale(1.04)}.clever-image-viewer-counter{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);padding:7px 11px;border-radius:999px;background:rgba(0,0,0,.45);color:#fff;font-size:.82rem;line-height:1;backdrop-filter:blur(8px);z-index:2}.clever-image-viewer-hint{position:absolute;left:50%;top:14px;transform:translateX(-50%);padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.1);color:rgba(255,255,255,.8);font-size:.75rem;z-index:2;pointer-events:none}@media(max-width:767px){.clever-image-viewer{padding:10px}.clever-image-viewer-image{max-width:100%;max-height:88vh;border-radius:5px}.clever-image-viewer-button{width:42px;height:42px}.clever-image-viewer-prev{left:6px}.clever-image-viewer-next{right:6px}.clever-image-viewer-close{top:8px;right:8px}.clever-image-viewer-hint{display:none}}`; document.head.appendChild(style); };
  const getViewerImages = () => { const seen = new Set(); return [...document.querySelectorAll('img')].filter(img => { if (!(img instanceof HTMLImageElement)) return false; if (!img.currentSrc && !img.src) return false; if (img.closest('.clever-image-viewer')) return false; if (img.classList.contains('site-logo-image') || img.closest('.logo')) return false; if (img.closest('a')) return false; if (img.closest('.clever-floating-controls')) return false; if (img.closest('button') && img.closest('button')?.getAttribute('aria-label')?.toLowerCase().includes('delete')) return false; const url = img.currentSrc || img.src; if (!url || seen.has(url)) return false; if (img.width < 60 || img.height < 60) return false; seen.add(url); return true; }).map(img => ({ src: img.currentSrc || img.src, alt: img.alt || STORE_NAME })); };
  const closeImageViewer = () => { const viewer = document.getElementById('clever-image-viewer'); if (!viewer) return; viewer.classList.remove('is-open'); viewer.setAttribute('aria-hidden', 'true'); document.body.style.overflow = imageViewerState.previousOverflow; };
  const renderImageViewer = () => { const viewer = document.getElementById('clever-image-viewer'); if (!viewer || !imageViewerState.images.length) return; const item = imageViewerState.images[imageViewerState.index]; const image = viewer.querySelector('.clever-image-viewer-image'); const counter = viewer.querySelector('.clever-image-viewer-counter'); const prev = viewer.querySelector('.clever-image-viewer-prev'); const next = viewer.querySelector('.clever-image-viewer-next'); if (image) { image.src = item.src; image.alt = item.alt; } if (counter) counter.textContent = imageViewerState.images.length > 1 ? `${imageViewerState.index + 1} / ${imageViewerState.images.length}` : ''; if (prev) prev.hidden = imageViewerState.images.length <= 1; if (next) next.hidden = imageViewerState.images.length <= 1; };
  const showImageAt = index => { if (!imageViewerState.images.length) return; const total = imageViewerState.images.length; imageViewerState.index = (index + total) % total; renderImageViewer(); };
  const openImageViewer = (clickedSrc, clickedAlt) => { ensureImageViewerStyles(); let viewer = document.getElementById('clever-image-viewer'); if (!viewer) { viewer = document.createElement('div'); viewer.id = 'clever-image-viewer'; viewer.className = 'clever-image-viewer'; viewer.setAttribute('role', 'dialog'); viewer.setAttribute('aria-modal', 'true'); viewer.setAttribute('aria-hidden', 'true'); viewer.innerHTML = `<button class="clever-image-viewer-button clever-image-viewer-close" type="button" aria-label="Close image viewer">×</button><button class="clever-image-viewer-button clever-image-viewer-prev" type="button" aria-label="Previous image">‹</button><div class="clever-image-viewer-image-wrap"><img class="clever-image-viewer-image" alt="" decoding="async" draggable="false" /></div><button class="clever-image-viewer-button clever-image-viewer-next" type="button" aria-label="Next image">›</button><div class="clever-image-viewer-counter" aria-live="polite"></div><div class="clever-image-viewer-hint">Click outside or press Esc to close</div>`; document.body.appendChild(viewer); viewer.addEventListener('click', event => { if (event.target === viewer || event.target === viewer.querySelector('.clever-image-viewer-image-wrap')) closeImageViewer(); }); viewer.querySelector('.clever-image-viewer-close')?.addEventListener('click', closeImageViewer); viewer.querySelector('.clever-image-viewer-prev')?.addEventListener('click', event => { event.stopPropagation(); showImageAt(imageViewerState.index - 1); }); viewer.querySelector('.clever-image-viewer-next')?.addEventListener('click', event => { event.stopPropagation(); showImageAt(imageViewerState.index + 1); }); document.addEventListener('keydown', event => { const open = document.getElementById('clever-image-viewer')?.classList.contains('is-open'); if (!open) return; if (event.key === 'Escape') closeImageViewer(); else if (event.key === 'ArrowLeft') showImageAt(imageViewerState.index - 1); else if (event.key === 'ArrowRight') showImageAt(imageViewerState.index + 1); }); let touchStartX = 0; let touchStartY = 0; viewer.addEventListener('touchstart', event => { const touch = event.changedTouches[0]; touchStartX = touch.clientX; touchStartY = touch.clientY; }, { passive: true }); viewer.addEventListener('touchend', event => { const touch = event.changedTouches[0]; const dx = touch.clientX - touchStartX; const dy = touch.clientY - touchStartY; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) && imageViewerState.images.length > 1) showImageAt(imageViewerState.index + (dx < 0 ? 1 : -1)); }, { passive: true }); } imageViewerState.images = getViewerImages(); if (!imageViewerState.images.length) imageViewerState.images = [{ src: clickedSrc, alt: clickedAlt || STORE_NAME }]; const clickedIndex = imageViewerState.images.findIndex(item => item.src === clickedSrc); imageViewerState.index = clickedIndex >= 0 ? clickedIndex : 0; imageViewerState.previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; viewer.classList.add('is-open'); viewer.setAttribute('aria-hidden', 'false'); renderImageViewer(); };
  const bindImageViewer = () => { if (location.pathname.startsWith('/admin') || location.pathname === '/products' || location.pathname === '/products/' || /^\/products\/page\/\d+\/?$/.test(location.pathname)) return; document.querySelectorAll('img').forEach(img => { if (!(img instanceof HTMLImageElement)) return; if (img.closest('.clever-image-viewer') || img.classList.contains('site-logo-image') || img.closest('.logo') || img.closest('.clever-floating-controls')) return; if (img.closest('a, button')) return; if (img.dataset.cleverViewerBound === 'true') return; if (img.width < 60 && img.height < 60) return; img.dataset.cleverViewerBound = 'true'; img.classList.add('clever-image-clickable'); img.setAttribute('tabindex', '0'); img.setAttribute('role', 'button'); img.setAttribute('aria-label', img.alt ? `View ${img.alt}` : 'View image'); img.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openImageViewer(img.currentSrc || img.src, img.alt || STORE_NAME); }); img.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openImageViewer(img.currentSrc || img.src, img.alt || STORE_NAME); } }); }); };
  // Fade cards and headings up as they scroll into view. Elements already on screen are left alone.
  let revealObserver = null;
  const initReveal = () => {
    if (location.pathname.startsWith('/admin') || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    revealObserver ??= new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const element = entry.target;
      revealObserver.unobserve(element);
      element.classList.add('reveal-in');
      element.classList.remove('reveal-pending');
      const done = event => { if (event.propertyName !== 'transform') return; element.removeEventListener('transitionend', done); element.classList.remove('reveal-in'); element.style.removeProperty('--reveal-delay'); };
      element.addEventListener('transitionend', done);
    }), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    const fold = window.innerHeight;
    document.querySelectorAll('.product-card, .category-card, .category-page-card, .benefit-grid > div, .section-header, .cart-item').forEach(element => {
      if (element.dataset.reveal) return;
      element.dataset.reveal = '1';
      if (element.getBoundingClientRect().top < fold) return;
      const index = element.parentElement ? [...element.parentElement.children].indexOf(element) % 4 : 0;
      element.style.setProperty('--reveal-delay', `${index * 70}ms`);
      element.classList.add('reveal-pending');
      revealObserver.observe(element);
    });
  };
  const initVisitorAnalytics = () => {
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/api')) return;
    if (document.querySelector('script[data-clever-visitor-analytics]')) return;
    const script = document.createElement('script');
    script.src = '/visitor-analytics.js?v=20260916-1';
    script.async = true;
    script.dataset.cleverVisitorAnalytics = 'true';
    document.head.appendChild(script);
  };
  const refresh = () => { detectDevice(); if (location.pathname.startsWith('/admin')) return; patchLogos(); ensureCartLinks(); ensureControls(); bindImageViewer(); initReveal(); initVisitorAnalytics(); updateCartUI(); };
  // The server injects the published theme into every page, so there is nothing to fetch here.
  applyCachedThemeImmediately(); refresh();
  window.addEventListener('resize', detectDevice, { passive: true }); window.addEventListener('orientationchange', detectDevice, { passive: true }); window.addEventListener('storage', e => { if (e.key === CART_KEY) refresh(); }); window.addEventListener('clever-cart-updated', refresh); window.addEventListener('cart-updated', refresh); window.addEventListener('pageshow', refresh); document.addEventListener('DOMContentLoaded', refresh);;
})();
