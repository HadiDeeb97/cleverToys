/**
 * Shared start-up for every admin page:
 *  1. Connects to Supabase with the signed-in admin's session (or sends them to /login).
 *  2. Asks the database for their role and permissions (admin_me, from supabase/cms.sql).
 *     Before cms.sql is run, any admin is treated as an owner, exactly like before.
 *  3. Shows only the sidebar links their role can open, and a clear message on pages it cannot.
 *  4. Watches for new orders (staff who handle orders) and shows a badge, a message and a sound.
 *
 * Page markup needs <div id="auth-config" data-url data-key hidden>, <div id="guard"> and <div id="app" hidden>.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Perm = 'products' | 'orders' | 'customers' | 'accounting' | 'analytics' | 'content' | 'marketing' | 'seo' | 'settings' | 'reviews' | 'team' | 'logs' | 'backup';
export type AdminAccess = { role: 'owner' | 'manager' | 'orders' | 'content'; perms: Perm[]; email: string; cmsReady: boolean };
// No generated database types in this project, so rows are typed loosely.
export type Db = SupabaseClient<any, 'public', any>;

const ALL: Perm[] = ['products', 'orders', 'customers', 'accounting', 'analytics', 'content', 'marketing', 'seo', 'settings', 'reviews', 'team', 'logs', 'backup'];
const ROLE_NAMES: Record<string, string> = { owner: 'Owner', manager: 'Manager', orders: 'Orders staff', content: 'Content editor' };
// First page to send someone to when their role cannot open the current one.
const HOME_FOR: Array<[Perm, string]> = [['orders', '/admin/dashboard'], ['products', '/admin'], ['content', '/admin/pages']];

export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
export const money = (n: unknown) => `$${Number(n || 0).toFixed(2)}`;
export const toast = (message: string, tone: 'success' | 'error' = 'success') => (window as any).adminToast?.(message, tone);
export const when = (v: string | null | undefined) => (v ? new Date(v).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

type PgError = { code?: string; message?: string } | null | undefined;
/** The database function does not exist yet (the SQL file has not been run). */
export const missingFunction = (e: PgError) => Boolean(e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(e.message || '')));
/** The table does not exist yet (the SQL file has not been run). */
// (PGRST200: a lookup that joins a table which does not exist yet reports a missing relationship.)
export const missingTable = (e: PgError) => Boolean(e && (e.code === 'PGRST205' || e.code === 'PGRST200' || e.code === '42P01' || /could not find the table|does not exist/i.test(e.message || '')));

/** Yellow "run this SQL file" notice used by pages whose feature needs supabase/cms.sql. */
export function setupNotice(file = 'supabase/cms.sql') {
  return `<div class="acc-notice">This page needs one database update. In Supabase, open <strong>SQL Editor</strong>, paste the contents of <code>${esc(file)}</code> and press <strong>Run</strong>. Then reload this page.</div>`;
}

async function readAccess(supabase: Db): Promise<AdminAccess | null> {
  const me = await supabase.rpc('admin_me');
  if (!me.error) {
    const data = me.data as { role: AdminAccess['role']; perms: Perm[]; email: string } | null;
    return data ? { role: data.role, perms: data.perms || [], email: data.email || '', cmsReady: true } : null;
  }
  if (!missingFunction(me.error)) throw new Error(me.error.message);
  // Older database: one kind of admin with full access.
  const legacy = await supabase.rpc('is_admin');
  if (legacy.error) throw new Error(legacy.error.message);
  return legacy.data ? { role: 'owner', perms: ALL, email: '', cmsReady: false } : null;
}

/**
 * Starts an admin page. Resolves with the Supabase client and the admin's access, or null when the
 * page must not open (not signed in, not an admin, or their role cannot open it).
 */
