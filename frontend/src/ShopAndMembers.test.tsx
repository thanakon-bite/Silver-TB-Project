import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './test/renderPage';
import { api } from './lib/api';
import { cartKey } from './contexts/CartContext';

/** Who is signed in for the next render: null for a guest. */
let mockMember: { id: string; email: string; full_name: string; role: 'user' | 'admin' } | null = null;

jest.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockMember ? { access_token: 'test-token' } : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      upsert: () => Promise.resolve({ error: null }),
    }),
  },
}));

jest.mock('./lib/api', () => {
  const actual = jest.requireActual('./lib/api');
  return { ...actual, api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

const customer = { id: 'u1', email: 'mali@example.com', full_name: 'มาลี ใจดี', role: 'user' as const };
const otherCustomer = { id: 'u2', email: 'somchai@example.com', full_name: 'สมชาย', role: 'user' as const };
const admin = { id: 'a1', email: 'owner@example.com', full_name: 'เจ้าของร้าน', role: 'admin' as const };

const product = (id: string, name: string, name_th: string, category: string) => ({
  id, name, name_th, description: null, price: 3200, stock: 2, category, attributes: {}, images: [], is_best_seller: false, views: 0,
});
const atlas = product('b1', 'Atlas beetle', 'ด้วงกว่างสามเขา', 'beetle');
const jelly = product('f1', 'Beetle jelly', 'เยลลี่ด้วง', 'food');

function backend() {
  (api.get as jest.Mock).mockImplementation((path: string) => {
    if (path === '/auth/me') return mockMember ? Promise.resolve(mockMember) : Promise.reject(new Error('no session'));
    if (path === '/products?limit=100') return Promise.resolve({ products: [atlas, jelly] });
    if (path === '/orders/shipping-fee') return Promise.resolve({ shipping_fee: 0 });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockMember = null;
  backend();
});

const mainNav = (name = 'เมนูหลัก') => within(screen.getAllByRole('navigation', { name })[0]);
const footer = () => within(screen.getByRole('contentinfo'));

describe('the shop is the front page', () => {
  test('the hero sits above every product for sale', async () => {
    renderApp('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Silver Thief Bug' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'เลือกซื้อด้วงทั้งหมด' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'ด้วงกว่างสามเขา' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ดูคอลเลกชัน/ })).toHaveAttribute('href', '#shop');
  });

  test('an old /products link lands on the shop with its filter', async () => {
    renderApp('/products?category=food');
    expect(await screen.findByRole('button', { name: 'เยลลี่ด้วง' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'อาหาร' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'ด้วงกว่างสามเขา' })).not.toBeInTheDocument();
  });

  test('the menu has no separate home entry', async () => {
    renderApp('/');
    await screen.findByRole('button', { name: 'ด้วงกว่างสามเขา' });
    expect(mainNav().getByRole('link', { name: 'ร้านค้า' })).toHaveAttribute('href', '/');
    expect(mainNav().queryByRole('link', { name: 'หน้าแรก' })).not.toBeInTheDocument();
  });

  test("the about page tells the shop's story and leaves contact details to the contact page", async () => {
    renderApp('/about');
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('heading', { level: 1, name: 'เกี่ยวกับเรา' })).toBeInTheDocument();
    expect(main.getByRole('heading', { name: 'รู้จักด้วงของคุณ' })).toBeInTheDocument();
    expect(main.queryByRole('link', { name: /095 681 2084/ })).not.toBeInTheDocument();
  });
});

describe('the menu by who is signed in', () => {
  test('a guest sees the shop pages, a login button, and no Cart, Favorites, Admin or orders', async () => {
    renderApp('/');
    await screen.findByRole('button', { name: 'ด้วงกว่างสามเขา' });
    expect(mainNav().getAllByRole('link').map((l) => l.textContent)).toEqual(['ร้านค้า', 'เกี่ยวกับเรา', 'ติดต่อเรา']);
    expect(screen.queryByRole('button', { name: /ตะกร้าสินค้า/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /รายการโปรด/ })).not.toBeInTheDocument();
  });

  test('a Customer also sees their orders, Cart and Favorites, but not Admin', async () => {
    mockMember = customer;
    renderApp('/');
    expect(await mainNav().findByRole('link', { name: 'รายการออเดอร์' })).toHaveAttribute('href', '/orders');
    expect(mainNav().queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /ตะกร้าสินค้า/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'คำสั่งซื้อของฉัน' })).not.toBeInTheDocument();
  });

  test('an Admin sees Admin and then their orders after contact', async () => {
    mockMember = admin;
    renderApp('/');
    await mainNav().findByRole('link', { name: 'Admin' });
    expect(mainNav().getAllByRole('link').map((l) => l.textContent)).toEqual(['ร้านค้า', 'เกี่ยวกับเรา', 'ติดต่อเรา', 'Admin', 'รายการออเดอร์']);
  });

  test('"สมัครสมาชิก" is for guests only', async () => {
    mockMember = customer;
    renderApp('/');
    await mainNav().findByRole('link', { name: 'รายการออเดอร์' });
    expect(footer().queryByRole('link', { name: 'สมัครสมาชิก' })).not.toBeInTheDocument();
    expect(footer().getByRole('link', { name: 'รายการโปรด' })).toHaveAttribute('href', '/favorites');
  });

  test('"สมัครสมาชิก" opens sign-up even after switching the form back to sign-in', async () => {
    renderApp('/login?mode=signup');
    await screen.findByLabelText('ชื่อ-นามสกุล');
    userEvent.click(within(screen.getByRole('group', { name: /./ })).getAllByRole('button')[0]);
    await waitFor(() => expect(screen.queryByLabelText('ชื่อ-นามสกุล')).not.toBeInTheDocument());
    userEvent.click(footer().getByRole('link', { name: 'สมัครสมาชิก' }));
    expect(await screen.findByLabelText('ชื่อ-นามสกุล')).toBeInTheDocument();
  });
});

