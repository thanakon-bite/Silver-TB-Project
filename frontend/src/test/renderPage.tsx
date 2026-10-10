import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import th from '../../public/locales/th/translation.json';
import { AuthProvider } from '../contexts/AuthContext';
import { CartProvider, CartItem } from '../contexts/CartContext';

/** A real i18n instance with the shipped Thai strings, so tests read what customers read. */
export function makeI18n() {
  const instance = i18next.createInstance();
  instance.use(initReactI18next).init({
    lng: 'th',
    resources: { th: { translation: th } },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}

interface Options {
  path: string;
  cart?: CartItem[];
  /** Pages visited before this one, oldest first (browser history). */
  history?: string[];
  /** Extra routes rendered beside the page under test, e.g. where a redirect lands. */
  routes?: React.ReactNode;
  /** App-level UI rendered outside the routes, e.g. the Cart drawer. */
  outside?: React.ReactNode;
}

/**
 * Renders a page the way the app does: real Auth and Cart providers, real Thai i18n, a router.
 * Only the network adapters (the API client and Supabase) are mocked, by each test file.
 */
export function renderPage(page: React.ReactElement, { path, cart = [], history = [], routes, outside }: Options) {
  localStorage.setItem('stb_cart_v1', JSON.stringify(cart));
  return render(
    <I18nextProvider i18n={makeI18n()}>
      <MemoryRouter initialEntries={[...history, path]} initialIndex={history.length}>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path={path} element={page} />
              {routes}
            </Routes>
            {outside}
          </CartProvider>
        </AuthProvider>
      </MemoryRouter>
    </I18nextProvider>
  );
}
