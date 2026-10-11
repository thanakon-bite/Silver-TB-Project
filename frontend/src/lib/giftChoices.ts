import { useCallback, useState } from 'react';
import { storage } from './format';

const KEY = 'stb_gift_choices';

/** The Customer's pick of gift product per Promotion ({ promotion_id: product_id }), kept on this device until they check out. */
export function readGiftChoices(): Record<string, string> {
  const v = storage.get<unknown>(KEY, {});
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};
}

export function useGiftChoices() {
  const [choices, setChoices] = useState<Record<string, string>>(readGiftChoices);
  const choose = useCallback((promotionId: string, productId: string) => {
    setChoices((c) => {
      const next = { ...c, [promotionId]: productId };
      storage.set(KEY, next);
      return next;
    });
  }, []);
  return { choices, choose };
}