describe('Cart and Favorites belong to signed-in Customers', () => {
  test('a guest adding to the Cart is sent to login', async () => {
    renderApp('/');
    userEvent.click((await screen.findAllByRole('button', { name: /^เพิ่ม.*ด้วงกว่างสามเขา/ }))[0]);
    expect(await screen.findByRole('heading', { level: 1, name: 'ยินดีต้อนรับกลับ' })).toBeInTheDocument();
  });

  test('a guest tapping the heart is sent to login', async () => {
    renderApp('/');
    await screen.findByRole('button', { name: 'ด้วงกว่างสามเขา' });
    userEvent.click(screen.getAllByRole('button', { name: 'เพิ่มในรายการโปรด' })[0]);
    expect(await screen.findByRole('heading', { level: 1, name: 'ยินดีต้อนรับกลับ' })).toBeInTheDocument();
  });

  test('a guest opening Favorites is sent to login', async () => {
    renderApp('/favorites');
    expect(await screen.findByRole('heading', { level: 1, name: 'ยินดีต้อนรับกลับ' })).toBeInTheDocument();
  });

  test("a Customer's Cart is kept under their account and added to there", async () => {
    mockMember = customer;
    renderApp('/');
    await mainNav().findByRole('link', { name: 'รายการออเดอร์' });
    userEvent.click((await screen.findAllByRole('button', { name: /^เพิ่ม.*ด้วงกว่างสามเขา/ }))[0]);
    await waitFor(() => expect(JSON.parse(localStorage.getItem(cartKey('u1')) || '[]')).toHaveLength(1));
  });

  test("another Customer on the same device does not see that Cart", async () => {
    localStorage.setItem(cartKey('u1'), JSON.stringify([{ product_id: 'b1', name: 'Atlas beetle', price: 3200, image: '', quantity: 1 }]));
    mockMember = otherCustomer;
    renderApp('/');
    await mainNav().findByRole('link', { name: 'รายการออเดอร์' });
    expect(screen.queryByRole('button', { name: /มี 1 ชิ้น/ })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(cartKey('u1')) || '[]')).toHaveLength(1);
  });
});

test('switching to English changes the whole shop page, product names included', async () => {
  renderApp('/');
  await screen.findByRole('button', { name: 'ด้วงกว่างสามเขา' });
  userEvent.click(screen.getAllByRole('button', { name: 'Switch to English' })[0]);
  expect(await screen.findByRole('heading', { level: 2, name: 'Shop All Beetles' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Atlas beetle' })).toBeInTheDocument();
  // Only the shown names change; the product list is not downloaded again.
  expect((api.get as jest.Mock).mock.calls.filter(([p]) => p === '/products?limit=100')).toHaveLength(1);
  expect(mainNav('Main menu').getAllByRole('link').map((l) => l.textContent)).toEqual(['Shop', 'About us', 'Contact']);
});
