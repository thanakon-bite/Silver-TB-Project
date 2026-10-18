import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Heart, Plus, Star, Tag } from 'lucide-react';
import BeetleMark from '../brand/BeetleMark';
import { useCart } from '../../contexts/CartContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import { useRequireSignIn } from '../auth/RouteGuards';
import { useAuth } from '../../contexts/AuthContext';
import { baht } from '../../lib/format';
import type { Product } from '../../lib/types';
import { compactButton } from '../ui/buttonStyles';
import { useCategoryName } from '../../lib/catalogue';

/** What the shop's public product list returns (admin-only fields are optional). */
export type ShopProduct = Omit<Product, 'is_active'> & { is_active?: boolean };

/** Name and description in the customer's language, falling back to the English original. */
export const useProductText = () => {
  const { t, i18n } = useTranslation();
  const isThai = (i18n.language || 'th').startsWith('th');
  const categoryName = useCategoryName();
  return {
    /** Works for Cart items too, so their names follow the language like the shop's. */
    name: (p: { name: string; name_th?: string | null }) => (isThai && p.name_th ? p.name_th : p.name),
    description: (p: ShopProduct) => (isThai && p.description_th ? p.description_th : p.description) || '',
    category: (p: ShopProduct) => (p.category === 'beetle' && p.attributes?.family ? t(p.attributes.family) : categoryName(p.category)),
  };
};

/** What pressing "add" did: added one, found the Cart already holding all Available, or did nothing. */
export type AddResult = 'added' | 'full' | 'none';

/**
 * Adding to the cart answers on the button itself ("added" for a moment) while the Cart drawer opens:
 * no popup, no toast (design.md: feedback is inline). When the Cart already holds every Available
 * unit, the button says so instead and the Cart is left alone.
 */
export const useAddToCart = () => {
  const { addItem, items } = useCart();
  const requireSignIn = useRequireSignIn();
  const [said, setSaid] = useState<{ id: string; result: 'added' | 'full' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const add = useCallback(
    (p: ShopProduct): AddResult => {
      if (p.available <= 0 || !requireSignIn()) return 'none';
      const inCart = items.find((i) => i.product_id === p.id)?.quantity ?? 0;
      const result = inCart >= p.available ? 'full' : 'added';
      if (result === 'added') {
        addItem({ product_id: p.id, name: p.name, name_th: p.name_th, price: p.price, image: p.images?.[0] || '', max_quantity: p.available });
      }
      setSaid({ id: p.id, result });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaid(null), 1600);
      return result;
    },
    [addItem, items, requireSignIn]
  );
  return {
    add,
    isJustAdded: (id: string) => said?.id === id && said.result === 'added',
    isFull: (id: string) => said?.id === id && said.result === 'full',
  };
};

// The photo box is its own hover group, so the arrows show wherever the photos are (card or product window).
const arrow =
  'absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink shadow-[0_1px_4px_rgb(0_0_0/0.2)] ' +
  'opacity-100 transition-[opacity,transform] hover:scale-105 hover:bg-paper focus-visible:opacity-100 ' +
  '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/photos:opacity-100 motion-reduce:transition-none';

/**
 * Photos of one product. Arrows appear on hover (always on touch screens); dots show the position.
 * Pass `current` and `onChange` to drive it from outside (the product window's thumbnails).
 */
