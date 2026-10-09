import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { storage } from '../lib/format';

interface FavoritesContextType {
  favorites: string[];
  toggle: (product_id: string) => void;
  isFavorite: (product_id: string) => boolean;
}

const FAVORITES_KEY = 'stb_favorites_v1';

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = storage.get<string[]>(FAVORITES_KEY, []);
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [];
  });

  useEffect(() => storage.set(FAVORITES_KEY, favorites), [favorites]);

  const toggle = useCallback((product_id: string) => {
    setFavorites((prev) =>
      prev.includes(product_id) ? prev.filter((id) => id !== product_id) : [...prev, product_id]
    );
  }, []);

  const isFavorite = useCallback((product_id: string) => favorites.includes(product_id), [favorites]);

  return (
    <FavoritesContext.Provider value={{ favorites, toggle, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = (): FavoritesContextType => {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
};
