import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './test/renderPage';
import { api } from './lib/api';
import { resetCatalogue } from './lib/catalogue';

let mockMember: { id: string; email: string; full_name: string; role: 'user' | 'admin' } | null = null;
let mockFavorites: string[] = [];

jest.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockMember ? { access_token: 'test-token' } : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: mockFavorites.map((product_id) => ({ product_id })), error: null }) }),
      upsert: () => Promise.resolve({ error: null }),
    }),
  },
}));

jest.mock('./lib/api', () => {
  const actual = jest.requireActual('./lib/api');
  return { ...actual, api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() } };
});

const customer = { id: 'u1', email: 'mali@example.com', full_name: 'มาลี ใจดี', role: 'user' as const };
const product = (id: string, name: string, name_th: string, category: string, price: number) => ({
  id, name, name_th, description: null, price, available: 3, category, attributes: {}, images: [], is_best_seller: false, views: 0,
});
const atlas = product('b1', 'Atlas beetle', 'ด้วงกว่างสามเขา', 'beetle', 3200);
const jelly = product('f1', 'Beetle jelly', 'เยลลี่ด้วง', 'food', 100);
const bark = product('f2', 'Oak bark', 'เปลือกโอ๊ก', 'food', 50);
const log = product('l1', 'Rotten log', 'ขอนผุ', 'log', 300);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockMember = null;
  mockFavorites = [];
  (api.get as jest.Mock).mockImplementation((path: string) => {
    if (path === '/auth/me') return mockMember ? Promise.resolve(mockMember) : Promise.reject(new Error('no session'));
    if (path === '/products?limit=100') return Promise.resolve({ products: [atlas, jelly, bark, log] });
    if (path === '/rules/promotions') return Promise.resolve([]);
    if (path === '/notifications') return Promise.resolve({ notifications: [], unread: 0 });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

/** Product names in the order the cards are shown. */
const productNames = async () => {
  await screen.findByRole('button', { name: 'ด้วงกว่างสามเขา' });
  return screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
};

test('search, categories and sort sit together in one toolbar right after the Hero', async () => {
  renderApp('/');
  const toolbar = within(await screen.findByRole('search', { name: 'ค้นหาและกรองสินค้า' }));
  expect(toolbar.getByRole('searchbox')).toBeInTheDocument();
  expect(toolbar.getByRole('group', { name: 'หมวดหมู่' })).toBeInTheDocument();
  expect(toolbar.getByRole('combobox', { name: /เรียง/ })).toBeInTheDocument();
});

test("a signed-in Customer's Favorites come first, each group in the chosen sort", async () => {
  mockMember = customer;
  mockFavorites = ['l1', 'f2'];
  renderApp('/');
  await waitFor(async () => expect(await productNames()).toEqual(['เปลือกโอ๊ก', 'ขอนผุ', 'ด้วงกว่างสามเขา', 'เยลลี่ด้วง']));
  userEvent.selectOptions(screen.getByRole('combobox', { name: /เรียง/ }), 'price_asc');
  await waitFor(async () => expect(await productNames()).toEqual(['เปลือกโอ๊ก', 'ขอนผุ', 'เยลลี่ด้วง', 'ด้วงกว่างสามเขา']));
});

test('Favorites first stays within the chosen category', async () => {
  mockMember = customer;
  mockFavorites = ['l1', 'f2'];
  renderApp('/');
  await productNames();
  userEvent.click(screen.getByRole('button', { name: 'อาหาร' }));
  await waitFor(async () => expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['เปลือกโอ๊ก', 'เยลลี่ด้วง']));
});

test('guests see the shop in its normal order', async () => {
  renderApp('/');
  expect(await productNames()).toEqual(['ด้วงกว่างสามเขา', 'เยลลี่ด้วง', 'เปลือกโอ๊ก', 'ขอนผุ']);
});

test("the category chips follow the Admin's list, order and wording; the Family filter follows the Admin's Families", async () => {
  resetCatalogue();
  const shop = (api.get as jest.Mock).getMockImplementation()!;
  (api.get as jest.Mock).mockImplementation((path: string) =>
    path === '/categories'
      ? Promise.resolve({
          categories: [
            { slug: 'food', name_th: 'อาหารด้วง', name_en: 'Beetle food', sort_order: 1, is_system: false },
            { slug: 'beetle', name_th: 'ด้วงมีชีวิต', name_en: 'Live beetles', sort_order: 2, is_system: true },
            { slug: 'tools', name_th: 'เครื่องมือ', name_en: 'Tools', sort_order: 3, is_system: false },
          ],
          families: [
            { id: 'fa2', name: 'Stag', sort_order: 1 },
            { id: 'fa1', name: 'Rhinoceros', sort_order: 2 },
          ],
        })
      : path === '/products?limit=100'
        ? Promise.resolve({
            products: [
              { ...atlas, attributes: { family: 'Rhinoceros' } },
              { ...atlas, id: 'b2', name: 'Stag beetle', name_th: 'ด้วงคีม', attributes: { family: 'Stag' } },
              jelly,
            ],
          })
        : shop(path)
  );
  try {
    renderApp('/');
    const chips = within(await screen.findByRole('group', { name: 'หมวดหมู่' }));
    await waitFor(() => expect(chips.getAllByRole('button').map((b) => b.textContent)).toEqual(['ทั้งหมด', 'อาหารด้วง', 'ด้วงมีชีวิต', 'เครื่องมือ']));
    userEvent.click(chips.getByRole('button', { name: 'ด้วงมีชีวิต' }));
    const families = within(await screen.findByRole('group', { name: 'ประเภทด้วง' }));
    // In the Admin's order (Stag, then Rhinoceros), each in the shop's Thai wording
    const names = families.getAllByRole('button').map((b) => b.textContent);
    expect(names).toHaveLength(3);
    expect(names[1]).toBe('คีม');
  } finally {
    resetCatalogue();
  }
});
