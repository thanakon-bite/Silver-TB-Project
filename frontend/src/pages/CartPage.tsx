import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Minimize2, ShoppingBag } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { EmptyState } from '../component/ui/Feedback';
import { iconButton, primaryButton, primaryButtonInline, quietLink } from '../component/ui/buttonStyles';
import { CartGifts, CartHints, CartLines, CartSummary, OrderPromotionPicker, useCartPricing } from '../component/cart/CartParts';

/**
 * The Cart in full (CONTEXT.md: Cart): every product, the Promotion the whole Order uses (one card per
 * option, the Customer picks one), the hints for that Promotion and the totals checkout will charge.
 */
const CartPage: React.FC = () => {
  const { t } = useTranslation();
  const cart = useCartPricing(true);
  const { items, totalItems } = cart;
  const { openCart } = useCart();
  const navigate = useNavigate();
  // The page the drawer was expanded from (its expand link says), else the shop
  const from = (useLocation().state as { from?: string } | null)?.from || '/';
  const shrink = () => {
    navigate(from);
    openCart();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-ink">{t('shopping_cart')}</h1>
        {totalItems > 0 && <span className="font-mono text-sm tabular-nums text-muted">{t('cart_page.items', { count: totalItems })}</span>}
        <button type="button" onClick={shrink} className={`${iconButton} ml-auto`} aria-label={t('cart_page.collapse')} title={t('cart_page.collapse')}>
          <Minimize2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<ShoppingBag className="h-10 w-10" aria-hidden />}
            title={t('cart_empty')}
            text={t('cart_page.empty_hint')}
            action={
              <Link to="/" className={primaryButtonInline}>
                {t('shop_now')}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section aria-label={t('cart_page.products')} className="min-w-0 border-t border-line">
            <CartLines cart={cart} large />
            <CartGifts cart={cart} />
          </section>

          <aside aria-label={t('cart_page.summary')} className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <OrderPromotionPicker cart={cart} />
            <div className="rounded-2xl border border-line bg-sunken p-5">
              <CartHints cart={cart} />
              <CartSummary cart={cart} idPrefix="cart-page" />
              <Link to="/checkout" className={`${primaryButton} mt-4`}>
                {t('checkout')}
              </Link>
              <Link to="/" className={`${quietLink} mt-3 block w-full py-1 text-center text-sm`}>
                {t('continue_shopping')}
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default CartPage;
