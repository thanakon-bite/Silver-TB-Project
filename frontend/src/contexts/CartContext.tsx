import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { storage } from '../lib/format';
import { useAuth } from './AuthContext';

export interface CartItem {
  product_id: string;
  name: string;
  /** Thai name, shown instead of `name` when the shopper reads Thai. */
  name_th?: string | null;
  price: number; // display only — the server always recalculates prices
  image: string;
  quantity: number;
  max_quantity?: number; // stock when added; the server re-checks stock at checkout
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  totalItems: number;
  totalPrice: number;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (product_id: string) => void;
  updateQuantity: (product_id: string, quantity: number) => void;
  clearCart: () => void;
  /** Puts a Cart back as it was (an Order that could not go ahead returns its products to the Cart). */
  restoreCart: (items: CartItem[]) => void;
  /** Brings quantities within today's Available ({ product_id: available }); returns the products it changed. */
  syncAvailable: (available: Record<string, number>) => string[];
  openCart: () => void;
  closeCart: () => void;
}

/** Each Customer's Cart is kept on the device under their own key; guests have no Cart (CONTEXT.md). */
export const cartKey = (userId: string) => `stb_cart_v1:${userId}`;

const load = (userId: string | undefined): CartItem[] => {
  if (!userId) return [];
  const saved = storage.get<CartItem[]>(cartKey(userId), []);
  return Array.isArray(saved) ? saved.filter((i) => i && i.product_id && i.quantity > 0) : [];
};

/** The device-wide guest Cart from before Carts belonged to accounts. */
const LEGACY_KEY = 'stb_cart_v1';

const MAX_PER_ITEM = 99;

const CartContext = createContext<CartContextType | null>(null);

/** A Cart quantity never goes above Available (CONTEXT.md); 0 means the line has to go. */
const clamp = (qty: number, max?: number) => Math.max(0, Math.min(qty, max ?? MAX_PER_ITEM, MAX_PER_ITEM));

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const userId = useAuth().user?.id;
  // The Cart follows whoever is signed in: switching user loads theirs, signing out shows none.
  const [owner, setOwner] = useState(userId);
  const [items, setItems] = useState<CartItem[]>(() => load(userId));
  const [isOpen, setIsOpen] = useState(false);
  if (owner !== userId) {
    setOwner(userId);
    setItems(load(userId));
    setIsOpen(false);
  }

  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* storage blocked: nothing to clean */
    }
  }, []);

  useEffect(() => {
    if (userId && owner === userId) storage.set(cartKey(userId), items);
  }, [userId, owner, items]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>) => {
    if (!userId || (item.max_quantity !== undefined && item.max_quantity <= 0)) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === item.product_id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === item.product_id
            ? { ...i, ...item, quantity: Math.max(1, clamp(i.quantity + 1, item.max_quantity ?? i.max_quantity)) }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setIsOpen(true);
  }, [userId]);

  const removeItem = useCallback((product_id: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== product_id));
  }, []);

  const updateQuantity = useCallback(
    (product_id: string, quantity: number) => {
      if (quantity < 1) {
        removeItem(product_id);
        return;
      }
      setItems((prev) => prev.map((i) => (i.product_id === product_id ? { ...i, quantity: Math.max(1, clamp(quantity, i.max_quantity)) } : i)));
    },
    [removeItem]
  );

  const clearCart = useCallback(() => setItems([]), []);
  const restoreCart = useCallback((saved: CartItem[]) => setItems(saved), []);

  const syncAvailable = useCallback(
    (available: Record<string, number>) => {
      const known = (i: CartItem) => available[i.product_id] !== undefined;
      const changed = items.filter((i) => known(i) && i.quantity > available[i.product_id]).map((i) => i.product_id);
      if (changed.length || items.some((i) => known(i) && i.max_quantity !== available[i.product_id])) {
        setItems((prev) =>
          prev
            .map((i) => (known(i) ? { ...i, max_quantity: available[i.product_id], quantity: clamp(i.quantity, available[i.product_id]) } : i))
            .filter((i) => i.quantity > 0)
        );
      }
      return changed;
    },
    [items]
  );
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        totalItems,
        totalPrice,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        restoreCart,
        syncAvailable,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
