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
})();
