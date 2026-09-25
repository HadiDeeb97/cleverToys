// Type declarations for things the TypeScript checker cannot see on its own.

// Settings that src/middleware.ts writes into every page (see "branding" there).
interface CleverBranding {
  logoUrl?: string;
  storeName?: string;
  whatsappUrl?: string;
  instagramUrl?: string;
  showWhatsapp?: boolean;
  showInstagram?: boolean;
  ribbonText?: string;
  showRibbon?: boolean;
  codDeliveryPrice?: number;
  freeDeliveryThreshold?: number;
  useLogoColors?: boolean;
  publishedTheme?: { primary: string; primary2?: string; soft: string; accent: string; id?: string; name?: string } | null;
}

interface Window {
  __CLEVER_BRANDING__?: CleverBranding;
  /** Admin toast message, from public/admin-ui.js. */
  adminToast?: (message: string, tone?: string) => void;
  /** SheetJS, loaded from its CDN on the admin product import/template pages. */
  XLSX?: any;
}
declare const XLSX: any;

// Cloudflare-only fetch option (edge cache control) used by the middleware.
interface RequestInit {
  cf?: Record<string, unknown>;
}

// Environment variables from the Cloudflare Worker (set in the dashboard or .dev.vars).
declare module 'cloudflare:workers' {
  export const env: Record<string, string | undefined>;
}

// Request-scoped data shared by src/middleware.ts with pages (see src/lib/page-data.ts).
declare namespace App {
  interface Locals {
    pageData?: Promise<import('./lib/page-data').PageData>;
  }
}
