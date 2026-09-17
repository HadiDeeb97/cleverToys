(() => {
  const patch = () => {
    const branding = window.__CLEVER_BRANDING__ || {};
    const floating = document.getElementById('clever-floating-whatsapp');
    if (floating && branding.whatsappUrl) {
      floating.href = branding.whatsappUrl;
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patch, { once: true });
  else patch();
})();
