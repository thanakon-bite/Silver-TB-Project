import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X, ShoppingBag, Star, PackageSearch, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errorMessage';
import { baht } from '../lib/format';
import Modal from '../component/common/Modal';
import ProductCard, { FavoriteButton, ProductImages, StockLine, useAddToCart, useProductText, type ShopProduct } from '../component/products/ProductCard';
import { EmptyState, ErrorBox } from '../component/ui/Feedback';
import ShopHero from '../component/shop/ShopHero';
import { chip, primaryButton, secondaryButton, textLink } from '../component/ui/buttonStyles';
import { fieldClass } from '../component/ui/fieldStyles';
import { PRODUCT_CATEGORIES } from '../lib/types';

const CATEGORIES = ['all', ...PRODUCT_CATEGORIES];
const SORTS = ['default', 'price_asc', 'price_desc', 'name_asc'] as const;
type Sort = (typeof SORTS)[number];

const PRODUCTS_ID = 'shop';

/** The shop: the front page of the site, the hero above every product for sale. */
const Products: React.FC = () => {
  const { t } = useTranslation();
  const text = useProductText();
  const { add, isJustAdded } = useAddToCart();

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  // A ?category=… link (including old /products links, which App redirects here) opens with that filter.
  const urlCategory = useSearchParams()[0].get('category');
  const [category, setCategory] = useState('all');
  useEffect(() => {
    if (urlCategory && CATEGORIES.includes(urlCategory)) {
      setCategory(urlCategory);
      setFamily('');
    }
  }, [urlCategory]);
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

  const families = useMemo(
    () => Array.from(new Set(products.map((p) => p.attributes?.family).filter(Boolean) as string[])).sort(),
    [products]
  );

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
      return matchSearch && matchCategory && matchFamily;
    });
    if (sort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'name_asc') list = [...list].sort((a, b) => text.name(a).localeCompare(text.name(b)));
    return list;
  }, [products, search, category, family, sort, text]);

  const filtered = search !== '' || category !== 'all';
  const clearFilters = () => {
    setSearch('');
    setCategory('all');
    setFamily('');
  };

  return (
    <>
      <ShopHero productsId={PRODUCTS_ID} />
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <header className="border-b border-line pb-6">
          <h2 id={PRODUCTS_ID} tabIndex={-1} className="scroll-mt-24 font-display text-3xl font-bold text-ink outline-none sm:text-4xl">
            {t('shop_all_beetles')}
          </h2>
          <p className="mt-2 max-w-prose text-muted">{t('premium_exotic_beetles_desc')}</p>
        </header>

        {/* Search, sort and categories read as one toolbar. */}
        <div className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
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
                className={`${fieldClass()} h-11 pl-9 pr-10 [&::-webkit-search-cancel-button]:hidden`}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label={t('products_page.clear_search')}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-ink"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="product-sort" className="whitespace-nowrap text-sm text-muted">
                {t('products_page.sort_label')}
              </label>
              <select
                id="product-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className={`${fieldClass()} h-11 w-full sm:w-52`}
              >
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`products_page.sort_${s}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div role="group" aria-label={t('category')} className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={category === cat}
                onClick={() => {
                  setCategory(cat);
                  setFamily('');
                }}
                className={chip(category === cat)}
              >
                {t(cat)}
              </button>
            ))}
          </div>
          {category === 'beetle' && families.length > 0 && (
            <div role="group" aria-label={t('products_page.family')} className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
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
                <ProductCard key={p.id} product={p} onOpen={setSelected} onAdd={add} justAdded={isJustAdded(p.id)} />
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
                    <StockLine stock={selected.stock} size="text-sm" />
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
                      add(selected);
                      setSelected(null);
                    }}
                    disabled={selected.stock <= 0}
                    className={`${primaryButton} mt-3`}
                  >
                    <ShoppingBag className="h-5 w-5" aria-hidden />
                    {selected.stock <= 0 ? t('sold_out') : t('add_to_cart')}
                  </button>
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
