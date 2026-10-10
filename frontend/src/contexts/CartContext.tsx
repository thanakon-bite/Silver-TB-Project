import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { storage } from '../lib/format';

export interface CartItem {
  product_id: string;
  name: string;
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
  openCart: () => void;
  closeCart: () => void;
}

const CART_KEY = 'stb_cart_v1';
const MAX_PER_ITEM = 99;

const CartContext = createContext<CartContextType | null>(null);

const clamp = (qty: number, max?: number) => Math.max(1, Math.min(qty, max ?? MAX_PER_ITEM, MAX_PER_ITEM));

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = storage.get<CartItem[]>(CART_KEY, []);
    return Array.isArray(saved) ? saved.filter((i) => i && i.product_id && i.quantity > 0) : [];
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => storage.set(CART_KEY, items), [items]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === item.product_id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === item.product_id
            ? { ...i, ...item, quantity: clamp(i.quantity + 1, item.max_quantity ?? i.max_quantity) }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((product_id: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== product_id));
  }, []);

  const updateQuantity = useCallback(
    (product_id: string, quantity: number) => {
      if (quantity < 1) {
        removeItem(product_id);
        return;
      }
      setItems((prev) => prev.map((i) => (i.product_id === product_id ? { ...i, quantity: clamp(quantity, i.max_quantity) } : i)));
    },
    [removeItem]
  );

  const clearCart = useCallback(() => setItems([]), []);
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
