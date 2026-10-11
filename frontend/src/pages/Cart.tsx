import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { X, Plus, Minus, ShoppingBag, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../contexts/CartContext';
import { baht } from '../lib/format';
import BeetleMark from '../component/brand/BeetleMark';
import { useProductText } from '../component/products/ProductCard';
import { iconButton, primaryButton, primaryButtonInline, quietLink } from '../component/ui/buttonStyles';
import { usePricedCart } from '../lib/usePricedCart';
import { useGiftChoices } from '../lib/giftChoices';
import { amountText, promotionName } from '../lib/promotions';

const stepper =
  'flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition-colors hover:border-muted disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none';

/** The Cart is a drawer over the current page, never a page of its own (CONTEXT.md). */
const Cart: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isThai = (i18n.language || 'th').startsWith('th');
  const { items, isOpen, closeCart, removeItem, updateQuantity, totalPrice, totalItems } = useCart();
  const text = useProductText();
  // Priced by the server while the drawer is open: Promotions, hints and the Shipping Fee match checkout.
  const { choices: giftChoices, choose: chooseGift } = useGiftChoices();
  const priced = usePricedCart(items, isOpen, giftChoices);
  const pricedLine = (productId: string) => priced?.lines.find((l) => l.product_id === productId);
  const promoNameOf = (id: string | null) => {
    const p = priced?.promotions_applied?.find((x) => x.id === id);
    return p ? promotionName(p, isThai) : '';
  };
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
                          <p className="shrink-0 text-right font-mono text-sm tabular-nums text-ink">
                            {pricedLine(item.product_id)?.discount_per_unit ? (
                              <>
                                <span className="block text-xs text-muted line-through">{baht(item.price * item.quantity)}</span>
                                {baht(pricedLine(item.product_id)!.line_total)}
                              </>
                            ) : (
                              baht(item.price * item.quantity)
                            )}
                          </p>
                        </div>
                        <p className="font-mono text-xs tabular-nums text-muted">{baht(item.price)}</p>
                        {!!pricedLine(item.product_id)?.discount_per_unit && (
                          <p className="mt-0.5 text-xs font-medium text-accent-strong">
                            {t('promotions.cart_line', {
                              name: promoNameOf(pricedLine(item.product_id)!.promotion_id),
                              amount: baht(pricedLine(item.product_id)!.discount_per_unit),
                            })}
                          </p>
                        )}
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
              {/* Gifts the Promotions earned: free, and the Customer picks one when several are offered */}
              {items.length > 0 && !!priced?.gifts.length && (
                <ul className="divide-y divide-line border-t border-line">
                  {priced.gifts.map((g) => {
                    const promo = promotionName(g, isThai);
                    const label = (o: { name: string; name_th: string | null }) => (isThai ? o.name_th || o.name : o.name);
                    return (
                      <li key={g.promotion_id} className="flex items-start gap-4 py-4">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-accent-strong/50 bg-accent-strong/5">
                          <Gift className="h-7 w-7 text-accent-strong" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="font-medium text-accent-strong">{t('promotions.gift_heading', { name: promo })}</p>
                          {g.out_of_stock ? (
                            <p className="mt-1 text-muted">{t('promotions.gift_out')}</p>
                          ) : (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {g.options.length > 1 ? (
                                <select
                                  aria-label={t('promotions.gift_pick', { name: promo })}
                                  value={g.product_id || ''}
                                  onChange={(e) => chooseGift(g.promotion_id, e.target.value)}
                                  className="min-w-0 rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink"
                                >
                                  {g.options.map((o) => (
                                    <option key={o.product_id} value={o.product_id} disabled={o.available < g.quantity}>
                                      {label(o)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-ink">{label({ name: g.name || '', name_th: g.name_th_product })}</span>
                              )}
                              <span className="font-mono text-xs tabular-nums text-muted">{t('promotions.gift_qty', { count: g.quantity })}</span>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-line bg-sunken px-5 pb-6 pt-4">
                {priced?.next_tiers?.map((h) => (
                  <p key={h.promotion_id} className="mb-2 rounded-lg bg-accent-strong/10 px-3 py-2 text-xs font-medium text-accent-strong">
                    {t('promotions.next_tier', { count: h.units_needed, amount: amountText(h.tier, t), name: promotionName(h, isThai) })}
                  </p>
                ))}
                {priced?.next_gifts?.map((h) => (
                  <p key={`gift-${h.promotion_id}`} className="mb-2 rounded-lg bg-accent-strong/10 px-3 py-2 text-xs font-medium text-accent-strong">
                    {t('promotions.next_gift', { count: h.units_needed, gift: h.gift_quantity, name: promotionName(h, isThai) })}
                  </p>
                ))}
                {priced?.limited?.map((l) => (
                  <p key={l.promotion_id} className="mb-2 text-xs text-muted">
                    {t(l.reason === 'per_customer' ? 'promotions.limited_mine' : 'promotions.limited_full', { name: promotionName(l, isThai) })}
                  </p>
                ))}
                {priced ? (
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between text-muted">
                      <dt id="cart-subtotal">{t('subtotal')}</dt>
                      <dd aria-labelledby="cart-subtotal" className="font-mono tabular-nums">{baht(priced.items_subtotal)}</dd>
                    </div>
                    {priced.discount_total > 0 && (
                      <div className="flex justify-between text-accent-strong">
                        <dt id="cart-discount">{t('promotions.discount')}</dt>
                        <dd aria-labelledby="cart-discount" className="font-mono tabular-nums">−{baht(priced.discount_total)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between text-muted">
                      <dt id="cart-shipping">{t('checkout_page.shipping_fee')}</dt>
                      <dd aria-labelledby="cart-shipping" className="font-mono tabular-nums">
                        {priced.shipping_fee > 0 ? baht(priced.shipping_fee) : t('checkout_page.free')}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between pt-1 text-ink">
                      <dt id="cart-total" className="font-semibold">{t('promotions.total')}</dt>
                      <dd aria-labelledby="cart-total" className="font-mono text-xl font-medium tabular-nums">{baht(priced.total)}</dd>
                    </div>
                  </dl>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-ink">{t('subtotal')}</span>
                      <span className="font-mono text-xl font-medium tabular-nums text-ink">{baht(totalPrice)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{t('cart_page.shipping_note')}</p>
                  </>
                )}
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
