// Shared admin chrome: sign out from the sidebar, toast messages, role-based sidebar and the
// new-orders badge. Page scripts call window.adminApplyAccess() once the signed-in admin's role is
// known (src/scripts/admin-access.ts); the role is remembered for this tab so the sidebar is right
// immediately on the next page.
(() => {
  const ACCESS_KEY = 'ctAdminAccess';

  document.getElementById('admin-signout')?.addEventListener('click', () => {
    // Supabase keeps the session in localStorage under sb-<project>-auth-token.
    try { Object.keys(localStorage).filter((key) => /^sb-.*-auth-token$/.test(key)).forEach((key) => localStorage.removeItem(key)); } catch {}
    try { sessionStorage.removeItem(ACCESS_KEY); } catch {}
    location.href = '/login';
  });

  let region = null;
  window.adminToast = (message, tone = 'success') => {
    if (!region) {
      region = document.createElement('div');
      region.className = 'admin-toasts';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    const toast = document.createElement('div');
    toast.className = `admin-toast ${tone}`;
    toast.textContent = message;
    region.appendChild(toast);
    setTimeout(() => { toast.classList.add('leaving'); setTimeout(() => toast.remove(), 300); }, 3200);
  };

  // ---------- Sidebar: only the pages this staff member's role can open ----------
  window.adminApplyAccess = (access) => {
    if (!access || !Array.isArray(access.perms)) return;
    try { sessionStorage.setItem(ACCESS_KEY, JSON.stringify(access)); } catch {}
    const perms = new Set(access.perms);
    document.querySelectorAll('.admin-nav a[data-perm]').forEach((link) => { link.hidden = !perms.has(link.dataset.perm); });
    // Hide a group title when none of its links are left.
    document.querySelectorAll('.admin-nav .admin-nav-group').forEach((title) => {
      let next = title.nextElementSibling; let visible = false;
      while (next && !next.classList.contains('admin-nav-group')) { if (!next.hidden) visible = true; next = next.nextElementSibling; }
      title.hidden = !visible;
    });
    const roleLabel = document.querySelector('.admin-brand small');
    const names = { owner: 'Owner', manager: 'Manager', orders: 'Orders staff', content: 'Content editor' };
    if (roleLabel && names[access.role]) roleLabel.textContent = `Admin · ${names[access.role]}`;
  };
  try { const saved = JSON.parse(sessionStorage.getItem(ACCESS_KEY) || 'null'); if (saved) window.adminApplyAccess(saved); } catch {}

  // ---------- New orders badge on the Orders link ----------
  window.adminSetNewOrders = (count) => {
    const link = document.querySelector('.admin-nav a[href="/admin/orders"]');
    if (!link) return;
    let badge = link.querySelector('.admin-nav-badge');
    if (!count) { badge?.remove(); return; }
    if (!badge) { badge = document.createElement('b'); badge.className = 'admin-nav-badge'; link.appendChild(badge); }
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.setAttribute('aria-label', `${count} new`);
  };

  // ---------- Admin search (sidebar button, Ctrl/⌘ K or "/") ----------
  // Finds any page, tab or setting and jumps straight to it: the page opens, the tab switches and the
  // setting is scrolled into view and highlighted. Also searches products and orders.
  // [label, where, extra words, link, tab, heading to scroll to]
  const PLACES = [
    ['Dashboard', 'Overview', 'home sales today chart', '/admin/dashboard'],
    ['Top sellers', 'Dashboard', 'best selling', '/admin/dashboard', '', 'Top sellers'],
    ['Restock soon', 'Dashboard', 'low stock', '/admin/dashboard', '', 'Restock soon'],
    ['Orders', 'Sell', 'order list', '/admin/orders'],
    ['Pending orders', 'Orders', 'new waiting', '/admin/orders?status=pending'],
    ['Shipped orders', 'Orders', 'delivery on the way', '/admin/orders?status=shipped'],
    ['Customers', 'Sell', 'clients buyers people', '/admin/customers'],
    ['Accounting overview', 'Accounting', 'money revenue cash', '/admin/accounting', 'overview'],
    ['Profit & loss', 'Accounting', 'pnl profit income statement', '/admin/accounting', 'pnl'],
    ['Sales by product', 'Accounting', 'sales report category governorate', '/admin/accounting', 'sales'],
    ['Expenses', 'Accounting', 'add expense costs spending', '/admin/accounting', 'expenses'],
    ['Cost prices', 'Accounting', 'cost margin profit per unit', '/admin/accounting', 'costs'],
    ['Orders ledger', 'Accounting', 'ledger export', '/admin/accounting', 'ledger'],
    ['Products', 'Catalog', 'toys items list', '/admin', 'products'],
    ['Add a product', 'Products', 'new product create', '/admin', 'products', 'Add product'],
    ['Low stock products', 'Products', 'stock running out', '/admin?filter=low'],
    ['Out of stock products', 'Products', 'sold out stock', '/admin?filter=out'],
    ['Hidden products', 'Products', 'invisible not visible', '/admin?filter=hidden'],
    ['Featured products', 'Products', 'home featured star', '/admin?filter=featured'],
    ['Categories', 'Products', 'category add category', '/admin', 'categories'],
    ['Excel import', 'Products', 'import upload spreadsheet xlsx bulk', '/admin', 'import'],
    ['Import template', 'Products', 'excel template download', '/admin/import-template'],
    ['Reviews', 'Catalog', 'ratings stars approve comments', '/admin/reviews'],
    ['Discount codes', 'Discounts & delivery', 'coupon promo code voucher', '/admin/discounts', 'coupons'],
    ['New discount code', 'Discounts & delivery', 'create coupon', '/admin/discounts', 'coupons', 'New code'],
    ['Delivery fee per governorate', 'Discounts & delivery', 'shipping zones beirut lebanon delivery price', '/admin/discounts', 'delivery'],
    ['Home banners', 'Marketing', 'slideshow banner carousel', '/admin/banners'],
    ['Visitors', 'Insights', 'analytics traffic sessions countries', '/admin/analytics'],
    ['Activity log', 'Insights', 'history who changed', '/admin/activity'],
    ['Pages', 'Website', 'content pages about privacy terms', '/admin/pages'],
    ['New page', 'Pages', 'create page', '/admin/pages', '', 'New page'],
    ['Fonts (typography)', 'Storefront', 'font typography text style', '/admin/storefront', 'style', 'Typography'],
    ['Corners', 'Storefront', 'rounded radius', '/admin/storefront', 'style', 'Corners'],
    ['Page background', 'Storefront', 'background pattern', '/admin/storefront', 'style', 'Page background'],
    ['Button style', 'Storefront', 'buttons shape', '/admin/storefront', 'style', 'Buttons'],
    ['Floating buttons', 'Storefront', 'whatsapp bubble cart button', '/admin/storefront', 'style', 'Floating buttons'],
    ['Home page sections', 'Storefront', 'order show hide sections', '/admin/storefront', 'home', 'Sections'],
    ['Hero banner', 'Storefront · Home', 'headline top banner image', '/admin/storefront', 'home', 'Hero banner'],
    ['Store promises', 'Storefront · Home', 'trust reasons', '/admin/storefront', 'home', 'Store promises'],
    ['Section titles', 'Storefront · Home', 'headings featured new arrivals', '/admin/storefront', 'home', 'Section titles'],
    ['Promotion banner', 'Storefront · Home', 'promo offer', '/admin/storefront', 'home', 'Promotion banner'],
    ['Our story', 'Storefront · Home', 'about story', '/admin/storefront', 'home', 'Our story'],
    ['Help choosing', 'Storefront · Home', 'whatsapp help', '/admin/storefront', 'home', 'Help choosing'],
    ['Notes under Add to Cart', 'Storefront · Product page', 'product page delivery payment returns notes', '/admin/storefront', 'product', 'Notes under Add to Cart'],
    ['Footer', 'Storefront', 'footer about address hours', '/admin/storefront', 'footer', 'Footer'],
    ['Contact details', 'Storefront', 'phone email city address hours', '/admin/storefront', 'footer', 'Contact details'],
    ['Contact page', 'Storefront', 'contact page cards', '/admin/storefront', 'contact', 'Top of the page'],
    ['Instagram section on Contact page', 'Storefront · Contact page', 'instagram feed profile snippet', '/admin/storefront', 'contact', 'Instagram profile'],
    ['Menus', 'Storefront', 'navigation header footer links menu', '/admin/storefront', 'menus'],
    ['WhatsApp link', 'Branding', 'whatsapp number phone chat', '/admin/branding', '', 'Social links'],
    ['Instagram link', 'Branding', 'instagram social', '/admin/branding', '', 'Social links'],
    ['Ribbon banner', 'Branding', 'top bar announcement free delivery message', '/admin/branding', '', 'Ribbon banner'],
    ['Delivery price & free delivery', 'Branding', 'cash on delivery fee threshold free shipping', '/admin/branding', '', 'Cash on delivery'],
    ['Order on WhatsApp button', 'Branding', 'buy now whatsapp', '/admin/branding', '', 'Buy Now on WhatsApp'],
    ['Colors & theme', 'Branding', 'colour color theme palette', '/admin/branding', '', 'Colors'],
    ['Store logo', 'Branding', 'logo upload shape circle rounded', '/admin/branding', '', 'Store Logo'],
    ['Website icon (favicon)', 'Branding', 'favicon browser tab home screen icon', '/admin/branding', '', 'Browser tab'],
    ['SEO health', 'SEO', 'seo score google', '/admin/seo', 'overview'],
    ['Page titles & descriptions', 'SEO', 'meta title description pages', '/admin/seo', 'pages'],
    ['Product SEO', 'SEO', 'product titles descriptions', '/admin/seo', 'products'],
    ['Category SEO', 'SEO', 'category titles descriptions', '/admin/seo', 'categories'],
    ['Sitemap & robots.txt', 'SEO', 'sitemap robots', '/admin/seo', 'sitemap'],
    ['Google Search Console', 'SEO · Settings', 'google verification bing', '/admin/seo', 'settings', 'Search engine verification'],
    ['Meta Pixel', 'SEO · Settings', 'facebook pixel meta ads tracking instagram ads', '/admin/seo', 'settings', 'Meta'],
    ['Default share image', 'SEO · Settings', 'share image og social preview', '/admin/seo', 'settings', 'Default share image'],
    ['Business details', 'SEO · Settings', 'business name phone email city google', '/admin/seo', 'settings', 'Business details'],
    ['Team & roles', 'Settings', 'staff admins users permissions add admin', '/admin/team'],
    ['Backup', 'Settings', 'export excel download backup', '/admin/backup']
  ];
  const normalize = (v) => String(v || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ');
  const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // A place is offered only when this admin can open its page (same rule as the sidebar links).
  const allowed = (href) => {
    const path = href.split('?')[0];
    const link = document.querySelector(`.admin-nav a[href="${path}"]`);
    return !link || !link.hidden;
  };
  const JUMP_KEY = 'ctAdminJump';
  function jumpInPage(target) {
    const started = Date.now();
    const visible = (el) => el && el.offsetParent !== null;
    const tick = () => {
      if (Date.now() - started > 12000) return;
      if (target.tab) {
        const tab = document.querySelector(`.tab[data-tab="${target.tab}"]`);
        if (!visible(tab)) { setTimeout(tick, 150); return; }
        if (!tab.classList.contains('active')) tab.click();
      } else if (!visible(document.querySelector('main h1, #app'))) { setTimeout(tick, 150); return; }
      if (!target.find) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const want = normalize(target.find).trim();
      const hit = [...document.querySelectorAll('h2, h3, legend, summary, .eyebrow, .sf-panel h2, label')].find((el) => visible(el) && normalize(el.textContent).trim().startsWith(want))
        || [...document.querySelectorAll('h2, h3, legend, summary, .eyebrow, label')].find((el) => visible(el) && normalize(el.textContent).includes(want));
      if (!hit) { if (Date.now() - started < 4000) setTimeout(tick, 200); return; }
      const box = hit.closest('.admin-panel, .form-card, .branding-card, section, fieldset') || hit;
      // Tall sections scroll to their top, short ones to the middle; checked again once the page settles
      // (pictures and saved settings can still move things right after loading).
      const place = () => box.scrollIntoView({ behavior: 'smooth', block: box.offsetHeight > innerHeight * 0.7 ? 'start' : 'center' });
      place();
      setTimeout(() => { const top = box.getBoundingClientRect().top; if (top < 0 || top > innerHeight * 0.5) place(); }, 900);
      box.classList.remove('admin-jump-flash'); void box.offsetWidth; box.classList.add('admin-jump-flash');
      setTimeout(() => box.classList.remove('admin-jump-flash'), 2200);
    };
    tick();
  }
  function go(place) {
    const [, , , href, tab = '', find = ''] = place;
    const url = new URL(href, location.origin);
    if (url.pathname === location.pathname && url.search === location.search) { closeSearch(); jumpInPage({ tab, find }); return; }
    try { sessionStorage.setItem(JUMP_KEY, JSON.stringify({ path: url.pathname, tab, find })); } catch {}
    location.href = url.pathname + url.search + (tab ? `#${tab}` : '');
  }
  // Arrived from a search result on another page: finish the jump.
  try {
    const pending = JSON.parse(sessionStorage.getItem(JUMP_KEY) || 'null');
    if (pending) { sessionStorage.removeItem(JUMP_KEY); if (pending.path === location.pathname) jumpInPage(pending); }
  } catch {}

  let dialog, input, list, results = [], active = 0;
  function search(q) {
    const words = normalize(q).split(' ').filter(Boolean);
    let found = [];
    if (!words.length) found = PLACES.filter((p) => ['Orders', 'Products', 'Customers', 'Store logo', 'Delivery fee per governorate', 'Discount codes'].includes(p[0]));
    else found = PLACES.map((p) => {
      const label = normalize(p[0]), hay = `${label} ${normalize(p[1])} ${normalize(p[2])}`;
      if (!words.every((w) => hay.includes(w))) return null;
      const score = (label.startsWith(words[0]) ? 0 : label.includes(words[0]) ? 1 : 2);
      return [score, p];
    }).filter(Boolean).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    found = found.filter((p) => allowed(p[3])).slice(0, 8);
    const text = q.trim();
    if (text.length >= 2) {
      if (allowed('/admin')) found.push([`Search products for “${text}”`, 'Products', '', `/admin?q=${encodeURIComponent(text)}`, '', '', 'products']);
      if (allowed('/admin/orders')) found.push([`Search orders for “${text}”`, 'Orders', '', `/admin/orders?q=${encodeURIComponent(text)}`, '', '', 'orders']);
    }
    return found;
  }
  function render() {
    results = search(input.value);
    active = Math.min(active, Math.max(0, results.length - 1));
    list.innerHTML = results.length
      ? results.map((p, i) => `<li role="option" id="as-opt-${i}" aria-selected="${i === active}" data-i="${i}"><span class="as-icon" aria-hidden="true">${p[6] === 'products' ? '🧸' : p[6] === 'orders' ? '🛒' : p[4] || p[5] ? '⚙️' : '📄'}</span><span class="as-text"><strong>${escapeHtml(p[0])}</strong><small>${escapeHtml(p[1])}</small></span><span class="as-go" aria-hidden="true">↵</span></li>`).join('')
      : '<li class="as-empty">Nothing matches. Try another word, like “delivery”, “logo” or “pixel”.</li>';
    input.setAttribute('aria-activedescendant', results.length ? `as-opt-${active}` : '');
    list.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' });
  }
  function openSearch() {
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'admin-search';
      dialog.setAttribute('aria-label', 'Search the admin panel');
      dialog.innerHTML = `<div class="as-box"><div class="as-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" placeholder="Search settings, pages, products or orders…" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="as-list" /><kbd>Esc</kbd></div><ul id="as-list" class="as-list" role="listbox"></ul><p class="as-hint"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open</p></div>`;
      document.body.appendChild(dialog);
      input = dialog.querySelector('input');
      list = dialog.querySelector('.as-list');
      input.addEventListener('input', () => { active = 0; render(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(results.length - 1, active + 1); render(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); render(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) go(results[active]); }
      });
      list.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) go(results[Number(li.dataset.i)]); });
      list.addEventListener('mousemove', (e) => { const li = e.target.closest('li[data-i]'); if (li && Number(li.dataset.i) !== active) { active = Number(li.dataset.i); render(); } });
      dialog.addEventListener('click', (e) => { if (e.target === dialog) closeSearch(); });
    }
    input.value = '';
    active = 0;
    render();
    dialog.showModal();
    input.focus();
  }
  function closeSearch() { if (dialog?.open) dialog.close(); }
  document.getElementById('admin-search-open')?.addEventListener('click', openSearch);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const kbd = document.querySelector('.admin-search-open kbd');
  if (kbd && mac) kbd.textContent = '⌘K';
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); dialog?.open ? closeSearch() : openSearch(); return; }
    const typing = e.target.closest?.('input, textarea, select, [contenteditable=true]');
    if (e.key === '/' && !typing && !dialog?.open) { e.preventDefault(); openSearch(); }
  });
})();
