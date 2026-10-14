import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { X, ShoppingBag, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../contexts/CartContext';
import { iconButton, primaryButton, primaryButtonInline, quietLink } from '../component/ui/buttonStyles';
import { CartGifts, CartHints, CartLines, CartSummary, OrderPromotionLine, useCartPricing } from '../component/cart/CartParts';

/**
 * The Cart drawer over the current page: how the Cart opens normally. Its expand icon opens the Cart
 * page (/cart), the Cart in full, where the Customer picks the Order's Promotion (CONTEXT.md: Cart).
 */
const Cart: React.FC = () => {
  const { t } = useTranslation();
  const { isOpen: open } = useCart();
  // The Cart page's shrink icon brings the drawer back over this page
  const location = useLocation();
  // Priced by the server only while the drawer shows
  const cart = useCartPricing(open);
  const { items, isOpen, closeCart, totalItems } = cart;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeCart();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [isOpen, closeCart]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeCart}
            className="absolute inset-0 bg-ink/40"
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-line bg-paper shadow-[-12px_0_40px_-16px_rgb(0_0_0/0.35)]"
          >
            <div className="flex items-center justify-between gap-4 border-b border-line py-3 pl-5 pr-3">
              <div className="flex items-baseline gap-2">
                <h2 id="cart-title" className="font-display text-xl font-bold text-ink">
                  {t('shopping_cart')}
                </h2>
                {totalItems > 0 && <span className="font-mono text-sm tabular-nums text-muted">{t('cart_page.items', { count: totalItems })}</span>}
              </div>
              <div className="flex items-center gap-1">
                <Link to="/cart" state={{ from: `${location.pathname}${location.search}` }} onClick={closeCart} className={iconButton} aria-label={t('cart_page.expand')} title={t('cart_page.expand')}>
                  <Maximize2 className="h-4 w-4" aria-hidden />
                </Link>
                <button ref={closeRef} type="button" onClick={closeCart} className={iconButton} aria-label={t('close')}>
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                  <ShoppingBag className="h-10 w-10 text-muted" aria-hidden />
                  <p className="mt-4 font-display text-lg font-bold text-ink">{t('cart_empty')}</p>
                  <p className="mt-1 text-sm text-muted">{t('cart_page.empty_hint')}</p>
                  <Link to="/" onClick={closeCart} className={`${primaryButtonInline} mt-6`}>
                    {t('shop_now')}
                  </Link>
                </div>
              ) : (
                <CartLines cart={cart} />
              )}
              <CartGifts cart={cart} />
            </div>

            {items.length > 0 && (
              <div className="border-t border-line bg-sunken px-5 pb-6 pt-4">
                <OrderPromotionLine cart={cart} changeTo="/cart" onChange={closeCart} />
                <CartHints cart={cart} />
                <CartSummary cart={cart} idPrefix="cart" />
                <Link to="/checkout" onClick={closeCart} className={`${primaryButton} mt-4`}>
                  {t('checkout')}
                </Link>
                <button type="button" onClick={closeCart} className={`${quietLink} mt-3 block w-full py-1 text-center text-sm`}>
                  {t('continue_shopping')}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Cart;
