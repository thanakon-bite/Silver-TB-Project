import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import Checkout from './Checkout';
import Cart from './Cart';
import { renderPage } from '../test/renderPage';
import { useCart } from '../contexts/CartContext';
import { api, ApiError } from '../lib/api';

jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'test-token' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

jest.mock('../lib/api', () => {
  const actual = jest.requireActual('../lib/api');
  return { ...actual, api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});

const customer = { id: 'u1', email: 'mali@example.com', full_name: 'มาลี ใจดี', phone: '', role: 'user' };
const atlas = { product_id: 'p1', name: 'Chalcosoma atlas', price: 3200, image: 'https://img.example/atlas.jpg', quantity: 1 };

const home = {
  id: 'a1', label: null, recipient_name: 'มาลี ใจดี', phone: '0812345678', address_line: '99/1 ถนนทดสอบ',
  subdistrict_id: 160401, subdistrict: 'ลำนารายณ์', district_id: 1604, district: 'ชัยบาดาล',
  province_id: 7, province: 'ลพบุรี', postal_code: '15130', is_default: true,
};

/** A Pending Order as the backend returns it after reserving stock. */
const pendingOrder = (expiresInMs: number) => ({
  id: 'o1', order_number: 'STB-261010-00007', status: 'awaiting_payment',
  subtotal: 3200, shipping_fee: 0, total: 3200, currency: 'thb',
  shipping_address: { ...home }, expires_at: new Date(Date.now() + expiresInMs).toISOString(),
  order_items: [{ id: 'i1', product_id: 'p1', product_name: 'Chalcosoma atlas', quantity: 1, unit_price: 3200, line_total: 3200 }],
});

/** The backend as the Checkout sees it: a Customer with no Saved Addresses and free shipping. */
function backend(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    '/auth/me': customer,
    '/addresses': [],
    '/geo/provinces': [],
    ...overrides,
  };
  (api.get as jest.Mock).mockImplementation((path: string) =>
    path in responses ? Promise.resolve(responses[path]) : Promise.reject(new Error(`unexpected GET ${path}`))
  );
}

/** POST /orders/price-preview as the server prices the Cart: free shipping unless a test says otherwise. */
const preview = (overrides: Record<string, unknown> = {}) => ({
  lines: [], gifts: [], paid_units: 1, items_subtotal: 3200, discount_total: 0, item_total: 3200, shipping_fee: 0, total: 3200,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  backend();
  (api.post as jest.Mock).mockImplementation((path: string) =>
    path === '/orders/price-preview' ? Promise.resolve(preview()) : Promise.reject(new Error(`unexpected POST ${path}`))
  );
});

test('the gift the Customer picked in the Cart goes with the preview and the order, and shows as free', async () => {
  localStorage.setItem('stb_gift_choices', JSON.stringify({ g1: 's2' }));
  (api.post as jest.Mock).mockImplementation((path: string) =>
    path === '/orders/price-preview'
      ? Promise.resolve(
          preview({
            gifts: [{ promotion_id: 'g1', name_th: 'ซื้อ 1 แถม 1', name_en: null, product_id: 's2', name: 'Spoon', name_th_product: 'ช้อน', quantity: 1, out_of_stock: false, options: [] }],
          })
        )
      : Promise.reject(new Error('stop here'))
  );
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas] });

  const summary = within(await screen.findByRole('region', { name: 'สรุปคำสั่งซื้อ' }));
  expect(await summary.findByText('ช้อน (ของแถม)')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/orders/price-preview', { items: [{ product_id: 'p1', quantity: 1 }], gift_choices: { g1: 's2' } });
  localStorage.removeItem('stb_gift_choices');
});

test('the summary shows the Promotion discount the server priced', async () => {
  (api.post as jest.Mock).mockImplementation((path: string) =>
    path === '/orders/price-preview'
      ? Promise.resolve(preview({ items_subtotal: 3200, discount_total: 320, item_total: 2880, total: 2880 }))
      : Promise.reject(new Error('unexpected'))
  );
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas] });

  const summary = within(await screen.findByRole('region', { name: 'สรุปคำสั่งซื้อ' }));
  expect(await summary.findByText('ส่วนลดโปรโมชัน')).toBeInTheDocument();
  expect(summary.getByText('−฿320')).toBeInTheDocument();
  expect(summary.getAllByText('฿2,880').length).toBeGreaterThan(0);
});

