import { useEffect, useState } from 'react';
import { api } from './api';
import { baht } from './format';

/** One step of a Discount: buy min_units or more, get value % or value baht off each unit. */
export interface DiscountTier {
  min_units: number;
  type: 'percent' | 'baht';
  value: number;
}

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

/** Promotions running now. Fetched once per page view; a failure just means no badges. */
export function useActivePromotions() {
  const [list, setList] = useState<ActivePromotion[]>([]);
  useEffect(() => {
    let live = true;
    api
      .get<ActivePromotion[]>('/rules/promotions')
      .then((l) => live && setList(Array.isArray(l) ? l : []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return list;
}
