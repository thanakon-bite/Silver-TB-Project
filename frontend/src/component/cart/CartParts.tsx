import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Gift, Minus, Plus, Tag } from 'lucide-react';
import { useCart, type CartItem } from '../../contexts/CartContext';
import { baht } from '../../lib/format';
import { useGiftChoices } from '../../lib/giftChoices';
import { usePromotionChoice } from '../../lib/promotionChoice';
import { amountText, promotionName, useActivePromotions } from '../../lib/promotions';
import { usePricedCart } from '../../lib/usePricedCart';
import BeetleMark from '../brand/BeetleMark';
import { useProductText } from '../products/ProductCard';
import PromotionPicker from '../products/PromotionPicker';

const stepper =
  'flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition-colors hover:border-muted disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none';

/**
 * The Cart priced by the server (Promotions, Gifts, hints, Shipping Fee: what checkout will charge), shared
 * by the Cart drawer and the Cart page. `enabled` is false while neither is showing.
 */
export function useCartPricing(enabled: boolean) {
  const { t, i18n } = useTranslation();
  const isThai = (i18n.language || 'th').startsWith('th');
  const cart = useCart();
  const text = useProductText();
  const { choices: giftChoices, choose: chooseGift } = useGiftChoices();
  const { choice: promotionChoice, choose: choosePromotion } = usePromotionChoice();
  const priced = usePricedCart(cart.items, enabled, giftChoices, promotionChoice);
  const running = useActivePromotions();

  // Quantities never stay above today's Available: lower them and say which products changed
  const [lowered, setLowered] = useState<string[]>([]);
  const { syncAvailable } = cart;
  useEffect(() => {
    if (!priced) return;
    const available = Object.fromEntries(priced.lines.filter((l) => l.available !== undefined).map((l) => [l.product_id, l.available as number]));
    const changed = syncAvailable(available);
    if (changed.length) setLowered((prev) => Array.from(new Set([...prev, ...changed])));
  }, [priced, syncAvailable]);
  useEffect(() => {
    if (!enabled) setLowered([]);
  }, [enabled]);

  /** Removing a product (button, or stepping down from 1) asks first. */
  const confirmRemove = async (item: CartItem) => {
    const ok = await Swal.fire({
      icon: 'question',
      title: t('cart_page.remove_title'),
      text: t('cart_page.remove_text', { name: text.name(item) }),
      showCancelButton: true,
      confirmButtonText: t('cart_page.remove_confirm'),
      cancelButtonText: t('cart_page.keep'),
    });
    if (ok.isConfirmed) cart.removeItem(item.product_id);
  };

  const pricedLine = (productId: string) => priced?.lines.find((l) => l.product_id === productId);
  // A line that used the Stackable set names every Promotion it took
  const promoNamesOf = (line: { promotion_id: string | null; promotion_ids?: string[] }) =>
    (line.promotion_ids?.length ? line.promotion_ids : [line.promotion_id])
      .map((id) => priced?.promotions_applied?.find((x) => x.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => promotionName(p, isThai))
      .join(' + ');
  // The running Promotions' tiers and Gifts, so each option card says what it gives
  const withDetails = <P extends { id: string }>(p: P) => ({ ...p, ...running.find((r) => r.id === p.id), ...p });

  return { ...cart, text, isThai, priced, pricedLine, promoNamesOf, withDetails, lowered, confirmRemove, chooseGift, choosePromotion };
}

export type CartPricing = ReturnType<typeof useCartPricing>;

/** The products in the Cart with their price, Promotion line and quantity stepper. */
export const CartLines: React.FC<{ cart: CartPricing; large?: boolean }> = ({ cart, large = false }) => {
  const { t } = useTranslation();
  const { items, text, pricedLine, promoNamesOf, lowered, confirmRemove, updateQuantity } = cart;
  const thumb = large ? 'h-24 w-24 sm:h-28 sm:w-28' : 'h-20 w-20';
  return (
    <>
      {lowered.length > 0 && items.length > 0 && (
        <p role="status" className="mt-4 rounded-xl border border-line bg-sunken px-3 py-2 text-xs text-ink">
          {t('cart_page.lowered_to_available')}
        </p>
      )}
      <ul className="divide-y divide-line">
        {items.map((item) => {
          const line = pricedLine(item.product_id);
          return (
            <li key={item.product_id} className="flex gap-4 py-4">
              <div className={`${thumb} shrink-0 overflow-hidden rounded-lg border border-line bg-sunken`}>
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
                  <p className={`min-w-0 font-medium text-ink ${large ? 'text-base' : 'text-sm'}`}>{text.name(item)}</p>
                  <p className="shrink-0 text-right font-mono text-sm tabular-nums text-ink">
                    {line?.discount_per_unit ? (
                      <>
                        <span className="block text-xs text-muted line-through">{baht(item.price * item.quantity)}</span>
                        {baht(line.line_total)}
                      </>
                    ) : (
                      baht(item.price * item.quantity)
                    )}
                  </p>
                </div>
                <p className="font-mono text-xs tabular-nums text-muted">{baht(item.price)}</p>
                {!!line?.discount_per_unit && (
                  <p className="mt-0.5 text-xs font-medium text-accent-strong">
                    {t('promotions.cart_line', { name: promoNamesOf(line), amount: baht(line.discount_per_unit) })}
                  </p>
                )}
                {item.max_quantity !== undefined && item.quantity >= item.max_quantity && (
                  <p className="mt-0.5 text-xs text-muted">{t('cart_page.max_reached', { count: item.max_quantity })}</p>
                )}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1" role="group" aria-label={`${t('quantity')} · ${text.name(item)}`}>
                    <button
                      type="button"
                      onClick={() => (item.quantity <= 1 ? confirmRemove(item) : updateQuantity(item.product_id, item.quantity - 1))}
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
                    onClick={() => confirmRemove(item)}
                    className="min-h-[36px] px-1 text-sm text-muted underline-offset-4 hover:text-danger hover:underline"
                  >
                    {t('remove')}
                    <span className="sr-only"> {text.name(item)}</span>
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
};

/** Gifts the Order's Promotion earned: free, and the Customer picks one when several are offered. */
export const CartGifts: React.FC<{ cart: CartPricing }> = ({ cart }) => {
  const { t } = useTranslation();
  const { items, priced, isThai, chooseGift } = cart;
  if (!items.length || !priced?.gifts.length) return null;
  return (
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
                      className="min-w-0 rounded-xl border border-line bg-paper px-2 py-1.5 text-sm text-ink"
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
  );
};

/**
 * The Order's Promotion: one card per option, the Customer picks one for the whole Order (ADR 0004).
 * Shown only when there is a choice; a single option already shows on each line.
 */
export const OrderPromotionPicker: React.FC<{ cart: CartPricing }> = ({ cart }) => {
  const { t } = useTranslation();
  const { priced, withDetails, choosePromotion } = cart;
  const options = priced?.promotion_options || [];
  if (options.length < 2) return null;
  return (
    <PromotionPicker
      legend={t('cart_page.order_promotion')}
      hint={t('cart_page.order_promotion_hint')}
      name="order-promotion"
      value={priced?.promotion_option ?? null}
      onChange={choosePromotion}
      options={options.map((o) => ({
        key: o.key,
        kind: o.kind,
        promotions: o.promotions.map(withDetails),
        note:
          o.saving > 0
            ? t('cart_page.option_saving', { amount: baht(o.saving) })
            : o.gift_out
              ? t('promotions.gift_out')
              : t('cart_page.option_nothing'),
      }))}
    />
  );
};

/** The Order's Promotion in one line, for the drawer, with a link to where it is changed. */
export const OrderPromotionLine: React.FC<{ cart: CartPricing; changeTo: string; onChange?: () => void }> = ({ cart, changeTo, onChange }) => {
  const { t } = useTranslation();
  const { priced, isThai } = cart;
  const option = priced?.promotion_options?.find((o) => o.key === priced.promotion_option);
  if (!option) return null;
  const names = option.promotions.map((p) => promotionName(p, isThai)).join(' + ');
  return (
    <p className="mb-2 flex items-center gap-1.5 text-xs text-ink">
      <Tag className="h-3.5 w-3.5 shrink-0 text-accent-strong" aria-hidden />
      <span className="min-w-0">{t('cart_page.using_promotion', { name: names })}</span>
      {(priced?.promotion_options?.length ?? 0) > 1 && (
        <Link to={changeTo} onClick={onChange} className="ml-auto shrink-0 font-medium text-accent-strong underline-offset-4 hover:underline">
          {t('cart_page.change_promotion')}
        </Link>
      )}
    </p>
  );
};

/** "Add N more" for the Order's Promotion only, and the Promotions this Customer can no longer use. */
export const CartHints: React.FC<{ cart: CartPricing }> = ({ cart }) => {
  const { t } = useTranslation();
  const { priced, isThai } = cart;
  if (!priced) return null;
  return (
    <>
      {priced.next_tiers?.map((h) => (
        <p key={h.promotion_id} className="mb-2 rounded-xl bg-accent-strong/10 px-3 py-2 text-xs font-medium text-accent-strong">
          {t('promotions.next_tier', { count: h.units_needed, amount: amountText(h.tier, t), name: promotionName(h, isThai) })}
        </p>
      ))}
      {priced.next_gifts?.map((h) => (
        <p key={`gift-${h.promotion_id}`} className="mb-2 rounded-xl bg-accent-strong/10 px-3 py-2 text-xs font-medium text-accent-strong">
          {t('promotions.next_gift', { count: h.units_needed, gift: h.gift_quantity, name: promotionName(h, isThai) })}
        </p>
      ))}
      {priced.limited?.map((l) => (
        <p key={l.promotion_id} className="mb-2 text-xs text-muted">
          {t(l.reason === 'per_customer' ? 'promotions.limited_mine' : 'promotions.limited_full', { name: promotionName(l, isThai) })}
        </p>
      ))}
    </>
  );
};

/** Items subtotal → discount → Shipping Fee → total, as the server priced them. */
export const CartSummary: React.FC<{ cart: CartPricing; idPrefix: string }> = ({ cart, idPrefix }) => {
  const { t } = useTranslation();
  const { priced, totalPrice } = cart;
  const id = (k: string) => `${idPrefix}-${k}`;
  if (!priced) {
    return (
      <>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-ink">{t('cart_page.item_subtotal')}</span>
          <span className="font-mono text-xl font-medium tabular-nums text-ink">{baht(totalPrice)}</span>
        </div>
        <p className="mt-1 text-xs text-muted">{t('cart_page.shipping_note')}</p>
      </>
    );
  }
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between text-muted">
        <dt id={id('subtotal')}>{t('cart_page.item_subtotal')}</dt>
        <dd aria-labelledby={id('subtotal')} className="font-mono tabular-nums">{baht(priced.items_subtotal)}</dd>
      </div>
      {priced.discount_total > 0 && (
        <div className="flex justify-between text-accent-strong">
          <dt id={id('discount')}>{t('promotions.discount')}</dt>
          <dd aria-labelledby={id('discount')} className="font-mono tabular-nums">−{baht(priced.discount_total)}</dd>
        </div>
      )}
      <div className="flex justify-between text-muted">
        <dt id={id('shipping')}>{t('checkout_page.shipping_fee')}</dt>
        <dd aria-labelledby={id('shipping')} className="font-mono tabular-nums">
          {priced.shipping_fee > 0 ? baht(priced.shipping_fee) : t('checkout_page.free')}
        </dd>
      </div>
      <div className="flex items-baseline justify-between pt-1 text-ink">
        <dt id={id('total')} className="font-semibold">{t('promotions.total')}</dt>
        <dd aria-labelledby={id('total')} className="font-mono text-xl font-medium tabular-nums">{baht(priced.total)}</dd>
      </div>
    </dl>
  );
};