test('the summary before ordering shows the Shipping Fee and total the server priced', async () => {
  (api.post as jest.Mock).mockImplementation((path: string) =>
    path === '/orders/price-preview' ? Promise.resolve(preview({ shipping_fee: 50, total: 3250 })) : Promise.reject(new Error('unexpected'))
  );
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas] });

  const summary = within(await screen.findByRole('region', { name: 'สรุปคำสั่งซื้อ' }));
  await waitFor(() => expect(summary.getAllByRole('definition')[0]).toHaveTextContent('฿50'));
  expect(summary.getAllByText('฿3,250').length).toBeGreaterThan(0);
  expect(api.post).toHaveBeenCalledWith('/orders/price-preview', { items: [{ product_id: 'p1', quantity: 1 }] });
});

test('the order summary shows the Shipping Fee as free when it is zero', async () => {
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas] });

  // The summary's terms are the Shipping Fee, then the total.
  const [shippingFee] = within(await screen.findByRole('region', { name: 'สรุปคำสั่งซื้อ' })).getAllByRole('definition');
  await waitFor(() => expect(shippingFee).toHaveTextContent('ฟรี'));
});

test('a field error disappears as soon as the customer fixes that field', async () => {
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas] });

  userEvent.click(await screen.findByRole('button', { name: 'ดำเนินการชำระเงิน' }));
  expect(await screen.findByText('กรุณากรอกเบอร์โทรไทย เช่น 0812345678')).toBeInTheDocument();

  userEvent.type(screen.getByLabelText('เบอร์โทร'), '0812345678');

  expect(screen.queryByText('กรุณากรอกเบอร์โทรไทย เช่น 0812345678')).not.toBeInTheDocument();
  expect(screen.getByText('กรุณากรอกบ้านเลขที่และถนน')).toBeInTheDocument();
});

test('a failed order is explained in Thai next to the button, not in a popup', async () => {
  backend({ '/addresses': [home] });
  (api.post as jest.Mock).mockRejectedValue(new ApiError('Not enough stock for Chalcosoma atlas.', 409, 'INSUFFICIENT_STOCK'));
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas] });

  userEvent.click(await screen.findByRole('button', { name: 'ดำเนินการชำระเงิน' }));

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('สร้างคำสั่งซื้อไม่สำเร็จ');
  expect(alert).toHaveTextContent('สินค้าบางรายการในตะกร้ามีไม่พอ');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('when the Reservation runs out the customer is back on the address step with a notice', async () => {
  backend({ '/addresses': [home] });
  (api.post as jest.Mock).mockResolvedValue(pendingOrder(-1000));
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas] });

  userEvent.click(await screen.findByRole('button', { name: 'ดำเนินการชำระเงิน' }));

  const notice = await screen.findByRole('status');
  expect(notice).toHaveTextContent('หมดเวลาการจอง');
  expect(screen.getByRole('button', { name: 'ดำเนินการชำระเงิน' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('"edit cart" goes back to the previous page with the Cart drawer open', async () => {
  renderPage(<Checkout />, {
    path: '/checkout',
    cart: [atlas],
    history: ['/products'],
    routes: <Route path="/products" element={<p>หน้าร้านค้า</p>} />,
    outside: <Cart />,
  });

  userEvent.click(await screen.findByRole('button', { name: /แก้ไขตะกร้า/ }));

  expect(await screen.findByText('หน้าร้านค้า')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'ตะกร้าสินค้า' })).toBeInTheDocument();
});

test('the order summary shows each product in the Cart with its picture, quantity and price', async () => {
  const hercules = { product_id: 'p2', name: 'Dynastes hercules', price: 4500, image: 'https://img.example/hercules.jpg', quantity: 2 };
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas, hercules] });

  const summary = await screen.findByRole('region', { name: 'สรุปคำสั่งซื้อ' });
  expect(within(summary).getByRole('img', { name: 'Chalcosoma atlas' })).toHaveAttribute('src', atlas.image);
  expect(within(summary).getByRole('img', { name: 'Dynastes hercules' })).toHaveAttribute('src', hercules.image);
  expect(within(summary).getByText('฿9,000')).toBeInTheDocument();
  expect(within(summary).getByText('×2')).toBeInTheDocument();
  expect(within(summary).getAllByRole('definition')[1]).toHaveTextContent('฿12,200');
});

