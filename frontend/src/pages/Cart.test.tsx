import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderPage';
import { api } from '../lib/api';
import { promotionChoiceKey } from '../lib/promotionChoice';

jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'test-token' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      upsert: () => Promise.resolve({ error: null }),
    }),
  },
}));

jest.mock('../lib/api', () => {
  const actual = jest.requireActual('../lib/api');
  return { ...actual, api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() } };
});

jest.mock('sweetalert2', () => ({ __esModule: true, default: { fire: jest.fn(() => Promise.resolve({})) } }));
const Swal = jest.requireMock('sweetalert2').default;

const customer = { id: 'u1', email: 'mali@example.com', full_name: 'มาลี ใจดี', role: 'user' };
const jelly = { product_id: 'f1', name: 'Beetle jelly', name_th: 'เยลลี่ด้วง', price: 100, image: '', quantity: 3, max_quantity: 9 };

/** The server's price of the Cart; `available` is today's Available of the jelly. */
const preview = (quantity: number, available = 9) => ({
  lines: [{ product_id: 'f1', name: 'Beetle jelly', quantity, list_price: 100, unit_price: 95, discount_per_unit: 5, line_total: 95 * quantity, promotion_id: 'pr1', available }],
  gifts: [],
  promotions_applied: [{ id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: null, units: quantity, discount_total: 5 * quantity }],
  paid_units: quantity,
  items_subtotal: 100 * quantity,
  discount_total: 5 * quantity,
  item_total: 95 * quantity,
  shipping_fee: 50,
  total: 95 * quantity + 50,
});

function backend(available = 9) {
  (api.get as jest.Mock).mockImplementation((path: string) => {
    if (path === '/auth/me') return Promise.resolve(customer);
    if (path.startsWith('/products')) return Promise.resolve({ products: [] });
    if (path === '/rules/promotions') return Promise.resolve([]);
    if (path === '/notifications') return Promise.resolve({ notifications: [], unread: 0 });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  (api.post as jest.Mock).mockImplementation((path: string, body: { items: { quantity: number }[] }) =>
    path === '/orders/price-preview' ? Promise.resolve(preview(body.items[0].quantity, available)) : Promise.reject(new Error(`unexpected POST ${path}`))
  );
}

async function openCart(cart = [jelly]) {
  renderApp('/', { cart });
  userEvent.click((await screen.findAllByRole('button', { name: /ตะกร้า/ }))[0]);
  return within(await screen.findByRole('dialog', { name: /ตะกร้า/ }));
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  backend();
});

test('the summary reads items subtotal, then discount, Shipping Fee and total', async () => {
  const cart = await openCart();

  const subtotal = await cart.findByRole('definition', { name: 'ราคาสินค้ารวม' });
  expect(subtotal).toHaveTextContent('฿300');
  const terms = within(subtotal.closest('dl') as HTMLElement).getAllByRole('term').map((t) => t.textContent);
  expect(terms).toEqual(['ราคาสินค้ารวม', 'ส่วนลดโปรโมชัน', 'ค่าจัดส่ง', 'รวมทั้งหมด']);
});

test('removing a product asks first; keeping it leaves the Cart alone', async () => {
  const cart = await openCart();

  Swal.fire.mockResolvedValueOnce({ isConfirmed: false });
  userEvent.click(await cart.findByRole('button', { name: /ลบ.*เยลลี่ด้วง/ }));

  await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'ลบสินค้าออกจากตะกร้า?', confirmButtonText: 'ลบออก', cancelButtonText: 'เก็บไว้' })));
  expect(cart.getAllByText('เยลลี่ด้วง').length).toBeGreaterThan(0);
});

test('stepping down from one asks too, and confirming removes the product', async () => {
  const cart = await openCart([{ ...jelly, quantity: 1 }]);

  Swal.fire.mockResolvedValueOnce({ isConfirmed: true });
  userEvent.click(await cart.findByRole('button', { name: 'ลดจำนวน' }));

  expect(await cart.findByText('ตะกร้าของคุณว่างเปล่า')).toBeInTheDocument();
});

