# Clever Toys

Online toy store for Lebanon, built with [Astro](https://docs.astro.build) (server output) on Cloudflare Workers, with Supabase for the database, auth and image storage.

## Commands

| Command           | Action                                        |
| :---------------- | :-------------------------------------------- |
| `npm install`     | Install dependencies                          |
| `npm run dev`     | Start the local dev server at `localhost:4321` |
| `npm run build`   | Build the Worker to `./dist/`                  |
| `npm run preview` | Preview the production build locally           |
| `npm run deploy`  | Build and deploy with Wrangler                 |

## Configuration

Set these variables in the Cloudflare Worker environment (or a local `.env` for development):

- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (the `PUBLIC_` versions also work)
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (optional, for new-order notifications)

## Database

Run the SQL files in `supabase/` from the Supabase SQL Editor. They can safely be run more than once:

- `production.sql`: order creation, admin policies, multi-category support
- `branding_settings.sql`: store settings (WhatsApp, Instagram, ribbon, delivery price)
- `seo_migration.sql`: per-page SEO overrides
- `visitor_analytics.sql`: visitor tracking for the admin analytics page
- `customer_orders.sql`: lets signed-in customers see their own orders on `/account`
- `theme_settings.sql`: stores the published theme so Admin → Branding can publish it
- `order_tracking.sql`: powers the `/track-order` page

## Project structure

- `src/pages/`: storefront pages, `admin/` dashboard pages, and `api/` endpoints
- `src/middleware.ts`: adds the shared header, branding, store settings and SEO overrides to every HTML page
- `public/`: client scripts (`store-ui.js`, `branding-ui.js`, `visitor-analytics.js`) and CSS fixes

## Audit

See [`docs/AUDIT.md`](docs/AUDIT.md) for the security, performance, accessibility, SEO and ecommerce review, including recommended next steps.
