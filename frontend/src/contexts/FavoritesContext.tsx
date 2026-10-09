import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import Swal from 'sweetalert2';
import { storage } from '../lib/format';
import { useAuth } from './AuthContext';

interface FavoritesContextType {
  favorites: string[];
  toggle: (product_id: string) => void;
  isFavorite: (product_id: string) => boolean;
}

const FAVORITES_KEY = 'stb_favorites_v1';

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  // Favorites are stored per user so a shared browser never leaks one user's list to another
  const storageKey = user ? `${FAVORITES_KEY}:${user.id}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!storageKey) {
      setFavorites([]);
    } else {
      const saved = storage.get<string[]>(storageKey, []);
      setFavorites(Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []);
    }
    setLoadedKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (storageKey && loadedKey === storageKey) storage.set(storageKey, favorites);
  }, [favorites, storageKey, loadedKey]);

  const toggle = useCallback((product_id: string) => {
    if (!user) {
      Swal.fire({
        icon: 'warning',
        title: 'Please Login',
        text: 'You must be logged in to add products to your favorites.',
        confirmButtonColor: '#FF922B'
      });
      return;
    }
    setFavorites((prev) =>
      prev.includes(product_id) ? prev.filter((id) => id !== product_id) : [...prev, product_id]
    );
  }, [user]);

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
