/**
 * store-ui.js: shared behaviour for every storefront page (not the admin panel).
 *
 *  - Cart counters in the header and on the floating cart button (the cart lives in localStorage)
 *  - Floating cart + WhatsApp buttons and the header cart link (fallbacks if the server did not add them)
 *  - Slide-in menu (phones/tablets) and cart drawer (opens after "Add to cart")
 *  - "Add to cart" buttons on product cards and small toast messages
 *  - Full-screen photo viewer when a product photo is tapped
 *  - Gentle fade-in of cards as they scroll into view
 *  - Loads the visitor analytics script
 *
 * The header, footer and floating buttons are normally drawn by src/middleware.ts; this file only
 * fills in live values (like the cart count) and never rebuilds elements the shopper might be tapping.
 */
(() => {
  if (location.pathname.startsWith('/admin')) return;

  const CART_KEY = 'cleverToysCart';
  const STORE_NAME = 'Clever Toys';
  const DEFAULT_WHATSAPP_URL = 'https://wa.me/96171220251?text=Hello%20Clever%20Toys%21%20I%20have%20a%20question%20about%20your%20toys.';
  const branding = window.__CLEVER_BRANDING__ || {};
  const WHATSAPP_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';

  // ---------- Cart counters ----------
  const readCart = () => {
    try {
      const items = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(items) ? items.filter((i) => i && Number(i.quantity) > 0) : [];
    } catch {
      return [];
    }
  };
  const cartCount = () => readCart().reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
  const cartLabel = (count) => count ? `Shopping cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Shopping cart';

  /** Gives a plain "Cart" link the icon + badge layout. Runs once per link, never on later updates. */
  const normalizeCartLink = (link) => {
    if (!(link instanceof HTMLAnchorElement) || link.querySelector('.cart-count-badge')) return;
    link.classList.add('cart-link');
    link.innerHTML = '<span class="cart-icon" aria-hidden="true">🛒</span><span class="cart-label">Cart</span><span class="cart-count-badge" aria-hidden="true" hidden></span>';
  };

  /** Small "pop" on a badge when something is added. */
  const bump = (element) => {
    if (!element || element.hidden) return;
    element.classList.remove('bump');
    void element.offsetWidth; // restart the animation
    element.classList.add('bump');
    element.addEventListener('animationend', () => element.classList.remove('bump'), { once: true });
  };

  let lastCartCount = null;
  /** Updates every cart badge. Only text and attributes change, so links stay tappable. */
  const updateCartUI = () => {
    const count = cartCount();
    const grew = lastCartCount !== null && count > lastCartCount;
    lastCartCount = count;
    document.querySelectorAll('.site-header a[href="/cart"],.site-header a[href="/cart/"]').forEach((link) => {
      normalizeCartLink(link);
      const badge = link.querySelector('.cart-count-badge');
      if (badge) { badge.textContent = String(count); badge.hidden = count === 0; }
      link.setAttribute('aria-label', cartLabel(count));
    });
    const floating = document.getElementById('clever-floating-cart');
    if (floating) {
      const badge = floating.querySelector('.floating-cart-count');
      if (badge) { badge.textContent = String(count); badge.hidden = count === 0; }
      floating.setAttribute('aria-label', cartLabel(count));
    }
    if (grew) requestAnimationFrame(() => document.querySelectorAll('.site-header .cart-count-badge, .floating-cart-count').forEach(bump));
  };

  // ---------- Fallbacks for pages the server did not decorate ----------
  const ensureFloatingControls = () => {
    if (document.querySelector('.clever-floating-controls')) return;
    const whatsappUrl = String(branding.whatsappUrl || '').trim() || DEFAULT_WHATSAPP_URL;
    const root = document.createElement('div');
    root.className = 'clever-floating-controls';
    root.innerHTML = `<a id="clever-floating-cart" class="clever-floating-cart" href="/cart" title="View your cart" aria-label="Shopping cart"><span class="floating-cart-icon" aria-hidden="true">🛒</span><span class="floating-cart-count" aria-hidden="true" hidden>0</span></a><a id="clever-floating-whatsapp" class="clever-floating-whatsapp" href="${whatsappUrl.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer" aria-label="Chat with Clever Toys on WhatsApp" title="Chat with us on WhatsApp">${WHATSAPP_SVG}</a>`;
    document.body.appendChild(root);
  };

  const ensureHeaderCartLink = () => {
    document.querySelectorAll('.site-header').forEach((header) => {
      const selector = 'a[href="/cart"],a[href="/cart/"]';
      if (!header.querySelector(selector)) {
        const target = header.querySelector('.header-actions') || header.querySelector('.main-nav');
        if (target) { const cart = document.createElement('a'); cart.href = '/cart'; target.appendChild(cart); }
      }
      [...header.querySelectorAll(selector)].slice(1).forEach((link) => link.remove()); // keep only one
    });
  };

  /** Logo image from Admin → Branding for headers that only have text. */
  const ensureLogos = () => {
    if (!branding.logoUrl) return;
    document.querySelectorAll('.logo').forEach((logo) => {
      if (logo.querySelector('.site-logo-image')) return;
      const image = document.createElement('img');
      image.className = 'site-logo-image';
      image.alt = STORE_NAME;
      image.decoding = 'async';
      image.addEventListener('error', () => { image.hidden = true; });
      image.src = branding.logoUrl;
      logo.prepend(image);
    });
  };

  // ---------- Full-screen photo viewer ----------
  // Product photos that are not links open in a viewer with swipe, arrow keys and Esc.
  const viewer = { images: [], index: 0, previousOverflow: '' };
  const isViewerCandidate = (img) =>
    img instanceof HTMLImageElement &&
    (img.currentSrc || img.src) &&
    !img.closest('.clever-image-viewer, .logo, .clever-floating-controls, a, button, .site-header, .site-footer') &&
    !(img.width < 60 && img.height < 60);

  const ensureViewer = () => {
    let el = document.getElementById('clever-image-viewer');
    if (el) return el;
    const style = document.createElement('style');
    style.id = 'clever-image-viewer-styles';
    style.textContent = `.clever-image-viewer{position:fixed;inset:0;z-index:20000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.94);padding:18px;touch-action:none}.clever-image-viewer.is-open{display:flex}.clever-image-viewer-image-wrap{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:100%;max-width:1400px}.clever-image-viewer-image{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;border-radius:8px;user-select:none;-webkit-user-drag:none;box-shadow:0 20px 60px rgba(0,0,0,.35)}.clever-image-viewer-button{position:absolute;border:0;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;cursor:pointer;backdrop-filter:blur(8px);transition:background .15s,transform .15s;z-index:2}@media (hover:hover){.clever-image-viewer-button:hover{background:rgba(255,255,255,.24);transform:scale(1.04)}}.clever-image-viewer-close{top:12px;right:12px;font-size:26px}.clever-image-viewer-prev{left:12px;top:50%;transform:translateY(-50%);font-size:30px}.clever-image-viewer-next{right:12px;top:50%;transform:translateY(-50%);font-size:30px}@media (hover:hover){.clever-image-viewer-prev:hover,.clever-image-viewer-next:hover{transform:translateY(-50%) scale(1.04)}}.clever-image-viewer-counter{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);padding:7px 11px;border-radius:999px;background:rgba(0,0,0,.45);color:#fff;font-size:.82rem;line-height:1;backdrop-filter:blur(8px);z-index:2}.clever-image-viewer-hint{position:absolute;left:50%;top:14px;transform:translateX(-50%);padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.1);color:rgba(255,255,255,.8);font-size:.75rem;z-index:2;pointer-events:none}@media(max-width:767px){.clever-image-viewer{padding:10px}.clever-image-viewer-image{max-width:100%;max-height:88vh;border-radius:5px}.clever-image-viewer-button{width:42px;height:42px}.clever-image-viewer-prev{left:6px}.clever-image-viewer-next{right:6px}.clever-image-viewer-close{top:8px;right:8px}.clever-image-viewer-hint{display:none}}`;
    document.head.appendChild(style);
    el = document.createElement('div');
    el.id = 'clever-image-viewer';
    el.className = 'clever-image-viewer';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<button class="clever-image-viewer-button clever-image-viewer-close" type="button" aria-label="Close image viewer">×</button><button class="clever-image-viewer-button clever-image-viewer-prev" type="button" aria-label="Previous image">‹</button><div class="clever-image-viewer-image-wrap"><img class="clever-image-viewer-image" alt="" decoding="async" draggable="false" /></div><button class="clever-image-viewer-button clever-image-viewer-next" type="button" aria-label="Next image">›</button><div class="clever-image-viewer-counter" aria-live="polite"></div><div class="clever-image-viewer-hint">Click outside or press Esc to close</div>';
    document.body.appendChild(el);
    el.addEventListener('click', (event) => { if (event.target === el || event.target === el.querySelector('.clever-image-viewer-image-wrap')) closeViewer(); });
    el.querySelector('.clever-image-viewer-close').addEventListener('click', closeViewer);
    el.querySelector('.clever-image-viewer-prev').addEventListener('click', (event) => { event.stopPropagation(); showImage(viewer.index - 1); });
    el.querySelector('.clever-image-viewer-next').addEventListener('click', (event) => { event.stopPropagation(); showImage(viewer.index + 1); });
    document.addEventListener('keydown', (event) => {
      if (!el.classList.contains('is-open')) return;
      if (event.key === 'Escape') closeViewer();
      else if (event.key === 'ArrowLeft') showImage(viewer.index - 1);
      else if (event.key === 'ArrowRight') showImage(viewer.index + 1);
    });
    // Swipe left/right to change photo.
    let startX = 0, startY = 0;
    el.addEventListener('touchstart', (event) => { const t = event.changedTouches[0]; startX = t.clientX; startY = t.clientY; }, { passive: true });
    el.addEventListener('touchend', (event) => {
      const t = event.changedTouches[0];
      const dx = t.clientX - startX, dy = t.clientY - startY;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) && viewer.images.length > 1) showImage(viewer.index + (dx < 0 ? 1 : -1));
    }, { passive: true });
    return el;
  };

  const renderViewer = () => {
    const el = document.getElementById('clever-image-viewer');
    const item = viewer.images[viewer.index];
    if (!el || !item) return;
    const image = el.querySelector('.clever-image-viewer-image');
    image.src = item.src;
    image.alt = item.alt;
    el.querySelector('.clever-image-viewer-counter').textContent = viewer.images.length > 1 ? `${viewer.index + 1} / ${viewer.images.length}` : '';
    el.querySelector('.clever-image-viewer-prev').hidden = viewer.images.length <= 1;
    el.querySelector('.clever-image-viewer-next').hidden = viewer.images.length <= 1;
  };
  const showImage = (index) => {
    if (!viewer.images.length) return;
    viewer.index = (index + viewer.images.length) % viewer.images.length;
    renderViewer();
  };
  const openViewer = (src, alt) => {
    const el = ensureViewer();
    const seen = new Set();
    // All photos of the product (from the gallery thumbnails), or just the one that was tapped.
    const fromThumbs = [...document.querySelectorAll('.thumbnail[data-image]')].map((b) => ({ src: b.dataset.image, alt: b.dataset.alt || STORE_NAME }));
    viewer.images = (fromThumbs.length ? fromThumbs : [{ src, alt: alt || STORE_NAME }]).filter((item) => item.src && !seen.has(item.src) && seen.add(item.src));
    if (!viewer.images.length) viewer.images = [{ src, alt: alt || STORE_NAME }];
    viewer.index = Math.max(0, viewer.images.findIndex((item) => item.src === src));
    viewer.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    renderViewer();
  };
  function closeViewer() {
    const el = document.getElementById('clever-image-viewer');
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = viewer.previousOverflow;
  }

  /** Makes product photos open the viewer (the product page gallery, or any image marked data-zoomable). */
  const bindImageViewer = () => {
    document.querySelectorAll('.gallery-main img, img[data-zoomable]').forEach((img) => {
      if (img.dataset.cleverViewerBound || !isViewerCandidate(img)) return;
      img.dataset.cleverViewerBound = 'true';
      img.classList.add('clever-image-clickable');
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', img.alt ? `View ${img.alt}` : 'View image');
      const open = () => openViewer(img.currentSrc || img.src, img.alt || STORE_NAME);
      img.addEventListener('click', (event) => { event.preventDefault(); open(); });
      img.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });
  };

  // ---------- Fade-in on scroll ----------
  // Only elements that start below the screen fade in, so nothing visible ever flickers.
  // The cart list is skipped because it is redrawn on every quantity change.
  let revealObserver = null;
  const initReveal = () => {
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    revealObserver ??= new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const element = entry.target;
      revealObserver.unobserve(element);
      element.classList.add('reveal-in');
      element.classList.remove('reveal-pending');
      const done = (event) => {
        if (event.propertyName !== 'transform') return;
        element.removeEventListener('transitionend', done);
        element.classList.remove('reveal-in');
        element.style.removeProperty('--reveal-delay');
      };
      element.addEventListener('transitionend', done);
    }), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    const fold = window.innerHeight;
    document.querySelectorAll('.product-card, .category-tile, .category-page-card, .age-tile, .section-header, .promo-banner, .story-block, .help-card').forEach((element) => {
      if (element.dataset.reveal) return;
      element.dataset.reveal = '1';
      if (element.getBoundingClientRect().top < fold) return;
      const index = element.parentElement ? [...element.parentElement.children].indexOf(element) % 4 : 0;
      element.style.setProperty('--reveal-delay', `${index * 70}ms`);
      element.classList.add('reveal-pending');
      revealObserver.observe(element);
    });
  };

  // ---------- Visitor analytics (Admin → Visitors) ----------
  const loadVisitorAnalytics = () => {
    if (location.pathname.startsWith('/api') || document.querySelector('script[data-clever-visitor-analytics]')) return;
    const script = document.createElement('script');
    script.src = '/visitor-analytics.js?v=20260926-1';
    script.async = true;
    script.dataset.cleverVisitorAnalytics = 'true';
    document.head.appendChild(script);
  };

  // ---------- Money and cart helpers shared by the drawers ----------
  const money = (n) => `$${Number(n || 0).toFixed(2)}`;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const saveCart = (cart) => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { toast('Your browser blocked the cart. Please allow site storage.'); return false; }
    window.dispatchEvent(new CustomEvent('clever-cart-updated'));
    return true;
  };
  const placeholderEmoji = (name) => { let h = 0; for (const ch of String(name || 'toy')) h = (h * 31 + ch.codePointAt(0)) >>> 0; return ['🧸', '🚂', '🧩', '🎨', '🪀', '🚀', '🦖', '🎲', '🪁', '🧱', '🎈', '🦄'][h % 12]; };

  // ---------- Toast: small message at the bottom of the screen ----------
  let toastTimer = 0;
  function toast(message) {
    let el = document.querySelector('.store-toast');
    if (!el) { el = document.createElement('div'); el.className = 'store-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = message;
    requestAnimationFrame(() => el.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
  }

  // ---------- Drawers: the menu (left) and the cart (right) ----------
  // Opening: remove [hidden], then add .is-open on the next frame so the slide-in animates.
  let lastTrigger = null;
  const openDrawer = (drawer, trigger, focusSelector) => {
    if (!drawer) return;
    document.querySelectorAll('.drawer.is-open').forEach((d) => d !== drawer && closeDrawer(d, false));
    lastTrigger = trigger || document.activeElement;
    drawer.hidden = false;
    document.body.classList.add('has-drawer');
    requestAnimationFrame(() => requestAnimationFrame(() => drawer.classList.add('is-open')));
    document.querySelectorAll(`[aria-controls="${drawer.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'true'));
    const target = drawer.querySelector(focusSelector || '[data-drawer-close]');
    // On phones, only move focus into the search box when search was asked for (it opens the keyboard).
    setTimeout(() => target?.focus({ preventScroll: true }), 60);
  };
  const closeDrawer = (drawer, restoreFocus = true) => {
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove('is-open');
    document.querySelectorAll(`[aria-controls="${drawer.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (!document.querySelector('.drawer.is-open')) document.body.classList.remove('has-drawer');
    setTimeout(() => { if (!drawer.classList.contains('is-open')) drawer.hidden = true; }, 360);
    if (restoreFocus && lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
  };
  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-drawer-open]');
    if (opener) {
      event.preventDefault();
      openDrawer(document.getElementById(opener.dataset.drawerOpen), opener, opener.dataset.drawerFocus === 'search' ? 'input[type=search]' : null);
      return;
    }
    const closer = event.target.closest('[data-drawer-close]');
    if (closer) { event.preventDefault(); closeDrawer(closer.closest('.drawer')); }
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.querySelectorAll('.drawer.is-open').forEach((d) => closeDrawer(d)); });

  // ---------- Cart drawer: opens after something is added, lets shoppers adjust quantities ----------
  const cartDrawer = () => {
    let drawer = document.getElementById('cart-drawer');
    if (drawer) return drawer;
    drawer = document.createElement('div');
    drawer.className = 'drawer from-right';
    drawer.id = 'cart-drawer';
    drawer.hidden = true;
    drawer.innerHTML = '<div class="drawer-backdrop" data-drawer-close></div><aside class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title"><div class="drawer-head"><strong id="cart-drawer-title">Your cart</strong><button type="button" class="icon-button" data-drawer-close aria-label="Close cart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="drawer-body" data-cart-drawer-body></div><div class="drawer-foot" data-cart-drawer-foot></div></aside>';
    document.body.appendChild(drawer);
    // − / + / remove inside the drawer
    drawer.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-cd-action]');
      if (!button || button.disabled) return;
      const cart = readCart();
      const item = cart[Number(button.dataset.index)];
      if (!item) return;
      const max = Number(item.maxStock);
      if (button.dataset.cdAction === 'minus') item.quantity = Math.max(1, Number(item.quantity) - 1);
      if (button.dataset.cdAction === 'plus') item.quantity = Number.isFinite(max) && max > 0 ? Math.min(Number(item.quantity) + 1, max) : Number(item.quantity) + 1;
      if (button.dataset.cdAction === 'remove') cart.splice(Number(button.dataset.index), 1);
      saveCart(cart);
    });
    return drawer;
  };
  const renderCartDrawer = () => {
    const drawer = document.getElementById('cart-drawer');
    if (!drawer) return;
    const cart = readCart();
    const body = drawer.querySelector('[data-cart-drawer-body]');
    const foot = drawer.querySelector('[data-cart-drawer-foot]');
    const count = cartCount();
    drawer.querySelector('#cart-drawer-title').textContent = count ? `Your cart (${count})` : 'Your cart';
    if (!cart.length) {
      body.innerHTML = '<div class="cart-drawer-empty"><span aria-hidden="true">🧺</span><strong>Your cart is empty</strong><p>Find something fun to add.</p><a class="button" href="/products">Shop toys</a></div>';
      foot.hidden = true;
      return;
    }
    body.innerHTML = cart.map((item, i) => {
      const max = Number(item.maxStock);
      const thumb = item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy">` : `<span aria-hidden="true">${placeholderEmoji(item.name)}</span>`;
      return `<div class="cart-drawer-item"><a class="cd-thumb" href="/product/${encodeURIComponent(item.slug || '')}" tabindex="-1">${thumb}</a><div><strong>${esc(item.name)}</strong>${item.variantName ? `<small>${esc(item.variantName)}</small>` : ''}<div class="quantity-control"><button type="button" data-cd-action="minus" data-index="${i}" aria-label="Decrease quantity"${Number(item.quantity) <= 1 ? ' disabled' : ''}>−</button><strong>${Number(item.quantity)}</strong><button type="button" data-cd-action="plus" data-index="${i}" aria-label="Increase quantity"${Number.isFinite(max) && max > 0 && Number(item.quantity) >= max ? ' disabled' : ''}>+</button><button type="button" class="remove-link" data-cd-action="remove" data-index="${i}">Remove</button></div></div><strong>${money(Number(item.price) * Number(item.quantity))}</strong></div>`;
    }).join('');
    const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const threshold = Math.max(0, Number(branding.freeDeliveryThreshold || 0));
    const progress = threshold
      ? `<div class="delivery-progress"><p>${subtotal >= threshold ? '🎉 You unlocked free delivery!' : `Add <strong>${money(threshold - subtotal)}</strong> more for free delivery`}</p><div class="delivery-progress-track" aria-hidden="true"><i style="width:${Math.min(100, Math.round((subtotal / threshold) * 100))}%"></i></div></div>`
      : '';
    foot.hidden = false;
    foot.innerHTML = `${progress}<div class="cart-drawer-total"><span>Subtotal</span><span>${money(subtotal)}</span></div><div class="cart-drawer-actions"><a class="button" href="/checkout">Checkout</a><a class="button secondary-button" href="/cart">View cart</a></div><p class="cart-drawer-note">Cash on delivery · Delivery fee shown at checkout</p>`;
  };
  const openCartDrawer = (trigger) => { cartDrawer(); renderCartDrawer(); openDrawer(document.getElementById('cart-drawer'), trigger); };

  // ---------- "Add to cart" buttons on product cards ----------
  // <button data-quick-add data-id data-name data-slug data-price data-image data-stock>
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-quick-add]');
    if (!button) return;
    event.preventDefault();
    const d = button.dataset;
    const maxStock = Number(d.stock);
    const cart = readCart();
    const existing = cart.find((item) => item.productId === d.id && !item.variantId);
    const nextQty = (existing ? Number(existing.quantity) : 0) + 1;
    if (Number.isFinite(maxStock) && maxStock > 0 && nextQty > maxStock) { toast(`Only ${maxStock} in stock, and they are all in your cart.`); return; }
    if (existing) { existing.quantity = nextQty; existing.maxStock = maxStock; existing.price = Number(d.price); }
    else cart.push({ productId: d.id, variantId: null, variantName: null, sku: null, name: d.name, slug: d.slug, price: Number(d.price), image: d.image || '', quantity: 1, maxStock });
    if (!saveCart(cart)) return;
    button.classList.add('is-added');
    setTimeout(() => button.classList.remove('is-added'), 1400);
    openCartDrawer(button);
  });
  // The product page (and anything else) can ask for the cart drawer after adding an item.
  window.addEventListener('clever-cart-added', (event) => openCartDrawer(event.detail?.trigger));

  // ---------- Account links for guests ----------
  // Visitors who are not signed in go straight to the sign-in page (then back to their account),
  // instead of opening /account first and being redirected from there.
  let signedIn = false;
  try { signedIn = Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k) && localStorage.getItem(k)); } catch {}
  if (!signedIn) document.querySelectorAll('a[href="/account"]').forEach((a) => { a.href = '/login?next=/account'; });

  // ---------- Broken product photos ----------
  // If a product photo fails to load (deleted file, bad link), hide it so the card shows its soft
  // background instead of the browser's broken-image icon. Errors don't bubble, so listen in the capture phase.
  document.addEventListener('error', (event) => {
    const img = event.target;
    if (img instanceof HTMLImageElement && img.closest('.product-media, .cart-item, .summary-item, .cart-drawer')) img.style.visibility = 'hidden';
  }, true);
  // Photos that already failed before this script loaded.
  document.querySelectorAll('.product-media img').forEach((img) => { if (img.complete && !img.naturalWidth && img.getAttribute('src')) img.style.visibility = 'hidden'; });

  // ---------- Header shadow once the page is scrolled ----------
  const header = document.querySelector('.site-header');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { header?.classList.toggle('is-scrolled', window.scrollY > 8); ticking = false; });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Start ----------
  // This file loads with "defer", so the page is fully parsed when it runs.
  ensureLogos();
  ensureHeaderCartLink();
  ensureFloatingControls();
  updateCartUI();
  bindImageViewer();
  initReveal();
  // Analytics waits until the page has finished loading so it never competes with the page itself.
  // A page the browser loaded ahead of time (speculation rules in src/middleware.ts) is only counted
  // once the shopper actually opens it.
  const startVisitorAnalytics = () => {
    if (document.readyState === 'complete') loadVisitorAnalytics();
    else window.addEventListener('load', loadVisitorAnalytics, { once: true });
  };
  if (document.prerendering) document.addEventListener('prerenderingchange', startVisitorAnalytics, { once: true });
  else startVisitorAnalytics();

  // Keep counters in sync: cart changed on this page, in another tab, or page restored with the Back button.
  window.addEventListener('clever-cart-updated', () => { updateCartUI(); renderCartDrawer(); });
  window.addEventListener('cart-updated', updateCartUI);
  window.addEventListener('storage', (event) => { if (event.key === CART_KEY) { updateCartUI(); renderCartDrawer(); } });
  window.addEventListener('pageshow', (event) => { if (event.persisted) updateCartUI(); });
})();
