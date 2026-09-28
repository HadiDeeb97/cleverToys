/**
 * Shop listing shared by /products and /category/<slug>: reads the filters from the URL, loads one
 * page of toys (24) plus the filter options, and builds the links for paging and removing filters.
 *
 * URL parameters: search (?q=), category (?category=, /products only), option (?variant=),
 * age (?age_min= / ?age_max=), sale (?sale=1), sorting (?sort=) and page (?page=).
 * On a category page the category is fixed by the path, so it is not a URL parameter there.
 * The page markup is src/components/ShopView.astro.
 */
import type { AstroGlobal } from 'astro';
import { supabase } from './supabase';
import type { CardProduct } from '../components/ProductCard.astro';

export const SHOP_PAGE_SIZE = 24;

export type ShopCategory = { id: string; name: string; slug: string };
export type ShopOptions = {
  /** Where the filters, sorting and paging links point: "/products" or "/category/<slug>". */
  basePath: string;
  /** Set on a category page: only toys in this category are listed. */
  fixedCategory?: ShopCategory;
};

export async function loadShop(Astro: AstroGlobal, { basePath, fixedCategory }: ShopOptions) {
  const params = Astro.url.searchParams;
  const parsedPage = Number.parseInt(params.get('page') || '1', 10);
  const requestedPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const search = params.get('q')?.trim() || '';
  // Categories picked in the filters (/products only); a category page always filters by its own.
  const selectedCategorySlugs = fixedCategory ? [] : [...new Set(params.getAll('category').map(v => v.trim()).filter(Boolean))];
  const filterCategorySlugs = fixedCategory ? [fixedCategory.slug] : selectedCategorySlugs;
  const selectedVariantFilters = [...new Set(params.getAll('variant').map(v => v.trim()).filter(Boolean))];
  const ageMinParam = params.get('age_min')?.trim() || '';
  const ageMaxParam = params.get('age_max')?.trim() || '';
  const ageMin = ageMinParam !== '' && Number.isFinite(Number(ageMinParam)) ? Math.max(0, Number(ageMinParam)) : null;
  const ageMax = ageMaxParam !== '' && Number.isFinite(Number(ageMaxParam)) ? Math.max(0, Number(ageMaxParam)) : null;
  const sort = params.get('sort') || 'newest';
  // Sale (?sale=1): every toy with a sale price, plus toys where only some options have one.
  const saleOnly = params.get('sale') === '1';
  // Toys whose options are on sale. Only looked up on the Sale page (one extra request there).
  const saleVariantIds = saleOnly
    ? [...new Set(((await supabase.from('product_variants').select('product_id').eq('is_active', true).not('sale_price', 'is', null)).data || []).map((r) => String(r.product_id)))]
    : [];

  const from = (requestedPage - 1) * SHOP_PAGE_SIZE;
  const to = from + SHOP_PAGE_SIZE - 1;

  // The database is far away, so every sequential request adds a noticeable wait. The category and
  // option filters are applied inside the products query itself (joined tables with !inner), which
  // lets all three requests below run at the same time: one round trip for the whole page.
  const buildProductsQuery = (head = false) => {
    // product_variants is embedded twice: all options (so cards know when a toy needs "Choose options"),
    // and, only when filtering by option, an inner-joined copy named variant_filter that keeps just matching toys.
    const joins = [
      filterCategorySlugs.length ? 'product_categories!inner(categories!inner(slug))' : '',
      selectedVariantFilters.length ? 'variant_filter:product_variants!inner(name)' : ''
    ].filter(Boolean);
    const columns = ['id, name, slug, price, sale_price, stock_quantity, primary_image_url, short_description, category_id, age_min, age_max, created_at, product_variants(id,is_active,price,sale_price)', ...joins].join(', ');
    let query = supabase.from('products').select(columns, { count: 'exact', head }).eq('is_active', true);
    if (search) query = query.ilike('name', `%${search}%`);
    if (saleOnly) query = saleVariantIds.length ? query.or(`sale_price.not.is.null,id.in.(${saleVariantIds.join(',')})`) : query.not('sale_price', 'is', null);
    if (filterCategorySlugs.length) query = query.eq('product_categories.categories.is_active', true).in('product_categories.categories.slug', filterCategorySlugs);
    if (selectedVariantFilters.length) query = query.eq('variant_filter.is_active', true).in('variant_filter.name', selectedVariantFilters);
    if (ageMin !== null) query = query.or(`age_max.gte.${ageMin},age_max.is.null`);
    if (ageMax !== null) query = query.or(`age_min.lte.${ageMax},age_min.is.null`);
    return query;
  };

  let query = buildProductsQuery();
  if (sort === 'price-asc') query = query.order('price', { ascending: true });
  else if (sort === 'price-desc') query = query.order('price', { ascending: false });
  else if (sort === 'name') query = query.order('name', { ascending: true });
  else query = query.order('created_at', { ascending: false });

  const [categoriesResult, variantsResult, productsResult] = await Promise.all([
    supabase.from('categories').select('id, name, slug').eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('product_variants').select('name').eq('is_active', true).order('name', { ascending: true }),
    query.range(from, to)
  ]);

  const categories = (categoriesResult.data || []) as ShopCategory[];
  const variantOptions = [...new Set((variantsResult.data || []).map(v => String(v.name || '').trim()).filter(Boolean))];

  /** Link to this listing with the current filters, optionally minus one filter (for the removable chips). */
  function shopUrl({ page = 1, without = '', value = '', base = basePath }: { page?: number; without?: 'q' | 'category' | 'variant' | 'age' | 'sale' | ''; value?: string; base?: string } = {}) {
    const next = new URLSearchParams();
    if (search && without !== 'q') next.set('q', search);
    selectedCategorySlugs.filter((slug) => !(without === 'category' && slug === value)).forEach((slug) => next.append('category', slug));
    selectedVariantFilters.filter((v) => !(without === 'variant' && v === value)).forEach((v) => next.append('variant', v));
    if (without !== 'age') { if (ageMinParam) next.set('age_min', ageMinParam); if (ageMaxParam) next.set('age_max', ageMaxParam); }
    if (saleOnly && without !== 'sale') next.set('sale', '1');
    if (sort !== 'newest') next.set('sort', sort);
    if (page > 1) next.set('page', String(page));
    const qs = next.toString();
    return `${base}${qs ? `?${qs}` : ''}`;
  }

  const { count, error } = productsResult;
  const products = productsResult.data as unknown as CardProduct[] | null;
  // Pages past the end (e.g. after products are removed) make the range query fail; send them to the last valid page.
  if (requestedPage > 1 && (error || !products?.length)) {
    const { count: availableCount, error: countError } = await buildProductsQuery(true);
    const lastPage = Math.max(1, Math.ceil((availableCount ?? 0) / SHOP_PAGE_SIZE));
    if (!countError && requestedPage > lastPage) return { redirect: shopUrl({ page: lastPage }) } as const;
  }
  const totalProducts = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalProducts / SHOP_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  const activeChips = [
    ...(saleOnly ? [{ label: 'On sale', href: shopUrl({ without: 'sale' }) }] : []),
    ...(search ? [{ label: `“${search}”`, href: shopUrl({ without: 'q' }) }] : []),
    ...categories.filter((c) => selectedCategorySlugs.includes(c.slug)).map((c) => ({ label: c.name, href: shopUrl({ without: 'category', value: c.slug }) })),
    // On a category page the category itself is a chip too: removing it opens the whole shop with the other filters.
    ...(fixedCategory ? [{ label: fixedCategory.name, href: shopUrl({ base: '/products' }) }] : []),
    ...selectedVariantFilters.map((v) => ({ label: v, href: shopUrl({ without: 'variant', value: v }) })),
    ...(ageMinParam || ageMaxParam ? [{ label: `Ages ${ageMinParam || '0'}–${ageMaxParam || '∞'}`, href: shopUrl({ without: 'age' }) }] : [])
  ];

  return {
    basePath, fixedCategory, search, selectedCategorySlugs, selectedVariantFilters, ageMinParam, ageMaxParam, sort, saleOnly,
    categories, variantOptions, error, cards: products ?? [], totalProducts, totalPages, currentPage, activeChips,
    filterCount: (saleOnly ? 1 : 0) + selectedCategorySlugs.length + (fixedCategory ? 1 : 0) + selectedVariantFilters.length + (ageMinParam || ageMaxParam ? 1 : 0),
    pageUrl: (page: number) => shopUrl({ page })
  };
}

export type ShopData = Exclude<Awaited<ReturnType<typeof loadShop>>, { redirect: string }>;
