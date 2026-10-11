import { useCallback, useEffect, useState } from 'react';
import { storage } from './format';
import { useAuth } from '../contexts/AuthContext';

/** Each Customer's pick sits beside their Cart (cartKey), so another account on the device never inherits it. */
export const promotionChoiceKey = (userId: string) => `stb_promotion_choice:${userId}`;

/** The device-wide key from before the pick belonged to an account. */
export const LEGACY_PROMOTION_CHOICE_KEY = 'stb_promotion_choice';

/**
 * The Customer's pick of the Promotion option for the whole Order ('stack', or an Exclusive Promotion's
 * id), made on a product page or the Cart page, kept with their Cart and sent with every price-preview and
 * the order. It goes when the Cart is emptied, so the next Cart starts on the best option. The server
 * falls back to the best option when the pick is no longer on offer (ADR 0004).
 */
export function readPromotionChoice(userId: string | undefined): string | null {
  if (!userId) return null;
  const v = storage.get<unknown>(promotionChoiceKey(userId), null);
  return typeof v === 'string' && v ? v : null;
}

// Every reader (product page, Cart drawer, Cart page) sees a pick the moment another one makes it
const listeners = new Set<(choice: string | null) => void>();

/** Forgets the pick (the Cart was emptied); every reader goes back to the best option. */
export function clearPromotionChoice(userId: string) {
  if (readPromotionChoice(userId) === null) return;
  try {
    window.localStorage.removeItem(promotionChoiceKey(userId));
  } catch {
    /* storage blocked: nothing kept */
  }
  listeners.forEach((l) => l(null));
}

export function usePromotionChoice() {
  const userId = useAuth().user?.id;
  const [choice, setChoice] = useState<string | null>(() => readPromotionChoice(userId));
  // Switching account reads that account's pick
  const [owner, setOwner] = useState(userId);
  if (owner !== userId) {
    setOwner(userId);
    setChoice(readPromotionChoice(userId));
  }
  useEffect(() => {
    listeners.add(setChoice);
    return () => {
      listeners.delete(setChoice);
    };
  }, []);
  const choose = useCallback(
    (key: string) => {
      if (userId) storage.set(promotionChoiceKey(userId), key);
      listeners.forEach((l) => l(key));
    },
    [userId]
  );
  return { choice, choose };
}
