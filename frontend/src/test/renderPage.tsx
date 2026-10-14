import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import th from '../../public/locales/th/translation.json';
import en from '../../public/locales/en/translation.json';
import { AuthProvider } from '../contexts/AuthContext';
import { CartProvider, CartItem, cartKey } from '../contexts/CartContext';
import { FavoritesProvider } from '../contexts/FavoritesContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AppShell } from '../App';

/** A real i18n instance with the shipped strings (Thai first), so tests read what customers read. */
export function makeI18n() {
  const instance = i18next.createInstance();
  instance.use(initReactI18next).init({
    lng: 'th',
    fallbackLng: 'th',
    resources: { th: { translation: th }, en: { translation: en } },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}

interface Options {
  /** The route pattern the page is mounted at, e.g. /orders/:id. */
  path: string;
  /** The URL being visited, when it differs from the pattern (params, query). */
  url?: string;
  cart?: CartItem[];
  /** Whose Cart `cart` is: the signed-in Customer the test file's /auth/me returns. */
  userId?: string;
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
export function renderPage(page: React.ReactElement, { path, url = path, cart = [], userId = 'u1', history = [], routes, outside }: Options) {
  localStorage.setItem(cartKey(userId), JSON.stringify(cart));
  return render(
    <I18nextProvider i18n={makeI18n()}>
      <MemoryRouter initialEntries={[...history, url]} initialIndex={history.length}>
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

/**
 * Renders the whole app shell (navbar, routes, footer, Cart drawer) at a URL, with the same real
 * providers and Thai strings as the app. Use it for behaviour that spans pages: menus and links.
 * Who is signed in is decided by the test file's Supabase session and /auth/me mocks.
 */
export function renderApp(
  url: string,
  { cart = [], userId = 'u1', history = [], i18n = makeI18n() }: { cart?: CartItem[]; userId?: string; history?: string[]; i18n?: ReturnType<typeof makeI18n> } = {}
) {
  if (cart.length) localStorage.setItem(cartKey(userId), JSON.stringify(cart));
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[...history, url]} initialIndex={history.length}>
        <AuthProvider>
          <CartProvider>
            <FavoritesProvider>
              <ThemeProvider>
                <AppShell />
              </ThemeProvider>
            </FavoritesProvider>
          </CartProvider>
        </AuthProvider>
      </MemoryRouter>
    </I18nextProvider>
  );
}
