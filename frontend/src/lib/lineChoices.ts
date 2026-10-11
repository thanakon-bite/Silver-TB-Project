import { useCallback, useEffect, useState } from 'react';
import { storage } from './format';

const KEY = 'stb_line_choices';

/**
 * The Customer's pick of Promotion option per product ({ product_id: 'stack' | Promotion id }), made on the
 * product page or in the Cart, kept on this device and sent with every price-preview and the order; the
 * server falls back to the best when a pick is no longer on offer (ADR 0004).
 */
export function readLineChoices(): Record<string, string> {
  const v = storage.get<unknown>(KEY, {});
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};
}

// Every reader (product page, Cart drawer) sees a pick the moment another one makes it
const listeners = new Set<(c: Record<string, string>) => void>();

export function useLineChoices() {
  const [choices, setChoices] = useState<Record<string, string>>(readLineChoices);
  useEffect(() => {
    listeners.add(setChoices);
    return () => {
      listeners.delete(setChoices);
    };
  }, []);
  const choose = useCallback((productId: string, option: string) => {
    const next = { ...readLineChoices(), [productId]: option };
    storage.set(KEY, next);
    listeners.forEach((l) => l(next));
  }, []);
  return { choices, choose };
}
