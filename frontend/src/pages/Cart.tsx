import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { X, Plus, Minus, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../contexts/CartContext';
import { baht } from '../lib/format';
import BeetleMark from '../component/brand/BeetleMark';
import { useProductText } from '../component/products/ProductCard';
import { iconButton, primaryButton, primaryButtonInline, quietLink } from '../component/ui/buttonStyles';

const stepper =
  'flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition-colors hover:border-muted disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none';

/** The Cart is a drawer over the current page, never a page of its own (CONTEXT.md). */
const Cart: React.FC = () => {
  const { t } = useTranslation();
  const { items, isOpen, closeCart, removeItem, updateQuantity, totalPrice, totalItems } = useCart();
  const text = useProductText();
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
              <button ref={closeRef} type="button" onClick={closeCart} className={iconButton} aria-label={t('close')}>
                <X className="h-5 w-5" aria-hidden />
              </button>
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
                <ul className="divide-y divide-line">
                  {items.map((item) => (
                    <li key={item.product_id} className="flex gap-4 py-4">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-sunken">
                        {item.image ? (
                          <img src={item.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <BeetleMark className="h-8 w-8 text-line" />
                          </div>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 text-sm font-medium text-ink">{text.name(item)}</p>
                          <p className="shrink-0 font-mono text-sm tabular-nums text-ink">{baht(item.price * item.quantity)}</p>
                        </div>
                        <p className="font-mono text-xs tabular-nums text-muted">{baht(item.price)}</p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center gap-1" role="group" aria-label={`${t('quantity')} · ${text.name(item)}`}>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                              aria-label={t('cart_page.decrease')}
                              className={stepper}
                            >
                              <Minus className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <span className="w-8 text-center font-mono text-sm tabular-nums" aria-live="polite">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                              disabled={item.max_quantity !== undefined && item.quantity >= item.max_quantity}
                              aria-label={t('cart_page.increase')}
                              className={stepper}
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.product_id)}
                            className="min-h-[36px] px-1 text-sm text-muted underline-offset-4 hover:text-danger hover:underline"
                          >
                            {t('remove')}
                            <span className="sr-only"> {text.name(item)}</span>
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-line bg-sunken px-5 pb-6 pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-ink">{t('subtotal')}</span>
                  <span className="font-mono text-xl font-medium tabular-nums text-ink">{baht(totalPrice)}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{t('cart_page.shipping_note')}</p>
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
