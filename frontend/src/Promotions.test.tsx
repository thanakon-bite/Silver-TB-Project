import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './test/renderPage';
import { api } from './lib/api';

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
  return { ...actual, api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() } };
});

const customer = { id: 'u1', email: 'mali@example.com', full_name: 'มาลี ใจดี', role: 'user' as const };

const product = (id: string, name: string, name_th: string, price: number) => ({
  id, name, name_th, description: null, price, available: 9, category: 'food', attributes: {}, images: [], is_best_seller: false, views: 0,
});
const jelly = product('f1', 'Beetle jelly', 'เยลลี่ด้วง', 100);
const bark = product('f2', 'Oak bark', 'เปลือกโอ๊ก', 200);
const log = product('l1', 'Rotten log', 'ขอนผุ', 300);

const rainy = {
  id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: 'Rainy season sale', ends_at: '2026-11-30T16:59:59.999Z',
  applies_to_all: false, product_ids: ['f1', 'f2'], gift_every: null, gift_quantity: null,
  discount_tiers: [
    { min_units: 1, type: 'percent', value: 5 },
    { min_units: 3, type: 'percent', value: 10 },
  ],
};
const logDeal = { ...rainy, id: 'pr2', name_th: 'ขอนคุ้ม', product_ids: ['l1'], discount_tiers: [{ min_units: 2, type: 'baht', value: 20 }] };

function backend(preview?: unknown) {
  (api.get as jest.Mock).mockImplementation((path: string) => {
    if (path === '/auth/me') return mockMember ? Promise.resolve(mockMember) : Promise.reject(new Error('no session'));
    if (path === '/products?limit=100') return Promise.resolve({ products: [jelly, bark, log] });
    if (path === '/rules/promotions') return Promise.resolve([rainy, logDeal]);
    if (path === '/notifications') return Promise.resolve({ notifications: [], unread: 0 });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  (api.post as jest.Mock).mockImplementation((path: string) =>
    path === '/orders/price-preview' && preview ? Promise.resolve(preview) : Promise.reject(new Error(`unexpected POST ${path}`))
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockMember = null;
  backend();
});

test('product cards in a Promotion carry a short badge from its first tier', async () => {
  renderApp('/');
  const jellyCard = (await screen.findByRole('button', { name: 'เยลลี่ด้วง' })).closest('article') as HTMLElement;
  expect(within(jellyCard).getByText('ลด 5%')).toBeInTheDocument();
  const logCard = screen.getByRole('button', { name: 'ขอนผุ' }).closest('article') as HTMLElement;
  expect(within(logCard).getByText('ซื้อ 2 ลด ฿20/ชิ้น')).toBeInTheDocument();
});

test('the product page lists every tier of its Promotion', async () => {
  renderApp('/');
  userEvent.click(await screen.findByRole('button', { name: 'เยลลี่ด้วง' }));
  const promo = within(await screen.findByRole('region', { name: 'โปรโมชัน' }));
  expect(promo.getByText('ลดรับหน้าฝน')).toBeInTheDocument();
  expect(promo.getByText('ซื้อ 1 ชิ้นขึ้นไป ลด 5%')).toBeInTheDocument();
  expect(promo.getByText('ซื้อ 3 ชิ้นขึ้นไป ลด 10%')).toBeInTheDocument();
});

test('the Cart shows each discount, the next tier to reach, the Shipping Fee and the total the server priced', async () => {
  mockMember = customer;
  backend({
    lines: [
      { product_id: 'f1', name: 'Beetle jelly', quantity: 2, list_price: 100, unit_price: 95, discount_per_unit: 5, line_total: 190, promotion_id: 'pr1' },
      { product_id: 'l1', name: 'Rotten log', quantity: 1, list_price: 300, unit_price: 300, discount_per_unit: 0, line_total: 300, promotion_id: null },
    ],
    gifts: [],
    promotions_applied: [{ id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: 'Rainy season sale', units: 2, discount_total: 10 }],
    next_tiers: [{ promotion_id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: 'Rainy season sale', units_needed: 1, tier: { min_units: 3, type: 'percent', value: 10 } }],
    limited: [{ promotion_id: 'pr2', name_th: 'ขอนคุ้ม', name_en: null, reason: 'per_customer' }],
    redeem: ['pr1'],
    paid_units: 3, items_subtotal: 500, discount_total: 10, item_total: 490, shipping_fee: 50, total: 540,
  });
  renderApp('/', {
    cart: [
      { product_id: 'f1', name: 'Beetle jelly', name_th: 'เยลลี่ด้วง', price: 100, image: '', quantity: 2 },
      { product_id: 'l1', name: 'Rotten log', name_th: 'ขอนผุ', price: 300, image: '', quantity: 1 },
    ],
  });
  userEvent.click((await screen.findAllByRole('button', { name: /ตะกร้า/ }))[0]);
  const cart = within(await screen.findByRole('dialog', { name: /ตะกร้า/ }));

  expect(await cart.findByText('ลดรับหน้าฝน · ลด ฿5/ชิ้น')).toBeInTheDocument();
  expect(cart.getByText('เพิ่มอีก 1 ชิ้น รับส่วนลด 10% (ลดรับหน้าฝน)')).toBeInTheDocument();
  expect(cart.getByText('ใช้สิทธิ์โปรโมชัน ขอนคุ้ม ครบแล้ว จึงคิดราคาปกติ')).toBeInTheDocument();
  const totals = within(cart.getByRole('definition', { name: 'ส่วนลดโปรโมชัน' }).closest('dl') as HTMLElement);
  expect(totals.getByRole('definition', { name: 'ส่วนลดโปรโมชัน' })).toHaveTextContent('−฿10');
  expect(totals.getByRole('definition', { name: 'ค่าจัดส่ง' })).toHaveTextContent('฿50');
  expect(totals.getByRole('definition', { name: 'รวมทั้งหมด' })).toHaveTextContent('฿540');
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/orders/price-preview', {
      items: [
        { product_id: 'f1', quantity: 2 },
        { product_id: 'l1', quantity: 1 },
      ],
    })
  );
});

