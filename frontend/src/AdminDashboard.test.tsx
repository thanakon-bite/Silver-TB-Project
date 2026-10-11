import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeI18n, renderApp } from './test/renderPage';

/** The admin pages in English (they have Thai too: see the Thai admin test at the end). */
const renderAdmin = (url = '/admin') => {
  const i18n = makeI18n();
  i18n.changeLanguage('en');
  return renderApp(url, { i18n });
};
import { api, ApiError } from './lib/api';
import { resetCatalogue } from './lib/catalogue';

jest.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'test-token' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}));

jest.mock('./lib/api', () => {
  const actual = jest.requireActual('./lib/api');
  return { ...actual, api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() } };
});

// Alerts need browser APIs jsdom lacks; what matters here is what the page itself shows.
jest.mock('sweetalert2', () => ({ __esModule: true, default: { fire: jest.fn(() => Promise.resolve({})), showValidationMessage: jest.fn() } }));

// Canvas does not exist in jsdom; every chart's table view carries the same numbers.
jest.mock('react-chartjs-2', () => ({ Bar: () => null, Doughnut: () => null }));

const admin = { id: 'a1', email: 'owner@example.com', full_name: 'เจ้าของร้าน', role: 'admin' };

const stats = (overrides = {}) => ({
  revenue_total: 6400,
  confirmed_orders: 4,
  orders_by_status: { awaiting_payment: 1, paid: 0, waiting_shipping: 2, shipping: 3, confirmed: 4, cancelled: 0 },
  products_by_category: { beetle: 5, food: 2, log: 1, gear: 0 },
  to_fulfil: 2,
  needs_attention: 0,
  customers: 7,
  low_stock: [{ id: 'p1', name: 'Atlas beetle', available: 0 }],
  daily: [{ date: '2026-10-10', revenue: 3200, orders: 1 }],
  ...overrides,
});

const product = (id: string, name: string, is_active = true) => ({
  id, name, name_th: null, description: null, description_th: null, price: 3200, on_hand: 6, available: 5, in_transit: 1, category: 'beetle',
  attributes: {}, images: [], is_best_seller: false, is_active, views: 0, created_at: '2026-10-01T00:00:00Z',
});

const member = (id: string, full_name: string, role: 'user' | 'admin' = 'user') => ({
  id, full_name, email: `${id}@example.com`, phone: null, role, created_at: '2026-10-01T00:00:00Z', orders: 0, total_spent: 0,
});

/** The admin API: each test overrides the parts it is about. Paths are matched without their query. */
function backend(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    '/auth/me': admin,
    '/admin/stats': stats(),
    '/orders/admin/all': { orders: [], total: 25, page: 1, limit: 10 },
    '/products/admin/all': { products: [product('p1', 'Atlas beetle')], total: 1, page: 1, limit: 10 },
    '/admin/customers': { customers: [member('a1', 'เจ้าของร้าน', 'admin'), member('u1', 'มาลี')], total: 2, page: 1, limit: 10 },
    '/admin/promotions': [
      {
        id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: 'Rainy season sale', starts_at: '2026-10-01T17:00:00.000Z', ends_at: '2026-11-30T16:59:59.999Z',
        applies_to_all: false, product_ids: ['p1'], gift_product_ids: [], discount_tiers: [{ min_units: 3, type: 'percent', value: 10 }],
        gift_every: null, gift_quantity: null, per_customer_limit: 1, customer_limit: null, is_active: true, redemptions: 4, customers: 3,
      },
    ],
    '/admin/rules/shipping': {
      tiers: [
        { min_units: 1, max_units: 1, fee: 10 },
        { min_units: 2, max_units: 5, fee: 50 },
        { min_units: 6, max_units: null, fee: 80 },
      ],
      free_threshold: null,
      fallback_fee: 0,
    },
    ...overrides,
  };
  (api.get as jest.Mock).mockImplementation((path: string) => {
    const key = path.split('?')[0];
    return key in responses ? Promise.resolve(responses[key]) : Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

const getCalls = (prefix: string) => (api.get as jest.Mock).mock.calls.map(([p]) => p as string).filter((p) => p.startsWith(prefix));

beforeEach(() => {
  jest.clearAllMocks();
  resetCatalogue();
  backend();
});

/**
 * Plays a SweetAlert form the way an Admin would: renders its html, fills the fields, presses confirm
 * (running its preConfirm check) and returns what Swal would. `attempts` are tried in order; each
 * refused one is left to the validation message.
 */
const fillSwalForm = (attempts: Record<string, string>[], seen: { opts?: any } = {}) =>
  jest.requireMock('sweetalert2').default.fire.mockImplementationOnce(async (opts: any) => {
    seen.opts = opts;
    const box = document.createElement('div');
    box.innerHTML = opts.html;
    document.body.appendChild(box);
    let value: unknown = false;
    for (const fields of attempts) {
      for (const [id, v] of Object.entries(fields)) (box.querySelector(`#${id}`) as HTMLInputElement).value = v;
      value = opts.preConfirm();
      if (value) break;
    }
    box.remove();
    return value ? { isConfirmed: true, value } : { isConfirmed: false, isDismissed: true };
  });

const openTab = async (name: string) => {
  userEvent.click(await screen.findByRole('tab', { name }));
};

describe('Overview', () => {
  test('the cards show Revenue and Confirmed orders only', async () => {
    renderAdmin();
    const revenue = await screen.findByRole('button', { name: /Revenue · Confirmed orders/ });
    expect(revenue).toHaveTextContent('฿6,400');
    const confirmed = screen.getByRole('button', { name: /^Confirmed orders/ });
    expect(confirmed).toHaveTextContent('4');
    expect(screen.queryByRole('button', { name: /Paid, waiting to ship/ })).not.toBeInTheDocument();

    userEvent.click(confirmed);
    await waitFor(() => expect(getCalls('/orders/admin/all').some((p) => p.includes('status=confirmed'))).toBe(true));
  });

  test('shows orders by status, products by category and low stock as tables on request', async () => {
    renderAdmin();
    const status = await screen.findByRole('region', { name: 'Orders by status' });
    userEvent.click(within(status).getByRole('button', { name: 'Table' }));
    expect(within(status).getByRole('row', { name: /Shipping 3/ })).toBeInTheDocument();

    const categories = screen.getByRole('region', { name: 'Products by category' });
    userEvent.click(within(categories).getByRole('button', { name: 'Table' }));
    expect(within(categories).getByRole('row', { name: /Beetles 5/ })).toBeInTheDocument();

    const low = screen.getByRole('region', { name: /Running low/ });
    userEvent.click(within(low).getByRole('button', { name: 'Table' }));
    expect(within(low).getByRole('row', { name: /Atlas beetle Sold out/i })).toBeInTheDocument();
  });

  test('says so when there is nothing to chart', async () => {
    backend({
      '/admin/stats': stats({
        orders_by_status: { awaiting_payment: 0, paid: 0, waiting_shipping: 0, shipping: 0, confirmed: 0, cancelled: 0 },
        products_by_category: { beetle: 0, food: 0, log: 0, gear: 0 },
        low_stock: [],
        daily: [{ date: '2026-10-10', revenue: 0, orders: 0 }],
      }),
    });
    renderAdmin();
    expect(await screen.findByText('No orders yet.')).toBeInTheDocument();
    expect(screen.getByText('No active products yet.')).toBeInTheDocument();
    expect(screen.getByText('All active products are well stocked.')).toBeInTheDocument();
    expect(screen.getByText('No confirmed orders in the last 14 days.')).toBeInTheDocument();
  });

  test('a status in the legend opens Orders filtered to it', async () => {
    renderAdmin();
    const status = await screen.findByRole('region', { name: 'Orders by status' });
    userEvent.click(within(status).getByRole('button', { name: /^Shipping/ }));
    await waitFor(() => expect(getCalls('/orders/admin/all').some((p) => p.includes('status=shipping'))).toBe(true));
  });
});

/** What the API says an Admin may do with an order in each status (backend lib/orderStatus.js orderActions). */
const ADMIN_ACTIONS: Record<string, { ship: boolean; confirm: boolean; cancel: boolean; refund_on_cancel: boolean }> = {
  awaiting_payment: { ship: false, confirm: false, cancel: true, refund_on_cancel: false },
  paid: { ship: false, confirm: false, cancel: true, refund_on_cancel: true },
  waiting_shipping: { ship: true, confirm: false, cancel: true, refund_on_cancel: true },
  shipping: { ship: false, confirm: true, cancel: false, refund_on_cancel: false },
  confirmed: { ship: false, confirm: false, cancel: false, refund_on_cancel: false },
  cancelled: { ship: false, confirm: false, cancel: false, refund_on_cancel: false },
};

const anOrder = (overrides: Record<string, unknown> = {}) => {
  const o = anOrderFields(overrides);
  return { actions: { customer: null, admin: ADMIN_ACTIONS[o.status as string] }, ...o };
};

const anOrderFields = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'o1', order_number: 'STB-261010-00007', user_id: 'u1', status: 'waiting_shipping', subtotal: 3200, shipping_fee: 0, total: 3200,
  currency: 'thb', shipping_address: null, order_items: [], stripe_payment_intent_id: 'pi_1', expires_at: null,
  paid_at: '2026-10-10T07:35:00Z', shipped_at: null, confirmed_at: null, confirmed_by: null, refunded_at: null, payment_failed_at: null, cancelled_at: null, cancel_reason: null,
  carrier: null, tracking_number: null, created_at: '2026-10-10T07:30:00Z', admin_note: null, needs_attention: false,
  profiles: { full_name: 'มาลี', email: 'u1@example.com', phone: null },
  ...overrides,
});

