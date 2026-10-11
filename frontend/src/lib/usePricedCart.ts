import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { PricedCart } from './types';

/** The price-preview / order body: cart items, plus the gift picks when there are any. */
export const pricingBody = (items: { product_id: string; quantity: number }[], giftChoices: Record<string, string> = {}) => ({
  items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
  ...(Object.keys(giftChoices).length ? { gift_choices: giftChoices } : {}),
});

/**
 * What the server says these Cart items cost today (Promotions, Gifts, Shipping Rule): the Cart and
 * Checkout show exactly this, so it always matches the order. null while loading or when it cannot be priced.
 */
export function usePricedCart(items: { product_id: string; quantity: number }[], enabled = true, giftChoices: Record<string, string> = {}) {
  const [priced, setPriced] = useState<PricedCart | null>(null);
  const signature = useMemo(() => JSON.stringify([items.map((i) => [i.product_id, i.quantity]), giftChoices]), [items, giftChoices]);

  useEffect(() => {
    if (!enabled || !items.length) {
      setPriced(null);
      return;
    }
    let live = true;
    Promise.resolve()
      .then(() => api.post<PricedCart>('/orders/price-preview', pricingBody(items, giftChoices)))
      .then((p) => live && setPriced(p?.lines ? p : null))
      .catch(() => live && setPriced(null));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled]);

  return priced;
}
