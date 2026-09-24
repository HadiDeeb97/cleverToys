# Clever Toys codebase audit

Audit of the Astro + Cloudflare Workers + Supabase storefront, September 2026.
Items marked **Applied** are in the code on `main`. Items marked **Recommended** need a decision, a paid service, or larger work, and include an implementation sketch.

Run these SQL files once in the Supabase SQL Editor (both are safe to re-run):

- `supabase/theme_settings.sql`: stores the published theme in `store_settings`
- `supabase/order_tracking.sql`: enables the `/track-order` page

---

## 1. Security

### 1.1 Stored XSS on the admin dashboard (critical) - Applied
- **What:** `src/pages/admin/dashboard.astro` rendered `order_number`, `customer_name` and `status` into `innerHTML` without escaping.
- **Why:** anyone can place an order. A customer name like `<img src=x onerror=...>` would run in the admin's browser, where the Supabase admin session lives, allowing full store takeover.
- **How:** all order fields go through an `esc()` helper before being inserted. Other admin pages already escaped this data; the analytics trend tooltip was also escaped for consistency.

### 1.2 Unpinned third-party script on checkout - Applied
- **What:** `checkout.astro` loaded `https://unpkg.com/@supabase/supabase-js@2` synchronously.
- **Why:** an unpinned CDN script runs on the page that collects names, phones and addresses (supply-chain risk), and it blocked rendering.
- **How:** checkout now imports `createClient` from the bundled npm package, like every other page.

### 1.3 Unvalidated order payload - Applied
- **What:** `src/pages/api/orders.ts` forwarded the whole request body to `create_order` and into the Telegram message. Notes, email, city and area had no length limits, and the body size was unbounded.
- **How:** `sanitizeOrder()` allow-lists the fields `create_order` uses, trims and caps each one (for example notes at 1000 characters and at most 50 items), and requests over 32 KB get `413`. Telegram totals now come only from the server calculation, never from the browser.

### 1.4 Missing security headers - Applied
- **What:** no response set security headers.
- **How:** `src/middleware.ts` adds the following to every response:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`
  - `Permissions-Policy`
  - `Strict-Transport-Security`

### 1.5 Earlier fixes (already merged)
Escaping on the account and checkout pages, `</script>`-safe inline JSON, order double-submit protection, and customer order RLS.

### 1.6 Rate limiting for public endpoints - Recommended
- **What:** `/api/orders`, `/api/track-order` and `/api/analytics/track` accept unlimited requests.
- **Why:** bots can create junk orders (which also reserve stock) or flood analytics.
- **How:** add a Cloudflare rate-limiting binding and check it before doing work.
  ```jsonc
  // wrangler.jsonc
  "ratelimits": [{ "name": "ORDER_LIMITER", "namespace_id": "1001", "simple": { "limit": 5, "period": 60 } }]
  ```
  ```ts
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const { success } = await env.ORDER_LIMITER.limit({ key: ip });
  if (!success) return new Response(JSON.stringify({ error: 'Too many requests, try again in a minute.' }), { status: 429 });
  ```
  For stronger bot protection on checkout, add Cloudflare Turnstile to the form and verify the token in `orders.ts`.

### 1.7 Full Content Security Policy - Recommended
Pages use inline scripts and `onload` handlers, so a strict `script-src` needs nonces. Once the inline page scripts move into bundled modules (see 4.2), add `script-src 'self'` and `style-src 'self' https://fonts.googleapis.com 'unsafe-inline'`. Add a Subresource Integrity hash to the SheetJS script on `admin/import-template.astro`.

### 1.8 Dependencies - Applied
`npm audit` reports 0 vulnerabilities. Patch updates were applied (Astro 7.3.5, `@astrojs/cloudflare` 14.3.3, `supabase-js` 2.117.1, Wrangler 4.138), and `wrangler` moved to `devDependencies`.

---

## 2. Performance

### 2.1 Render-blocking fonts - Applied
Google Fonts now load with `media="print" onload="this.media='all'"` plus a `<noscript>` fallback, so text renders immediately with `font-display: swap`.

### 2.2 Images - Applied
- The main product image has `fetchpriority="high"`, `decoding="async"` and intrinsic dimensions.
- Product grid images have `loading="lazy"`, `decoding="async"` and `width`/`height`, which avoids layout shift.

### 2.3 Caching - Applied
- `public/_headers` caches the versioned storefront scripts for 1 day (with stale-while-revalidate) and the favicons for 7 days.
- `sitemap.xml` and `robots.txt` send `Cache-Control: public, max-age=3600`.

