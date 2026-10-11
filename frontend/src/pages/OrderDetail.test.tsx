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

/** An Order as GET /orders/:id returns it: Awaiting Payment, Reservation running for 20 more minutes. */
const anOrder = (overrides: Record<string, unknown> = {}) => {
  const o = anOrderFields(overrides);
  // What the API says the owner may do (backend lib/orderStatus.js orderActions)
  return { actions: { customer: { cancel: o.status === 'awaiting_payment', confirm: o.status === 'shipping' }, admin: null }, ...o };
};

const anOrderFields = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'o1', order_number: 'STB-261010-00007', user_id: 'u1', status: 'awaiting_payment',
  subtotal: 3200, shipping_fee: 0, total: 3200, currency: 'thb',
  shipping_address: {
    recipient_name: 'มาลี ใจดี', phone: '0812345678', address_line: '99/1 ถนนทดสอบ',
    subdistrict: 'ลำนารายณ์', district: 'ชัยบาดาล', province_id: 7, province: 'ลพบุรี', postal_code: '15130',
  },
  order_items: [
    { id: 'i1', product_id: 'p1', product_name: 'Chalcosoma atlas', product_image: 'https://img.example/atlas.jpg', unit_price: 3200, quantity: 1, line_total: 3200 },
  ],
  stripe_payment_intent_id: null, expires_at: new Date(Date.now() + 20 * MINUTE).toISOString(),
  paid_at: null, shipped_at: null, confirmed_at: null, confirmed_by: null, refunded_at: null, payment_failed_at: null, cancelled_at: null, cancel_reason: null,
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

test('a Shipping order reads จัดส่งแล้ว and shows its journey and the Tracking Number', async () => {
  backend(
    anOrder({
      status: 'shipping', expires_at: null,
      paid_at: '2026-10-10T07:35:00Z', shipped_at: '2026-10-11T03:00:00Z', carrier: 'Kerry Express', tracking_number: 'KEX123456789TH',
    })
  );
  visit();

  expect(await screen.findByRole('heading', { level: 1, name: 'จัดส่งแล้ว' })).toBeInTheDocument();
  const journey = screen.getByRole('list', { name: 'ความคืบหน้าคำสั่งซื้อ' });
  expect(within(journey).getByText('สั่งซื้อ')).toBeInTheDocument();
  expect(within(journey).getByText('จัดส่งแล้ว')).toBeInTheDocument();
  expect(within(journey).getByText('KEX123456789TH')).toBeInTheDocument();
});

const shipping = {
  status: 'shipping', expires_at: null, paid_at: '2026-10-10T07:35:00Z', shipped_at: '2026-10-11T03:00:00Z',
  carrier: 'Kerry Express', tracking_number: 'KEX123456789TH',
};

test('the customer confirms a Shipping order as received', async () => {
  backend(anOrder(shipping));
  (api.post as jest.Mock).mockResolvedValue(
    anOrder({ ...shipping, status: 'confirmed', confirmed_at: '2026-10-12T05:00:00Z', confirmed_by: 'customer' })
  );
  visit();

  userEvent.click(await screen.findByRole('button', { name: 'ได้รับสินค้าแล้ว' }));

  expect(await screen.findByRole('heading', { level: 1, name: 'ได้รับสินค้าแล้ว' })).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/orders/o1/confirm', {});
  expect(screen.queryByRole('button', { name: 'ได้รับสินค้าแล้ว' })).not.toBeInTheDocument();
  const journey = screen.getByRole('list', { name: 'ความคืบหน้าคำสั่งซื้อ' });
  expect(within(journey).getByText('ได้รับสินค้าแล้ว')).toBeInTheDocument();
});

test('an admin viewing someone else’s Shipping order gets no customer buttons (the API says so)', async () => {
  backend(anOrder({ ...shipping, actions: { customer: null, admin: { ship: false, confirm: true, cancel: false, refund_on_cancel: false } } }));
  visit();

  expect(await screen.findByRole('heading', { level: 1, name: 'จัดส่งแล้ว' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'ได้รับสินค้าแล้ว' })).not.toBeInTheDocument();
});

test('an order confirmed automatically says who confirmed it', async () => {
  backend(anOrder({ ...shipping, status: 'confirmed', confirmed_at: '2026-10-18T03:00:00Z', confirmed_by: 'auto' }));
  visit();

  const journey = await screen.findByRole('list', { name: 'ความคืบหน้าคำสั่งซื้อ' });
  expect(within(journey).getByText(/ยืนยันอัตโนมัติ/)).toBeInTheDocument();
});

