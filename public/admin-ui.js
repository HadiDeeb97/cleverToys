// Shared admin chrome: sign out from the sidebar, toast messages and a helper for confirmations.
(() => {
  document.getElementById('admin-signout')?.addEventListener('click', () => {
    // Supabase keeps the session in localStorage under sb-<project>-auth-token.
    try { Object.keys(localStorage).filter((key) => /^sb-.*-auth-token$/.test(key)).forEach((key) => localStorage.removeItem(key)); } catch {}
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
})();