### 2.4 Theme fetched twice - Applied
`store-ui.js` re-downloaded `theme.json` on every page even though the server already injects the theme. That request is removed, which also stops a stale file from overriding the live theme.

### 2.5 Per-request Supabase calls in middleware - Recommended
- **What:** every HTML page makes 2 to 4 Supabase requests (store settings, theme file, SEO) before responding. They already run in parallel.
- **How:** cache them at the edge for a short time.
  ```ts
  const cache = caches.default;
  const cacheKey = new Request(`https://cache.clevertoys/settings`);
  let cached = await cache.match(cacheKey);
  if (!cached) {
    cached = await fetch(settingsUrl, { headers });
    cached = new Response(cached.body, cached);
    cached.headers.set('cache-control', 'public, max-age=30');
    context.locals.runtime?.ctx?.waitUntil(cache.put(cacheKey, cached.clone()));
  }
  ```
  A 30-second TTL removes most of the latency at the cost of theme and settings changes taking up to 30 seconds to appear.

### 2.6 Image transformations - Recommended
Product photos are served at full upload size. Supabase image transformations (`/storage/v1/render/image/public/product-images/...?width=400&quality=75`, on paid plans) or Cloudflare Images (the adapter already enables the `IMAGES` binding) would cut grid image weight substantially. Serve roughly 400px for cards and 900px for the product page.

### 2.7 Sorting by price ignores sale prices - Recommended
`products.astro` sorts on `price`, so discounted items appear in the wrong order. Add a generated column and sort on it.
```sql
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS effective_price numeric(10,2)
  GENERATED ALWAYS AS (coalesce(sale_price, price)) STORED;