test('a cancelled order tells the customer why: the admin words, or the shop wording for a timeout', async () => {
  backend(anOrder({ status: 'cancelled', cancelled_at: '2026-10-10T09:00:00Z', cancel_reason: 'สินค้าหมด', expires_at: null }));
  const { unmount } = visit();
  expect(await screen.findByText('สินค้าหมด')).toBeInTheDocument();
  expect(screen.getByText(/เหตุผลที่ยกเลิก/)).toBeInTheDocument();
  unmount();

  backend(anOrder({ status: 'cancelled', cancelled_at: '2026-10-10T09:00:00Z', cancel_reason: 'payment_timeout', expires_at: null }));
  visit();
  expect(await screen.findByText('หมดเวลาชำระเงิน')).toBeInTheDocument();
});

test('an order bought with a Promotion shows its discount', async () => {
  backend(anOrder({ subtotal: 2880, discount_total: 320, total: 2880 }));
  visit();
  const summary = within(await screen.findByRole('region', { name: 'สรุปคำสั่งซื้อ' }));
  expect(summary.getByText('ส่วนลดโปรโมชัน')).toBeInTheDocument();
  expect(summary.getByText('−฿320')).toBeInTheDocument();
});

test('a cancelled order that was refunded says so', async () => {
  backend(anOrder({ status: 'cancelled', paid_at: '2026-10-10T07:35:00Z', refunded_at: '2026-10-10T09:00:00Z', cancelled_at: '2026-10-10T09:00:00Z', expires_at: null }));
  visit();

  expect(await screen.findByRole('heading', { level: 1, name: 'ยกเลิกและคืนเงินแล้ว' })).toBeInTheDocument();
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
  backend(anOrder({ status: 'waiting_shipping', paid_at: '2026-10-10T07:35:00Z' }));
  visit('/orders/o1?paid=1', [atlas]);

  expect(await screen.findByRole('heading', { level: 1, name: 'รอจัดส่ง' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('0'));
});

test('opening a paid order later leaves the current Cart alone', async () => {
  backend(anOrder({ status: 'waiting_shipping', paid_at: '2026-10-10T07:35:00Z' }));
  visit('/orders/o1', [atlas]);

  expect(await screen.findByRole('heading', { level: 1, name: 'รอจัดส่ง' })).toBeInTheDocument();
  expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
});

test('back from Stripe before the webhook: the page waits, then reads paid and empties the Cart', async () => {
  jest.useFakeTimers();
  try {
    const paid = anOrder({ status: 'waiting_shipping', paid_at: '2026-10-10T07:35:00Z' });
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

    expect(await screen.findByRole('heading', { level: 1, name: 'รอจัดส่ง' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('ขอบคุณที่สั่งซื้อ');
    expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
  } finally {
    jest.useRealTimers();
  }
});

test('an Awaiting Payment order whose Reservation has run out says it will be cancelled and offers no payment', async () => {
  backend(anOrder({ expires_at: new Date(Date.now() - MINUTE).toISOString() }));
  visit();

  expect(await screen.findByRole('heading', { level: 1, name: 'รอชำระเงิน' })).toBeInTheDocument();
  const notice = screen.getByRole('status');
  expect(notice).toHaveTextContent('หมดเวลาชำระ');
  expect(within(notice).getByRole('link', { name: 'เลือกสินค้าต่อ' })).toHaveAttribute('href', '/');
  expect(screen.queryByRole('button', { name: /ชำระ ฿/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'ยกเลิกคำสั่งซื้อ' })).not.toBeInTheDocument();
});

test('back from Stripe on an order that is no longer Awaiting Payment: no waiting for a payment', async () => {
  backend(anOrder({ status: 'cancelled', cancelled_at: '2026-10-10T08:00:00Z' }));
  visit('/orders/o1?paid=1');

  expect(await screen.findByRole('heading', { level: 1, name: 'ยกเลิกแล้ว' })).toBeInTheDocument();
  expect(screen.queryByText(/กำลังยืนยันการชำระเงิน/)).not.toBeInTheDocument();
});

test('back from Stripe and still unconfirmed after waiting: says not to pay again and offers no pay button', async () => {
  jest.useFakeTimers();
  try {
    backend(anOrder());
    visit('/orders/o1?paid=1');
    expect(await screen.findByText(/กำลังยืนยันการชำระเงิน/)).toBeInTheDocument();

    for (let i = 0; i < 45; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
    }

    expect(screen.getByText(/ร้านยังไม่ได้รับการยืนยันการชำระเงิน/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ชำระ ฿/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ยกเลิกคำสั่งซื้อ' })).not.toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});
