import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import Swal from 'sweetalert2';
import i18n from '../i18n';
import { storage } from '../lib/format';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

interface FavoritesContextType {
  favorites: string[];
  toggle: (product_id: string) => void;
  isFavorite: (product_id: string) => boolean;
}

// Favorites used to live in localStorage; they are imported into the database once per browser.
const LEGACY_KEYS = (userId: string) => ['stb_favorites_v1', `stb_favorites_v1:${userId}`];

const FavoritesContext = createContext<FavoritesContextType | null>(null);

/** Favorites are stored in the `favorites` table; RLS limits each user to their own rows. */
export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const legacy = LEGACY_KEYS(userId).flatMap((k) => {
        const saved = storage.get<string[]>(k, []);
        return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [];
      });
      if (legacy.length) {
        const rows = Array.from(new Set(legacy)).map((product_id) => ({ user_id: userId, product_id }));
        const { error } = await supabase.from('favorites').upsert(rows, { onConflict: 'user_id,product_id', ignoreDuplicates: true });
        if (!error) LEGACY_KEYS(userId).forEach((k) => localStorage.removeItem(k));
      }
      const { data, error } = await supabase.from('favorites').select('product_id').eq('user_id', userId);
      if (!cancelled && !error) setFavorites((data || []).map((r) => r.product_id));
    })().catch(() => {
      /* favorites are non-critical; leave the list empty */
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback(
    (product_id: string) => {
      if (!userId) {
        Swal.fire({
          title: i18n.t('favorites_login.title'),
          text: i18n.t('favorites_login.text'),
          showCancelButton: true,
          confirmButtonText: i18n.t('login'),
          cancelButtonText: i18n.t('favorites_login.later'),
        }).then((r) => {
          if (r.isConfirmed) window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        });
        return;
      }
      const wasFavorite = favorites.includes(product_id);
      setFavorites((prev) => (wasFavorite ? prev.filter((id) => id !== product_id) : [...prev, product_id]));
      const request = wasFavorite
        ? supabase.from('favorites').delete().eq('user_id', userId).eq('product_id', product_id)
        : supabase.from('favorites').upsert({ user_id: userId, product_id }, { onConflict: 'user_id,product_id', ignoreDuplicates: true });
      Promise.resolve(request).then(({ error }) => {
        if (error) setFavorites((prev) => (wasFavorite ? [...prev, product_id] : prev.filter((id) => id !== product_id)));
      });
    },
    [userId, favorites]
  );

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
