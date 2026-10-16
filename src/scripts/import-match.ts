/**
 * Which product on the site a row of the Excel import is (Admin → Products → Excel import).
 *
 *  - Exact: the same slug (web address) or the same SKU.
 *  - Similar name: scored 0…1 and shown for the admin to confirm (the best 3 are offered).
 *
 * How names are compared:
 *  - Words are simplified: capitals, accents, plurals ("tiles" → tile), spacing around numbers
 *    ("100PCS" → 100 pcs), "pieces" → pcs, "R/C" / "remote control" → rc, a few synonyms (potty / toilet).
 *  - Words written together or apart match ("basketball" / "basket ball", "flashcards" / "flash cards").
 *  - Small typos in longer words match ("magentic" / "magnetic"), and word starts ("multifunction" /
 *    "multifunctional"); short words must be exact (bear / bead).
 *  - Not every word counts the same: filler words (toy, game, set, kids, smart…) count little, and
 *    words found in many of the store's names count less than rare ones.
 *  - When all the important words of one name are in the other ("Matching Eggs" / "Smart Eggs
 *    Matching Toy"), it is a strong match.
 *  - Different numbers mean different toys ("Magnetic Tiles 60 pcs" / "… 100 pcs"); a number on only
 *    one side ("Spraying Kitchen" / "Spraying Kitchen - 69 Pcs") lowers the score a little.
 */
import { within } from './smart-search';

type Named = { id: string; name: string; slug?: string | null; sku?: string | null; price?: number | string | null };
export type Candidate<P> = { product: P; score: number };

/** At or above: shown as a possible match (the row starts on Skip). */
export const POSSIBLE_MATCH = 0.65;
/** At or above: offered in the row's choices ("Same toy as …"), even for rows added as new. */
export const WEAK_MATCH = 0.5;
/** At or above: labelled a strong match. */
export const STRONG_MATCH = 0.85;

const STOP = new Set(['the', 'a', 'an', 'of', 'for', 'with', 'and', 'to', 'in', 'on', 'by', 'from']);
const FILLER = new Set(['toy', 'game', 'set', 'kit', 'kid', 'child', 'children', 'play', 'fun', 'new', 'smart', 'series', 'style', 'deluxe', 'collection', 'pack', 'pcs', 'edition', 'version', 'original', 'super', 'cute', 'lovely']);
const SYNONYMS: Record<string, string> = { potty: 'toilet', soccer: 'football', colour: 'color', colourful: 'colorful', grey: 'gray', aeroplane: 'plane', airplane: 'plane', motorbike: 'motorcycle', pieces: 'pcs', piece: 'pcs', pc: 'pcs', pzs: 'pcs' };
const singular = (w: string) => (/^\d+$/.test(w) || w.length <= 3 ? w : w.endsWith('ies') ? `${w.slice(0, -3)}y` : /(ss|us|is)$/.test(w) ? w : w.endsWith('s') ? w.slice(0, -1) : w);
const isNumber = (w: string) => /^\d+$/.test(w);

/** The words of a name, simplified for comparing: "Magnetic Tiles 100PCS" → magnetic, tile, 100, pcs. */
export function nameTokens(value: unknown): string[] {
  return String(value ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\br\s*\/\s*c\b/g, ' rc ').replace(/\bremote[\s-]*control(led)?\b/g, ' rc ')
    .replace(/(\d)(\p{L})/gu, '$1 $2').replace(/(\p{L})(\d)/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean)
    .map((w) => SYNONYMS[w] ?? w)
    .map(singular)
    .map((w) => SYNONYMS[w] ?? w)
    .filter((w) => !STOP.has(w));
}

/** Two neighbouring words written together in the other name ("basket ball" / "basketball") become one. */
function joinCompounds(a: string[], b: string[]) {
  const other = new Set(b);
  const out: string[] = [];
  for (let i = 0; i < a.length; i++) {
    const joined = i + 1 < a.length ? singular(a[i] + a[i + 1]) : '';
    if (joined && !isNumber(a[i]) && other.has(joined)) { out.push(joined); i++; } else out.push(a[i]);
  }
  return out;
}

function wordMatch(a: string, b: string) {
  if (a === b) return 1;
  if (isNumber(a) || isNumber(b)) return 0;
  // Typos: same first letter, one mistake in words of 6+ letters, two in words of 8+ ("magentic").
  // Shorter words are left alone: bear / bead, doll / roll are different words.
  const shortest = Math.min(a.length, b.length);
  if (shortest >= 6 && a[0] === b[0] && within(a, b, shortest >= 8 ? 2 : 1)) return 0.85;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 5 && long.startsWith(short) && long.length - short.length <= 4) return 0.8;
  return 0;
}

/** How much a word counts: filler words little, words common in the store's names less. */
type Weigh = (w: string) => number;
function weigher(products: Named[]): Weigh {
  const df = new Map<string, number>();
  for (const p of products) for (const w of new Set(tokensOf(p))) df.set(w, (df.get(w) || 0) + 1);
  const common = Math.max(6, products.length * 0.04);
  return (w) => (FILLER.has(w) ? 0.3 : (df.get(w) || 0) >= common ? 0.6 : 1);
}

