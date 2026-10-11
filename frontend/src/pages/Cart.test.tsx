import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderPage';
import { api } from '../lib/api';

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

describe('a line with more than one Promotion option', () => {
  const PR_GIFT = '11111111-1111-4111-8111-111111111111';
  const options = [
    { key: PR_GIFT, kind: 'exclusive', promotions: [{ id: PR_GIFT, name_th: 'ซื้อ 1 แถมเปลือก', name_en: null }], saving: 120 },
    { key: 'stack', kind: 'stack', promotions: [{ id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: null }, { id: 'pr2', name_th: 'ลดสมาชิก', name_en: null }], saving: 45 },
  ];
  /** The server prices with the stack unless the Customer picked the Gift. */
  const priced = (body: { promotion_choices?: Record<string, string> }) => {
    const gift = body.promotion_choices?.f1 === PR_GIFT;
    return {
      ...preview(3),
      lines: [{
        product_id: 'f1', name: 'Beetle jelly', quantity: 3, list_price: 100, unit_price: gift ? 100 : 85, discount_per_unit: gift ? 0 : 15,
        line_total: gift ? 300 : 255, promotion_id: gift ? PR_GIFT : 'pr1', promotion_ids: gift ? [PR_GIFT] : ['pr1', 'pr2'],
        option: gift ? PR_GIFT : 'stack', options, available: 9,
      }],
      promotions_applied: gift
        ? [{ id: PR_GIFT, name_th: 'ซื้อ 1 แถมเปลือก', name_en: null, units: 3, discount_total: 0 }]
        : [{ id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: null, units: 3, discount_total: 30 }, { id: 'pr2', name_th: 'ลดสมาชิก', name_en: null, units: 3, discount_total: 15 }],
    };
  };
  beforeEach(() => {
    (api.post as jest.Mock).mockImplementation((path: string, body: { promotion_choices?: Record<string, string> }) =>
      path === '/orders/price-preview' ? Promise.resolve(priced(body)) : Promise.reject(new Error(`unexpected POST ${path}`))
    );
  });

  test('shows a radio list with what each option saves, the best pre-selected; a pick is remembered and priced by the server', async () => {
    const cart = await openCart();
    const group = within(await cart.findByRole('group', { name: 'เลือกโปรโมชันของ เยลลี่ด้วง' }));
    const stack = group.getByRole('radio', { name: /ใช้ร่วมกัน: ลดรับหน้าฝน \+ ลดสมาชิก/ });
    const gift = group.getByRole('radio', { name: /ซื้อ 1 แถมเปลือก/ });
    expect(stack).toBeChecked();
    expect(group.getByText('ประหยัด ฿45')).toBeInTheDocument();
    expect(group.getByText('ประหยัด ฿120')).toBeInTheDocument();
    expect(cart.getByText('ลดรับหน้าฝน + ลดสมาชิก · ลด ฿15/ชิ้น')).toBeInTheDocument();

    userEvent.click(gift);
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith('/orders/price-preview', { items: [{ product_id: 'f1', quantity: 3 }], promotion_choices: { f1: PR_GIFT } })
    );
    await waitFor(() => expect(group.getByRole('radio', { name: /ซื้อ 1 แถมเปลือก/ })).toBeChecked());
    expect(JSON.parse(localStorage.getItem('stb_line_choices') || '{}')).toEqual({ f1: PR_GIFT });
  });

  test('a line with a single option shows no radio list', async () => {
    // The default backend prices one Promotion only
    backend();
    const cart = await openCart();
    await cart.findByRole('definition', { name: 'ราคาสินค้ารวม' });
    expect(cart.queryByRole('radio')).not.toBeInTheDocument();
  });
});
