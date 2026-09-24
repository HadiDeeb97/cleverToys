(() => {
  const fallbackWhatsappUrl = 'https://wa.me/96171220251?text=Hello%20Clever%20Toys%21%20I%20have%20a%20question%20about%20your%20toys.';
  const customerKey = 'cleverToysCustomer';
  const DEFAULT_GREETING = 'Hello Clever Toys! I have a question about your toys.';
  // Older store settings saved this greeting; replace it with the corrected default.
  const isOldGreeting = (text) => /^hello,?\s*i'?m interested with your product\.?$/i.test(String(text || '').trim());
  const whatsappIcon = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16 3.2C9.1 3.2 3.5 8.8 3.5 15.7c0 2.2.6 4.4 1.8 6.3L3.2 28.8l6.9-2.1c1.8 1 3.8 1.5 5.9 1.5 6.9 0 12.5-5.6 12.5-12.5S22.9 3.2 16 3.2Zm0 22.8c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-4.1 1.2 1.2-4-.3-.4c-1-1.6-1.5-3.5-1.5-5.4C5.5 9.9 10.2 5.2 16 5.2s10.5 4.7 10.5 10.5S21.8 26 16 26Zm5.8-7.8c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.7-1.7-2-.2-.3 0-.5.1-.7l.4-.5.3-.5c.1-.2 0-.4 0-.6-.1-.2-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z"/></svg>';

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

  const withGreeting = (target, greeting = DEFAULT_GREETING) => {
    try {
      const url = new URL(target || fallbackWhatsappUrl);
      const current = url.searchParams.get('text');
      // Keep a custom greeting the admin wrote; replace missing, outdated or plain default ones.
      if (!current || isOldGreeting(current) || current === DEFAULT_GREETING) url.searchParams.set('text', greeting);
      return url.toString();
    } catch {
      return target;
    }
  };
  const pageGreeting = () => {
    const title = isProductDetailPage() ? document.querySelector('.product-details h1')?.textContent?.trim() : '';
    return title ? `Hello Clever Toys! I have a question about the ${title}.` : DEFAULT_GREETING;
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
        links.push('<a class="clever-header-social clever-header-whatsapp" href="' + escapeHtml(withGreeting(branding.whatsappUrl, pageGreeting())) + '" target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="Chat with Clever Toys on WhatsApp">' + whatsappIcon + '</a>');
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
    if (floating && branding.whatsappUrl) floating.href = withGreeting(branding.whatsappUrl, pageGreeting());
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

    const wrap = document.createElement('div');
    wrap.className = 'whatsapp-order';
    wrap.dataset.buyWhatsapp = 'true';
    wrap.innerHTML = `<button type="button" class="button whatsapp-buy-button">${whatsappIcon}<span>Order on WhatsApp</span></button><p class="whatsapp-order-note">We'll confirm availability and delivery time in chat · Cash on delivery</p>`;
    purchaseBox.appendChild(wrap);
    const button = wrap.querySelector('button');

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
      const qty = Math.max(1, Math.floor(Number(quantity.value || 1)));
      const selected = variantSelect instanceof HTMLSelectElement && variantSelect.value
        ? variantSelect.options[variantSelect.selectedIndex]
        : null;
      // Variant options read "Name · SKU"; only the name belongs in the message.
      const optionName = (selected?.textContent || '').split('·')[0].trim();
      const unitPrice = Number(String(priceEl.textContent || '').replace(/[^0-9.]/g, '')) || 0;
      const subtotal = unitPrice * qty;
      const delivery = getDeliveryFee(subtotal, branding);
      const total = subtotal + delivery;
      const customer = readStoredCustomer();
      const name = customer.full_name || customer.customer_name || '';
      const phone = customer.phone || customer.customer_phone || '';
      const area = [customer.governorate, customer.city, customer.area].filter(Boolean).join(', ');
      const productName = productTitle.textContent?.trim() || 'Toy';
      const productUrl = `${location.origin}${location.pathname}`;

      // WhatsApp renders *text* as bold. Blank delivery fields invite the customer to fill them in.
      const lines = [
        'Hello Clever Toys 👋',
        'I would like to place an order:',
        '',
        `*${productName}*`,
        optionName ? `Option: ${optionName}` : null,
        `Quantity: ${qty} × ${money(unitPrice)}`,
        `Link: ${productUrl}`,
        '',
        '*Order summary*',
        `Subtotal: ${money(subtotal)}`,
        `Delivery: ${delivery === 0 ? 'Free' : money(delivery)}`,
        `*Total: ${money(total)}* (cash on delivery)`,
        '',
        '*Delivery details*',
        `Name: ${name}`,
        `Phone: ${phone}`,
        `Area: ${area}`,
        `Address: ${customer.address || ''}`,
        '',
        'Please confirm availability and the expected delivery time. Thank you!'
      ].filter((value) => value !== null).join('\n');

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