/** Share (0…1, weighted) of a's words found in b. */
function coverage(a: string[], b: string[], weigh: Weigh) {
  let total = 0, found = 0;
  for (const w of a) {
    const weight = weigh(w);
    total += weight;
    found += weight * Math.max(0, ...b.map((x) => wordMatch(w, x)));
  }
  return { share: total ? found / total : 0, weight: total };
}

/** Letter pairs shared by two strings, 0…1 (catches names typed with no spaces at all). */
function pairs(a: string, b: string) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const count = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) { const p = a.slice(i, i + 2); count.set(p, (count.get(p) || 0) + 1); }
  let shared = 0;
  for (let i = 0; i < b.length - 1; i++) { const p = b.slice(i, i + 2); const n = count.get(p) || 0; if (n) { shared++; count.set(p, n - 1); } }
  return (2 * shared) / (a.length + b.length - 2);
}

/** How alike two names (already split into words) are, 0…1. */
export function nameSimilarity(a: string[], b: string[], weigh: Weigh = (w) => (FILLER.has(w) ? 0.3 : 1)): number {
  if (!a.length || !b.length) return 0;
  const numbersA = [...new Set(a.filter(isNumber))].sort().join(' ');
  const numbersB = [...new Set(b.filter(isNumber))].sort().join(' ');
  if (numbersA && numbersB && numbersA !== numbersB) return 0; // different numbers: different toys
  const wordsA = joinCompounds(a.filter((w) => !isNumber(w)), b);
  const wordsB = joinCompounds(b.filter((w) => !isNumber(w)), wordsA);
  if (!wordsA.length || !wordsB.length) return numbersA === numbersB ? 0.5 : 0;
  const ca = coverage(wordsA, wordsB, weigh);
  const cb = coverage(wordsB, wordsA, weigh);
  const [small, large] = ca.weight <= cb.weight ? [ca, cb] : [cb, ca];
  let score: number;
  if (small.share >= 0.95) {
    // Every important word of the shorter name is in the longer one: the more of the longer name
    // that is explained, the surer. A one-word name ("Puzzles") fits into many names, so it counts less.
    score = (small.weight >= 1.5 ? 0.55 : 0.45) + 0.45 * large.share;
  } else score = (ca.share + cb.share) / 2;
  const joined = pairs(wordsA.join(''), wordsB.join(''));
  if (joined >= 0.9) score = Math.max(score, joined);
  if (numbersA !== numbersB) score *= 0.92; // a number on one side only
  return Math.min(1, score);
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
function tokensOf(p: Named) {
  let t = tokenCache.get(p);
  if (!t) { t = nameTokens(p.name); tokenCache.set(p, t); }
  return t;
}
const weigherCache = new WeakMap<object, { size: number; weigh: Weigh }>();

/**
 * The site products whose name is most like `name`, best first (up to `limit`, score WEAK_MATCH or
 * more). A close price breaks ties between similar names.
 */
export function rankCandidates<P extends Named>(products: P[], name: string, price: number | null = null, limit = 3): Candidate<P>[] {
  const wanted = nameTokens(name);
  if (!wanted.length) return [];
  let cached = weigherCache.get(products);
  if (!cached || cached.size !== products.length) { cached = { size: products.length, weigh: weigher(products) }; weigherCache.set(products, cached); }
  const weigh = cached.weigh;
  return products
    .map((product) => {
      let score = nameSimilarity(wanted, tokensOf(product), weigh);
      const sitePrice = Number(product.price ?? 0);
      if (score > 0 && price && price > 0 && sitePrice > 0) {
        const ratio = Math.max(price, sitePrice) / Math.min(price, sitePrice);
        if (ratio <= 1.15) score += 0.03; else if (ratio >= 2) score -= 0.03;
      }
      return { product, score: Math.max(0, Math.min(1, score)) };
    })
    .filter((m) => m.score >= WEAK_MATCH)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

/**
 * Products on the site that look like the same toy listed twice (Admin → Products → Possible
 * duplicates): for each product, the other products whose name scores `min` or more, best first.
 * Toys with different numbers ("Magnetic Tiles 60 pcs" / "… 100 pcs") are never paired.
 */
export function findDuplicates<P extends Named>(products: P[], min = STRONG_MATCH): Map<string, Candidate<P>[]> {
  const weigh = weigher(products);
  const out = new Map<string, Candidate<P>[]>();
  const add = (a: P, b: P, score: number) => {
    const list = out.get(a.id) || [];
    list.push({ product: b, score });
    out.set(a.id, list);
  };
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const score = nameSimilarity(tokensOf(products[i]), tokensOf(products[j]), weigh);
      if (score >= min) { add(products[i], products[j], score); add(products[j], products[i], score); }
    }
  }
  for (const list of out.values()) list.sort((x, y) => y.score - x.score);
  return out;
}
