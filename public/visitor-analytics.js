/**
 * visitor-analytics.js: anonymous visit counting for Admin → Visitors.
 *
 * Sends one "pageview" per page, then a small "heartbeat" every 60 seconds while the tab is
 * visible (so the admin can see who is online and how long visits last). Nothing is sent while
 * the tab is in the background, to save the shopper's battery and data.
 * Loaded by store-ui.js after the page has finished loading.
 */
(() => {
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/api')) return;
  const VISITOR_KEY = 'cleverToysVisitorId';
  const SESSION_KEY = 'cleverToysSessionId';
  const makeId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  const getId = (storage, key) => {
    try {
      let value = storage.getItem(key);
      if (!value) { value = makeId(); storage.setItem(key, value); }
      return value;
    } catch { return makeId(); }
  };
  const visitorId = getId(localStorage, VISITOR_KEY);
  const sessionId = getId(sessionStorage, SESSION_KEY);
  const detect = () => {
    const ua = navigator.userAgent || '';
    let device = 'desktop';
    if (/tablet|ipad|playbook|silk/i.test(ua)) device = 'tablet';
    else if (/mobi|android|iphone|ipod/i.test(ua)) device = 'mobile';
    let browser = 'Other';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/OPR\//i.test(ua)) browser = 'Opera';
    else if (/Chrome\//i.test(ua)) browser = 'Chrome';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
    let os = 'Other';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';
    return { device, browser, os };
  };
  const info = detect();
  const send = (eventType = 'pageview') => {
    const payload = JSON.stringify({
      visitorId,
      sessionId,
      path: `${location.pathname}${location.search}`.slice(0, 500),
      referrer: document.referrer || '',
      device: info.device,
      browser: info.browser,
      os: info.os,
      eventType
    });
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
      credentials: 'same-origin'
    }).catch(() => {});
  };
  send('pageview');
  let heartbeat = 0;
  const startHeartbeat = () => { if (!heartbeat) heartbeat = window.setInterval(() => send('heartbeat'), 60000); };
  const stopHeartbeat = () => { window.clearInterval(heartbeat); heartbeat = 0; };
  startHeartbeat();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { stopHeartbeat(); send('heartbeat'); }
    else startHeartbeat();
  });
})();