test('on small screens the summary folds into a bar that shows the total and opens on tap', async () => {
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas] });

  const toggle = await screen.findByRole('button', { name: /แสดงสรุปคำสั่งซื้อ/ });
  expect(toggle).toHaveTextContent('฿3,200');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');

  userEvent.click(toggle);

  expect(screen.getByRole('button', { name: /ซ่อนสรุปคำสั่งซื้อ/ })).toHaveAttribute('aria-expanded', 'true');
});

test('paying opens the Stripe page for this Order', async () => {
  const assign = jest.fn();
  const realLocation = window.location;
  Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, assign } });
  backend({ '/addresses': [home] });
  (api.post as jest.Mock).mockImplementation((path: string) =>
    path === '/orders' ? Promise.resolve(pendingOrder(30 * 60 * 1000)) : Promise.resolve({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
  );
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas] });

  userEvent.click(await screen.findByRole('button', { name: 'ดำเนินการชำระเงิน' }));
  userEvent.click(await screen.findByRole('button', { name: 'ชำระ ฿3,200' }));

  await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1'));
  expect(api.post).toHaveBeenCalledWith('/payments/checkout-session', { order_id: 'o1' });
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
});

test('a reason the shop has no Thai wording for is shown as the server sent it', async () => {
  backend({ '/addresses': [home] });
  (api.post as jest.Mock).mockRejectedValue(new ApiError('Something unusual happened.', 409, 'SOMETHING_NEW'));
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas] });

  userEvent.click(await screen.findByRole('button', { name: 'ดำเนินการชำระเงิน' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Something unusual happened.');
});

/** What the shop's cart badge would read: the number of products in the Cart. */
const CartCount = () => <p data-testid="cart-count">{useCart().items.length}</p>;

test('the Cart empties as soon as the Order is created; the customer pays from the Order', async () => {
  backend({ '/addresses': [home] });
  (api.post as jest.Mock).mockImplementation((path: string) =>
    path === '/orders/price-preview' ? Promise.resolve(preview()) : Promise.resolve(pendingOrder(15 * 60 * 1000))
  );
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas], outside: <CartCount /> });
  await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('1'));

  userEvent.click(await screen.findByRole('button', { name: 'ดำเนินการชำระเงิน' }));

  await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('0'));
  expect(screen.getAllByText('Chalcosoma atlas').length).toBeGreaterThan(0);
});

test('a failed Order leaves the Cart as it was', async () => {
  backend({ '/addresses': [home] });
  (api.post as jest.Mock).mockImplementation((path: string) =>
    path === '/orders/price-preview' ? Promise.resolve(preview()) : Promise.reject(new ApiError('Not enough stock', 409, 'INSUFFICIENT_STOCK'))
  );
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas], outside: <CartCount /> });

  userEvent.click(await screen.findByRole('button', { name: 'ดำเนินการชำระเงิน' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('สร้างคำสั่งซื้อไม่สำเร็จ');
  expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
});

test('an Order whose Reservation runs out on the payment step puts its products back in the Cart', async () => {
  backend({ '/addresses': [home] });
  (api.post as jest.Mock).mockImplementation((path: string) =>
    path === '/orders/price-preview' ? Promise.resolve(preview()) : Promise.resolve(pendingOrder(-1000))
  );
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas], outside: <CartCount /> });

  userEvent.click(await screen.findByRole('button', { name: 'ดำเนินการชำระเงิน' }));

  expect(await screen.findByRole('status')).toHaveTextContent('หมดเวลาการจอง');
  expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
});

test('the Promotion option picked in the Cart goes with the preview and the order; picks for other products stay behind', async () => {
  localStorage.setItem('stb_line_choices', JSON.stringify({ p1: 'stack', gone: 'stack' }));
  backend({ '/addresses': [home] });
  (api.post as jest.Mock).mockImplementation((path: string) =>
    path === '/orders/price-preview' ? Promise.resolve(preview()) : Promise.reject(new ApiError('stop here', 409, 'SOMETHING_NEW'))
  );
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas] });

  userEvent.click(await screen.findByRole('button', { name: 'ดำเนินการชำระเงิน' }));
  await screen.findByRole('alert');
  expect(api.post).toHaveBeenCalledWith('/orders/price-preview', { items: [{ product_id: 'p1', quantity: 1 }], promotion_choices: { p1: 'stack' } });
  expect(api.post).toHaveBeenCalledWith('/orders', expect.objectContaining({ items: [{ product_id: 'p1', quantity: 1 }], promotion_choices: { p1: 'stack' } }));
  localStorage.removeItem('stb_line_choices');
});
