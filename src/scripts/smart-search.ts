/**
 * Smart matching for the admin search boxes (Products, Orders): every typed word must match, in any
 * order, anywhere in the given fields; small typos and plurals still match; phone numbers match
 * however they are typed (spaces, +961, leading 0). Results are ranked: matches in the first
 * (most important) field and at the start of words come first.
 */
export const searchWords = (value: unknown) =>
  String(value ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Whether two words differ by at most `max` letters (stops early). */
function within(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return false;
  // Two swapped neighbouring letters ("lnia" → lina) count as one mistake.
  let before: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], before[j - 2] + 1);
      best = Math.min(best, cur[j]);
    }
    if (best > max) return false;
    before = prev;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** Lebanese phone digits without +961 / 00961 / leading 0, so "71 123 456" matches "+961 71123456". */
const phoneDigits = (value: string) => value.replace(/\D/g, '').replace(/^(00)?961/, '').replace(/^0/, '');

/**
 * Score for one record, or 0 when it does not match. `fields` are [text, weight] pairs, most
 * important first (e.g. [[name, 3], [sku, 2], [brand, 1]]). `phones` are compared as digits.
 */
export function smartScore(query: string, fields: Array<[unknown, number]>, phones: unknown[] = []): number {
  const words = searchWords(query);
  if (!words.length) return 1;
  const prepared = fields.map(([text, weight]) => ({ words: searchWords(text), joined: searchWords(text).join(' '), weight }));
  const digits = phones.map((p) => phoneDigits(String(p ?? ''))).filter(Boolean);
  // A phone number typed with spaces or dashes ("71 222 333", "+961 71-222"): compare all its digits at once.
  if (digits.length && /^[\d\s+()\-.]+$/.test(query) && query.replace(/\D/g, '').length >= 3) {
    const typed = phoneDigits(query) || query.replace(/\D/g, '');
    if (digits.some((d) => d.includes(typed))) return 10;
  }
  let total = 0;
  for (const w of words) {
    let best = 0;
    if (/^\d{3,}$/.test(w) && digits.some((d) => d.includes(phoneDigits(w) || w))) best = 3;
    for (const f of prepared) {
      let s = 0;
      if (f.words.some((h) => h.startsWith(w))) s = 3;
      else if (f.joined.includes(w)) s = 2;
      else if (w.length > 3 && w.endsWith('s') && f.joined.includes(w.slice(0, -1))) s = 2;
      else if (w.length >= 4 && f.words.some((h) => within(w, h, w.length >= 5 ? 2 : 1) || within(w, h.slice(0, w.length), 1))) s = 1;
      best = Math.max(best, s * f.weight);
    }
    if (!best) return 0;
    total += best;
  }
  return total;
}

/** Keeps the records that match, best first (ties keep their original order). */
export function smartFilter<T>(items: T[], query: string, fields: (item: T) => Array<[unknown, number]>, phones: (item: T) => unknown[] = () => []): T[] {
  if (!searchWords(query).length) return items;
  return items
    .map((item, index) => ({ item, index, score: smartScore(query, fields(item), phones(item)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item);
}
