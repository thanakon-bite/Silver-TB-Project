import { useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from '../contexts/AuthContext';
import { baht } from './format';

/** One step of a Discount: buy min_units or more, get value % or value baht off each unit. */
export interface DiscountTier {
  min_units: number;
  type: 'percent' | 'baht';
  value: number;
}

/** Whether a Promotion combines with other Stackable ones on a line, or is used alone (ADR 0004). */
export type Stacking = 'stackable' | 'exclusive';

/** A Promotion running now, as GET /rules/promotions returns it (CONTEXT.md: Promotion). */
export interface ActivePromotion {
  id: string;
  name_th: string;
  name_en: string | null;
  ends_at: string;
  applies_to_all: boolean;
  product_ids: string[];
  discount_tiers: DiscountTier[];
  gift_every: number | null;
  gift_quantity: number | null;
  stacking?: Stacking;
  /** Prices of the products it gives as Gifts, to value a Gift against a Discount. */
  gift_prices?: number[];
}

type T = (key: string, o?: Record<string, unknown>) => string;

export const promotionName = (p: { name_th: string; name_en?: string | null }, isThai: boolean) => (isThai ? p.name_th : p.name_en || p.name_th);

const off = (tier: DiscountTier, t: T) =>
  tier.type === 'percent' ? t('promotions.off_percent', { value: tier.value }) : t('promotions.off_baht', { amount: baht(tier.value) });

/** Short badge for a product card, from the Promotion's first step: "ลด 5%", "ซื้อ 3 ลด 10%", "ซื้อ 2 แถม 1". */
export function badgeText(p: ActivePromotion, t: T): string | null {
  const first = [...(p.discount_tiers || [])].sort((a, b) => a.min_units - b.min_units)[0];
  if (first) return first.min_units <= 1 ? off(first, t) : t('promotions.badge_buy', { count: first.min_units, off: off(first, t) });
  if (p.gift_every && p.gift_quantity) return t('promotions.badge_gift', { every: p.gift_every, gift: p.gift_quantity });
  return null;
}

/** One tier spelled out on the product page: "ซื้อ 3 ชิ้นขึ้นไป ลด 10%". */
export const tierText = (tier: DiscountTier, t: T) => t('promotions.tier_line', { count: tier.min_units, off: off(tier, t) });

/** Just the size of a tier's discount, "10%" or "฿20/ชิ้น", for sentences like the Cart's next-tier hint. */
export const amountText = (tier: DiscountTier, t: T) =>
  tier.type === 'percent' ? t('promotions.amount_percent', { value: tier.value }) : t('promotions.amount_baht', { amount: baht(tier.value) });

export const promotionsFor = (productId: string, list: ActivePromotion[]) =>
  list.filter((p) => p.applies_to_all || p.product_ids.includes(productId));

/**
 * The ways a product can take its Promotions, as the Cart offers them (ADR 0004): each Exclusive one on
 * its own, and the Stackable ones together. Keys match the Cart's choice: a Promotion id, or 'stack'.
 */
export function promotionOptions(productId: string, list: ActivePromotion[]) {
  const covering = promotionsFor(productId, list);
  const stack = covering.filter((p) => p.stacking === 'stackable');
  return [
    ...covering.filter((p) => p.stacking !== 'stackable').map((p) => ({ key: p.id, kind: 'exclusive' as const, promotions: [p] })),
    ...(stack.length ? [{ key: 'stack', kind: 'stack' as const, promotions: stack }] : []),
  ];
}

/** The option a product page starts on: the one holding its Best Promotion. */
export function bestOptionKey(product: { id: string; price: number }, list: ActivePromotion[]): string | null {
  const best = bestPromotion(product, list);
  return !best ? null : best.stacking === 'stackable' ? 'stack' : best.id;
}

/**
 * What a Promotion is worth per unit to someone buying `units` of a product priced `price`: the
 * Discount of the highest tier reached, plus a Gift once `units` earns one, valued at its cheapest
 * gift price shared over the units it takes.
 */
function worthPerUnit(p: ActivePromotion, price: number, units: number): number {
  const tier = [...(p.discount_tiers || [])].filter((t) => t.min_units <= units).sort((a, b) => b.min_units - a.min_units)[0];
  const discount = !tier ? 0 : tier.type === 'percent' ? (price * tier.value) / 100 : Math.min(tier.value, price);
  const giftPrice = p.gift_prices?.length ? Math.min(...p.gift_prices) : 0;
  const gift = p.gift_every && p.gift_quantity && units >= p.gift_every ? (giftPrice * p.gift_quantity) / p.gift_every : 0;
  return discount + gift;
}

/** The fewest units at which a Promotion gives anything: its lowest Discount Tier or its Gift. */
const lowestTier = (p: ActivePromotion) =>
  Math.min(...(p.discount_tiers || []).map((t) => t.min_units), p.gift_every && p.gift_quantity ? p.gift_every : Infinity);

/**
 * The Best Promotion (CONTEXT.md) for a product among those covering it: worth most when buying one
 * unit; when none gives anything for one unit, compared at each one's lowest tier. Ties keep list order.
 */
export function bestPromotion(product: { id: string; price: number }, list: ActivePromotion[]): ActivePromotion | null {
  const covering = promotionsFor(product.id, list);
  if (!covering.length) return null;
  const pick = (worth: (p: ActivePromotion) => number) =>
    covering.reduce<{ p: ActivePromotion | null; w: number }>((best, p) => {
      const w = worth(p);
      return w > best.w ? { p, w } : best;
    }, { p: null, w: 0 }).p;
  return (
    pick((p) => worthPerUnit(p, product.price, 1)) ||
    pick((p) => (Number.isFinite(lowestTier(p)) ? worthPerUnit(p, product.price, lowestTier(p)) : 0)) ||
    covering[0]
  );
}

/**
 * Promotions running now that this shopper can still redeem. The API client sends the session token,
 * so a signed-in Customer's used-up Promotions are left out; fetched again when who is signed in changes.
 * A failure just means no badges.
 */
export function useActivePromotions() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [list, setList] = useState<ActivePromotion[]>([]);
  useEffect(() => {
    if (loading) return;
    let live = true;
    api
      .get<ActivePromotion[]>('/rules/promotions')
      .then((l) => live && setList(Array.isArray(l) ? l : []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId, loading]);
  return list;
}