export async function startAdmin(perm: Perm, pageName: string): Promise<{ supabase: Db; access: AdminAccess } | null> {
  const guard = document.getElementById('guard');
  const app = document.getElementById('app');
  try {
    const cfg = document.getElementById('auth-config');
    const url = cfg?.dataset.url, key = cfg?.dataset.key;
    if (!url || !key) throw new Error('Supabase browser configuration is missing.');
    const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) as Db;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`; return null; }
    const access = await readAccess(supabase);
    if (!access) {
      if (guard) guard.innerHTML = '<h2>Access denied</h2><p>This account is not on the admin team.</p><a class="button" href="/">Back to store</a>';
      return null;
    }
    if (!access.email) access.email = session.user.email || '';
    (window as any).adminApplyAccess?.(access);
    if (!access.perms.includes(perm)) {
      const home = HOME_FOR.find(([p]) => access.perms.includes(p))?.[1] || '/';
      if (guard) guard.innerHTML = `<h2>Not available for your role</h2><p>${esc(pageName)} is not part of the <strong>${esc(ROLE_NAMES[access.role] || access.role)}</strong> role. Ask the store owner if you need it.</p><a class="button" href="${home}">Go to my pages</a>`;
      return null;
    }
    if (guard) guard.hidden = true;
    if (app) app.hidden = false;
    if (access.perms.includes('orders')) watchNewOrders(supabase);
    return { supabase, access };
  } catch (error) {
    if (guard) { guard.hidden = false; guard.innerHTML = `<h2>${esc(pageName)} could not load</h2><p>${esc(error instanceof Error ? error.message : 'Unknown error')}</p>`; }
    return null;
  }
}

// ---------- New order alerts ----------
const SEEN_KEY = 'ctAdminOrdersSeenAt';
let watching = false;

/** Call on the Orders page after showing the list: everything up to now counts as seen. */
export function markOrdersSeen() {
  try { localStorage.setItem(SEEN_KEY, new Date().toISOString()); } catch {}
  (window as any).adminSetNewOrders?.(0);
}

function chime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = freq; osc.connect(gain); gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.start(t); osc.stop(t + 0.32);
    });
  } catch {}
}

function watchNewOrders(supabase: Db) {
  if (watching) return;
  watching = true;
  let seenAt = '';
  try { seenAt = localStorage.getItem(SEEN_KEY) || ''; } catch {}
  if (!seenAt) { seenAt = new Date().toISOString(); try { localStorage.setItem(SEEN_KEY, seenAt); } catch {} }
  let known = -1;
  const check = async () => {
    if (document.hidden) return;
    try { seenAt = localStorage.getItem(SEEN_KEY) || seenAt; } catch {}
    const { data, error } = await supabase.from('orders').select('order_number,total,customer_name,created_at').gt('created_at', seenAt).order('created_at', { ascending: false }).limit(50);
    if (error || !data) return;
    (window as any).adminSetNewOrders?.(data.length);
    if (known >= 0 && data.length > known) {
      const newest = data[0];
      toast(`🛒 New order ${newest.order_number} from ${newest.customer_name} (${money(newest.total)})`);
      chime();
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification('New Clever Toys order', { body: `${newest.order_number} · ${newest.customer_name} · ${money(newest.total)}`, icon: '/favicon.svg', tag: 'ct-order' }); } catch {}
      }
    }
    known = data.length;
  };
  check();
  setInterval(check, 30_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}

/** Asks the browser for permission to show new-order notifications (called from a button click). */
export async function enableOrderNotifications(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

/**
 * For the older admin pages that do their own sign-in: after their "is this an admin?" check,
 * this checks the role can open the page, updates the sidebar and starts new-order alerts.
 * Returns false (and shows a message in #guard) when the role cannot open the page.
 */
export async function allowPage(supabase: Db, perm: Perm, pageName: string): Promise<boolean> {
  const access = await readAccess(supabase);
  if (!access) return false;
  (window as any).adminApplyAccess?.(access);
  if (!access.perms.includes(perm)) {
    const home = HOME_FOR.find(([p]) => access.perms.includes(p))?.[1] || '/';
    const guard = document.getElementById('guard');
    if (guard) { guard.hidden = false; guard.innerHTML = `<h2>Not available for your role</h2><p>${esc(pageName)} is not part of the <strong>${esc(ROLE_NAMES[access.role] || access.role)}</strong> role. Ask the store owner if you need it.</p><a class="button" href="${home}">Go to my pages</a>`; }
    return false;
  }
  if (access.perms.includes('orders')) watchNewOrders(supabase);
  return true;
}

/** Shrinks a picture to at most `max` pixels on its longest side and converts it to WebP for fast pages. */
export async function toWebp(file: File, max = 1600) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Could not convert the picture.')), 'image/webp', 0.84));
}
