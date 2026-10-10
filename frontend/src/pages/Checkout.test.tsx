import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Checkout from './Checkout';
import { renderPage } from '../test/renderPage';
import { api } from '../lib/api';

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

/** The backend as the Checkout sees it: a Customer with no Saved Addresses and free shipping. */
function backend(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    '/auth/me': customer,
    '/addresses': [],
    '/orders/shipping-fee': { shipping_fee: 0 },
    '/geo/provinces': [],
    ...overrides,
  };
  (api.get as jest.Mock).mockImplementation((path: string) =>
    path in responses ? Promise.resolve(responses[path]) : Promise.reject(new Error(`unexpected GET ${path}`))
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  backend();
});

test('the order summary shows the Shipping Fee as free when it is zero', async () => {
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas] });

  const shippingRow = (await screen.findByText('ค่าจัดส่ง')).parentElement!;
  await waitFor(() => expect(shippingRow).toHaveTextContent('ฟรี'));
});

test('a field error disappears as soon as the customer fixes that field', async () => {
  renderPage(<Checkout />, { path: '/checkout', cart: [atlas] });

  userEvent.click(await screen.findByRole('button', { name: 'ดำเนินการชำระเงิน' }));
  expect(await screen.findByText('กรุณากรอกเบอร์โทรไทย เช่น 0812345678')).toBeInTheDocument();

  userEvent.type(screen.getByLabelText('เบอร์โทร'), '0812345678');

  expect(screen.queryByText('กรุณากรอกเบอร์โทรไทย เช่น 0812345678')).not.toBeInTheDocument();
  expect(screen.getByText('กรุณากรอกบ้านเลขที่และถนน')).toBeInTheDocument();
});
