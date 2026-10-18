import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X, ShoppingBag, Star, PackageSearch, ShieldCheck, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchShopProducts } from '../lib/shopProducts';
import ShopPager, { SHOP_PAGE_SIZE } from '../component/products/ShopPager';
import { errorMessage } from '../lib/errorMessage';
import { baht } from '../lib/format';
import Modal from '../component/common/Modal';
import ProductCard, { FavoriteButton, ProductImages, ProductThumbs, StockLine, useAddToCart, useProductText, type ShopProduct } from '../component/products/ProductCard';
import { EmptyState, ErrorBox } from '../component/ui/Feedback';
import ShopHero from '../component/shop/ShopHero';
import { chip, primaryButton, secondaryButton, textLink } from '../component/ui/buttonStyles';
import { fieldClass } from '../component/ui/fieldStyles';
import { useCatalogue, useCategoryName } from '../lib/catalogue';
import { badgeText, bestOptionKey, bestPromotion, promotionName, promotionOptions, promotionsFor, useActivePromotions } from '../lib/promotions';
import { usePromotionChoice } from '../lib/promotionChoice';
import PromotionPicker from '../component/products/PromotionPicker';
import { useFavorites } from '../contexts/FavoritesContext';

const SORTS = ['default', 'price_asc', 'price_desc', 'name_asc'] as const;
type Sort = (typeof SORTS)[number];

const PRODUCTS_ID = 'shop';
const RESULTS_ID = 'shop-results';