CREATE INDEX IF NOT EXISTS products_effective_price_idx ON public.products(effective_price);
```
```ts
if (sort === 'price-asc') query = query.order('effective_price', { ascending: true });
```

---

## 3. Ecommerce features

### 3.1 Guest order tracking - Applied
- New `/track-order` page, `/api/track-order` endpoint and `track_order()` SQL function.
- Customers enter their order number and phone number and see a status timeline, items and totals.
- The function only returns an order when both values match (it compares the last digits of the phone), and it returns the same error for "no such order" and "wrong phone".
- Linked from the order confirmation page and the footer.

### 3.2 Free-delivery progress in the cart - Applied
The cart shows "Add $X more for free delivery" with a progress bar, using the threshold set in Admin → Branding. This is a proven average-order-value lever.

### 3.3 Low-stock urgency - Applied
Product pages say "Only N left, order soon!" when stock is 5 or fewer, including for variants.

### 3.4 Recommended next features (in order of business value)
1. **Order status notifications.** When an admin changes an order's status in `admin/orders.astro`, send the customer a WhatsApp or SMS message with the tracking link. Reuse the Telegram pattern in `api/orders.ts` with a provider such as the WhatsApp Business API.
2. **Discount codes.** `orders.discount` exists but is always 0. Add a `discount_codes` table (code, percent or amount, minimum subtotal, expiry, usage limit) and apply it inside `create_order` so the server stays authoritative.
3. **Low-stock alerts for the admin.** After `create_order` decrements stock, send a Telegram message when a product or variant falls below a threshold.
4. **Online payment.** Checkout is cash on delivery only. Check which card or wallet gateways accept merchants in Lebanon. Integrate one server-side (create the payment in a Worker route, confirm via webhook, then mark the order paid) and keep COD as an option.
5. **Reviews and ratings.** A `product_reviews` table with RLS (insert by authenticated customers who ordered the product, public read of approved reviews). Show stars on cards and add `aggregateRating` to the product JSON-LD.
6. **Wishlist and recently viewed.** Use `localStorage` for guests and a table for signed-in customers.
7. **Abandoned cart recovery.** For signed-in customers, persist the cart server-side and message them after 24 hours.

---

## 4. Code quality and maintainability

### 4.1 Duplicated configuration - Applied
Seventeen files repeated `env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || ''`. They now use `supabaseConfig()` from `src/lib/config.ts`, which also strips trailing slashes. `src/lib/supabase.ts` uses the same helper.

### 4.2 Remaining structural issues - Recommended
- **Minified inline scripts:** most pages (`admin/index.astro`, `cart.astro`, `product/[slug].astro` and others) contain long minified inline scripts. They can't be type-checked (about 725 `astro check` errors) and are hard to review. Move them into `src/scripts/*.ts` modules imported from `<script>` tags, one page at a time.
- **Cart logic in four places:** reading and writing the `cleverToysCart` key is duplicated in `cart.astro`, `checkout.astro`, `product/[slug].astro` and `public/store-ui.js`. Extract `src/scripts/cart.ts` with `readCart()`, `saveCart()`, `cartCount()` and a single `cart-updated` event.
- **Escape helpers everywhere:** each page defines its own `esc()`. Put one in `src/scripts/html.ts`.
- **Middleware too large:** `src/middleware.ts` (about 300 lines) builds headers, the footer, SEO tags, the theme and security headers. Split it into `src/server/theme.ts`, `seo.ts`, `layout.ts` and `security.ts`. Longer term, replace HTML regex rewriting with a real `Layout.astro` that every page uses.
- **Admin search id shared with the shop:** `#product-search` is used for both the admin product search and the shop search box. Give the admin one its own id.

### 4.3 Dead code - Applied
Removed the unused `src/layouts/Layout.astro`, `src/lib/image.ts` and `src/lib/product-images.ts`, and the Astro starter files.

---

## 5. Accessibility (WCAG 2.2)

### Applied
- **Language:** pages without an `<html>` element now get `<html lang="en">`, so screen readers use the right language.
- **Skip link:** "Skip to content" is the first focusable element on every storefront page and jumps to `<main id="main-content">`.
- **Image viewer:** it no longer turns linked product images into `role="button"` elements nested inside links. That was invalid for assistive technology, and on category pages it opened a zoom viewer instead of the product page.
- **Contrast:** every theme's primary and gradient colors meet 4.5:1 with white text. Custom colors are darkened automatically until they pass.
- **Order tracking:** the timeline marks the current step with `aria-current="step"` and announces results politely.

### Recommended
- Link form errors to their fields with `aria-describedby`, and move focus to the first invalid field on submit (checkout, login, register).
- Give the quantity input on product pages an accessible description of the stock limit.
- Add visible `:focus-visible` styles to the theme cards and color inputs in the admin.

---

## 6. SEO

### Applied
- **Default meta:** a meta description, canonical URL, `og:site_name` and `og:type` are added when a page has none.
- **Private pages:** cart, checkout, account, login, registration, password reset and order success get `noindex, nofollow`.
- **Canonical URLs:** the About, Contact, Privacy, Shipping and Terms pages now build them from the configured site URL instead of the request host.
- **Sitemap:** `/track-order` is included.

### Recommended
- Add `BreadcrumbList` JSON-LD to product and category pages, and `Organization` JSON-LD (name, logo, WhatsApp contact) on the home page.
- Add `aggregateRating` to product JSON-LD once reviews exist.
- If you add Arabic, serve `/ar/...` routes with `hreflang` alternates (Astro i18n routing).

---

## 7. Theme and design

### Applied: gradient theme support
- **Theme format:** themes can include `primary2`, a gradient end color. The middleware injects `--brand-primary-2` and `global.css` builds `--brand-gradient` from both colors.
- **Where it shows:** buttons, the header cart button, the ribbon, the floating cart, the mobile active menu item, the hero bubble, the "Discover." headline (`.text-gradient`), category accents, the cart progress bar and the tracking timeline.
- **Admin controls:** a "Gradient style" switch, gradient pairs for all 8 presets (each end checked for WCAG AA with white text), and a "Gradient end" picker for custom themes.
- **Compatibility:** solid themes set `primary2` equal to `primary`, and older published themes without `primary2` render solid.
- **Publishing:** themes save to `store_settings.theme`, with the storage file as a fallback.

### How to extend
Everything visual derives from six variables, so new styles only need new tokens:
```css
:root {
  --brand-primary: #2563eb;      /* main color */
  --brand-primary-2: #7c3aed;    /* gradient end */
  --brand-soft: #e8f0ff;         /* light backgrounds */
  --theme-accent: #ffc53d;       /* badges, highlights */
  --brand-gradient: linear-gradient(135deg, var(--brand-primary), var(--brand-primary-2));
}
```
Ideas that fit this system: a per-theme corner radius (`--radius`) for "soft" and "blocky" looks; a per-theme display font; and seasonal themes scheduled by date in `store_settings`.

---

## 8. Tooling and best practices - Recommended
- **Type checking:** add `@astrojs/check` and `typescript` as dev dependencies and an `"check": "astro check"` script. Run it in CI once the inline scripts (4.2) are converted.
- **Wrangler config:** commit a `wrangler.jsonc` (compatibility date, vars, rate limiters) so deployments are reproducible instead of depending on dashboard settings.
- **Tests:**
  - Vitest unit tests for `sanitizeOrder`, `readableText`/contrast and pricing helpers.
  - A Playwright smoke test that loads the main pages at desktop and phone widths and fails on console errors or horizontal overflow. This audit used the same approach against a mock Supabase.
- **Formatting:** Prettier with the Astro plugin, plus ESLint, to un-minify and standardize the page scripts.
