import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './api';

/** A Category as the Admin keeps it (CONTEXT.md: Category; ADR 0005). `slug` never changes. */
export interface Category {
  slug: string;
  name_th: string;
  name_en: string;
  sort_order: number;
  is_system: boolean;
}

/** A beetle Family from the Admin's list (CONTEXT.md: Family). */
export interface Family {
  id: string;
  name: string;
  sort_order: number;
}

export interface Catalogue {
  categories: Category[];
  families: Family[];
}

/** What the shop had before Categories were Admin-managed: shown until (or if) the list cannot load. */
export const DEFAULT_CATALOGUE: Catalogue = {
  categories: [
    { slug: 'beetle', name_th: 'ด้วง', name_en: 'Beetles', sort_order: 1, is_system: true },
    { slug: 'food', name_th: 'อาหาร', name_en: 'Food', sort_order: 2, is_system: false },
    { slug: 'log', name_th: 'ขอนไม้และวัสดุเพาะ', name_en: 'Logs & substrate', sort_order: 3, is_system: false },
    { slug: 'gear', name_th: 'อุปกรณ์', name_en: 'Gear', sort_order: 4, is_system: false },
  ],
  families: [],
};

let cached: Catalogue | null = null;
let pending: Promise<Catalogue> | null = null;
const listeners = new Set<(c: Catalogue) => void>();

function load(force = false): Promise<Catalogue> {
  if (!force && cached) return Promise.resolve(cached);
  if (!force && pending) return pending;
  pending = api
    .get<Catalogue>('/categories')
    .then((c) => (c && Array.isArray(c.categories) ? { categories: c.categories, families: c.families || [] } : DEFAULT_CATALOGUE))
    .catch(() => DEFAULT_CATALOGUE)
    .then((c) => {
      cached = c;
      pending = null;
      listeners.forEach((l) => l(c));
      return c;
    });
  return pending;
}

/** Forget the list (tests, or after the Admin changes it): the next reader fetches it again. */
export const resetCatalogue = () => {
  cached = null;
  pending = null;
};

/**
 * The shop's Categories and Families, fetched once per page load and shared by every reader.
 * `reload` fetches again (the Admin's Categories tab after a change) and updates every reader.
 */
export function useCatalogue() {
  const [catalogue, setCatalogue] = useState<Catalogue>(cached || DEFAULT_CATALOGUE);
  useEffect(() => {
    let live = true;
    const update = (c: Catalogue) => live && setCatalogue(c);
    listeners.add(update);
    load().then(update);
    return () => {
      live = false;
      listeners.delete(update);
    };
  }, []);
  const reload = useCallback(() => load(true), []);
  return { ...catalogue, reload };
}

/** A Category's name in the shopper's language; an unknown slug falls back to its translation key. */
export function useCategoryName() {
  const { t, i18n } = useTranslation();
  const { categories } = useCatalogue();
  const isThai = (i18n.language || 'th').startsWith('th');
  return (slug: string) => {
    const c = categories.find((x) => x.slug === slug);
    return c ? (isThai ? c.name_th : c.name_en) : t(slug);
  };
}
