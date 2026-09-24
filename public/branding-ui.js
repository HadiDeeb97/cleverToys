/**
 * branding-ui.js: storefront features that depend on Admin → Branding settings.
 *
 *  - Header WhatsApp / Instagram icons (only added if the server did not already draw them)
 *  - Keeps the announcement ribbon right under the header
 *  - WhatsApp links on product pages ask about the product being viewed
 *  - "Order on WhatsApp" on product pages: asks for delivery details, then opens WhatsApp
 *    with a complete order message
 *
 * Settings come from window.__CLEVER_BRANDING__, which src/middleware.ts writes into every page,
 * so nothing has to be downloaded before the buttons work.
 */
(() => {
  const FALLBACK_WHATSAPP_URL = 'https://wa.me/96171220251?text=Hello%20Clever%20Toys%21%20I%20have%20a%20question%20about%20your%20toys.';
  const CUSTOMER_KEY = 'cleverToysCustomer'; // saved delivery details (same key checkout uses)
  const WHATSAPP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
  const HEADER_WHATSAPP_ICON = '<svg class="clever-header-social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
  const HEADER_INSTAGRAM_ICON = '<svg class="clever-header-social-icon" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="clever-instagram-gradient" x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse"><stop stop-color="#FFDC80"/><stop offset=".35" stop-color="#F77737"/><stop offset=".67" stop-color="#E1306C"/><stop offset="1" stop-color="#833AB4"/></linearGradient></defs><rect x="5.25" y="5.25" width="21.5" height="21.5" rx="6" fill="none" stroke="url(#clever-instagram-gradient)" stroke-width="2.4"/><circle cx="16" cy="16" r="5" fill="none" stroke="url(#clever-instagram-gradient)" stroke-width="2.4"/><circle cx="22.4" cy="9.7" r="1.55" fill="#E1306C"/></svg>';

  // ---------- Small helpers ----------
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (value) => `$${Number(value || 0).toFixed(2)}`;
  const isProductDetailPage = () => /^\/product\/[^/]+\/?$/.test(location.pathname);
  const isAdmin = location.pathname.startsWith('/admin');

  /** Branding settings from the server, with safe defaults. */
  const getBranding = () => {
    const b = window.__CLEVER_BRANDING__ || {};
    return {
      ...b,
      whatsappUrl: b.whatsappUrl || FALLBACK_WHATSAPP_URL,
      codDeliveryPrice: Math.max(0, Number(b.codDeliveryPrice || 0)),
      freeDeliveryThreshold: Math.max(0, Number(b.freeDeliveryThreshold || 0))
    };
  };

  /** Delivery fee: free above the threshold (if one is set), otherwise the cash-on-delivery fee. */
  const getDeliveryFee = (subtotal, branding) =>
    branding.freeDeliveryThreshold > 0 && subtotal >= branding.freeDeliveryThreshold ? 0 : branding.codDeliveryPrice;

  /** Adds a message to the WhatsApp link from Branding (keeps the phone number, replaces the text). */
  const buildWhatsappUrl = (target, message) => {
    let url;
    try { url = new URL(target || FALLBACK_WHATSAPP_URL); } catch { url = new URL(FALLBACK_WHATSAPP_URL); }
    url.searchParams.set('text', message);
    return url.toString();
  };

  const readStoredCustomer = () => {
    try {
      const value = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  };

  const saveCustomer = (details) => {
    try {
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify({
        ...readStoredCustomer(),
        full_name: details.full_name, customer_name: details.full_name,
        phone: details.phone, customer_phone: details.phone,
        governorate: details.governorate, city: details.city, area: details.area, address: details.address
      }));
    } catch {}
  };

  // ---------- Header social icons ----------
  // The server draws these in src/middleware.ts. This is only a fallback for pages it did not rewrite,
  // so the icons are never rebuilt under the shopper's finger.
  const applyHeaderSocials = () => {
    if (isAdmin) return;
    const branding = getBranding();
    document.querySelectorAll('header.site-header .header-inner').forEach((headerInner) => {
      if (headerInner.querySelector('.clever-header-socials')) return;
      const links = [];
      if (branding.showWhatsapp && branding.whatsappUrl) links.push(`<a class="clever-header-social clever-header-whatsapp" href="${escapeHtml(branding.whatsappUrl)}" target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="Chat with Clever Toys on WhatsApp">${HEADER_WHATSAPP_ICON}</a>`);
      if (branding.showInstagram && branding.instagramUrl) links.push(`<a class="clever-header-social clever-header-instagram" href="${escapeHtml(branding.instagramUrl)}" target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Clever Toys on Instagram">${HEADER_INSTAGRAM_ICON}</a>`);
      if (!links.length) return;
      const container = headerInner.querySelector('.header-actions') || headerInner.querySelector('.main-nav') || headerInner;
      const socials = document.createElement('span');
      socials.className = 'clever-header-socials';
      socials.setAttribute('aria-label', 'Social links');
      socials.innerHTML = links.join('');
      container.prepend(socials);
    });
  };

  /** The ribbon (Admin → Branding) belongs directly under the header. */
  const moveRibbonBelowHeader = () => {
    const header = document.querySelector('header.site-header');
    const ribbon = document.querySelector('.clever-ribbon');
    if (header && ribbon && header.nextElementSibling !== ribbon) header.insertAdjacentElement('afterend', ribbon);
  };

  // ---------- WhatsApp links ask about the product being viewed ----------
  const productInquiryMessage = () => {
    const title = document.querySelector('.product-details h1')?.textContent?.trim();
    if (!title) return '';
    const price = document.querySelector('#detail-price')?.textContent?.trim();
    const select = document.querySelector('#variant-select');
    const option = select instanceof HTMLSelectElement && select.value ? (select.options[select.selectedIndex]?.textContent || '').split('·')[0].trim() : '';
    return [
      'Hello Clever Toys 👋',
      "I'm interested in this product and would like more information:",
      '',
      `*${title}*`,
      option ? `Option: ${option}` : null,
      price ? `Price: ${price}` : null,
      `Link: ${location.origin}${location.pathname}`,
      '',
      'Is it available, and how long would delivery take? Thank you!'
    ].filter((line) => line !== null).join('\n');
  };

  /** Floating and header WhatsApp buttons: product question on product pages, the Branding link elsewhere. */
  const patchFloatingWhatsapp = () => {
    const branding = getBranding();
    const inquiry = isProductDetailPage() ? productInquiryMessage() : '';
    const href = inquiry ? buildWhatsappUrl(branding.whatsappUrl, inquiry) : branding.whatsappUrl;
    const floating = document.getElementById('clever-floating-whatsapp');
    if (floating) floating.href = href;
    document.querySelectorAll('.clever-header-whatsapp').forEach((link) => { link.href = href; });
  };

  // ---------- Delivery details dialog (before "Order on WhatsApp") ----------
  // Prefilled from the last checkout or WhatsApp order on this device.
  const openDetailsDialog = (order, onSend) => {
    let dialog = document.getElementById('wa-order-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'wa-order-dialog';
      dialog.className = 'wa-dialog';
      dialog.setAttribute('aria-labelledby', 'wa-dialog-title');
      dialog.innerHTML = `<form method="dialog" class="wa-dialog-form" novalidate>
        <div class="wa-dialog-head"><div><h2 id="wa-dialog-title">Your delivery details</h2><p class="wa-dialog-summary"></p></div><button type="button" class="wa-dialog-close" aria-label="Close">×</button></div>
        <div class="wa-dialog-fields">
          <label>Full name<input name="full_name" required autocomplete="name" maxlength="120"></label>
          <label>Phone number<input name="phone" required type="tel" autocomplete="tel" maxlength="40" placeholder="+961 …"></label>
          <label>Governorate<input name="governorate" required autocomplete="address-level1" maxlength="80"></label>
          <label>City<input name="city" required autocomplete="address-level2" maxlength="80"></label>
          <label>Area <span>(optional)</span><input name="area" autocomplete="address-level3" maxlength="120"></label>
          <label class="wide">Full address<textarea name="address" required rows="2" autocomplete="street-address" maxlength="500" placeholder="Street, building, floor"></textarea></label>
          <label class="wide">Notes <span>(optional)</span><textarea name="notes" rows="2" maxlength="500" placeholder="Best time to call, gift wrapping…"></textarea></label>
          <label class="wa-remember wide"><input type="checkbox" name="remember" checked> Remember my details on this device</label>
        </div>
        <p class="wa-dialog-error" role="alert" hidden>Please fill in the highlighted fields.</p>
        <div class="wa-dialog-actions"><button type="button" class="button secondary-button wa-dialog-cancel">Cancel</button><button type="submit" class="button whatsapp-buy-button">${WHATSAPP_ICON}<span>Send order on WhatsApp</span></button></div>
      </form>`;
      document.body.appendChild(dialog);
      dialog.querySelector('.wa-dialog-close').addEventListener('click', () => dialog.close());
      dialog.querySelector('.wa-dialog-cancel').addEventListener('click', () => dialog.close());
      // Tapping the dark backdrop closes the dialog.
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
      // Clear the red highlight as soon as a field is fixed.
      dialog.addEventListener('input', (event) => {
        if (event.target.hasAttribute?.('aria-invalid')) event.target.removeAttribute('aria-invalid');
        if (!dialog.querySelector('[aria-invalid=true]')) dialog.querySelector('.wa-dialog-error').hidden = true;
      });
    }

    const form = dialog.querySelector('form');
    const stored = readStoredCustomer();
    const prefill = {
      full_name: stored.full_name || stored.customer_name || '',
      phone: stored.phone || stored.customer_phone || '',
      governorate: stored.governorate || '', city: stored.city || '', area: stored.area || '', address: stored.address || ''
    };
    for (const [name, value] of Object.entries(prefill)) {
      const field = form.elements.namedItem(name);
      if (field && !field.value) field.value = value;
    }
    dialog.querySelector('.wa-dialog-summary').textContent = `${order.productName}${order.optionName ? ` · ${order.optionName}` : ''} × ${order.qty} — Total ${money(order.total)} (cash on delivery)`;
    const error = dialog.querySelector('.wa-dialog-error');
    error.hidden = true;

    form.onsubmit = (event) => {
      event.preventDefault();
      const data = Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, String(v).trim()]));
      // Required fields must be filled; the phone needs at least 7 digits.
      const missing = [...form.querySelectorAll('[required]')].filter((field) => !String(field.value).trim() || (field.name === 'phone' && String(field.value).replace(/\D/g, '').length < 7));
      form.querySelectorAll('[aria-invalid]').forEach((field) => field.removeAttribute('aria-invalid'));
      if (missing.length) {
        missing.forEach((field) => field.setAttribute('aria-invalid', 'true'));
        error.hidden = false;
        missing[0].focus();
        return;
      }
      if (form.elements.namedItem('remember').checked) saveCustomer(data);
      dialog.close();
      onSend(order, data);
    };

    dialog.showModal();
    // On computers, jump to the first empty field. On phones, don't: it would pop the keyboard over the form.
    if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
      const firstEmpty = [...form.querySelectorAll('[required]')].find((field) => !field.value.trim());
      (firstEmpty || form.querySelector('[type=submit]')).focus();
    }
  };

  // ---------- "Order on WhatsApp" on product pages ----------
  const setupWhatsappOrderButton = () => {
    const wrap = document.querySelector('[data-buy-whatsapp]');
    if (!isProductDetailPage()) { document.querySelectorAll('[data-buy-whatsapp]').forEach((el) => el.remove()); return; }
    const addButton = document.querySelector('#add-to-cart');
    const quantity = document.querySelector('#quantity');
    const priceEl = document.querySelector('#detail-price');
    const productTitle = document.querySelector('.product-details h1');
    const variantSelect = document.querySelector('#variant-select');
    const button = wrap?.querySelector('button');
    if (!wrap || !button || wrap.dataset.ready || !(addButton instanceof HTMLButtonElement) || !quantity || !priceEl || !productTitle) return;
    wrap.dataset.ready = 'true';

    // Same rules as Add to Cart: in stock, and an option chosen when the toy has options.
    const syncDisabled = () => { button.disabled = addButton.disabled; };
    variantSelect?.addEventListener('change', () => queueMicrotask(syncDisabled));
    quantity.addEventListener('input', syncDisabled);
    syncDisabled();

    const collectOrder = () => {
      const branding = getBranding();
      const qty = Math.max(1, Math.floor(Number(quantity.value || 1)));
      const selected = variantSelect instanceof HTMLSelectElement && variantSelect.value ? variantSelect.options[variantSelect.selectedIndex] : null;
      // Option labels read "Name · SKU"; only the name belongs in the message.
      const optionName = (selected?.textContent || '').split('·')[0].trim();
      const unitPrice = Number(String(priceEl.textContent || '').replace(/[^0-9.]/g, '')) || 0;
      const subtotal = unitPrice * qty;
      const delivery = getDeliveryFee(subtotal, branding);
      return { qty, optionName, unitPrice, subtotal, delivery, total: subtotal + delivery, productName: productTitle.textContent?.trim() || 'Toy', productUrl: `${location.origin}${location.pathname}` };
    };

    const buildMessage = (order, details) => [
      'Hello Clever Toys 👋',
      'I would like to place an order:',
      '',
      `*${order.productName}*`,
      order.optionName ? `Option: ${order.optionName}` : null,
      `Quantity: ${order.qty} × ${money(order.unitPrice)}`,
      `Link: ${order.productUrl}`,
      '',
      '*Order summary*',
      `Subtotal: ${money(order.subtotal)}`,
      `Delivery: ${order.delivery === 0 ? 'Free' : money(order.delivery)}`,
      `*Total: ${money(order.total)}* (cash on delivery)`,
      '',
      '*Delivery details*',
      `Name: ${details.full_name}`,
      `Phone: ${details.phone}`,
      `Area: ${[details.governorate, details.city, details.area].filter(Boolean).join(', ')}`,
      `Address: ${details.address}`,
      details.notes ? `Notes: ${details.notes}` : null,
      '',
      'Please confirm availability and the expected delivery time. Thank you!'
    ].filter((value) => value !== null).join('\n');

    button.addEventListener('click', () => {
      if (addButton.disabled) return;
      openDetailsDialog(collectOrder(), (order, details) => {
        window.open(buildWhatsappUrl(getBranding().whatsappUrl, buildMessage(order, details)), '_blank', 'noopener,noreferrer');
      });
    });
  };

  // ---------- Start ----------
  const start = () => {
    applyHeaderSocials();
    moveRibbonBelowHeader();
    patchFloatingWhatsapp();
    if (!isAdmin) setupWhatsappOrderButton();
  };
  // Keep the product question up to date when the shopper picks another option.
  document.addEventListener('change', (event) => { if (event.target instanceof HTMLSelectElement && event.target.id === 'variant-select') patchFloatingWhatsapp(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
