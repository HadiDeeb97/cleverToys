/**
 * Which product on the site a row of the Excel import is (Admin → Products → Excel import).
 *
 *  - Exact: the same slug (web address) or the same SKU.
 *  - Possible: a similar name: small typos, spacing ("100pcs" / "100 pcs"), word order, plurals,
 *    "pcs" / "pieces", "colour" / "color". The admin confirms these in the preview.
 *  - Names with different numbers ("Magnetic Tiles 60 pcs" / "Magnetic Tiles 100 pcs") never match:
 *    they are different toys.
 */
import { within } from './smart-search';

type Named = { id: string; name: string; slug?: string | null; sku?: string | null };

const STOP = new Set(['the', 'a', 'an', 'of', 'for', 'with', 'and', 'to', 'in', 'on']);
const singular = (w: string) => (/^\d+$/.test(w) || w.length <= 3 ? w : w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.endsWith('ss') ? w : w.endsWith('s') ? w.slice(0, -1) : w);

/** The words of a name, simplified for comparing: "Magnetic Tiles 100PCS" → magnetic, tile, 100, pcs. */
export function nameTokens(value: unknown): string[] {
  return String(value ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/(\d)(\p{L})/gu, '$1 $2').replace(/(\p{L})(\d)/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean)
    .map((w) => (/^(pcs?|pieces?|pzs)$/.test(w) ? 'pcs' : w === 'colour' ? 'color' : w))
    .map(singular)
    .filter((w) => !STOP.has(w));
}

const isNumber = (w: string) => /^\d+$/.test(w);
const wordScore = (a: string, b: string) => (a === b ? 1 : a.length >= 4 && b.length >= 4 && !isNumber(a) && !isNumber(b) && within(a, b, Math.min(a.length, b.length) >= 6 ? 2 : 1) ? 0.85 : 0);
/** Letter pairs shared by two strings, 0…1 (catches "buildingblock" / "building block"). */
function pairs(a: string, b: string) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const count = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) { const p = a.slice(i, i + 2); count.set(p, (count.get(p) || 0) + 1); }
  let shared = 0;
  for (let i = 0; i < b.length - 1; i++) { const p = b.slice(i, i + 2); const n = count.get(p) || 0; if (n) { shared++; count.set(p, n - 1); } }
  return (2 * shared) / (a.length + b.length - 2);
}

/** How alike two names are, 0…1. Different numbers → 0. */
export function nameSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const numbersA = a.filter(isNumber).sort().join(' ');
  const numbersB = b.filter(isNumber).sort().join(' ');
  if (numbersA !== numbersB) return 0;
  const best = (w: string, list: string[]) => Math.max(0, ...list.map((x) => wordScore(w, x)));
  const words = (a.reduce((s, w) => s + best(w, b), 0) + b.reduce((s, w) => s + best(w, a), 0)) / (a.length + b.length);
  return Math.max(words, pairs(a.join(''), b.join('')));
}

/** Same slug, else same SKU (capital letters and spaces ignored). */
export function exactMatch<P extends Named>(products: P[], slug: string, sku: string): { product: P; how: 'slug' | 'sku' } | null {
  const bySlug = slug ? products.find((p) => p.slug === slug) : undefined;
  if (bySlug) return { product: bySlug, how: 'slug' };
  const key = sku.trim().toLowerCase();
  const bySku = key ? products.find((p) => String(p.sku ?? '').trim().toLowerCase() === key) : undefined;
  return bySku ? { product: bySku, how: 'sku' } : null;
}

const tokenCache = new WeakMap<object, string[]>();
/** Site products with a similar name, best first (score 0.78 or more). */
export function similarProducts<P extends Named>(products: P[], name: string, threshold = 0.78): Array<{ product: P; score: number }> {
  const wanted = nameTokens(name);
  if (!wanted.length) return [];
  return products
    .map((product) => {
      let tokens = tokenCache.get(product);
      if (!tokens) { tokens = nameTokens(product.name); tokenCache.set(product, tokens); }
      return { product, score: nameSimilarity(wanted, tokens) };
    })
    .filter((m) => m.score >= threshold)
    .sort((x, y) => y.score - x.score);
}
