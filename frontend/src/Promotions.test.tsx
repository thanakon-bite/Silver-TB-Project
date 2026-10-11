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

test('product cards in a Promotion carry a short badge from its first tier, asked for once the session is known', async () => {
  renderApp('/');
  const jellyCard = (await screen.findByRole('button', { name: 'เยลลี่ด้วง' })).closest('article') as HTMLElement;
  expect(await within(jellyCard).findByText('ลด 5%')).toBeInTheDocument();
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

test('a ?promotion= link shows only that Promotion\'s products, and the clear button shows them all again', async () => {
  renderApp('/?promotion=pr2');
  expect(await screen.findByRole('status')).toHaveTextContent('สินค้าในโปรโมชัน ขอนคุ้ม');
  expect(await screen.findByRole('button', { name: 'ขอนผุ' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'เยลลี่ด้วง' })).not.toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: 'ดูสินค้าทั้งหมด' }));
  expect(await screen.findByRole('button', { name: 'เยลลี่ด้วง' })).toBeInTheDocument();
  expect(screen.queryByText('สินค้าในโปรโมชัน ขอนคุ้ม')).not.toBeInTheDocument();
});

test('a ?promotion= link to a Promotion that covers every product filters nothing out', async () => {
  (api.get as jest.Mock).mockImplementation((path: string) => {
    if (path === '/products?limit=100') return Promise.resolve({ products: [jelly, bark, log] });
    if (path === '/rules/promotions') return Promise.resolve([{ ...rainy, id: 'all', name_th: 'ลดทั้งร้าน', applies_to_all: true, product_ids: [] }]);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  renderApp('/?promotion=all');
  expect(await screen.findByRole('status')).toHaveTextContent('สินค้าในโปรโมชัน ลดทั้งร้าน');
  expect(screen.getByRole('button', { name: 'เยลลี่ด้วง' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ขอนผุ' })).toBeInTheDocument();
});

test('a card covered by several Promotions shows its Best Promotion, not the first one listed', async () => {
  const small = { ...rainy, id: 'small', name_th: 'ลดนิด', product_ids: ['f1'], discount_tiers: [{ min_units: 1, type: 'percent', value: 2 }] };
  const gift = { ...rainy, id: 'gift', name_th: 'แถมเปลือก', product_ids: ['f1'], discount_tiers: [], gift_every: 1, gift_quantity: 1, gift_prices: [200] };
  (api.get as jest.Mock).mockImplementation((path: string) => {
    if (path === '/products?limit=100') return Promise.resolve({ products: [jelly] });
    if (path === '/rules/promotions') return Promise.resolve([small, gift]);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  renderApp('/');
  const card = (await screen.findByRole('button', { name: 'เยลลี่ด้วง' })).closest('article') as HTMLElement;
  expect(await within(card).findByText('ซื้อ 1 แถม 1')).toBeInTheDocument();
  expect(within(card).queryByText('ลด 2%')).not.toBeInTheDocument();
});

describe('choosing a Promotion on the product page', () => {
  const jellyDeals = [
    { ...rainy, id: 'ex1', name_th: 'ลดตรง', product_ids: ['f1'], stacking: 'exclusive', discount_tiers: [{ min_units: 1, type: 'percent', value: 5 }] },
    { ...rainy, id: 'gift', name_th: 'ซื้อ 3 แถม 1', product_ids: ['f1'], stacking: 'exclusive', discount_tiers: [], gift_every: 3, gift_quantity: 1, gift_prices: [50] },
    { ...rainy, id: 'st1', name_th: 'ลดสมาชิก', product_ids: ['f1'], stacking: 'stackable', discount_tiers: [{ min_units: 2, type: 'baht', value: 10 }] },
    { ...rainy, id: 'st2', name_th: 'ลดหน้าฝน', product_ids: ['f1'], stacking: 'stackable', discount_tiers: [{ min_units: 2, type: 'percent', value: 3 }] },
  ];
  beforeEach(() => {
    (api.get as jest.Mock).mockImplementation((path: string) => {
      if (path === '/products?limit=100') return Promise.resolve({ products: [jelly, log] });
      if (path === '/rules/promotions') return Promise.resolve([...jellyDeals, logDeal]);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
  });

  test('one card per option, the best picked first; the pick is kept for the Cart', async () => {
    renderApp('/');
    userEvent.click(await screen.findByRole('button', { name: 'เยลลี่ด้วง' }));
    const picker = within(await screen.findByRole('group', { name: 'เลือกโปรโมชันที่ต้องการ' }));
    const radios = picker.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(['ลดตรง', 'ซื้อ 3 แถม 1', 'ใช้ร่วมกัน: ลดสมาชิก + ลดหน้าฝน']);
    // Each card says what it gives
    expect(picker.getByText('ซื้อครบทุก 3 ชิ้น แถม 1 ชิ้น')).toBeInTheDocument();
    expect(picker.getByText('ใช้ร่วมกันได้')).toBeInTheDocument();
    // 5% on one unit is the Best Promotion
    expect(picker.getByRole('radio', { name: 'ลดตรง' })).toBeChecked();

    userEvent.click(picker.getByRole('radio', { name: 'ใช้ร่วมกัน: ลดสมาชิก + ลดหน้าฝน' }));
    expect(picker.getByRole('radio', { name: 'ใช้ร่วมกัน: ลดสมาชิก + ลดหน้าฝน' })).toBeChecked();
    expect(JSON.parse(localStorage.getItem('stb_line_choices') || '{}')).toEqual({ f1: 'stack' });
  });

  test('a product with a single Promotion shows it as a card with nothing to pick', async () => {
    renderApp('/');
    userEvent.click(await screen.findByRole('button', { name: 'ขอนผุ' }));
    const promo = within(await screen.findByRole('region', { name: 'โปรโมชัน' }));
    expect(promo.getByText('ขอนคุ้ม')).toBeInTheDocument();
    expect(promo.queryByRole('radio')).not.toBeInTheDocument();
  });
});

test('a Promotion picked on the product page is what the Cart prices with', async () => {
  mockMember = customer;
  localStorage.setItem('stb_line_choices', JSON.stringify({ f1: 'pr1' }));
  backend({
    lines: [{ product_id: 'f1', name: 'Beetle jelly', quantity: 1, list_price: 100, unit_price: 95, discount_per_unit: 5, line_total: 95, promotion_id: 'pr1' }],
    gifts: [], promotions_applied: [{ id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: null, units: 1, discount_total: 5 }],
    paid_units: 1, items_subtotal: 100, discount_total: 5, item_total: 95, shipping_fee: 0, total: 95,
  });
  renderApp('/', { cart: [{ product_id: 'f1', name: 'Beetle jelly', name_th: 'เยลลี่ด้วง', price: 100, image: '', quantity: 1 }] });
  userEvent.click((await screen.findAllByRole('button', { name: /ตะกร้า/ }))[0]);
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/orders/price-preview', { items: [{ product_id: 'f1', quantity: 1 }], promotion_choices: { f1: 'pr1' } })
  );
});
