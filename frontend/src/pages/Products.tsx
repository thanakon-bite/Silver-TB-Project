import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X, ShoppingBag, Star, PackageSearch, ShieldCheck, Tag } from 'lucide-react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errorMessage';
import { baht } from '../lib/format';
import Modal from '../component/common/Modal';
import ProductCard, { FavoriteButton, ProductImages, StockLine, useAddToCart, useProductText, type ShopProduct } from '../component/products/ProductCard';
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

  useEffect(() => {
    api
      .get<{ products: ShopProduct[] }>('/products?limit=100')
      .then((data) => setProducts(data.products || []))
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

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-2 sm:px-6 lg:px-8">
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
              {shown.map((p) => (
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
        </div>

        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? text.name(selected) : ''} maxWidth="3xl">
          {selected && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-sunken md:aspect-square">
                <ProductImages images={selected.images} alt={text.name(selected)} size="detail" />
                <FavoriteButton product={selected} className="absolute right-3 top-3" />
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
          )}
        </Modal>
      </div>
    </>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex gap-4 py-2.5">
    <dt className="w-24 shrink-0 text-muted">{label}</dt>
    <dd className="min-w-0 text-ink">{children}</dd>
  </div>
);

export default Products;
