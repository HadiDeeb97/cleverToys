(() => {
  const fallbackWhatsappUrl = 'https://wa.me/96171220251?text=Hello%2C%20I%27m%20interested%20with%20your%20product';
  const customerKey = 'cleverToysCustomer';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const money = value => `$${Number(value || 0).toFixed(2)}`;

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
    codDeliveryPrice: Math.max(0, Number(window.__CLEVER_BRANDING__?.codDeliveryPrice || 0))
  });

  const applyHeaderSocials = () => {
    if (location.pathname.startsWith('/admin')) return;
    const branding = getBranding();
    const header = document.querySelector('header.site-header');
    const nav = header?.querySelector('.main-nav');
    if (!header || !nav) return;

    document.querySelector('.clever-topbar')?.remove();

    let socials = nav.querySelector('.clever-header-socials');
    if (!socials) {
      socials = document.createElement('span');
      socials.className = 'clever-header-socials';
      socials.setAttribute('aria-label', 'Social links');
      nav.appendChild(socials);
    }

    const links = [];
    if (branding.showWhatsapp && branding.whatsappUrl) {
      links.push(`<a class="clever-header-social clever-header-whatsapp" href="${escapeHtml(branding.whatsappUrl)}" target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="Chat with Clever Toys on WhatsApp">💬</a>`);
    }
    if (branding.showInstagram && branding.instagramUrl) {
      links.push(`<a class="clever-header-social clever-header-instagram" href="${escapeHtml(branding.instagramUrl)}" target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Clever Toys on Instagram">📸</a>`);
    }
    socials.innerHTML = links.join('');
    socials.hidden = links.length === 0;

    let styles = document.getElementById('clever-header-social-styles');
    if (!styles) {
      styles = document.createElement('style');
      styles.id = 'clever-header-social-styles';
      styles.textContent = `.clever-header-socials{display:inline-flex;align-items:center;gap:6px;margin-left:2px}.clever-header-social{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:999px;text-decoration:none;font-size:18px;line-height:1;background:rgba(15,23,42,.05);transition:transform .16s ease,background .16s ease;flex:0 0 auto}.clever-header-social:hover{transform:translateY(-1px);background:rgba(15,23,42,.1)}.clever-header-whatsapp{background:rgba(37,211,102,.12)}.clever-header-whatsapp:hover{background:rgba(37,211,102,.2)}.clever-header-instagram{background:rgba(225,48,108,.1)}.clever-header-instagram:hover{background:rgba(225,48,108,.18)}@media(max-width:640px){.clever-header-social{width:32px;height:32px;font-size:17px}.clever-header-socials{gap:4px}}`;
      document.head.appendChild(styles);
    }
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

  const patchCheckoutDelivery = async () => {
    if (location.pathname !== '/checkout') return;
    let branding = getBranding();
    try {
      const response = await fetch('/api/store-settings', { cache: 'no-store' });
      if (response.ok) {
        const settings = await response.json();
        branding = { ...branding, ...settings };
        window.__CLEVER_BRANDING__ = branding;
      }
    } catch {}

    const fee = Math.max(0, Number(branding.codDeliveryPrice || 0));
    const summary = document.querySelector('#checkout-summary');
    if (!(summary instanceof HTMLElement) || !summary.textContent) return;

    const cart = (() => {
      try {
        const items = JSON.parse(localStorage.getItem('cleverToysCart') || '[]');
        return Array.isArray(items) ? items : [];
      } catch {
        return [];
      }
    })();
    const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const total = subtotal + fee;

    let deliveryLine = summary.querySelector('[data-cod-delivery-line]');
    if (!deliveryLine) {
      deliveryLine = document.createElement('div');
      deliveryLine.className = 'summary-line';
      deliveryLine.dataset.codDeliveryLine = 'true';
      deliveryLine.innerHTML = '<span>COD delivery</span><strong></strong>';
      const totalRow = summary.querySelector('.summary-total');
      const cartLink = summary.querySelector('.summary-cart-link');
      if (totalRow) totalRow.before(deliveryLine);
      else if (cartLink) summary.insertBefore(deliveryLine, cartLink);
      else summary.appendChild(deliveryLine);
    }
    const feeStrong = deliveryLine.querySelector('strong');
    if (feeStrong) feeStrong.textContent = money(fee);

    const totalRow = summary.querySelector('.summary-total');
    const totalValues = totalRow?.querySelectorAll('strong');
    if (totalValues?.length) totalValues[totalValues.length - 1].textContent = money(total);

    let style = document.getElementById('clever-checkout-delivery-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'clever-checkout-delivery-style';
      style.textContent = '.summary-line{display:flex;justify-content:space-between;gap:14px;align-items:center;margin:8px 0}.summary-total{padding-top:10px;margin-top:10px;border-top:1px solid #e2e8f0}.summary-line span{color:#475569}.summary-line strong{font-variant-numeric:tabular-nums}';
      document.head.appendChild(style);
    }
  };

  const addWhatsappProductButton = async () => {
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
    button.disabled = addButton.disabled;
    purchaseBox.appendChild(button);

    const style = document.createElement('style');
    style.textContent = `.whatsapp-buy-button{width:100%;margin-top:10px;background:#25D366!important;color:#fff!important;border:0!important}.whatsapp-buy-button:hover{background:#1ebe5d!important}.whatsapp-buy-button:disabled{opacity:.5;cursor:not-allowed}`;
    document.head.appendChild(style);

    const syncDisabled = () => { button.disabled = addButton.disabled; };
    variantSelect?.addEventListener('change', syncDisabled);
    quantity.addEventListener('input', syncDisabled);

    button.addEventListener('click', () => {
      if (addButton.disabled) return;
      const qty = Math.max(1, Number(quantity.value || 1));
      const selected = variantSelect instanceof HTMLSelectElement && variantSelect.value
        ? variantSelect.options[variantSelect.selectedIndex]
        : null;
      const selectedName = selected?.textContent?.trim() || '';
      const unitPrice = Number(String(priceEl.textContent || '').replace(/[^0-9.]/g, '')) || 0;
      const delivery = Math.max(0, Number(branding.codDeliveryPrice || 0));
      const subtotal = unitPrice * qty;
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
        `🚚 COD delivery: ${money(delivery)}`,
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
    await patchCheckoutDelivery();
    await addWhatsappProductButton();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void patch(); }, { once: true });
  else void patch();
})();
