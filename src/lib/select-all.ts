/**
 * Every row of a Supabase query, for lists that can grow past 1000 rows (photos, orders, visits…).
 *
 * The database sends at most 1000 rows per request, even when a bigger .limit() is asked for, so the
 * rest would be cut off without any error. This reads the list 1000 rows at a time.
 *
 * `query` builds a fresh query each time and must end its ordering on a unique column (for example
 * .order('created_at').order('id')): otherwise rows with the same value can move between requests, and
 * one row shows twice while another is skipped. `max` stops early for very large lists.
 */
export async function selectAll<T = Record<string, any>>(query: () => any, max = Infinity): Promise<{ data: T[]; error: { message: string } | null }> {
  const data: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const r = await query().range(from, Math.min(from + 999, max - 1));
    if (r.error) return { data, error: r.error };
    const page = (r.data ?? []) as T[];
    data.push(...page);
    if (page.length < 1000) break;
  }
  return { data, error: null };
}