const gifted = (gift: Record<string, unknown>) => ({
  lines: [{ product_id: 'f1', name: 'Beetle jelly', quantity: 2, list_price: 100, unit_price: 100, discount_per_unit: 0, line_total: 200, promotion_id: 'g1' }],
  gifts: [
    {
      promotion_id: 'g1', name_th: 'ซื้อ 2 แถม 1', name_en: null, product_id: 's1', name: 'Sticker', name_th_product: 'สติกเกอร์', quantity: 1, out_of_stock: false,
      options: [
        { product_id: 's1', name: 'Sticker', name_th: 'สติกเกอร์', available: 5 },
        { product_id: 's2', name: 'Spoon', name_th: 'ช้อนป้อนเยลลี่', available: 5 },
      ],
      ...gift,
    },
  ],
  promotions_applied: [{ id: 'g1', name_th: 'ซื้อ 2 แถม 1', name_en: null, units: 2, discount_total: 0 }],
  next_tiers: [], next_gifts: [], limited: [], redeem: ['g1'],
  paid_units: 2, items_subtotal: 200, discount_total: 0, item_total: 200, shipping_fee: 0, total: 200,
});

test('the Cart shows the Gift earned and lets the Customer pick which one; the pick is priced by the server', async () => {
  mockMember = customer;
  backend(gifted({}));
  renderApp('/', { cart: [{ product_id: 'f1', name: 'Beetle jelly', name_th: 'เยลลี่ด้วง', price: 100, image: '', quantity: 2 }] });
  userEvent.click((await screen.findAllByRole('button', { name: /ตะกร้า/ }))[0]);
  const cart = within(await screen.findByRole('dialog', { name: /ตะกร้า/ }));

  expect(await cart.findByText('ของแถม · ซื้อ 2 แถม 1')).toBeInTheDocument();
  const pick = cart.getByRole('combobox', { name: 'เลือกของแถม (ซื้อ 2 แถม 1)' });
  expect(pick).toHaveValue('s1');
  expect(cart.getByText('×1 ฟรี')).toBeInTheDocument();
  userEvent.selectOptions(pick, 's2');
  await waitFor(() =>
    expect(api.post).toHaveBeenLastCalledWith('/orders/price-preview', { items: [{ product_id: 'f1', quantity: 2 }], gift_choices: { g1: 's2' } })
  );
});

test('a Gift with nothing Available says so and the Cart can still check out', async () => {
  mockMember = customer;
  backend(gifted({ product_id: null, name: null, name_th_product: null, quantity: 0, out_of_stock: true }));
  renderApp('/', { cart: [{ product_id: 'f1', name: 'Beetle jelly', name_th: 'เยลลี่ด้วง', price: 100, image: '', quantity: 2 }] });
  userEvent.click((await screen.findAllByRole('button', { name: /ตะกร้า/ }))[0]);
  const cart = within(await screen.findByRole('dialog', { name: /ตะกร้า/ }));
  expect(await cart.findByText('ของแถมหมด')).toBeInTheDocument();
  expect(cart.getByRole('link', { name: 'ชำระเงิน' })).toBeInTheDocument();
});