test('Orders lists one status per order, filters by the new statuses, and has no payment column', async () => {
  backend({ '/orders/admin/all': { orders: [anOrder()], total: 1, page: 1, limit: 10 } });
  renderAdmin();
  await openTab('Orders');

  const row = await screen.findByRole('row', { name: /STB-261010-00007/ });
  expect(within(row).getByText('Waiting shipping')).toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Payment' })).not.toBeInTheDocument();

  const filter = screen.getByRole('combobox', { name: 'Status' });
  expect(within(filter).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(
    ['', 'awaiting_payment', 'paid', 'waiting_shipping', 'shipping', 'confirmed', 'cancelled']
  );
  userEvent.selectOptions(filter, 'shipping');
  await waitFor(() => expect(getCalls('/orders/admin/all').at(-1)).toContain('status=shipping'));
});

test('a Waiting Shipping order ships only with a Tracking Number', async () => {
  backend({ '/orders/admin/all': { orders: [anOrder()], total: 1, page: 1, limit: 10 }, '/orders/o1': anOrder() });
  (api.patch as jest.Mock).mockResolvedValue(anOrder({ status: 'shipping', tracking_number: 'KEX1', shipped_at: '2026-10-11T03:00:00Z' }));
  renderAdmin();
  await openTab('Orders');
  userEvent.click(await screen.findByRole('row', { name: /STB-261010-00007/ }));

  const ship = await screen.findByRole('button', { name: 'Mark as Shipping' });
  userEvent.click(ship);
  expect(api.patch).not.toHaveBeenCalled();

  userEvent.type(screen.getByRole('textbox', { name: 'Tracking number' }), 'KEX1');
  userEvent.click(ship);
  await waitFor(() =>
    expect(api.patch).toHaveBeenCalledWith('/orders/o1/status', expect.objectContaining({ status: 'shipping', tracking_number: 'KEX1' }))
  );
});

test("an admin confirms a Shipping order on the customer's behalf", async () => {
  const shipped = anOrder({ status: 'shipping', tracking_number: 'KEX1', shipped_at: '2026-10-11T03:00:00Z' });
  backend({ '/orders/admin/all': { orders: [shipped], total: 1, page: 1, limit: 10 }, '/orders/o1': shipped });
  (api.patch as jest.Mock).mockResolvedValue(anOrder({ status: 'confirmed', confirmed_by: 'admin', confirmed_at: '2026-10-12T03:00:00Z' }));
  renderAdmin();
  await openTab('Orders');
  userEvent.click(await screen.findByRole('row', { name: /STB-261010-00007/ }));

  userEvent.click(await screen.findByRole('button', { name: 'Confirm received' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/orders/o1/status', { status: 'confirmed' }));
});

describe('Cancel with a reason', () => {
  const open = async (o: ReturnType<typeof anOrder>) => {
    backend({ '/orders/admin/all': { orders: [o], total: 1, page: 1, limit: 10 }, '/orders/o1': o });
    (api.patch as jest.Mock).mockResolvedValue(anOrder({ status: 'cancelled', cancel_reason: 'สินค้าหมด' }));
    renderAdmin();
    await openTab('Orders');
    userEvent.click(await screen.findByRole('row', { name: /STB-261010-00007/ }));
    return within(await screen.findByRole('dialog', { name: /STB-261010-00007/ }));
  };

  test('an unpaid order is cancelled only once a reason is written', async () => {
    const dialog = await open(anOrder({ status: 'awaiting_payment', paid_at: null }));
    userEvent.click(dialog.getByRole('button', { name: 'Cancel order' }));
    const confirm = dialog.getByRole('button', { name: 'Cancel and tell the customer' });
    expect(confirm).toBeDisabled();
    userEvent.type(dialog.getByRole('textbox', { name: 'Cancel reason (the customer sees this)' }), 'สินค้าหมด');
    userEvent.click(confirm);
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/orders/o1/status', { status: 'cancelled', reason: 'สินค้าหมด' }));
  });

  test('opening the cancel form puts focus on the reason, and Keep closes it without cancelling', async () => {
    const dialog = await open(anOrder());
    userEvent.click(dialog.getByRole('button', { name: 'Cancel order' }));
    expect(dialog.getByRole('textbox', { name: 'Cancel reason (the customer sees this)' })).toHaveFocus();
    // design.md: [keep] comes before [confirm]
    const keep = dialog.getByRole('button', { name: 'Keep order' });
    expect(keep.compareDocumentPosition(dialog.getByRole('button', { name: 'Refund ฿3,200 and cancel' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    userEvent.click(keep);
    expect(dialog.queryByRole('textbox', { name: 'Cancel reason (the customer sees this)' })).not.toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Cancel order' })).toHaveFocus();
    expect(api.patch).not.toHaveBeenCalled();
  });

  test('cancelling a paid order says it refunds in full', async () => {
    const dialog = await open(anOrder());
    userEvent.click(dialog.getByRole('button', { name: 'Cancel order' }));
    userEvent.type(dialog.getByRole('textbox', { name: 'Cancel reason (the customer sees this)' }), 'ด้วงป่วย');
    userEvent.click(dialog.getByRole('button', { name: 'Refund ฿3,200 and cancel' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/orders/o1/status', { status: 'cancelled', reason: 'ด้วงป่วย' }));
  });

  test('an error the shop knows by code is shown in its own words', async () => {
    const dialog = await open(anOrder());
    (api.patch as jest.Mock).mockRejectedValueOnce(new ApiError('Write the reason in your own words', 400, 'RESERVED_CANCEL_REASON'));
    userEvent.click(dialog.getByRole('button', { name: 'Cancel order' }));
    userEvent.type(dialog.getByRole('textbox', { name: 'Cancel reason (the customer sees this)' }), 'expired');
    userEvent.click(dialog.getByRole('button', { name: 'Refund ฿3,200 and cancel' }));
    const Swal = jest.requireMock('sweetalert2').default;
    await waitFor(() =>
      expect(Swal.fire).toHaveBeenCalledWith('Error', 'That reason is one the system uses. Write it in your own words.', 'error')
    );
  });

  test('the screen offers only what the API allows, whatever the status', async () => {
    const dialog = await open(anOrder({ actions: { customer: null, admin: { ship: false, confirm: false, cancel: false, refund_on_cancel: false } } }));
    expect(dialog.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: 'Mark as Shipping' })).not.toBeInTheDocument();
  });

  test('a paid order the shop already refunded is cancelled without promising a second refund', async () => {
    const dialog = await open(anOrder({ refunded_at: '2026-10-11T00:00:00Z', actions: { customer: null, admin: { ...ADMIN_ACTIONS.waiting_shipping, refund_on_cancel: false } } }));
    userEvent.click(dialog.getByRole('button', { name: 'Cancel order' }));
    expect(dialog.getByRole('button', { name: 'Cancel and tell the customer' })).toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: /^Refund/ })).not.toBeInTheDocument();
  });

  test('a Shipping order cannot be cancelled', async () => {
    const dialog = await open(anOrder({ status: 'shipping', shipped_at: '2026-10-11T03:00:00Z', tracking_number: 'KEX1' }));
    expect(dialog.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });
});

test('the Admin Note shows in the orders table and saves from there', async () => {
  backend({ '/orders/admin/all': { orders: [anOrder({ admin_note: 'โทรหาลูกค้าก่อนส่ง' })], total: 1, page: 1, limit: 10 } });
  (api.patch as jest.Mock).mockResolvedValue(anOrder({ admin_note: 'ส่งวันจันทร์' }));
  renderAdmin();
  await openTab('Orders');

  expect(await screen.findByRole('columnheader', { name: 'Note' })).toBeInTheDocument();
  const note = await screen.findByRole('textbox', { name: 'Note for STB-261010-00007' });
  expect(note).toHaveValue('โทรหาลูกค้าก่อนส่ง');
  userEvent.clear(note);
  userEvent.type(note, 'ส่งวันจันทร์');
  note.blur();
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/orders/o1/admin', { admin_note: 'ส่งวันจันทร์' }));
  expect(api.get).not.toHaveBeenCalledWith('/orders/o1');
});

test('Orders shows 10 per page with a pager', async () => {
  renderAdmin();
  await openTab('Orders');
  await waitFor(() => expect(screen.getByText(/items/)).toHaveTextContent('Page 1 of 3 · 25 items'));
  await waitFor(() => expect(getCalls('/orders/admin/all').at(-1)).toContain('limit=10'));
  userEvent.click(screen.getByRole('button', { name: /Next/ }));
  await waitFor(() => expect(getCalls('/orders/admin/all').at(-1)).toContain('page=2'));
});

describe('Products & stock', () => {
  test('each product shows On Hand, Available and In Transit', async () => {
    renderAdmin();
    await openTab('Products & stock');
    const row = await screen.findByRole('row', { name: /Atlas beetle/ });
    expect(screen.getByRole('columnheader', { name: 'On Hand' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Available' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'In transit' })).toBeInTheDocument();
    expect(within(row).getByLabelText('On Hand')).toHaveTextContent('6');
    expect(within(row).getByLabelText('Available')).toHaveTextContent('5');
    expect(within(row).getByLabelText('In transit')).toHaveTextContent('1');
    expect(screen.queryByText(/Onhand|Stockmove/)).not.toBeInTheDocument();
  });

  test('one button sets On Hand: the form opens on today\'s count, refuses less than Reserved, and sends the count and note', async () => {
    (api.post as jest.Mock).mockResolvedValue({ ...product('p1', 'Atlas beetle'), on_hand: 9, available: 8 });
    const Swal = jest.requireMock('sweetalert2').default;
    const seen: { opts?: any } = {};
    fillSwalForm([{ 'stb-on-hand': '0' }, { 'stb-on-hand': '9', 'stb-on-hand-note': 'รับของเข้า' }], seen);
    renderAdmin();
    await openTab('Products & stock');
    const row = await screen.findByRole('row', { name: /Atlas beetle/ });

    userEvent.click(within(row).getByRole('button', { name: 'Set On Hand of Atlas beetle' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/products/p1/stock', { on_hand: 9, note: 'รับของเข้า' }));
    expect(seen.opts.titleText).toBe('Set On Hand — Atlas beetle');
    expect(seen.opts.html).toContain('value="6"');
    expect(seen.opts.html).toContain('min="1"');
    expect(Swal.showValidationMessage).toHaveBeenCalledWith("Can't go below 1: customers have reserved them");
    await waitFor(() => expect(within(row).getByLabelText('On Hand')).toHaveTextContent('9'));
    expect(within(row).getByLabelText('Available')).toHaveTextContent('8');
  });

  test('a count the server refuses as below Reserved says the minimum', async () => {
    (api.post as jest.Mock).mockRejectedValue(new ApiError('On Hand cannot go below the 2 unit(s) reserved by open orders.', 409, 'BELOW_RESERVED', { reserved: 2 }));
    const Swal = jest.requireMock('sweetalert2').default;
    fillSwalForm([{ 'stb-on-hand': '3' }]);
    renderAdmin();
    await openTab('Products & stock');
    const row = await screen.findByRole('row', { name: /Atlas beetle/ });
    userEvent.click(within(row).getByRole('button', { name: 'Set On Hand of Atlas beetle' }));
    await waitFor(() => expect(Swal.fire).toHaveBeenLastCalledWith(expect.any(String), "On Hand can't go below 2: customers have reserved them", 'error'));
    expect(within(row).getByLabelText('On Hand')).toHaveTextContent('6');
  });

  test('the history icon after Edit opens the Stock History, newest first, a page at a time', async () => {
    const change = (id: number, over: Record<string, unknown>) => ({
      id, kind: 'set_on_hand', on_hand_delta: 0, available_delta: 0, on_hand_after: 6, available_after: 5, note: null,
      created_at: '2026-10-11T03:00:00Z', order_number: null, actor: null, ...over,
    });
    backend({
      '/products/p1/stock-history': {
        changes: [
          change(3, { kind: 'set_on_hand', on_hand_delta: 3, available_delta: 3, on_hand_after: 9, available_after: 8, note: 'รับของเข้า', actor: 'เจ้าของร้าน' }),
          change(2, { kind: 'order_created', available_delta: -1, on_hand_after: 6, available_after: 5, order_number: 'STB-261010-00007' }),
          change(1, { kind: 'opening', on_hand_after: 6, available_after: 6 }),
        ],
        total: 4,
      },
    });
    renderAdmin();
    await openTab('Products & stock');
    const row = await screen.findByRole('row', { name: /Atlas beetle/ });
    const buttons = within(row).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(buttons.indexOf('Stock History of Atlas beetle')).toBe(buttons.indexOf('Edit Atlas beetle') + 1);

    userEvent.click(within(row).getByRole('button', { name: 'Stock History of Atlas beetle' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Stock History — Atlas beetle' }));
    const rows = await dialog.findAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('On Hand set');
    expect(rows[1]).toHaveTextContent('“รับของเข้า”');
    expect(rows[1]).toHaveTextContent('9(+3)');
    expect(rows[1]).toHaveTextContent('เจ้าของร้าน');
    expect(rows[2]).toHaveTextContent('Ordered (reserved)');
    expect(rows[2]).toHaveTextContent('STB-261010-00007');
    expect(rows[2]).toHaveTextContent('5(−1)');
    expect(rows[3]).toHaveTextContent('Opening balance');
    expect(getCalls('/products/p1/stock-history').at(-1)).toContain('page=1');

    userEvent.click(dialog.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(getCalls('/products/p1/stock-history').at(-1)).toContain('page=2'));
  });

  test('a switch turns a product off for the shop', async () => {
    (api.patch as jest.Mock).mockResolvedValue({});
    renderAdmin();
    await openTab('Products & stock');
    const toggle = await screen.findByRole('switch', { name: 'Show Atlas beetle in the shop' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    userEvent.click(toggle);
    expect(api.patch).toHaveBeenCalledWith('/products/p1', { is_active: false });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
  });

  test('a star in the row marks a product Best Seller and back', async () => {
    (api.patch as jest.Mock).mockResolvedValue({});
    renderAdmin();
    await openTab('Products & stock');
    const star = await screen.findByRole('button', { name: 'Best seller: Atlas beetle' });
    expect(star).toHaveAttribute('aria-pressed', 'false');
    userEvent.click(star);
    expect(api.patch).toHaveBeenCalledWith('/products/p1', { is_best_seller: true });
    expect(star).toHaveAttribute('aria-pressed', 'true');
    userEvent.click(star);
    expect(api.patch).toHaveBeenLastCalledWith('/products/p1', { is_best_seller: false });
    await waitFor(() => expect(star).toHaveAttribute('aria-pressed', 'false'));
  });

  test('the switch flips back when saving fails', async () => {
    (api.patch as jest.Mock).mockRejectedValue(new Error('offline'));
    renderAdmin();
    await openTab('Products & stock');
    const toggle = await screen.findByRole('switch', { name: 'Show Atlas beetle in the shop' });
    userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  });

  test('the status filter asks for inactive products from page 1, 10 at a time', async () => {
    renderAdmin();
    await openTab('Products & stock');
    await screen.findByRole('switch', { name: /Atlas beetle/ });
    userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Inactive');
    await waitFor(() => expect(getCalls('/products/admin/all').at(-1)).toMatch(/^(?=.*active=false)(?=.*page=1&)(?=.*limit=10)/));
  });
});

describe('Rules: Shipping Rule', () => {
  test('shows the tiers without gaps, edits a fee and the free threshold, and saves the whole rule', async () => {
    (api.put as jest.Mock).mockImplementation((_p: string, body: unknown) => Promise.resolve(body));
    renderAdmin();
    await openTab('Rules');
    const section = within(await screen.findByRole('region', { name: 'Shipping Rule' }));

    expect(await section.findByText('1 item')).toBeInTheDocument();
    expect(section.getByText(/6 items or more/)).toBeInTheDocument();
    const fee2 = section.getByRole('spinbutton', { name: 'Fee (฿), tier 2' });
    userEvent.clear(fee2);
    userEvent.type(fee2, '60');
    userEvent.type(section.getByRole('spinbutton', { name: 'Free shipping at (฿)' }), '1500');
    userEvent.click(section.getByRole('button', { name: 'Save shipping rule' }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/admin/rules/shipping', {
        tiers: [
          { min_units: 1, max_units: 1, fee: 10 },
          { min_units: 2, max_units: 5, fee: 60 },
          { min_units: 6, max_units: null, fee: 80 },
        ],
        free_threshold: 1500,
      })
    );
  });

  test('adding a tier splits the open-ended one so the ranges stay continuous', async () => {
    (api.put as jest.Mock).mockImplementation((_p: string, body: unknown) => Promise.resolve(body));
    renderAdmin();
    await openTab('Rules');
    const section = within(await screen.findByRole('region', { name: 'Shipping Rule' }));
    await section.findByText('1 item');

    userEvent.click(section.getByRole('button', { name: 'Add tier' }));
    userEvent.click(section.getByRole('button', { name: 'Save shipping rule' }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const sent = (api.put as jest.Mock).mock.calls[0][1];
    expect(sent.tiers.map((t: any) => [t.min_units, t.max_units])).toEqual([[1, 1], [2, 5], [6, 6], [7, null]]);
  });

  test('a rule the server refuses is explained on the page', async () => {
    (api.put as jest.Mock).mockRejectedValue(new ApiError('there is a gap after 5 units', 400, 'INVALID_SHIPPING_RULE'));
    renderAdmin();
    await openTab('Rules');
    const section = within(await screen.findByRole('region', { name: 'Shipping Rule' }));
    await section.findByText('1 item');
    userEvent.click(section.getByRole('button', { name: 'Save shipping rule' }));
    expect(await section.findByRole('alert')).toHaveTextContent('there is a gap after 5 units');
  });
});

describe('Rules: Promotions', () => {
  test('lists each Promotion with its dates and how many Customers used it', async () => {
    renderAdmin();
    await openTab('Rules');
    const section = within(await screen.findByRole('region', { name: 'Promotions' }));
    const row = await section.findByRole('row', { name: /ลดรับหน้าฝน/ });
    expect(within(row).getByText('2026-10-02 – 2026-11-30')).toBeInTheDocument();
    expect(within(row).getByText('4 redemptions · 3 customers')).toBeInTheDocument();
  });

  test('Discount Tiers read as tags from fewest units up, the Gift as its own tag, and how it combines', async () => {
    const promo = { id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: null, starts_at: '2026-10-01T17:00:00.000Z', ends_at: '2026-11-30T16:59:59.999Z',
      applies_to_all: true, product_ids: [], gift_product_ids: ['p1'],
      discount_tiers: [{ min_units: 3, type: 'percent', value: 10 }, { min_units: 1, type: 'baht', value: 20 }],
      gift_every: 3, gift_quantity: 1, per_customer_limit: null, customer_limit: null, stacking: 'stackable', is_active: true, redemptions: 0, customers: 0 };
    const plain = { ...promo, id: 'pr2', name_th: 'ลดปกติ', discount_tiers: [{ min_units: 2, type: 'percent', value: 5 }], gift_every: null, gift_quantity: null, stacking: 'exclusive' };
    backend({ '/admin/promotions': [promo, plain] });
    renderAdmin();
    await openTab('Rules');
    const tags = await screen.findByRole('list', { name: 'Discounts and gifts of ลดรับหน้าฝน' });
    expect(within(tags).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['1+ units −฿20 each', '3+ units −10%', 'Buy 3 get 1', 'Stackable']);
    const other = screen.getByRole('list', { name: 'Discounts and gifts of ลดปกติ' });
    expect(within(other).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['2+ units −5%', 'Exclusive']);
  });

  test('a new Promotion is Exclusive unless the Admin picks Stackable, and the choice is sent', async () => {
    (api.post as jest.Mock).mockResolvedValue({ id: 'pr9' });
    renderAdmin();
    await openTab('Rules');
    userEvent.click(await within(await screen.findByRole('region', { name: 'Promotions' })).findByRole('button', { name: 'New promotion' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New promotion' }));
    const exclusive = dialog.getByRole('radio', { name: /Exclusive: used on its own/ });
    const stackable = dialog.getByRole('radio', { name: /Stackable: combines with other promotions/ });
    expect(exclusive).toBeChecked();
    userEvent.type(dialog.getByLabelText('Name (Thai)'), 'ลดรวม');
    userEvent.type(dialog.getByLabelText('Start date'), '2026-12-01');
    userEvent.type(dialog.getByLabelText('End date'), '2026-12-31');
    userEvent.click(dialog.getByRole('checkbox', { name: 'All products' }));
    userEvent.click(dialog.getByRole('button', { name: 'Add discount tier' }));
    userEvent.type(dialog.getByRole('spinbutton', { name: 'Discount, tier 1' }), '5');
    userEvent.click(stackable);
    userEvent.click(dialog.getByRole('button', { name: 'Save promotion' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/promotions', expect.objectContaining({ stacking: 'stackable' })));
  });

  test('Rules tags read in Thai', async () => {
    const promo = { id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: null, starts_at: '2026-10-01T17:00:00.000Z', ends_at: '2026-11-30T16:59:59.999Z',
      applies_to_all: true, product_ids: [], gift_product_ids: ['p1'], discount_tiers: [{ min_units: 3, type: 'percent', value: 10 }],
      gift_every: 3, gift_quantity: 1, per_customer_limit: null, customer_limit: null, stacking: 'exclusive', is_active: true, redemptions: 0, customers: 0 };
    backend({ '/admin/promotions': [promo] });
    renderApp('/admin');
    userEvent.click(await screen.findByRole('tab', { name: 'กฎ' }));
    const tags = await screen.findByRole('list', { name: 'ส่วนลดและของแถมของ ลดรับหน้าฝน' });
    expect(within(tags).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['3+ ชิ้น −10%', 'ซื้อ 3 แถม 1', 'ใช้เดี่ยว']);
  });

  test('one Redemption by one Customer reads in the singular', async () => {
    const promo = { id: 'pr1', name_th: 'ลดรับหน้าฝน', name_en: null, starts_at: '2026-10-01T17:00:00.000Z', ends_at: '2026-11-30T16:59:59.999Z',
      applies_to_all: true, product_ids: [], gift_product_ids: [], discount_tiers: [{ min_units: 3, type: 'percent', value: 10 }],
      gift_every: null, gift_quantity: null, per_customer_limit: null, customer_limit: null, is_active: true, redemptions: 1, customers: 1 };
    backend({ '/admin/promotions': [promo] });
    renderAdmin();
    await openTab('Rules');
    const row = await within(await screen.findByRole('region', { name: 'Promotions' })).findByRole('row', { name: /ลดรับหน้าฝน/ });
    expect(within(row).getByText('1 redemption · 1 customer')).toBeInTheDocument();
  });

  test('the last Shipping Tier does not say "or more" twice', async () => {
    renderAdmin();
    await openTab('Rules');
    const section = within(await screen.findByRole('region', { name: 'Shipping Rule' }));
    expect(await section.findByText('6 items or more')).toBeInTheDocument();
    expect(section.queryByText('or more')).not.toBeInTheDocument();
  });

  test('creating a Promotion sends dates, products, discount tiers and limits', async () => {
    (api.post as jest.Mock).mockResolvedValue({ id: 'pr9' });
    renderAdmin();
    await openTab('Rules');
    const section = within(await screen.findByRole('region', { name: 'Promotions' }));
    userEvent.click(await section.findByRole('button', { name: 'New promotion' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New promotion' }));

    userEvent.type(dialog.getByLabelText('Name (Thai)'), 'ซื้อเยอะลดเยอะ');
    userEvent.type(dialog.getByLabelText('Start date'), '2026-12-01');
    userEvent.type(dialog.getByLabelText('End date'), '2026-12-31');
    userEvent.click(await within(dialog.getByRole('group', { name: 'Promotion products' })).findByRole('checkbox', { name: 'Atlas beetle' }));
    userEvent.click(dialog.getByRole('button', { name: 'Add discount tier' }));
    userEvent.clear(dialog.getByRole('spinbutton', { name: 'Buy at least (units), tier 1' }));
    userEvent.type(dialog.getByRole('spinbutton', { name: 'Buy at least (units), tier 1' }), '3');
    userEvent.type(dialog.getByRole('spinbutton', { name: 'Discount, tier 1' }), '5');
    userEvent.type(dialog.getByLabelText('Redemptions per customer'), '2');
    userEvent.click(dialog.getByRole('button', { name: 'Save promotion' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/promotions', expect.objectContaining({
        name_th: 'ซื้อเยอะลดเยอะ',
        start_date: '2026-12-01',
        end_date: '2026-12-31',
        applies_to_all: false,
        product_ids: ['p1'],
        discount_tiers: [{ min_units: 3, type: 'percent', value: 5 }],
        per_customer_limit: 2,
        customer_limit: null,
      }))
    );
  });

  test('a Promotion can give a Gift: every X units earn Y free of the ticked gift products', async () => {
    (api.post as jest.Mock).mockResolvedValue({ id: 'pr9' });
    renderAdmin();
    await openTab('Rules');
    userEvent.click(await within(await screen.findByRole('region', { name: 'Promotions' })).findByRole('button', { name: 'New promotion' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New promotion' }));
    userEvent.type(dialog.getByLabelText('Name (Thai)'), 'ซื้อ 2 แถม 1');
    userEvent.type(dialog.getByLabelText('Start date'), '2026-12-01');
    userEvent.type(dialog.getByLabelText('End date'), '2026-12-31');
    userEvent.click(dialog.getByRole('checkbox', { name: 'All products' }));
    userEvent.type(dialog.getByLabelText('Gift: every (units bought)'), '2');
    userEvent.type(dialog.getByLabelText('Gift: free units'), '1');
    const giftGroup = within(dialog.getByRole('group', { name: 'Gift products' }));
    userEvent.click(await giftGroup.findByRole('checkbox', { name: /Atlas beetle/ }));
    userEvent.click(dialog.getByRole('button', { name: 'Save promotion' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/promotions', expect.objectContaining({
        applies_to_all: true,
        discount_tiers: [],
        gift_every: 2,
        gift_quantity: 1,
        gift_product_ids: ['p1'],
      }))
    );
  });

  test('a Promotion that has started keeps what it covers and gives; only names, end date and on/off change', async () => {
    renderAdmin();
    await openTab('Rules');
    const section = within(await screen.findByRole('region', { name: 'Promotions' }));
    userEvent.click(await section.findByRole('button', { name: 'Edit ลดรับหน้าฝน' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'ลดรับหน้าฝน' }));
    expect(dialog.getByText(/has started/)).toBeInTheDocument();
    expect(dialog.getByLabelText('Start date')).toBeDisabled();
    expect(dialog.getByRole('spinbutton', { name: 'Discount, tier 1' })).toBeDisabled();
    expect(dialog.getByLabelText('End date')).toBeEnabled();
    expect(dialog.getByLabelText('Name (Thai)')).toBeEnabled();
  });

  test('when the API refuses an edit, the reason is shown in the shop’s own words', async () => {
    (api.patch as jest.Mock).mockRejectedValue(new ApiError('This promotion has started, so discount_tiers can no longer change', 409, 'PROMOTION_LOCKED'));
    renderAdmin();
    await openTab('Rules');
    const section = within(await screen.findByRole('region', { name: 'Promotions' }));
    userEvent.click(await section.findByRole('button', { name: 'Edit ลดรับหน้าฝน' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'ลดรับหน้าฝน' }));
    userEvent.click(dialog.getByRole('button', { name: 'Save promotion' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'This promotion has started: only its names, end date and on/off can change. Reload to see what is saved.'
    );
  });

  test('a Promotion Customers have used cannot be deleted', async () => {
    (api.delete as jest.Mock).mockRejectedValue(new ApiError('Customers have used this promotion, so it can only be ended or turned off', 409, 'PROMOTION_IN_USE'));
    renderAdmin();
    await openTab('Rules');
    const section = within(await screen.findByRole('region', { name: 'Promotions' }));
    userEvent.click(await section.findByRole('button', { name: 'Delete ลดรับหน้าฝน' }));
    userEvent.click(within(await screen.findByRole('dialog', { name: 'Delete ลดรับหน้าฝน?' })).getByRole('button', { name: 'Delete' }));
    expect(await section.findByRole('alert')).toHaveTextContent('can only be ended or turned off');
  });

  test('deleting a Promotion asks first, with focus on keeping it', async () => {
    renderAdmin();
    await openTab('Rules');
    const section = within(await screen.findByRole('region', { name: 'Promotions' }));
    userEvent.click(await section.findByRole('button', { name: 'Delete ลดรับหน้าฝน' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete ลดรับหน้าฝน?' }));
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Keep promotion' })).toHaveFocus());
    userEvent.click(dialog.getByRole('button', { name: 'Keep promotion' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.delete).not.toHaveBeenCalled();
  });
});

describe('Members', () => {
  test('creating a Member sends an invitation with their details and role', async () => {
    (api.post as jest.Mock).mockResolvedValue(member('u9', 'สมชาย'));
    renderAdmin();
    await openTab('Members');
    userEvent.click(await screen.findByRole('button', { name: /New member/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New member' }));
    userEvent.type(dialog.getByLabelText('Full name'), 'สมชาย');
    userEvent.type(dialog.getByLabelText('Email'), 'somchai@example.com');
    userEvent.selectOptions(dialog.getByLabelText('Role'), 'admin');
    userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/customers', { full_name: 'สมชาย', email: 'somchai@example.com', phone: undefined, role: 'admin' })
    );
  });

  test('an email that is already registered is explained in the form', async () => {
    (api.post as jest.Mock).mockRejectedValue(new ApiError('A member with this email already exists', 409, 'EMAIL_TAKEN'));
    renderAdmin();
    await openTab('Members');
    userEvent.click(await screen.findByRole('button', { name: /New member/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New member' }));
    userEvent.type(dialog.getByLabelText('Full name'), 'มาลี');
    userEvent.type(dialog.getByLabelText('Email'), 'u1@example.com');
    userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('A member with this email already exists.');
  });

  test('the pencil edits only the role, and never on your own row', async () => {
    (api.patch as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' });
    renderAdmin();
    await openTab('Members');
    await screen.findByText('มาลี');
    expect(screen.queryByRole('button', { name: 'Edit เจ้าของร้าน' })).not.toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Edit มาลี' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'มาลี' }));
    expect(dialog.getByText('u1@example.com')).toBeInTheDocument();
    expect(dialog.queryAllByRole('textbox')).toHaveLength(0);
    userEvent.selectOptions(dialog.getByLabelText('Role'), 'admin');
    userEvent.click(dialog.getByRole('button', { name: 'Save role' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/customers/u1/role', { role: 'admin' }));
  });

  test('removing a Member with orders deactivates them, one without orders deletes them, never yourself', async () => {
    backend({
      '/admin/customers': {
        customers: [member('a1', 'เจ้าของร้าน', 'admin'), { ...member('u1', 'มาลี'), orders: 2 }, member('u2', 'สมชาย')],
        total: 3, page: 1, limit: 10,
      },
    });
    (api.delete as jest.Mock).mockResolvedValue({ result: 'deactivated' });
    renderAdmin();
    await openTab('Members');
    await screen.findByText('มาลี');
    expect(screen.queryByRole('button', { name: 'Remove เจ้าของร้าน' })).not.toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Remove มาลี' }));
    let dialog = within(await screen.findByRole('dialog', { name: 'Remove มาลี?' }));
    expect(dialog.getByText(/has 2 orders/)).toBeInTheDocument();
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Keep member' })).toHaveFocus());
    userEvent.click(dialog.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/admin/customers/u1'));

    userEvent.click(await screen.findByRole('button', { name: 'Remove สมชาย' }));
    dialog = within(await screen.findByRole('dialog', { name: 'Remove สมชาย?' }));
    userEvent.click(dialog.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/admin/customers/u2'));
  });

  test('a Deactivated Member is marked and cannot be removed again', async () => {
    backend({
      '/admin/customers': {
        customers: [member('a1', 'เจ้าของร้าน', 'admin'), { ...member('u1', 'มาลี'), orders: 2, deactivated_at: '2026-10-05T00:00:00Z' }],
        total: 2, page: 1, limit: 10,
      },
    });
    renderAdmin();
    await openTab('Members');
    const row = await screen.findByRole('row', { name: /มาลี/ });
    expect(within(row).getByText('Deactivated')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Remove มาลี' })).not.toBeInTheDocument();
  });

  test('a new search starts again at page 1', async () => {
    backend({ '/admin/customers': { customers: [member('u1', 'มาลี')], total: 25, page: 1, limit: 10 } });
    renderAdmin();
    await openTab('Members');
    await screen.findByText('มาลี');
    userEvent.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(getCalls('/admin/customers').at(-1)).toContain('page=2'));
    userEvent.type(screen.getByLabelText('Search members'), 'มา');
    await waitFor(() => expect(getCalls('/admin/customers').at(-1)).toMatch(/^(?=.*page=1&)(?=.*search=)/));
  });

  test('the list shows 10 per page', async () => {
    renderAdmin();
    await openTab('Members');
    await screen.findByText('มาลี');
    expect(getCalls('/admin/customers').at(-1)).toContain('limit=10');
    expect(screen.getByText(/items/)).toHaveTextContent('Page 1 of 1 · 2 items');
  });
});

describe('in Thai', () => {
  test('the admin pages read in Thai: tabs, cards, tables and buttons', async () => {
    renderApp('/admin');
    for (const name of ['ภาพรวม', 'คำสั่งซื้อ', 'สินค้าและสต็อก', 'สมาชิก', 'กฎ', 'การชำระเงินและ LINE']) {
      expect(await screen.findByRole('tab', { name })).toBeInTheDocument();
    }
    expect(await screen.findByRole('button', { name: /รายได้ · คำสั่งซื้อที่ได้รับสินค้าแล้ว/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'คำสั่งซื้อตามสถานะ' })).toBeInTheDocument();

    userEvent.click(screen.getByRole('tab', { name: 'คำสั่งซื้อ' }));
    expect(await screen.findByRole('columnheader', { name: 'โน้ต' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'สถานะ' })).toBeInTheDocument();

    userEvent.click(screen.getByRole('tab', { name: 'สินค้าและสต็อก' }));
    expect(await screen.findByRole('button', { name: /เพิ่มสินค้า/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'คงคลัง' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'พร้อมขาย' })).toBeInTheDocument();

    userEvent.click(screen.getByRole('tab', { name: 'สมาชิก' }));
    expect(await screen.findByRole('button', { name: /เพิ่มสมาชิก/ })).toBeInTheDocument();

    userEvent.click(screen.getByRole('tab', { name: 'กฎ' }));
    expect(await screen.findByRole('region', { name: 'กฎค่าจัดส่ง' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'โปรโมชัน' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /สร้างโปรโมชัน/ })).toBeInTheDocument();
  });
});

describe('countdowns on the orders list', () => {
  const NOW = new Date('2026-10-11T10:00:00Z');
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

  test('an Awaiting Payment order counts down to its payment deadline, ticking each second in the last hour', async () => {
    // Half a minute of slack: finding the row lets a little fake time pass
    const due = at(61 * 60_000 + 30_000);
    const unpaid = anOrder({ status: 'awaiting_payment', paid_at: null, expires_at: due, deadline: { kind: 'payment', at: due } });
    backend({ '/orders/admin/all': { orders: [unpaid], total: 1, page: 1, limit: 10 } });
    renderAdmin();
    await openTab('Orders');
    const row = await screen.findByRole('row', { name: /STB-261010-00007/ });
    const countdown = within(row).getByText(/Payment due in/);
    expect(countdown).toHaveTextContent('Payment due in 1h 1m');
    expect(countdown).not.toHaveAttribute('data-warning');

    act(() => {
      jest.advanceTimersByTime(2 * 60_000);
    });
    const lastHour = within(row).getByText(/Payment due in/);
    expect(lastHour).toHaveTextContent(/^Payment due in 59:\d\d$/);
    expect(lastHour).toHaveAttribute('data-warning', 'true');

    // In the last hour it ticks every second
    const before = lastHour.textContent;
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(within(row).getByText(/Payment due in/).textContent).not.toBe(before);

  });

  test('a countdown that runs out reads Processing, never a negative time', async () => {
    const due = at(30_000);
    const unpaid = anOrder({ status: 'awaiting_payment', paid_at: null, expires_at: due, deadline: { kind: 'payment', at: due } });
    backend({ '/orders/admin/all': { orders: [unpaid], total: 1, page: 1, limit: 10 } });
    renderAdmin();
    await openTab('Orders');
    const row = await screen.findByRole('row', { name: /STB-261010-00007/ });
    expect(within(row).getByText(/Payment due in 00:\d\d/)).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(within(row).queryByText(/Payment due in/)).not.toBeInTheDocument();
    expect(within(row).getByText('Processing')).toBeInTheDocument();
  });

  test('a Shipping order counts down to its automatic Confirmed time and warns in the last day', async () => {
    const shipped = anOrder({ status: 'shipping', shipped_at: '2026-10-05T10:00:00Z', deadline: { kind: 'auto_confirm', at: at(2 * 86_400_000 + 3 * 3_600_000 + 30 * 60_000) } });
    const soon = anOrder({ id: 'o2', order_number: 'STB-261010-00008', status: 'shipping', deadline: { kind: 'auto_confirm', at: at(20 * 3_600_000 + 30 * 60_000) } });
    const noClock = anOrder({ id: 'o3', order_number: 'STB-261010-00009' });
    backend({ '/orders/admin/all': { orders: [shipped, soon, noClock], total: 3, page: 1, limit: 10 } });
    renderAdmin();
    await openTab('Orders');
    const first = await screen.findByRole('row', { name: /STB-261010-00007/ });
    expect(within(first).getByText(/Auto-confirms in/)).toHaveTextContent('Auto-confirms in 2d 3h');
    expect(within(first).getByText(/Auto-confirms in/)).not.toHaveAttribute('data-warning');
    const second = screen.getByRole('row', { name: /STB-261010-00008/ });
    expect(within(second).getByText(/Auto-confirms in/)).toHaveTextContent('Auto-confirms in 20h 29m');
    expect(within(second).getByText(/Auto-confirms in/)).toHaveAttribute('data-warning', 'true');
    expect(within(screen.getByRole('row', { name: /STB-261010-00009/ })).queryByText(/in \d/)).not.toBeInTheDocument();
  });

  test('the countdown reads in Thai', async () => {
    const unpaid = anOrder({ status: 'awaiting_payment', deadline: { kind: 'payment', at: at(2 * 3_600_000 + 30_000) } });
    backend({ '/orders/admin/all': { orders: [unpaid], total: 1, page: 1, limit: 10 } });
    renderApp('/admin');
    userEvent.click(await screen.findByRole('tab', { name: 'คำสั่งซื้อ' }));
    expect(await screen.findByText('หมดเวลาชำระใน 2 ชม. 0 นาที')).toBeInTheDocument();
  });
});

describe('Categories', () => {
  const catalogue = () => ({
    categories: [
      { slug: 'beetle', name_th: 'ด้วง', name_en: 'Beetles', sort_order: 1, is_system: true },
      { slug: 'food', name_th: 'อาหาร', name_en: 'Food', sort_order: 2, is_system: false },
    ],
    families: [{ id: 'fa1', name: 'Rhinoceros', sort_order: 1 }],
  });
  const openCategories = async () => {
    backend({ '/categories': catalogue() });
    renderAdmin();
    await openTab('Categories');
    return within(await screen.findByRole('region', { name: 'Product Categories' }));
  };

  test('lists Categories with their slug; the beetle Category is marked System and has no delete button', async () => {
    const section = await openCategories();
    const beetle = await section.findByRole('row', { name: /ด้วง.*Beetles/ });
    expect(within(beetle).getByText('System')).toBeInTheDocument();
    expect(within(beetle).queryByRole('button', { name: 'Delete ด้วง' })).not.toBeInTheDocument();
    expect(within(beetle).getByRole('button', { name: 'Edit ด้วง' })).toBeInTheDocument();
    const food = section.getByRole('row', { name: /อาหาร.*Food/ });
    expect(within(food).getByText('food')).toBeInTheDocument();
    expect(within(food).getByRole('button', { name: 'Delete อาหาร' })).toBeInTheDocument();
  });

  test('adding a Category needs both names, sends them and reloads the list', async () => {
    (api.post as jest.Mock).mockResolvedValue({ slug: 'tools' });
    const Swal = jest.requireMock('sweetalert2').default;
    fillSwalForm([{ 'stb-cat-th': 'เครื่องมือ', 'stb-cat-en': '' }, { 'stb-cat-th': 'เครื่องมือ', 'stb-cat-en': 'Tools' }]);
    const section = await openCategories();
    await section.findByRole('row', { name: /อาหาร/ });
    const before = getCalls('/categories').length;
    userEvent.click(section.getByRole('button', { name: 'Add Category' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/categories', { name_th: 'เครื่องมือ', name_en: 'Tools' }));
    expect(Swal.showValidationMessage).toHaveBeenCalledWith('Enter both a Thai and an English name');
    await waitFor(() => expect(getCalls('/categories').length).toBeGreaterThan(before));
  });

  test('renaming keeps the slug: the new names go to that Category', async () => {
    (api.patch as jest.Mock).mockResolvedValue({});
    const seen: { opts?: any } = {};
    fillSwalForm([{ 'stb-cat-th': 'อาหารด้วง', 'stb-cat-en': 'Beetle food' }], seen);
    const section = await openCategories();
    userEvent.click(await section.findByRole('button', { name: 'Edit อาหาร' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/categories/food', { name_th: 'อาหารด้วง', name_en: 'Beetle food' }));
    expect(seen.opts.html).toContain('value="อาหาร"');
  });

  test('moving a Category down sends the new order', async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    const section = await openCategories();
    userEvent.click(await section.findByRole('button', { name: 'Move ด้วง down' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/categories/reorder', { slugs: ['food', 'beetle'] }));
    expect(section.getByRole('button', { name: 'Move ด้วง up' })).toBeDisabled();
  });

  test('deleting a Category that still has products is refused with how many', async () => {
    (api.delete as jest.Mock).mockRejectedValue(new ApiError('2 product(s) are still in this Category', 409, 'CATEGORY_IN_USE', { count: 2 }));
    const Swal = jest.requireMock('sweetalert2').default;
    Swal.fire.mockResolvedValueOnce({ isConfirmed: true });
    const section = await openCategories();
    userEvent.click(await section.findByRole('button', { name: 'Delete อาหาร' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/categories/food'));
    await waitFor(() =>
      expect(Swal.fire).toHaveBeenLastCalledWith(expect.any(String), 'Products still in this Category: 2. Move them to another Category first', 'error')
    );
  });

  test('Families: add, rename (which renames the beetles too) and a refused delete', async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    (api.patch as jest.Mock).mockResolvedValue({});
    (api.delete as jest.Mock).mockRejectedValue(new ApiError('1 beetle(s) still have this Family', 409, 'FAMILY_IN_USE', { count: 1 }));
    const Swal = jest.requireMock('sweetalert2').default;
    await openCategories();
    const families = within(screen.getByRole('region', { name: 'Beetle Families' }));
    await families.findByRole('row', { name: /Rhinoceros/ });

    Swal.fire.mockResolvedValueOnce({ isConfirmed: true, value: '  Stag ' });
    userEvent.click(families.getByRole('button', { name: 'Add Family' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/categories/families', { name: 'Stag' }));

    Swal.fire.mockResolvedValueOnce({ isConfirmed: true, value: 'Rhino' });
    userEvent.click(families.getByRole('button', { name: 'Edit Rhinoceros' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/categories/families/fa1', { name: 'Rhino' }));
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ text: 'Every beetle in this Family is renamed too', inputValue: 'Rhinoceros' }));

    Swal.fire.mockResolvedValueOnce({ isConfirmed: true });
    userEvent.click(families.getByRole('button', { name: 'Delete Rhinoceros' }));
    await waitFor(() =>
      expect(Swal.fire).toHaveBeenLastCalledWith(expect.any(String), 'Beetles still in this Family: 1. Change their Family first', 'error')
    );
  });
});
