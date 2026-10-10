import React from 'react';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderDetail from './OrderDetail';
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
const MINUTE = 60 * 1000;

/** An Order as GET /orders/:id returns it: Pending, unpaid, Reservation running for 20 more minutes. */
const anOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'o1', order_number: 'STB-261010-00007', user_id: 'u1', status: 'pending', payment_status: 'unpaid',
  subtotal: 3200, shipping_fee: 0, total: 3200, currency: 'thb',
  shipping_address: {
    recipient_name: 'มาลี ใจดี', phone: '0812345678', address_line: '99/1 ถนนทดสอบ',
    subdistrict: 'ลำนารายณ์', district: 'ชัยบาดาล', province_id: 7, province: 'ลพบุรี', postal_code: '15130',
  },
  order_items: [
    { id: 'i1', product_id: 'p1', product_name: 'Chalcosoma atlas', product_image: 'https://img.example/atlas.jpg', unit_price: 3200, quantity: 1, line_total: 3200 },
  ],
  stripe_payment_intent_id: null, expires_at: new Date(Date.now() + 20 * MINUTE).toISOString(),
  paid_at: null, shipped_at: null, delivered_at: null, cancelled_at: null, cancel_reason: null,
  carrier: null, tracking_number: null, created_at: '2026-10-10T07:30:00Z',
  ...overrides,
});

/** The backend as this page sees it: the signed-in Customer and their Order (or a failure). */
function backend(order: unknown) {
  (api.get as jest.Mock).mockImplementation((path: string) => {
    if (path === '/auth/me') return Promise.resolve(customer);
    if (path === '/orders/o1') return order instanceof Error ? Promise.reject(order) : Promise.resolve(order);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

const atlas = { product_id: 'p1', name: 'Chalcosoma atlas', price: 3200, image: 'https://img.example/atlas.jpg', quantity: 1 };

/** What the shop's cart badge would read: the number of products in the Cart. */
const CartCount = () => <p data-testid="cart-count">{useCart().items.length}</p>;

const visit = (url = '/orders/o1', cart: typeof atlas[] = []) =>
  renderPage(<OrderDetail />, { path: '/orders/:id', url, cart, outside: <CartCount /> });

beforeEach(() => {
  jest.clearAllMocks();
});

test('an order still awaiting payment says so in Thai and offers the pay button straight away', async () => {
  backend(anOrder());
  visit();

  expect(await screen.findByRole('heading', { level: 1, name: 'รอชำระเงิน' })).toBeInTheDocument();
  expect(screen.getByText(/STB-261010-00007/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ชำระ ฿3,200' })).toBeInTheDocument();
});

test('an order that cannot be loaded is explained in Thai with a way back to the order list', async () => {
  backend(new ApiError('Order not found', 404, 'NOT_FOUND'));
  visit();

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('เปิดคำสั่งซื้อนี้ไม่ได้');
  expect(within(alert).getByRole('link', { name: 'คำสั่งซื้อของฉัน' })).toHaveAttribute('href', '/orders');
});

test('a shipped order shows its journey and the Tracking Number', async () => {
  backend(
    anOrder({
      status: 'shipped', payment_status: 'paid', expires_at: null,
      paid_at: '2026-10-10T07:35:00Z', shipped_at: '2026-10-11T03:00:00Z', carrier: 'Kerry Express', tracking_number: 'KEX123456789TH',
    })
  );
  visit();

  const journey = await screen.findByRole('list', { name: 'สถานะการจัดส่ง' });
  expect(within(journey).getByText('จัดส่งแล้ว')).toBeInTheDocument();
  expect(within(journey).getByText('KEX123456789TH')).toBeInTheDocument();
  expect(within(journey).queryByText('ได้รับสินค้าแล้ว')).not.toBeInTheDocument();
});

test('cancelling is confirmed on the page: keeping the order changes nothing, confirming cancels it', async () => {
  backend(anOrder());
  (api.post as jest.Mock).mockResolvedValue(anOrder({ status: 'cancelled', cancelled_at: '2026-10-10T07:40:00Z' }));
  visit();

  userEvent.click(await screen.findByRole('button', { name: 'ยกเลิกคำสั่งซื้อ' }));
  const keep = screen.getByRole('button', { name: 'เก็บไว้' });
  expect(keep).toHaveFocus();
  userEvent.click(keep);
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { level: 1, name: 'รอชำระเงิน' })).toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: 'ยกเลิกคำสั่งซื้อ' }));
  userEvent.click(screen.getByRole('button', { name: 'ยืนยันยกเลิก' }));

  expect(await screen.findByRole('heading', { level: 1, name: 'ยกเลิกแล้ว' })).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/orders/o1/cancel', {});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('a refused cancellation is explained in Thai on the page, not in a popup', async () => {
  backend(anOrder());
  (api.post as jest.Mock).mockRejectedValue(new ApiError('Only unpaid orders can be cancelled.', 409, 'ORDER_NOT_CANCELLABLE'));
  visit();

  userEvent.click(await screen.findByRole('button', { name: 'ยกเลิกคำสั่งซื้อ' }));
  userEvent.click(screen.getByRole('button', { name: 'ยืนยันยกเลิก' }));

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('ยกเลิกได้เฉพาะคำสั่งซื้อที่ยังไม่ได้ชำระ');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('back from Stripe with the payment already confirmed: the order reads paid and the Cart is emptied', async () => {
  backend(anOrder({ status: 'paid', payment_status: 'paid', paid_at: '2026-10-10T07:35:00Z' }));
  visit('/orders/o1?paid=1', [atlas]);

  expect(await screen.findByRole('heading', { level: 1, name: 'ชำระแล้ว' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('0'));
});

test('opening a paid order later leaves the current Cart alone', async () => {
  backend(anOrder({ status: 'paid', payment_status: 'paid', paid_at: '2026-10-10T07:35:00Z' }));
  visit('/orders/o1', [atlas]);

  expect(await screen.findByRole('heading', { level: 1, name: 'ชำระแล้ว' })).toBeInTheDocument();
  expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
});

test('back from Stripe before the webhook: the page waits, then reads paid and empties the Cart', async () => {
  jest.useFakeTimers();
  try {
    const paid = anOrder({ status: 'paid', payment_status: 'paid', paid_at: '2026-10-10T07:35:00Z' });
    let calls = 0;
    (api.get as jest.Mock).mockImplementation((path: string) => {
      if (path === '/auth/me') return Promise.resolve(customer);
      calls += 1;
      return Promise.resolve(calls === 1 ? anOrder() : paid);
    });
    visit('/orders/o1?paid=1', [atlas]);

    expect(await screen.findByText(/กำลังยืนยันการชำระเงิน/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ชำระ ฿/ })).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'ชำระแล้ว' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('ขอบคุณที่สั่งซื้อ');
    expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
  } finally {
    jest.useRealTimers();
  }
});

test('a Pending order whose Reservation has run out says it will be cancelled and offers no payment', async () => {
  backend(anOrder({ expires_at: new Date(Date.now() - MINUTE).toISOString() }));
  visit();

  expect(await screen.findByRole('heading', { level: 1, name: 'รอชำระเงิน' })).toBeInTheDocument();
  const notice = screen.getByRole('status');
  expect(notice).toHaveTextContent('หมดเวลาชำระ');
  expect(within(notice).getByRole('link', { name: 'เลือกสินค้าต่อ' })).toHaveAttribute('href', '/products');
  expect(screen.queryByRole('button', { name: /ชำระ ฿/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'ยกเลิกคำสั่งซื้อ' })).not.toBeInTheDocument();
});