export const ProductImages: React.FC<{
  images: string[];
  alt: string;
  size?: 'card' | 'detail';
  current?: number;
  onChange?: (i: number) => void;
}> = ({ images, alt, size = 'card', current: shown, onChange }) => {
  const { t } = useTranslation();
  const [own, setOwn] = useState(0);
  const valid = images?.filter(Boolean) || [];
  const current = Math.min(shown ?? own, Math.max(0, valid.length - 1));
  const setCurrent = (i: number) => (onChange ? onChange(i) : setOwn(i));

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
  const arrowSize = size === 'detail' ? 'h-11 w-11' : 'h-9 w-9';
  const chevron = size === 'detail' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <div className="group/photos relative h-full w-full">
      <img
        src={valid[current]}
        alt={valid.length > 1 ? `${alt} (${current + 1}/${valid.length})` : alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      {valid.length > 1 && (
        <>
          <button type="button" onClick={(e) => go(e, current - 1)} className={`${arrow} ${arrowSize} left-2`} aria-label={t('product_card.prev_photo')}>
            <ChevronLeft className={chevron} aria-hidden />
          </button>
          <button type="button" onClick={(e) => go(e, current + 1)} className={`${arrow} ${arrowSize} right-2`} aria-label={t('product_card.next_photo')}>
            <ChevronRight className={chevron} aria-hidden />
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

/** One small square per photo under the big one: shows how many there are and jumps to any of them. */
export const ProductThumbs: React.FC<{ images: string[]; alt: string; current: number; onSelect: (i: number) => void }> = ({
  images,
  alt,
  current,
  onSelect,
}) => {
  const { t } = useTranslation();
  const valid = images?.filter(Boolean) || [];
  if (valid.length < 2) return null;
  return (
    <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={`${t('product_card.photos')}: ${alt}`}>
      {valid.map((src, i) => (
        <button
          key={`${src}-${i}`}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={t('product_card.photo_n', { n: i + 1, total: valid.length })}
          aria-current={i === current ? 'true' : undefined}
          className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-[border-color,opacity] motion-reduce:transition-none ${
            i === current ? 'border-accent-strong' : 'border-transparent opacity-70 hover:border-line hover:opacity-100'
          }`}
        >
          <img src={src} alt="" aria-hidden loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
};

/**
 * Heart toggle over a product photo. Favorites belong to signed-in Customers (CONTEXT.md), so guests
 * don't see it at all. Hover grows the button and tints the heart; turning it on pops the heart once.
 */
export const FavoriteButton: React.FC<{ product: ShopProduct; className?: string }> = ({ product, className = '' }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toggle, isFavorite } = useFavorites();
  const requireSignIn = useRequireSignIn();
  const on = isFavorite(product.id);
  const [pops, setPops] = useState(0); // counts turn-ons, so only a tap (not loading the page) pops the heart
  if (!user) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!requireSignIn()) return;
        if (!on) setPops((n) => n + 1);
        toggle(product.id);
      }}
      aria-pressed={on}
      aria-label={on ? t('product_card.unfavorite') : t('product_card.favorite')}
      title={on ? t('product_card.unfavorite') : t('product_card.favorite')}
      className={`group/fav flex h-10 w-10 items-center justify-center rounded-full bg-paper/90 shadow-[0_1px_4px_rgb(0_0_0/0.2)] transition-[transform,background-color] duration-200 ease-out hover:scale-110 hover:bg-paper active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 ${className}`}
    >
      <motion.span
        key={pops}
        className="flex"
        initial={pops ? { scale: 0.6 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 12 }}
      >
        <Heart
          className={`h-[18px] w-[18px] transition-colors duration-200 ${
            on ? 'fill-danger text-danger' : 'text-ink group-hover/fav:fill-danger/20 group-hover/fav:text-danger'
          }`}
          aria-hidden
        />
      </motion.span>
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
  /** The last press found every Available unit already in the Cart. */
  cartFull?: boolean;
  /** Short text for the Promotion this product is in, e.g. "ซื้อ 3 ลด 10%". */
  promotionBadge?: string | null;
}

const ProductCard: React.FC<CardProps> = ({ product, onOpen, onAdd, justAdded, cartFull, promotionBadge }) => {
  const { t } = useTranslation();
  const text = useProductText();
  const name = text.name(product);
  const soldOut = product.available <= 0;

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
        {promotionBadge && !soldOut && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-lg bg-accent-strong px-2 py-1 text-xs font-semibold text-accent-ink">
            <Tag className="h-3 w-3" aria-hidden />
            {promotionBadge}
          </span>
        )}
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
            <StockLine stock={product.available} />
          </div>
          <button
            type="button"
            onClick={() => onAdd(product)}
            disabled={soldOut}
            className={`${compactButton} w-full sm:w-auto`}
          >
            {justAdded || cartFull ? <Check className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            <span aria-live="polite">{cartFull ? t('product_card.cart_full') : justAdded ? t('product_card.added') : t('add_btn')}</span>
            <span className="sr-only">: {name}</span>
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