test('a quantity above today\'s Available is lowered to it, with a note, and cannot be raised again', async () => {
  // The Cart was filled when 9 were Available; only 2 are now.
  backend(2);
  const cart = await openCart();

  expect(await cart.findByText(/ปรับจำนวนในตะกร้าให้ไม่เกินจำนวนที่พร้อมขาย/)).toBeInTheDocument();
  await waitFor(() => expect(cart.getByRole('group', { name: /เยลลี่ด้วง/ })).toHaveTextContent('2'));
  expect(cart.getByRole('button', { name: 'เพิ่มจำนวน' })).toBeDisabled();
  expect(cart.getByText('ใส่ได้สูงสุด 2 ชิ้นตามจำนวนที่พร้อมขาย')).toBeInTheDocument();
});

describe("the Order's Promotion", () => {
  const PR_GIFT = '11111111-1111-4111-8111-111111111111';
  const promotion_options = [
    { key: PR_GIFT, kind: 'exclusive', promotions: [{ id: PR_GIFT, name_th: 'ซื้อ 1 แถมเปลือก', name_en: null }], saving: 120 },
    { key: 'stack', kind: 'stack', promotions: [{ id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: null }, { id: 'pr2', name_th: 'ลดสมาชิก', name_en: null }], saving: 45 },
  ];
  /** The server prices the whole Order with the stack unless the Customer picked the Gift Promotion. */
  const priced = (body: { promotion_choice?: string }) => {
    const gift = body.promotion_choice === PR_GIFT;
    return {
      ...preview(3),
      lines: [{
        product_id: 'f1', name: 'Beetle jelly', quantity: 3, list_price: 100, unit_price: gift ? 100 : 85, discount_per_unit: gift ? 0 : 15,
        line_total: gift ? 300 : 255, promotion_id: gift ? PR_GIFT : 'pr1', promotion_ids: gift ? [PR_GIFT] : ['pr1', 'pr2'], available: 9,
      }],
      promotion_option: gift ? PR_GIFT : 'stack',
      promotion_options,
      promotions_applied: gift
        ? [{ id: PR_GIFT, name_th: 'ซื้อ 1 แถมเปลือก', name_en: null, units: 3, discount_total: 0 }]
        : [{ id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: null, units: 3, discount_total: 30 }, { id: 'pr2', name_th: 'ลดสมาชิก', name_en: null, units: 3, discount_total: 15 }],
      // The hints are the picked option's only
      next_tiers: gift ? [] : [{ promotion_id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: null, units_needed: 2, tier: { min_units: 5, type: 'percent', value: 20 } }],
      next_gifts: gift ? [{ promotion_id: PR_GIFT, name_th: 'ซื้อ 1 แถมเปลือก', name_en: null, units_needed: 1, gift_quantity: 1 }] : [],
    };
  };
  beforeEach(() => {
    (api.post as jest.Mock).mockImplementation((path: string, body: { promotion_choice?: string }) =>
      path === '/orders/price-preview' ? Promise.resolve(priced(body)) : Promise.reject(new Error(`unexpected POST ${path}`))
    );
  });

  test('the Cart page shows one card per option with what it saves; one pick covers the whole Order', async () => {
    renderApp('/cart', { cart: [jelly] });
    expect(await screen.findByRole('heading', { level: 1, name: 'ตะกร้าสินค้า' })).toBeInTheDocument();
    const picker = within(await screen.findByRole('group', { name: 'โปรโมชันของออเดอร์นี้' }));
    expect(picker.getByText('เลือกได้ 1 แบบ ใช้กับทุกสินค้าในออเดอร์ สินค้าที่โปรนั้นไม่ครอบคลุมคิดราคาปกติ')).toBeInTheDocument();
    expect(picker.getByRole('radio', { name: /ใช้ร่วมกัน: ลดรับหน้าฝน \+ ลดสมาชิก/ })).toBeChecked();
    expect(picker.getByText('ประหยัด ฿45')).toBeInTheDocument();
    expect(picker.getByText('ประหยัด ฿120')).toBeInTheDocument();
    expect(screen.getByText('ลดรับหน้าฝน + ลดสมาชิก · ลด ฿15/ชิ้น')).toBeInTheDocument();
    expect(screen.getByText('เพิ่มอีก 2 ชิ้น รับส่วนลด 20% (ลดรับหน้าฝน)')).toBeInTheDocument();

    userEvent.click(picker.getByRole('radio', { name: /ซื้อ 1 แถมเปลือก/ }));
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith('/orders/price-preview', { items: [{ product_id: 'f1', quantity: 3 }], promotion_choice: PR_GIFT })
    );
    await waitFor(() => expect(picker.getByRole('radio', { name: /ซื้อ 1 แถมเปลือก/ })).toBeChecked());
    expect(localStorage.getItem(promotionChoiceKey('u1'))).toBe(JSON.stringify(PR_GIFT));
    // Only the picked Promotion's hint is left
    expect(await screen.findByText('เพิ่มอีก 1 ชิ้น รับของแถม 1 ชิ้น (ซื้อ 1 แถมเปลือก)')).toBeInTheDocument();
    expect(screen.queryByText(/รับส่วนลด 20%/)).not.toBeInTheDocument();
  });

  test('the drawer names the Order\'s Promotion and leads to the Cart page to change it', async () => {
    const cart = await openCart();
    expect(await cart.findByText('ใช้โปรโมชัน: ลดรับหน้าฝน + ลดสมาชิก')).toBeInTheDocument();
    expect(cart.queryByRole('radio')).not.toBeInTheDocument();
    expect(cart.getByRole('link', { name: 'เปลี่ยนโปรโมชัน' })).toHaveAttribute('href', '/cart');
    // The drawer stays the normal Cart; the expand icon opens the full page
    userEvent.click(cart.getByRole('link', { name: 'เปิดตะกร้าแบบเต็มหน้า' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'ตะกร้าสินค้า' })).toBeInTheDocument();
  });

  test("an option whose Gift has run out says so rather than 'not reached yet'", async () => {
    (api.post as jest.Mock).mockImplementation((path: string, body: { promotion_choice?: string }) =>
      path === '/orders/price-preview'
        ? Promise.resolve({ ...priced(body), promotion_options: [{ ...promotion_options[0], saving: 0, gift_out: true }, promotion_options[1]] })
        : Promise.reject(new Error(`unexpected POST ${path}`))
    );
    renderApp('/cart', { cart: [jelly] });
    const picker = within(await screen.findByRole('group', { name: 'โปรโมชันของออเดอร์นี้' }));
    expect(picker.getByText('ของแถมหมด')).toBeInTheDocument();
    expect(picker.queryByText('ยังไม่ถึงเงื่อนไข')).not.toBeInTheDocument();
  });

  test('with only one option there is nothing to pick on the Cart page', async () => {
    (api.post as jest.Mock).mockImplementation((path: string, body: { promotion_choice?: string }) =>
      path === '/orders/price-preview'
        ? Promise.resolve({ ...priced(body), promotion_options: promotion_options.slice(1) })
        : Promise.reject(new Error(`unexpected POST ${path}`))
    );
    renderApp('/cart', { cart: [jelly] });
    expect(await screen.findByText('ลดรับหน้าฝน + ลดสมาชิก · ลด ฿15/ชิ้น')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'โปรโมชันของออเดอร์นี้' })).not.toBeInTheDocument();
  });

  test('the pick belongs to the Cart: emptying it forgets the pick, and another account never sees it', async () => {
    localStorage.setItem(promotionChoiceKey('u1'), JSON.stringify(PR_GIFT));
    localStorage.setItem('stb_promotion_choice', JSON.stringify(PR_GIFT));
    renderApp('/cart', { cart: [] });
    expect(await screen.findByText('ตะกร้าของคุณว่างเปล่า')).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem(promotionChoiceKey('u1'))).toBeNull());
    expect(localStorage.getItem('stb_promotion_choice')).toBeNull();
    expect(localStorage.getItem(promotionChoiceKey('u2'))).toBeNull();
  });

  test('the Cart page shrinks back to the drawer over the page it was opened from', async () => {
    const cart = await openCart();
    userEvent.click(cart.getByRole('link', { name: 'เปิดตะกร้าแบบเต็มหน้า' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'ตะกร้าสินค้า' })).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'ย่อตะกร้า' }));
    expect(await screen.findByRole('dialog', { name: /ตะกร้า/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'ตะกร้าสินค้า' })).not.toBeInTheDocument();
  });

  test('opened directly, the Cart page shrinks to the drawer over the shop', async () => {
    renderApp('/cart', { cart: [jelly] });
    userEvent.click(await screen.findByRole('button', { name: 'ย่อตะกร้า' }));
    expect(await screen.findByRole('dialog', { name: /ตะกร้า/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'ตะกร้าสินค้า' })).not.toBeInTheDocument();
  });

  test('an empty Cart page says so', async () => {
    renderApp('/cart');
    expect(await screen.findByText('ตะกร้าของคุณว่างเปล่า')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'โปรโมชันของออเดอร์นี้' })).not.toBeInTheDocument();
  });
});
