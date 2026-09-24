(() => {
  const fallbackWhatsappUrl = 'https://wa.me/96171220251?text=Hello%2C%20I%27m%20interested%20with%20your%20product';
  const customerKey = 'cleverToysCustomer';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const money = value => `$${Number(value || 0).toFixed(2)}`;
  const getDeliveryFee = (subtotal, branding) => {
    const fee = Math.max(0, Number(branding.codDeliveryPrice || 0));
    const threshold = Math.max(0, Number(branding.freeDeliveryThreshold || 0));
    return threshold > 0 && subtotal >= threshold ? 0 : fee;
  };
  const isProductDetailPage = () => /^\/product\/[^/]+\/?$/.test(location.pathname);

  const readStoredCustomer = () => {
    try {
      const value = JSON.parse(localStorage.getItem(customerKey) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  };

  const buildWhatsappUrl = (target, message) => {
    const fallback = fallbackWhatsappUrl;
    try {
      const url = new URL(target || fallback);
      url.searchParams.set('text', message);
      return url.toString();
    } catch {
      const url = new URL(fallback);
      url.searchParams.set('text', message);
      return url.toString();
    }
  };

  const getBranding = () => ({
    ...(window.__CLEVER_BRANDING__ || {}),
    whatsappUrl: window.__CLEVER_BRANDING__?.whatsappUrl || fallbackWhatsappUrl,
    codDeliveryPrice: Math.max(0, Number(window.__CLEVER_BRANDING__?.codDeliveryPrice || 0)),
    freeDeliveryThreshold: Math.max(0, Number(window.__CLEVER_BRANDING__?.freeDeliveryThreshold || 0))
  });

  const applyHeaderSocials = () => {
    if (location.pathname.startsWith('/admin')) return;
    const branding = getBranding();

    document.querySelectorAll('header.site-header').forEach((header) => {
      const headerInner = header.querySelector('.header-inner');
      if (!headerInner) return;

      let container = headerInner.querySelector('.header-actions') || headerInner.querySelector('.main-nav');
      if (!container) {
        container = document.createElement('div');
        container.className = 'header-actions';
        headerInner.appendChild(container);
      }

      let socials = headerInner.querySelector('.clever-header-socials');
      if (!socials) {
        socials = document.createElement('span');
        socials.className = 'clever-header-socials';
        socials.setAttribute('aria-label', 'Social links');
        container.prepend(socials);
      }

      const whatsappIcon = '<svg class="clever-header-social-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13.25" fill="#25D366"/><path d="M11.5 9.8c-.35 0-.72.08-1.02.45-.4.45-1.3 1.27-1.3 3.1 0 1.82 1.33 3.57 1.52 3.81.19.25 2.55 3.99 6.21 5.42 3.07 1.2 3.69.96 4.35.9.66-.06 2.12-.87 2.42-1.71.3-.84.3-1.56.21-1.71-.09-.15-.35-.25-.74-.45-.39-.2-2.3-1.14-2.66-1.27-.36-.14-.63-.2-.89.2-.26.4-1.02 1.27-1.25 1.53-.23.26-.46.3-.85.1-.39-.2-1.65-.61-3.15-1.95-1.16-1.03-1.94-2.3-2.17-2.69-.23-.4-.02-.61.18-.81.18-.18.39-.46.58-.69.2-.23.26-.4.39-.65.13-.26.06-.49-.03-.69-.1-.2-.89-2.12-1.22-2.9-.32-.75-.66-.65-.89-.65h-.76Z" fill="#fff"/></svg>';
      const instagramIcon = '<svg class="clever-header-social-icon" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="clever-instagram-gradient" x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse"><stop stop-color="#FFDC80"/><stop offset=".35" stop-color="#F77737"/><stop offset=".67" stop-color="#E1306C"/><stop offset="1" stop-color="#833AB4"/></linearGradient></defs><rect x="5.25" y="5.25" width="21.5" height="21.5" rx="6" fill="none" stroke="url(#clever-instagram-gradient)" stroke-width="2.4"/><circle cx="16" cy="16" r="5" fill="none" stroke="url(#clever-instagram-gradient)" stroke-width="2.4"/><circle cx="22.4" cy="9.7" r="1.55" fill="#E1306C"/></svg>';

      const links = [];
      if (branding.showWhatsapp && branding.whatsappUrl) {
        links.push('<a class="clever-header-social clever-header-whatsapp" href="' + escapeHtml(branding.whatsappUrl) + '" target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="Chat with Clever Toys on WhatsApp">' + whatsappIcon + '</a>');
      }
      if (branding.showInstagram && branding.instagramUrl) {
        links.push('<a class="clever-header-social clever-header-instagram" href="' + escapeHtml(branding.instagramUrl) + '" target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Clever Toys on Instagram">' + instagramIcon + '</a>');
      }
      socials.innerHTML = links.join('');
      socials.hidden = links.length === 0;
    });

    document.querySelector('.clever-topbar')?.remove();
  };

  const moveRibbonBelowHeader = () => {
    const header = document.querySelector('header.site-header');
    const ribbon = document.querySelector('.clever-ribbon');
    if (header && ribbon) header.insertAdjacentElement('afterend', ribbon);
  };

  const patchFloatingWhatsapp = () => {
    const branding = getBranding();
    const floating = document.getElementById('clever-floating-whatsapp');
    if (floating && branding.whatsappUrl) floating.href = branding.whatsappUrl;
  };

  const addWhatsappProductButton = async () => {
    if (!isProductDetailPage()) {
      document.querySelectorAll('[data-buy-whatsapp]').forEach((element) => element.remove());
      return;
    }
    if (location.pathname.startsWith('/admin')) return;

    const addButton = document.querySelector('#add-to-cart');
    const quantity = document.querySelector('#quantity');
    const priceEl = document.querySelector('#detail-price');
    const productTitle = document.querySelector('.product-details h1');
    const variantSelect = document.querySelector('#variant-select');
    const purchaseBox = addButton?.closest('.purchase-box');
    if (!(addButton instanceof HTMLButtonElement) || !quantity || !priceEl || !productTitle || !purchaseBox) return;
    if (purchaseBox.querySelector('[data-buy-whatsapp]')) return;

    let branding = getBranding();
    try {
      const response = await fetch('/api/store-settings', { cache: 'no-store' });
      if (response.ok) {
        const settings = await response.json();
        branding = { ...branding, ...settings };
        window.__CLEVER_BRANDING__ = branding;
      }
    } catch {}

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button whatsapp-buy-button';
    button.dataset.buyWhatsapp = 'true';
    button.textContent = '💬 Buy Now on WhatsApp';
    purchaseBox.appendChild(button);

    const style = document.createElement('style');
    style.textContent = `.whatsapp-buy-button{width:100%;margin-top:10px;background:#25D366!important;color:#fff!important;border:0!important}.whatsapp-buy-button:hover{background:#1ebe5d!important}.whatsapp-buy-button:disabled{opacity:.5;cursor:not-allowed}`;
    document.head.appendChild(style);

    const syncDisabled = () => {
      const hasOptions = variantSelect instanceof HTMLSelectElement && variantSelect.options.length > 1;
      const optionChosen = !hasOptions || Boolean(variantSelect.value);
      if (hasOptions && !optionChosen) addButton.disabled = true;
      button.disabled = addButton.disabled;
    };

    variantSelect?.addEventListener('change', syncDisabled);
    quantity.addEventListener('input', syncDisabled);
    syncDisabled();

    button.addEventListener('click', () => {
      if (addButton.disabled) return;
      const hasOptions = variantSelect instanceof HTMLSelectElement && variantSelect.options.length > 1;
      if (hasOptions && !variantSelect.value) return;
      const qty = Math.max(1, Number(quantity.value || 1));
      const selected = variantSelect instanceof HTMLSelectElement && variantSelect.value
        ? variantSelect.options[variantSelect.selectedIndex]
        : null;
      const selectedName = selected?.textContent?.trim() || '';
      const unitPrice = Number(String(priceEl.textContent || '').replace(/[^0-9.]/g, '')) || 0;
      const subtotal = unitPrice * qty;
      const delivery = getDeliveryFee(subtotal, branding);
      const total = subtotal + delivery;
      const customer = readStoredCustomer();
      const lines = [
        '🧾 CLEVER TOYS — WHATSAPP ORDER',
        '━━━━━━━━━━━━━━━━━━',
        `🧸 Product: ${productTitle.textContent?.trim() || 'Toy'}`,
        selectedName && !/^select an option$/i.test(selectedName) ? `🎯 Option: ${selectedName}` : null,
        `💵 Unit price: ${money(unitPrice)}`,
        `🔢 Quantity: ${qty}`,
        '━━━━━━━━━━━━━━━━━━',
        `💰 Subtotal: ${money(subtotal)}`,
        `🚚 COD delivery: ${delivery === 0 ? 'Free' : money(delivery)}`,
        `💵 TOTAL: ${money(total)}`,
        '💳 Payment: Cash on delivery',
        customer.full_name || customer.customer_name ? '' : null,
        customer.full_name || customer.customer_name ? `👤 Customer: ${customer.full_name || customer.customer_name}` : null,
        customer.phone || customer.customer_phone ? `📞 Phone: ${customer.phone || customer.customer_phone}` : null,
        customer.governorate || customer.city || customer.area ? `📍 Location: ${[customer.governorate, customer.city, customer.area].filter(Boolean).join(' · ')}` : null,
        customer.address ? `🏠 Address: ${customer.address}` : null,
        '',
        'Please confirm this order. Thank you!'
      ].filter(value => value !== null).join('\n');

      window.open(buildWhatsappUrl(branding.whatsappUrl || fallbackWhatsappUrl, lines), '_blank', 'noopener,noreferrer');
    });
  };

  const patch = async () => {
    applyHeaderSocials();
    moveRibbonBelowHeader();
    patchFloatingWhatsapp();
    await addWhatsappProductButton();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void patch(); }, { once: true });
  else void patch();
})();
