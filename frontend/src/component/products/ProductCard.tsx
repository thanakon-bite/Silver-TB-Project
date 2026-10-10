import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, ChevronRight, Heart, Plus, Star } from 'lucide-react';
import BeetleMark from '../brand/BeetleMark';
import { useCart } from '../../contexts/CartContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import { useRequireSignIn } from '../auth/RouteGuards';
import { baht } from '../../lib/format';
import type { Product } from '../../lib/types';
import { compactButton } from '../ui/buttonStyles';

/** What the shop's public product list returns (admin-only fields are optional). */
export type ShopProduct = Omit<Product, 'is_active'> & { is_active?: boolean };

/** Name and description in the customer's language, falling back to the English original. */
export const useProductText = () => {
  const { t, i18n } = useTranslation();
  const isThai = (i18n.language || 'th').startsWith('th');
  return {
    /** Works for Cart items too, so their names follow the language like the shop's. */
    name: (p: { name: string; name_th?: string | null }) => (isThai && p.name_th ? p.name_th : p.name),
    description: (p: ShopProduct) => (isThai && p.description_th ? p.description_th : p.description) || '',
    category: (p: ShopProduct) => (p.category === 'beetle' && p.attributes?.family ? t(p.attributes.family) : t(p.category)),
  };
};

/**
 * Adding to the cart answers on the button itself ("added" for a moment) while the Cart drawer opens:
 * no popup, no toast (design.md: feedback is inline).
 */
export const useAddToCart = () => {
  const { addItem } = useCart();
  const requireSignIn = useRequireSignIn();
  const [added, setAdded] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const add = useCallback(
    (p: ShopProduct) => {
      if (p.stock <= 0 || !requireSignIn()) return;
      addItem({ product_id: p.id, name: p.name, name_th: p.name_th, price: p.price, image: p.images?.[0] || '', max_quantity: p.stock });
      setAdded(p.id);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setAdded(null), 1600);
    },
    [addItem, requireSignIn]
  );
  return { add, isJustAdded: (id: string) => added === id };
};

const arrow =
  'absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink shadow-[0_1px_4px_rgb(0_0_0/0.2)] ' +
  'opacity-100 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 motion-reduce:transition-none';

/** Photos of one product. Arrows appear on hover (always on touch screens); dots show the position. */
export const ProductImages: React.FC<{ images: string[]; alt: string; size?: 'card' | 'detail' }> = ({ images, alt, size = 'card' }) => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const valid = images?.filter(Boolean) || [];

  if (valid.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-sunken">
        <BeetleMark className={`${size === 'card' ? 'h-14 w-14' : 'h-24 w-24'} text-line`} />
      </div>
    );
  }

  const go = (e: React.MouseEvent, to: number) => {
    e.stopPropagation();
    setCurrent((to + valid.length) % valid.length);
  };

  return (
    <div className="relative h-full w-full">
      <img
        src={valid[current]}
        alt={valid.length > 1 ? `${alt} (${current + 1}/${valid.length})` : alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      {valid.length > 1 && (
        <>
          <button type="button" onClick={(e) => go(e, current - 1)} className={`${arrow} left-2`} aria-label={t('product_card.prev_photo')}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={(e) => go(e, current + 1)} className={`${arrow} right-2`} aria-label={t('product_card.next_photo')}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5" aria-hidden>
            {valid.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-paper' : 'w-1.5 bg-paper/60'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/** Heart toggle over a product photo. */
export const FavoriteButton: React.FC<{ product: ShopProduct; className?: string }> = ({ product, className = '' }) => {
  const { t } = useTranslation();
  const { toggle, isFavorite } = useFavorites();
  const requireSignIn = useRequireSignIn();
  const on = isFavorite(product.id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (requireSignIn()) toggle(product.id);
      }}
      aria-pressed={on}
      aria-label={on ? t('product_card.unfavorite') : t('product_card.favorite')}
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-paper/90 shadow-[0_1px_4px_rgb(0_0_0/0.2)] transition-transform active:scale-95 motion-reduce:transition-none ${className}`}
    >
      <Heart className={`h-[18px] w-[18px] ${on ? 'fill-danger text-danger' : 'text-ink'}`} aria-hidden />
    </button>
  );
};

/** The stock line under a price: scarcity is stated in words, in danger, not as a red badge. */
export const StockLine: React.FC<{ stock: number; size?: string }> = ({ stock, size = 'text-xs' }) => {
  const { t } = useTranslation();
  if (stock <= 0) return <p className={`${size} text-muted`}>{t('out_of_stock')}</p>;
  if (stock <= 3) return <p className={`${size} font-medium text-danger`}>{t('only_left', { count: stock })}</p>;
  return <p className={`${size} text-muted`}>{t('count_in_stock', { count: stock })}</p>;
};

interface CardProps {
  product: ShopProduct;
  onOpen?: (p: ShopProduct) => void;
  onAdd: (p: ShopProduct) => void;
  justAdded: boolean;
}

const ProductCard: React.FC<CardProps> = ({ product, onOpen, onAdd, justAdded }) => {
  const { t } = useTranslation();
  const text = useProductText();
  const name = text.name(product);
  const soldOut = product.stock <= 0;

  return (
    <article className="group flex flex-col rounded-xl border border-line bg-paper p-3 transition-colors hover:border-muted motion-reduce:transition-none">
      <div
        className={`relative aspect-[4/3] overflow-hidden rounded-lg bg-sunken ${onOpen ? 'cursor-pointer' : ''}`}
        onClick={onOpen ? () => onOpen(product) : undefined}
      >
        <ProductImages images={product.images} alt={name} />
        {product.is_best_seller && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg bg-paper/90 px-2 py-1 text-xs font-semibold text-ink">
            <Star className="h-3 w-3 fill-accent text-accent" aria-hidden />
            {t('best_seller')}
          </span>
        )}
        <FavoriteButton product={product} className="absolute right-2 top-2" />
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/45">
            <span className="rounded-lg bg-paper px-3 py-1 text-sm font-semibold text-ink">{t('sold_out')}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-3">
        <p className="text-xs text-muted">{text.category(product)}</p>
        <h3 className="mt-0.5 text-[0.9375rem] font-semibold leading-snug text-ink">
          {onOpen ? (
            <button type="button" onClick={() => onOpen(product)} className="line-clamp-2 text-left transition-colors hover:text-accent-strong motion-reduce:transition-none">
              {name}
            </button>
          ) : (
            <span className="line-clamp-2">{name}</span>
          )}
        </h3>
        {text.description(product) && <p className="mt-1 line-clamp-2 hidden text-sm text-muted sm:block">{text.description(product)}</p>}

        <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-lg font-medium tabular-nums text-ink">{baht(product.price)}</p>
            <StockLine stock={product.stock} />
          </div>
          <button
            type="button"
            onClick={() => onAdd(product)}
            disabled={soldOut}
            className={`${compactButton} w-full sm:w-auto`}
          >
            {justAdded ? <Check className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            <span aria-live="polite">{justAdded ? t('product_card.added') : t('add_btn')}</span>
            <span className="sr-only">: {name}</span>
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