/** The shop: the front page of the site, the hero above every product for sale. */
const Products: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isThai = (i18n.language || 'th').startsWith('th');
  const text = useProductText();
  const { add, isJustAdded, isFull } = useAddToCart();
  const promotions = useActivePromotions();
  // A Promotion picked here is the one the whole Order uses (ADR 0004)
  const { choice: promotionChoice, choose: choosePromotion } = usePromotionChoice();
  const { favorites } = useFavorites();
  // The Admin's Categories and Families, in their order (ADR 0005)
  const catalogue = useCatalogue();
  const categoryName = useCategoryName();
  const CATEGORIES = useMemo(() => ['all', ...catalogue.categories.map((c) => c.slug)], [catalogue.categories]);

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  // A ?category=… link (including old /products links, which App redirects here) opens with that filter.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategory = searchParams.get('category');
  // A ?promotion=… link (from a Promotion Notification) shows only the products that Promotion covers.
  const promotionFilter = promotions.find((p) => p.id === searchParams.get('promotion')) || null;
  const clearPromotion = () =>
    setSearchParams(
      (params) => {
        params.delete('promotion');
        return params;
      },
      { replace: true }
    );
  const [category, setCategory] = useState('all');
  useEffect(() => {
    if (urlCategory && CATEGORIES.includes(urlCategory)) {
      setCategory(urlCategory);
      setFamily('');
    }
  }, [urlCategory, CATEGORIES]);
  const [family, setFamily] = useState('');
  const [sort, setSort] = useState<Sort>('default');
  const [selected, setSelected] = useState<ShopProduct | null>(null);
  const [photo, setPhoto] = useState(0);
  const detailTop = useRef<HTMLDivElement>(null);
  // Every product opens on its first photo; switching to a similar one scrolls the window back to the top.
  const shownId = useRef<string | null>(null);
  useEffect(() => {
    setPhoto(0);
    const from = shownId.current;
    shownId.current = selected?.id ?? null;
    if (from && selected) detailTop.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [selected]);

  /**
   * Similar products for the open one: the same Category, the same Family first for beetles, then what
   * can be bought now, best sellers and the most viewed. Up to twelve, four in view at a time.
   */
  const similar = useMemo(() => {
    if (!selected) return [];
    const family = selected.attributes?.family;
    const score = (p: ShopProduct) =>
      (family && p.attributes?.family === family ? 8 : 0) + (p.available > 0 ? 4 : 0) + (p.is_best_seller ? 2 : 0);
    return products
      .filter((p) => p.id !== selected.id && p.category === selected.category)
      .sort((a, b) => score(b) - score(a) || (b.views || 0) - (a.views || 0))
      .slice(0, 12);
  }, [products, selected]);

  // The similar row scrolls sideways; the arrows move it a whole view at a time and wrap around at either end.
  const similarRow = useRef<HTMLUListElement>(null);
  const [similarEnds, setSimilarEnds] = useState({ start: true, end: true });
  const measureSimilar = () => {
    const row = similarRow.current;
    if (!row) return;
    setSimilarEnds({ start: row.scrollLeft <= 1, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 1 });
  };
  /**
   * Pages through the row a view at a time (4 from md, 2 below), counted by items rather than pixels so
   * rounding never leaves it stuck. Past the last page goes back to the first; before the first goes to the last.
   */
  const scrollSimilar = (by: -1 | 1) => {
    const row = similarRow.current;
    const items = row ? (Array.from(row.children) as HTMLElement[]) : [];
    if (!row || items.length === 0) return;
    const perView = window.matchMedia?.('(min-width: 768px)').matches ? 4 : 2;
    const pages = Math.ceil(items.length / perView);
    const left = (i: number) => items[i].offsetLeft - items[0].offsetLeft;
    const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 8;
    const firstShown = items.findIndex((_, i) => left(i) >= row.scrollLeft - 8);
    const page = atEnd ? pages - 1 : Math.floor(Math.max(0, firstShown) / perView);
    const next = (page + by + pages) % pages;
    row.scrollTo?.({ left: left(next * perView), behavior: 'smooth' });
  };
  useEffect(() => {
    similarRow.current?.scrollTo?.({ left: 0 });
    measureSimilar();
    window.addEventListener('resize', measureSimilar);
    return () => window.removeEventListener('resize', measureSimilar);
  }, [similar]);

  useEffect(() => {
    fetchShopProducts()
      .then(setProducts)
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, []); // once: a language switch only changes which name is shown, not the list

  // The Admin's Families that some beetle has, in the Admin's order; a Family not on the list still shows, last
  const families = useMemo(() => {
    const used = new Set(products.map((p) => p.attributes?.family).filter(Boolean) as string[]);
    const listed = catalogue.families.map((f) => f.name).filter((n) => used.has(n));
    return [...listed, ...Array.from(used).filter((n) => !listed.includes(n)).sort()];
  }, [products, catalogue.families]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter((p) => {
      const matchSearch =
        !q ||
        [p.name, p.name_th, p.description, p.description_th, p.attributes?.species, p.attributes?.family].some((f) =>
          (f || '').toLowerCase().includes(q)
        );
      const matchCategory = category === 'all' || p.category === category;
      const matchFamily = category !== 'beetle' || !family || p.attributes?.family === family;
      const matchPromotion = !promotionFilter || promotionsFor(p.id, [promotionFilter]).length > 0;
      return matchSearch && matchCategory && matchFamily && matchPromotion;
    });
    if (sort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'name_asc') list = [...list].sort((a, b) => text.name(a).localeCompare(text.name(b)));
    // A signed-in Customer's Favorites come first, each group keeping the chosen order.
    if (favorites.length) {
      const fav = new Set(favorites);
      list = [...list.filter((p) => fav.has(p.id)), ...list.filter((p) => !fav.has(p.id))];
    }
    return list;
  }, [products, search, category, family, sort, text, favorites, promotionFilter]);

  // A card's badge is its Best Promotion, not just the first one listed
  const bestBadge = (p: ShopProduct) => {
    const best = bestPromotion(p, promotions);
    return best ? badgeText(best, t) : null;
  };

  // 20 cards a page (?page=N, so a page can be linked and Back returns to it); only these are drawn
  const pages = Math.max(1, Math.ceil(shown.length / SHOP_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1));
  const onPage = shown.slice((page - 1) * SHOP_PAGE_SIZE, page * SHOP_PAGE_SIZE);
  const goToPage = (n: number) => {
    setSearchParams((params) => {
      if (n <= 1) params.delete('page');
      else params.set('page', String(n));
      return params;
    });
    document.getElementById(RESULTS_ID)?.scrollIntoView?.({ block: 'start' });
  };
  // A new search, filter or sort starts again from page 1 (not on first load, so a ?page= link holds)
  const filterKey = [search, category, family, sort, promotionFilter?.id || ''].join('|');
  const lastFilterKey = useRef(filterKey);
  useEffect(() => {
    if (lastFilterKey.current === filterKey) return;
    lastFilterKey.current = filterKey;
    if (searchParams.has('page')) goToPage(1);
    // goToPage only writes the URL; the key is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const filtered = search !== '' || category !== 'all' || !!promotionFilter;
  const clearFilters = () => {
    setSearch('');
    setCategory('all');
    setFamily('');
    if (promotionFilter) clearPromotion();
  };

  return (
    <>
      <ShopHero productsId={PRODUCTS_ID} />
      {/* One slim toolbar right after the Hero, sharing its palette; it stays at the top while scrolling. */}
      <div className="sticky top-16 z-30 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        <h2 id={PRODUCTS_ID} tabIndex={-1} className="sr-only scroll-mt-24">
          {t('shop_all_beetles')}
        </h2>
        <div role="search" aria-label={t('products_page.toolbar')} className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          {/* Phones: search and sort on one row, categories scroll below. Wide: search | categories | sort. */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 lg:grid-cols-[18rem_minmax(0,1fr)_auto] lg:gap-4">
            <div className="relative">
              <label htmlFor="product-search" className="sr-only">
                {t('search_beetles')}
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                id="product-search"
                type="search"
                placeholder={t('search_beetles')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${fieldClass()} h-10 pl-9 pr-10 [&::-webkit-search-cancel-button]:hidden`}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label={t('products_page.clear_search')}
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 lg:col-start-3 lg:row-start-1">
              <label htmlFor="product-sort" className="sr-only lg:not-sr-only lg:whitespace-nowrap lg:text-sm lg:text-muted">
                {t('products_page.sort_label')}
              </label>
              <select
                id="product-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className={`${fieldClass()} h-10 w-36 sm:w-44`}
              >
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`products_page.sort_${s}`)}
                  </option>
                ))}
              </select>
            </div>

            <div
              role="group"
              aria-label={t('category')}
              className="no-scrollbar col-span-2 -mx-4 flex gap-2 overflow-x-auto px-4 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:px-0"
            >
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={category === cat}
                  onClick={() => {
                    setCategory(cat);
                    setFamily('');
                  }}
                  className={`${chip(category === cat)} shrink-0`}
                >
                  {cat === 'all' ? t('all') : categoryName(cat)}
                </button>
              ))}
            </div>
          </div>

          {category === 'beetle' && families.length > 0 && (
            <div role="group" aria-label={t('products_page.family')} className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-muted">{t('products_page.family')}</span>
              {['', ...families].map((f) => (
                <button
                  key={f || 'any'}
                  type="button"
                  aria-pressed={family === f}
                  onClick={() => setFamily(f)}
                  className={`py-1 underline-offset-4 ${family === f ? 'font-semibold text-accent-strong underline decoration-2' : 'text-muted hover:text-ink'}`}
                >
                  {f ? t(f) : t('all')}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The results start here; a page change scrolls back to it, below the sticky toolbar */}
      <div id={RESULTS_ID} className="mx-auto max-w-7xl scroll-mt-40 px-4 pb-20 pt-2 sm:px-6 lg:px-8">
        {promotionFilter && (
          <p role="status" className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-accent-strong/30 bg-accent-strong/5 px-4 py-3 text-sm text-ink">
            <Tag className="h-4 w-4 text-accent-strong" aria-hidden />
            <span className="font-medium">{t('products_page.promotion_filter', { name: promotionName(promotionFilter, isThai) })}</span>
            <button type="button" onClick={clearPromotion} className={textLink}>
              {t('products_page.promotion_filter_clear')}
            </button>
          </p>
        )}
        <p className="mt-6 text-sm text-muted" aria-live="polite">
          {!loading && !loadError && t('products_page.count', { count: shown.length })}
        </p>

        <div className="mt-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label={t('products_page.loading')}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-line p-3 motion-reduce:animate-none">
                  <div className="aspect-[4/3] rounded-lg bg-sunken" />
                  <div className="mt-3 h-3 w-1/3 rounded bg-sunken" />
                  <div className="mt-2 h-4 w-3/4 rounded bg-sunken" />
                  <div className="mt-4 h-5 w-1/4 rounded bg-sunken" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <ErrorBox title={t('products_page.load_error')}>
              {errorMessage(loadError, t)}{' '}
              <button type="button" onClick={() => window.location.reload()} className={textLink}>
                {t('products_page.retry')}
              </button>
            </ErrorBox>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<PackageSearch className="h-10 w-10" aria-hidden />}
              title={t('no_beetles_found')}
              text={filtered ? t('products_page.empty_filtered') : t('products_page.empty_shop')}
              action={
                filtered ? (
                  <button type="button" onClick={clearFilters} className={secondaryButton}>
                    {t('clear_filters')}
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {onPage.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onOpen={setSelected}
                  onAdd={add}
                  justAdded={isJustAdded(p.id)}
                  cartFull={isFull(p.id)}
                  promotionBadge={bestBadge(p)}
                />
              ))}
            </div>
          )}
          {!loading && !loadError && <ShopPager page={page} total={shown.length} onPage={goToPage} />}
        </div>

        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? text.name(selected) : ''} maxWidth="3xl">
          {selected && (
            <>
            <div ref={detailTop} className="grid scroll-mt-4 gap-6 md:grid-cols-2">
              <div className="min-w-0">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-sunken md:aspect-square">
                  <ProductImages images={selected.images} alt={text.name(selected)} size="detail" current={photo} onChange={setPhoto} />
                  <FavoriteButton product={selected} className="absolute right-3 top-3" />
                </div>
                <ProductThumbs images={selected.images} alt={text.name(selected)} current={photo} onSelect={setPhoto} />
              </div>

              <div className="flex min-w-0 flex-col">
                <p className="flex items-center gap-2 text-sm text-muted">
                  {text.category(selected)}
                  {selected.is_best_seller && (
                    <span className="inline-flex items-center gap-1 font-medium text-ink">
                      · <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden /> {t('best_seller')}
                    </span>
                  )}
                </p>
                {text.description(selected) && (
                  <p className="mt-3 whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink">{text.description(selected)}</p>
                )}

                {promotionsFor(selected.id, promotions).length > 0 && (
                  <section aria-label={t('promotions.title')} className="mt-4">
                    {(() => {
                      const options = promotionOptions(selected.id, promotions);
                      // The Order's pick when it is one of this product's; with no pick yet, its Best Promotion
                      const value = promotionChoice ? (options.some((o) => o.key === promotionChoice) ? promotionChoice : null) : bestOptionKey(selected, promotions);
                      return (
                        <PromotionPicker
                          legend={options.length > 1 ? t('promotions.choose_legend') : t('promotions.title')}
                          name={`promotion-${selected.id}`}
                          options={options}
                          value={value}
                          hint={options.length > 1 ? t('promotions.choose_hint') : undefined}
                          onChange={choosePromotion}
                        />
                      );
                    })()}
                  </section>
                )}

                <dl className="mt-5 divide-y divide-line border-y border-line text-sm">
                  {selected.category === 'beetle' && selected.attributes && (
                    <>
                      {selected.attributes.species && (
                        <Row label={t('species')}>
                          <i>{selected.attributes.species}</i>
                        </Row>
                      )}
                      {selected.attributes.locality && <Row label={t('locality')}>{selected.attributes.locality}</Row>}
                      {selected.attributes.sex && <Row label={t('sex')}>{t(`sex_${selected.attributes.sex}`)}</Row>}
                      {selected.attributes.stage && <Row label={t('stage')}>{t(`stage_${selected.attributes.stage}`)}</Row>}
                      {selected.attributes.size_mm && (
                        <Row label={t('size')}>
                          <span className="font-mono tabular-nums">{selected.attributes.size_mm} mm</span>
                        </Row>
                      )}
                    </>
                  )}
                  <Row label={t('stock')}>
                    <StockLine stock={selected.available} size="text-sm" />
                  </Row>
                  {selected.views > 0 && (
                    <Row label={t('products_page.views')}>
                      <span className="font-mono tabular-nums">{selected.views.toLocaleString()}</span>
                    </Row>
                  )}
                </dl>

                {selected.category === 'beetle' && (
                  <p className="mt-4 flex items-start gap-2 text-sm text-muted">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                    <span>
                      <Link to="/shipping#guarantee" className={textLink}>
                        {t('shipping_page.guarantee_title')}
                      </Link>{' '}
                      · {t('product_card.guarantee_line')}
                    </span>
                  </p>
                )}

                <div className="mt-6 md:mt-auto md:pt-6">
                  <p className="font-mono text-2xl font-medium tabular-nums text-ink">{baht(selected.price)}</p>
                  <button
                    type="button"
                    onClick={() => {
                      // A full Cart keeps the window open so the note below can be read
                      if (add(selected) !== 'full') setSelected(null);
                    }}
                    disabled={selected.available <= 0}
                    className={`${primaryButton} mt-3`}
                  >
                    <ShoppingBag className="h-5 w-5" aria-hidden />
                    {selected.available <= 0 ? t('sold_out') : t('add_to_cart')}
                  </button>
                  <p aria-live="polite" className="mt-2 text-sm text-muted">
                    {isFull(selected.id) && t('product_card.cart_full_note', { count: selected.available })}
                  </p>
                </div>
              </div>
            </div>

            {similar.length > 0 && (
              <section aria-labelledby="similar-heading" className="mt-8 border-t border-line pt-6">
                <h3 id="similar-heading" className="font-display text-lg font-bold text-ink">
                  {t('products_page.similar_title')}
                </h3>
                <div className="group/similar relative mt-3">
                <ul
                  ref={similarRow}
                  onScroll={measureSimilar}
                  className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth motion-reduce:scroll-auto"
                >
                  {similar.map((p) => (
                    <li key={p.id} className="w-[calc((100%-0.75rem)/2)] shrink-0 snap-start md:w-[calc((100%-2.25rem)/4)]">
                      <button
                        type="button"
                        onClick={() => setSelected(p)}
                        className="group flex w-full flex-col rounded-xl border border-line p-2 text-left transition-colors hover:border-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong motion-reduce:transition-none"
                      >
                        <span className="block aspect-[4/3] w-full overflow-hidden rounded-lg bg-sunken">
                          {p.images?.[0] ? (
                            <img
                              src={p.images[0]}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                            />
                          ) : null}
                        </span>
                        <span className="mt-2 line-clamp-2 text-sm font-medium text-ink">{text.name(p)}</span>
                        <span className="mt-1 font-mono text-sm tabular-nums text-ink">{baht(p.price)}</span>
                        {p.available <= 0 && <span className="text-xs text-muted">{t('sold_out')}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
                {!(similarEnds.start && similarEnds.end) && (
                  <>
                    <button
                      type="button"
                      onClick={() => scrollSimilar(-1)}
                      aria-label={t('products_page.similar_prev')}
                      className={`${similarArrow} -left-3`}
                    >
                      <ChevronLeft className="h-5 w-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollSimilar(1)}
                      aria-label={t('products_page.similar_next')}
                      className={`${similarArrow} -right-3`}
                    >
                      <ChevronRight className="h-5 w-5" aria-hidden />
                    </button>
                  </>
                )}
                </div>
              </section>
            )}
            </>
          )}
        </Modal>
      </div>
    </>
  );
};

// Same look as the photo arrows: shown on hover (always on touch screens). Always clickable: they wrap around.
const similarArrow =
  'absolute top-[38%] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper text-ink ' +
  'shadow-[0_1px_4px_rgb(0_0_0/0.2)] transition-[opacity,transform] hover:scale-105 ' +
  'focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/similar:opacity-100 motion-reduce:transition-none';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex gap-4 py-2.5">
    <dt className="w-24 shrink-0 text-muted">{label}</dt>
    <dd className="min-w-0 text-ink">{children}</dd>
  </div>
);

export default Products;
