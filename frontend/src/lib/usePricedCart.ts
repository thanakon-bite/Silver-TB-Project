import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { PricedCart } from './types';

/**
 * The price-preview / order body: cart items, plus the gift picks and each line's Promotion option
 * when there are any. Picks for products no longer in the Cart are left out.
 */
export const pricingBody = (
  items: { product_id: string; quantity: number }[],
  giftChoices: Record<string, string> = {},
  promotionChoices: Record<string, string> = {}
) => {
  const lineChoices = Object.fromEntries(Object.entries(promotionChoices).filter(([id]) => items.some((i) => i.product_id === id)));
  return {
    items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
    ...(Object.keys(giftChoices).length ? { gift_choices: giftChoices } : {}),
    ...(Object.keys(lineChoices).length ? { promotion_choices: lineChoices } : {}),
  };
};

/**
 * What the server says these Cart items cost today (Promotions, Gifts, Shipping Rule): the Cart and
 * Checkout show exactly this, so it always matches the order. null while loading or when it cannot be priced.
 */
export function usePricedCart(
  items: { product_id: string; quantity: number }[],
  enabled = true,
  giftChoices: Record<string, string> = {},
  promotionChoices: Record<string, string> = {}
) {
  const [priced, setPriced] = useState<PricedCart | null>(null);
  const signature = useMemo(
    () => JSON.stringify(pricingBody(items, giftChoices, promotionChoices)),
    [items, giftChoices, promotionChoices]
  );

  useEffect(() => {
    if (!enabled || !items.length) {
      setPriced(null);
      return;
    }
    let live = true;
    Promise.resolve()
      .then(() => api.post<PricedCart>('/orders/price-preview', pricingBody(items, giftChoices, promotionChoices)))
      .then((p) => live && setPriced(p?.lines ? p : null))
      .catch(() => live && setPriced(null));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled]);

  return priced;
}
