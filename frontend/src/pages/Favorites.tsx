import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useFavorites } from '../contexts/FavoritesContext';
import { fetchShopProducts } from '../lib/shopProducts';
import { errorMessage } from '../lib/errorMessage';
import ProductCard, { useAddToCart, type ShopProduct } from '../component/products/ProductCard';
import { EmptyState, ErrorBox, PageHeader } from '../component/ui/Feedback';
import { primaryButtonInline } from '../component/ui/buttonStyles';

/** Saved products. Un-hearting a card removes it; that is reversible, so it needs no confirmation. */
const Favorites: React.FC = () => {
  const { t } = useTranslation();
  const { favorites } = useFavorites();
  const { add, isJustAdded, isFull } = useAddToCart();

  const [products, setProducts] = React.useState<Record<string, ShopProduct> | null>(null);
  const [error, setError] = React.useState('');
  const hasFavorites = favorites.length > 0;

  React.useEffect(() => {
    if (!hasFavorites) return;
    fetchShopProducts()
      .then((list) => setProducts(Object.fromEntries(list.map((p) => [p.id, p]))))
      .catch((err) => setError(errorMessage(err, t)));
  }, [hasFavorites, t]);

  const saved = products ? favorites.map((id) => products[id]).filter(Boolean) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <PageHeader
        title={t('favorites_page.title')}
        description={hasFavorites ? t('favorites_page.count', { count: favorites.length }) : undefined}
      />

      <div className="mt-8">
        {!hasFavorites ? (
          <EmptyState
            icon={<Heart className="h-10 w-10" aria-hidden />}
            title={t('favorites_page.empty_title')}
            text={t('favorites_page.empty_text')}
            action={
              <Link to="/" className={primaryButtonInline}>
                {t('favorites_page.browse')}
              </Link>
            }
          />
        ) : error ? (
          <ErrorBox title={t('products_page.load_error')}>{error}</ErrorBox>
        ) : !products ? (
          <p role="status" className="text-sm text-muted">
            {t('products_page.loading')}
          </p>
        ) : saved.length === 0 ? (
          <EmptyState title={t('favorites_page.unavailable')} />
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {saved.map((p) => (
              <ProductCard key={p.id} product={p} onAdd={add} justAdded={isJustAdded(p.id)} cartFull={isFull(p.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
