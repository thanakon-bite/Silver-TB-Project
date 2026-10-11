import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './test/renderPage';
import { api } from './lib/api';
import { resetCatalogue } from './lib/catalogue';

jest.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}));

jest.mock('./lib/api', () => {
  const actual = jest.requireActual('./lib/api');
  return { ...actual, api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() } };
});

const product = (n: number, category = n % 2 ? 'beetle' : 'food') => ({
  id: `p${n}`, name: `Product ${String(n).padStart(3, '0')}`, name_th: `สินค้า ${String(n).padStart(3, '0')}`, description: null,
  price: 100 + n, available: 3, category, attributes: {}, images: [], is_best_seller: false, views: 0,
});
const many = (count: number) => Array.from({ length: count }, (_, i) => product(i + 1));

/** The shop's API: `pages` maps page number → products, with the total the server reports. */
function backend(pages: Record<number, ReturnType<typeof product>[]>, total: number) {
  (api.get as jest.Mock).mockImplementation((path: string) => {
    if (path === '/auth/me') return Promise.reject(new Error('no session'));
    if (path === '/rules/promotions') return Promise.resolve([]);
    const m = path.match(/^\/products\?limit=100(?:&page=(\d+))?$/);
    if (m) return Promise.resolve({ products: pages[Number(m[1] || 1)] || [], total, page: Number(m[1] || 1), limit: 100 });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  resetCatalogue();
});

const cards = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
const pager = () => within(screen.getByRole('navigation', { name: 'หน้ารายการสินค้า' }));

test('the shop shows 20 products a page, with a pager that says where you are', async () => {
  backend({ 1: many(45) }, 45);
  renderApp('/');
  await screen.findByRole('button', { name: 'สินค้า 001' });
  expect(cards()).toHaveLength(20);
  expect(cards()[0]).toBe('สินค้า 001');
  expect(pager().getByText('หน้า 1 จาก 3 · 45 รายการ')).toBeInTheDocument();
  expect(pager().getByRole('button', { name: /ก่อนหน้า/ })).toBeDisabled();

  userEvent.click(pager().getByRole('button', { name: /ถัดไป/ }));
  await waitFor(() => expect(cards()[0]).toBe('สินค้า 021'));
  expect(cards()).toHaveLength(20);

  userEvent.click(pager().getByRole('button', { name: 'หน้า 3' }));
  await waitFor(() => expect(cards()).toHaveLength(5));
  expect(pager().getByRole('button', { name: 'หน้า 3' })).toHaveAttribute('aria-current', 'page');
  expect(pager().getByRole('button', { name: /ถัดไป/ })).toBeDisabled();
});

test('changing a filter goes back to page 1', async () => {
  backend({ 1: many(45) }, 45);
  renderApp('/');
  await screen.findByRole('button', { name: 'สินค้า 001' });
  userEvent.click(pager().getByRole('button', { name: /ถัดไป/ }));
  await waitFor(() => expect(cards()[0]).toBe('สินค้า 021'));

  userEvent.click(screen.getAllByRole('button', { name: 'ด้วง' })[0]);
  await waitFor(() => expect(cards()[0]).toBe('สินค้า 001'));
  expect(pager().getByText('หน้า 1 จาก 2 · 23 รายการ')).toBeInTheDocument();
});

test('a page from a link opens on that page', async () => {
  backend({ 1: many(45) }, 45);
  renderApp('/?page=2');
  await screen.findByRole('button', { name: 'สินค้า 021' });
  expect(cards()[0]).toBe('สินค้า 021');
});

test('a page link holds while slower data (Promotions, Categories) arrives after the products', async () => {
  backend({ 1: many(45) }, 45);
  const base = (api.get as jest.Mock).getMockImplementation()!;
  let release: (v: unknown) => void = () => {};
  (api.get as jest.Mock).mockImplementation((path: string) =>
    path === '/rules/promotions' ? new Promise((r) => (release = r)) : base(path)
  );
  renderApp('/?page=2');
  await screen.findByRole('button', { name: 'สินค้า 021' });
  release([]);
  await new Promise((r) => setTimeout(r, 50));
  expect(cards()[0]).toBe('สินค้า 021');
  expect(pager().getByRole('button', { name: 'หน้า 2' })).toHaveAttribute('aria-current', 'page');
});

test('a shop of 20 or fewer products shows no pager', async () => {
  backend({ 1: many(12) }, 12);
  renderApp('/');
  await screen.findByRole('button', { name: 'สินค้า 001' });
  expect(screen.queryByRole('navigation', { name: 'หน้ารายการสินค้า' })).not.toBeInTheDocument();
});

test('more than 100 products are all fetched, a hundred at a time', async () => {
  const all = many(130);
  backend({ 1: all.slice(0, 100), 2: all.slice(100) }, 130);
  renderApp('/');
  await screen.findByRole('button', { name: 'สินค้า 001' });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/products?limit=100&page=2'));
  expect(await screen.findByText('หน้า 1 จาก 7 · 130 รายการ')).toBeInTheDocument();
});
