(() => {
  const CART_KEY = 'cleverToysCart';
  const STORE_NAME = 'Clever Toys';
  const WHATSAPP_URL = 'https://wa.me/96171220251?text=Hello%2C%20I%27m%20interested%20with%20your%20product';
  const branding = window.__CLEVER_BRANDING__ || {};
  const FALLBACK_LOGO = branding.logoUrl || '';
  const THEME_KEY = 'cleverToysTheme';

  const readCart = () => { try { const items=JSON.parse(localStorage.getItem(CART_KEY)||'[]'); return Array.isArray(items)?items.filter(item=>item&&Number(item.quantity)>0):[]; } catch { return []; } };
  const cartCount = () => readCart().reduce((sum,item)=>sum+Math.max(0,Number(item.quantity)||0),0);

  const normalizeCartLink = link => { if(!(link instanceof HTMLAnchorElement))return; link.classList.add('cart-link'); link.innerHTML='<span class="cart-icon" aria-hidden="true">🛒</span><span class="cart-label">Cart</span><span class="cart-count-badge" aria-hidden="true"></span>'; };

  const ensureFloatingStyles = () => {
    if (document.getElementById('clever-floating-styles')) return;
    const style = document.createElement('style');
    style.id = 'clever-floating-styles';
    style.textContent = `
      .clever-floating-cart{position:fixed;right:20px;bottom:20px;z-index:1002;width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;gap:3px;background:var(--brand-primary,#111827);color:var(--brand-text-on-primary,#fff);box-shadow:0 10px 26px rgba(15,23,42,.22);text-decoration:none;transition:transform .2s,box-shadow .2s}
      .clever-floating-cart:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(15,23,42,.27)}
      .clever-floating-cart .floating-cart-icon{font-size:25px;line-height:1}
      .clever-floating-cart .floating-cart-count{position:absolute;right:-2px;top:-2px;min-width:21px;height:21px;padding:0 5px;border-radius:999px;display:grid;place-items:center;background:#fff;color:var(--brand-primary,#111827);font-size:11px;font-weight:800;line-height:1}
      .clever-floating-whatsapp{position:fixed;left:20px;bottom:20px;z-index:1002;width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#25D366!important;color:#fff!important;box-shadow:0 10px 26px rgba(15,23,42,.22);text-decoration:none!important;opacity:1!important;visibility:visible!important}
      .clever-floating-whatsapp:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(15,23,42,.27)}
      .clever-floating-whatsapp svg{width:30px;height:30px;display:block}
      @media(max-width:640px){.clever-floating-cart{right:14px;bottom:14px;width:54px;height:54px}.clever-floating-whatsapp{left:14px;bottom:14px;width:54px;height:54px}.clever-floating-cart .floating-cart-icon{font-size:23px}.clever-floating-whatsapp svg{width:28px;height:28px}}
    `;
    document.head.appendChild(style);
  };

  const updateFloatingCart = count => { const button=document.getElementById('clever-floating-cart'); if(!button)return; const badge=button.querySelector('.floating-cart-count'); if(badge){badge.textContent=String(count);badge.hidden=count===0;} button.setAttribute('aria-label',count?`Shopping cart, ${count} ${count===1?'item':'items'}`:'Shopping cart'); };

  const ensureFloatingCart = () => {
    if(location.pathname.startsWith('/admin'))return;
    ensureFloatingStyles();
    let button=document.getElementById('clever-floating-cart');
    if(!button){button=document.createElement('a');button.id='clever-floating-cart';button.className='clever-floating-cart';button.href='/cart';button.title='View your cart';button.innerHTML='<span class="floating-cart-icon" aria-hidden="true">🛒</span><span class="floating-cart-count" aria-hidden="true"></span>';document.body.appendChild(button);}
    updateFloatingCart(cartCount());
  };

  const ensureCartLink = () => {
    if(location.pathname.startsWith('/admin'))return;
    document.querySelectorAll('.main-nav').forEach(nav=>{const links=[...nav.querySelectorAll('a[href="/cart"],a[href="/cart/"]')];if(links.length===0){const cart=document.createElement('a');cart.href='/cart';nav.appendChild(cart);normalizeCartLink(cart);}else if(links.length>1)links.slice(1).forEach(link=>link.remove());});
    const count=cartCount();
    document.querySelectorAll('a[href="/cart"],a[href="/cart/"]').forEach(link=>{normalizeCartLink(link);const badge=link.querySelector('.cart-count-badge');if(badge){badge.textContent=String(count);badge.hidden=count===0;}link.setAttribute('aria-label',count?`Shopping cart, ${count} ${count===1?'item':'items'}`:'Shopping cart');});
    updateFloatingCart(count);
  };

  const ensureWhatsAppBubble = () => {
    if(location.pathname.startsWith('/admin'))return;
    ensureFloatingStyles();
    document.querySelectorAll('.whatsapp-bubble').forEach((el,index)=>{if(index>0)el.remove();});
    let bubble=document.querySelector('.whatsapp-bubble');
    if(!bubble){bubble=document.createElement('a');bubble.className='whatsapp-bubble clever-floating-whatsapp';bubble.href=WHATSAPP_URL;bubble.target='_blank';bubble.rel='noopener noreferrer';bubble.setAttribute('aria-label','Chat with Clever Toys on WhatsApp');bubble.title='Chat with us on WhatsApp';bubble.innerHTML='<svg viewBox="0 0 32 32" focusable="false" aria-hidden="true"><path d="M16 3.2C9.1 3.2 3.5 8.8 3.5 15.7c0 2.2.6 4.4 1.8 6.3L3.2 28.8l6.9-2.1c1.8 1 3.8 1.5 5.9 1.5 6.9 0 12.5-5.6 12.5-12.5S22.9 3.2 16 3.2Zm0 22.8c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-4.1 1.2 1.2-4-.3-.4c-1-1.6-1.5-3.5-1.5-5.4C5.5 9.9 10.2 5.2 16 5.2s10.5 4.7 10.5 10.5S21.8 26 16 26Zm5.8-7.8c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.7-1.7-2-.2-.3 0-.5.1-.7.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.3 1.3.5 1.7.7.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z" fill="currentColor"/></svg>';document.body.appendChild(bubble);}else{bubble.classList.add('clever-floating-whatsapp');bubble.href=WHATSAPP_URL;}
  };

  const refreshAll = () => { ensureCartLink(); ensureFloatingCart(); ensureWhatsAppBubble(); };

  const applyTheme = primary => { if(!Array.isArray(primary)||primary.length!==3)return; const [r,g,b]=primary.map(Number); const clamp=v=>Math.max(0,Math.min(255,Math.round(v))); const lighten=a=>primary.map(v=>clamp(v+(255-v)*a)); const darken=a=>primary.map(v=>clamp(v*(1-a))); const hexify=rgb=>'#'+rgb.map(clamp).map(v=>v.toString(16).padStart(2,'0')).join(''); const hex=hexify(primary); document.documentElement.style.setProperty('--brand-primary',hex);document.documentElement.style.setProperty('--brand-primary-hover',hexify(darken(.12)));document.documentElement.style.setProperty('--brand-soft',hexify(lighten(.88)));document.documentElement.style.setProperty('--brand-text-on-primary',(0.299*r+0.587*g+0.114*b)>165?'#111827':'#fff'); try{localStorage.setItem(THEME_KEY,hex);document.cookie=`cleverTheme=${encodeURIComponent(hex)}; Max-Age=31536000; Path=/; SameSite=Lax`;}catch{} };
  const applyCachedThemeImmediately=()=>{const hex=branding.theme||(()=>{try{return localStorage.getItem(THEME_KEY)||'';}catch{return '';}})();if(/^#[0-9a-f]{6}$/i.test(hex))document.documentElement.style.setProperty('--brand-primary',hex);};
  const extractLogoTheme=async url=>{try{const image=new Image();image.crossOrigin='anonymous';image.src=url;await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});const canvas=document.createElement('canvas');canvas.width=canvas.height=48;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return;ctx.drawImage(image,0,0,48,48);const data=ctx.getImageData(0,0,48,48).data,buckets=new Map();for(let i=0;i<data.length;i+=16){if(data[i+3]<150)continue;const r=data[i],g=data[i+1],b=data[i+2],brightness=(r+g+b)/3;if(brightness>242||brightness<18)continue;const max=Math.max(r,g,b),min=Math.min(r,g,b);if(max===0||(max-min)/max<.12)continue;const key=[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v/24)*24))).join(',');buckets.set(key,(buckets.get(key)||0)+1);}let best=null;for(const[key,score]of buckets)if(!best||score>best.score)best={key,score};if(best)applyTheme(best.key.split(',').map(Number));}catch{}};
  const patchLogos=()=>document.querySelectorAll('.logo').forEach(logo=>{let image=logo.querySelector('.site-logo-image'),text=logo.querySelector('.logo-text');if(!image){image=document.createElement('img');image.className='site-logo-image';image.alt=STORE_NAME;image.decoding='async';logo.prepend(image);}if(!text){text=document.createElement('span');text.className='logo-text';logo.appendChild(text);}text.textContent=STORE_NAME;text.hidden=false;if(FALLBACK_LOGO){image.src=FALLBACK_LOGO;image.hidden=false;}});
  const ensureStoreHeader=()=>{if(location.pathname.startsWith('/admin')||document.querySelector('.site-header'))return;const header=document.createElement('header');header.className='site-header';header.innerHTML=`<div class="container header-inner"><a href="/" class="logo"><img class="site-logo-image" src="${FALLBACK_LOGO}" alt="${STORE_NAME}" decoding="async"><span class="logo-text">${STORE_NAME}</span></a><nav class="main-nav" aria-label="Main navigation"><a href="/">Home</a><a href="/products">Shop</a><a href="/categories">Categories</a><a href="/cart"></a></nav></div>`;document.body.prepend(header);};
  const init = () => { applyCachedThemeImmediately(); ensureStoreHeader(); patchLogos(); refreshAll(); if(FALLBACK_LOGO)extractLogoTheme(FALLBACK_LOGO); };

  window.addEventListener('storage',e=>{if(e.key===CART_KEY)refreshAll();});
  window.addEventListener('clever-cart-updated',refreshAll);
  window.addEventListener('cart-updated',refreshAll);
  document.addEventListener('DOMContentLoaded',()=>{ensureStoreHeader();patchLogos();refreshAll();});
  window.addEventListener('pageshow',refreshAll);
  setInterval(refreshAll, 700);
  init();
})();