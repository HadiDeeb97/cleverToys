(() => {
  const fallbackWhatsappUrl = 'https://wa.me/96171220251?text=Hello%20Clever%20Toys%21%20I%20have%20a%20question%20about%20your%20toys.';
  const customerKey = 'cleverToysCustomer';
  const whatsappIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';

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

      const whatsappIcon = '<svg class="clever-header-social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
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

  const saveCustomer = (details) => {
    try {
      const stored = readStoredCustomer();
      localStorage.setItem(customerKey, JSON.stringify({
        ...stored,
        full_name: details.full_name, customer_name: details.full_name,
        phone: details.phone, customer_phone: details.phone,
        governorate: details.governorate, city: details.city, area: details.area, address: details.address
      }));
    } catch {}
  };

  // Delivery details form shown before "Order on WhatsApp", prefilled from the last checkout or order.
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
        <div class="wa-dialog-actions"><button type="button" class="button secondary-button wa-dialog-cancel">Cancel</button><button type="submit" class="button whatsapp-buy-button">${whatsappIcon}<span>Send order on WhatsApp</span></button></div>
      </form>`;
      document.body.appendChild(dialog);
      dialog.querySelector('.wa-dialog-close').addEventListener('click', () => dialog.close());
      dialog.querySelector('.wa-dialog-cancel').addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
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
    for (const [name, value] of Object.entries(prefill)) { const field = form.elements.namedItem(name); if (field && !field.value) field.value = value; }
    dialog.querySelector('.wa-dialog-summary').textContent = `${order.productName}${order.optionName ? ` · ${order.optionName}` : ''} × ${order.qty} — Total ${money(order.total)} (cash on delivery)`;
    const error = dialog.querySelector('.wa-dialog-error');
    error.hidden = true;
    form.onsubmit = (event) => {
      event.preventDefault();
      const data = Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, String(v).trim()]));
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
    const firstEmpty = [...form.querySelectorAll('[required]')].find((field) => !field.value.trim());
    (firstEmpty || form.querySelector('[type=submit]')).focus();
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

    // Collect the order first, then ask for delivery details before opening WhatsApp,
    // so the message is complete even for shoppers who are not signed in.
    const collectOrder = () => {
      const qty = Math.max(1, Math.floor(Number(quantity.value || 1)));
      const selected = variantSelect instanceof HTMLSelectElement && variantSelect.value
        ? variantSelect.options[variantSelect.selectedIndex]
        : null;
      // Variant options read "Name · SKU"; only the name belongs in the message.
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
      const hasOptions = variantSelect instanceof HTMLSelectElement && variantSelect.options.length > 1;
      if (hasOptions && !variantSelect.value) return;
      openDetailsDialog(collectOrder(), (order, details) => {
        window.open(buildWhatsappUrl(branding.whatsappUrl || fallbackWhatsappUrl, buildMessage(order, details)), '_blank', 'noopener,noreferrer');
      });
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
